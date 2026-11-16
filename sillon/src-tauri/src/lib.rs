mod analysis;
mod db;
mod decode;
mod dsp;
mod engine;
mod media;
mod online;
mod scan;
mod tags;

use db::Db;
use engine::{Cmd, Engine};
use rusqlite::params;
use scan::{CoverCache, ScanState, Watcher};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

struct Ctx {
    db: Arc<Db>,
    covers: Arc<CoverCache>,
    scan: Arc<ScanState>,
    watcher: Watcher,
    engine: Engine,
}

type R<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ------------------------------------------------------------------ bibliothèque

#[derive(Serialize)]
struct Library {
    tracks: Vec<db::Track>,
    covers: HashMap<String, [String; 3]>,
    covers_dir: String,
}

#[tauri::command]
async fn get_library(ctx: State<'_, Ctx>) -> R<Library> {
    let conn = ctx.db.connect().map_err(err)?;
    Ok(Library {
        tracks: db::all_tracks(&conn).map_err(err)?,
        covers: db::all_covers(&conn).map_err(err)?,
        covers_dir: ctx.covers.dir.to_string_lossy().to_string(),
    })
}

#[derive(Serialize)]
struct Folder {
    id: i64,
    path: String,
    tracks: i64,
}

#[tauri::command]
fn get_folders(ctx: State<Ctx>) -> R<Vec<Folder>> {
    let conn = ctx.db.conn.lock();
    let mut st = conn
        .prepare("SELECT f.id, f.path, (SELECT COUNT(*) FROM tracks t WHERE t.folder_id = f.id) FROM folders f ORDER BY f.path")
        .map_err(err)?;
    let rows = st.query_map([], |r| Ok(Folder { id: r.get(0)?, path: r.get(1)?, tracks: r.get(2)? })).map_err(err)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
}

fn rescan_now(app: &AppHandle, ctx: &Ctx) {
    ctx.watcher.restart(app, &ctx.db, &ctx.scan, &ctx.covers);
    scan::request_scan(app, &ctx.db, &ctx.scan, &ctx.covers);
}

#[tauri::command]
fn add_folder(app: AppHandle, ctx: State<Ctx>, path: String) -> R<()> {
    if !std::path::Path::new(&path).is_dir() {
        return Err("Ce dossier n'existe pas.".into());
    }
    ctx.db.conn.lock().execute("INSERT OR IGNORE INTO folders(path) VALUES(?1)", [&path]).map_err(err)?;
    rescan_now(&app, &ctx);
    Ok(())
}

#[tauri::command]
fn remove_folder(app: AppHandle, ctx: State<Ctx>, id: i64) -> R<()> {
    ctx.db.conn.lock().execute("DELETE FROM folders WHERE id = ?1", [id]).map_err(err)?;
    rescan_now(&app, &ctx);
    Ok(())
}

#[tauri::command]
fn rescan(app: AppHandle, ctx: State<Ctx>) {
    scan::request_scan(&app, &ctx.db, &ctx.scan, &ctx.covers);
}

#[tauri::command]
fn get_lyrics(ctx: State<Ctx>, id: i64) -> R<Option<String>> {
    let conn = ctx.db.conn.lock();
    conn.query_row("SELECT lyrics FROM tracks WHERE id = ?1", [id], |r| r.get(0)).map_err(err)
}

#[tauri::command]
async fn search_lyrics(ctx: State<'_, Ctx>, query: String) -> R<Vec<i64>> {
    let q = query.trim().to_lowercase();
    if q.chars().count() < 3 {
        return Ok(Vec::new());
    }
    let conn = ctx.db.connect().map_err(err)?;
    let like = format!("%{}%", q.replace('%', "").replace('_', " "));
    let mut st = conn.prepare("SELECT id FROM tracks WHERE has_lyrics = 1 AND lower(lyrics) LIKE ?1 LIMIT 60").map_err(err)?;
    let rows = st.query_map([like], |r| r.get(0)).map_err(err)?;
    rows.collect::<rusqlite::Result<Vec<i64>>>().map_err(err)
}

#[tauri::command]
fn set_rating(ctx: State<Ctx>, id: i64, rating: i64) -> R<()> {
    ctx.db.conn.lock().execute("UPDATE tracks SET rating = ?1 WHERE id = ?2", params![rating.clamp(0, 5), id]).map_err(err)?;
    Ok(())
}

#[tauri::command]
fn set_loved(ctx: State<Ctx>, id: i64, loved: bool) -> R<()> {
    ctx.db.conn.lock().execute("UPDATE tracks SET loved = ?1 WHERE id = ?2", params![loved as i64, id]).map_err(err)?;
    Ok(())
}

#[tauri::command]
fn record_play(ctx: State<Ctx>, id: i64, started_at: i64, ms_played: i64, counted: bool, skipped: bool) -> R<()> {
    let conn = ctx.db.conn.lock();
    if ms_played >= 5000 {
        conn.execute("INSERT INTO plays(track_id, started_at, ms_played) VALUES(?1, ?2, ?3)", params![id, started_at, ms_played])
            .map_err(err)?;
    }
    if counted {
        conn.execute("UPDATE tracks SET play_count = play_count + 1, last_played = ?1 WHERE id = ?2", params![db::now(), id])
            .map_err(err)?;
    } else if skipped {
        conn.execute("UPDATE tracks SET skip_count = skip_count + 1 WHERE id = ?1", [id]).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
async fn get_stats(ctx: State<'_, Ctx>, from: i64, to: i64) -> R<db::Stats> {
    let conn = ctx.db.connect().map_err(err)?;
    db::stats(&conn, from, to).map_err(err)
}

#[tauri::command]
async fn write_tags(app: AppHandle, ctx: State<'_, Ctx>, ids: Vec<i64>, patch: tags::TagPatch) -> R<Vec<String>> {
    let mut errors = Vec::new();
    for id in ids {
        let path: String = {
            let conn = ctx.db.conn.lock();
            conn.query_row("SELECT path FROM tracks WHERE id = ?1", [id], |r| r.get(0)).map_err(err)?
        };
        match tags::write(std::path::Path::new(&path), &patch) {
            Ok(()) => {
                if let Err(e) = scan::rescan_file(&ctx.db, &ctx.covers, id) {
                    errors.push(format!("{path} : {e}"));
                }
            }
            Err(e) => errors.push(format!("{path} : {e}")),
        }
    }
    let _ = app.emit("library:changed", ());
    Ok(errors)
}

#[tauri::command]
fn online_complete(app: AppHandle, ctx: State<Ctx>) {
    online::complete(app, ctx.db.clone(), ctx.covers.clone());
}

// ---------------------------------------------------------------------- playlists

#[derive(Serialize)]
struct Playlist {
    id: i64,
    name: String,
    kind: String,
    rules: Option<Value>,
    created_at: i64,
    updated_at: i64,
    track_ids: Vec<i64>,
}

#[tauri::command]
fn get_playlists(ctx: State<Ctx>) -> R<Vec<Playlist>> {
    let conn = ctx.db.conn.lock();
    let mut st = conn.prepare("SELECT id, name, kind, rules, created_at, updated_at FROM playlists ORDER BY name COLLATE NOCASE").map_err(err)?;
    let mut lists: Vec<Playlist> = st
        .query_map([], |r| {
            Ok(Playlist {
                id: r.get(0)?,
                name: r.get(1)?,
                kind: r.get(2)?,
                rules: r.get::<_, Option<String>>(3)?.and_then(|s| serde_json::from_str(&s).ok()),
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
                track_ids: Vec::new(),
            })
        })
        .map_err(err)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(err)?;
    let mut st = conn.prepare("SELECT track_id FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position").map_err(err)?;
    for p in lists.iter_mut() {
        p.track_ids = st.query_map([p.id], |r| r.get(0)).map_err(err)?.collect::<rusqlite::Result<Vec<i64>>>().map_err(err)?;
    }
    Ok(lists)
}

#[tauri::command]
fn save_playlist(ctx: State<Ctx>, id: Option<i64>, name: String, kind: String, rules: Option<Value>) -> R<i64> {
    let conn = ctx.db.conn.lock();
    let rules = rules.map(|v| v.to_string());
    let now = db::now();
    match id {
        Some(id) => {
            conn.execute("UPDATE playlists SET name = ?1, rules = ?2, updated_at = ?3 WHERE id = ?4", params![name, rules, now, id])
                .map_err(err)?;
            Ok(id)
        }
        None => {
            conn.execute(
                "INSERT INTO playlists(name, kind, rules, created_at, updated_at) VALUES(?1, ?2, ?3, ?4, ?4)",
                params![name, kind, rules, now],
            )
            .map_err(err)?;
            Ok(conn.last_insert_rowid())
        }
    }
}

#[tauri::command]
fn delete_playlist(ctx: State<Ctx>, id: i64) -> R<()> {
    let conn = ctx.db.conn.lock();
    conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1", [id]).map_err(err)?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", [id]).map_err(err)?;
    Ok(())
}

#[tauri::command]
fn set_playlist_tracks(ctx: State<Ctx>, id: i64, ids: Vec<i64>) -> R<()> {
    let mut conn = ctx.db.conn.lock();
    let tx = conn.transaction().map_err(err)?;
    tx.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1", [id]).map_err(err)?;
    for (i, tid) in ids.iter().enumerate() {
        tx.execute("INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?1, ?2, ?3)", params![id, tid, i as i64])
            .map_err(err)?;
    }
    tx.execute("UPDATE playlists SET updated_at = ?1 WHERE id = ?2", params![db::now(), id]).map_err(err)?;
    tx.commit().map_err(err)?;
    Ok(())
}

// ------------------------------------------------------------------------ réglages

#[tauri::command]
fn get_settings(ctx: State<Ctx>) -> R<HashMap<String, Value>> {
    let conn = ctx.db.conn.lock();
    let mut st = conn.prepare("SELECT key, value FROM settings").map_err(err)?;
    let rows = st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map_err(err)?;
    let mut map = HashMap::new();
    for row in rows {
        let (k, v) = row.map_err(err)?;
        if let Ok(v) = serde_json::from_str(&v) {
            map.insert(k, v);
        }
    }
    Ok(map)
}

#[tauri::command]
fn set_setting(ctx: State<Ctx>, key: String, value: Value) -> R<()> {
    db::set_setting(&ctx.db.conn.lock(), &key, &value).map_err(err)?;
    if key == "analysis" {
        analysis::wake();
    }
    Ok(())
}

// -------------------------------------------------------------------------- lecteur

#[tauri::command]
fn player_load(ctx: State<Ctx>, item: decode::PlayItem, position_ms: u64, autoplay: bool) {
    ctx.engine.send(Cmd::Load { item, position_ms, autoplay });
}

#[tauri::command]
fn player_set_next(ctx: State<Ctx>, item: Option<decode::PlayItem>) {
    ctx.engine.send(Cmd::SetNext(item));
}

#[tauri::command]
fn player_command(ctx: State<Ctx>, action: String, value: Option<f64>) {
    let v = value.unwrap_or(0.0);
    let cmd = match action.as_str() {
        "play" => Cmd::Play,
        "pause" => Cmd::Pause,
        "toggle" => Cmd::Toggle,
        "stop" => Cmd::Stop,
        "seek" => Cmd::Seek(v.max(0.0) as u64),
        "volume" => Cmd::Volume(v as f32),
        "visualizer" => Cmd::Visualizer(v > 0.5),
        _ => return,
    };
    ctx.engine.send(cmd);
}

#[tauri::command]
fn player_set_dsp(ctx: State<Ctx>, config: dsp::DspConfig) {
    ctx.engine.send(Cmd::Dsp(config));
}

#[tauri::command]
fn player_set_options(ctx: State<Ctx>, options: engine::Options) {
    ctx.engine.send(Cmd::Options(options));
}

#[tauri::command]
fn player_sleep(ctx: State<Ctx>, seconds: Option<u64>, end_of_track: bool) {
    ctx.engine.send(Cmd::Sleep { seconds, end_of_track });
}

#[tauri::command]
async fn player_devices() -> Vec<String> {
    engine::devices()
}

#[tauri::command]
fn media_update(app: AppHandle, info: media::MediaInfo) {
    media::update(&app, info);
}

// ------------------------------------------------------------------------- fenêtres

#[tauri::command]
async fn open_mini(app: AppHandle) -> R<()> {
    if let Some(w) = app.get_webview_window("mini") {
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "mini", WebviewUrl::App("index.html#mini".into()))
        .title("Sillon")
        .inner_size(380.0, 116.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(true)
        .build()
        .map_err(err)?;
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.minimize();
    }
    Ok(())
}

#[tauri::command]
async fn close_mini(app: AppHandle) -> R<()> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(w) = app.get_webview_window("mini") {
        let _ = w.close();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Premier lancement : le dossier Musique du système est ajouté d'office,
/// pour que la bibliothèque ne soit pas vide. Une seule fois (on peut le retirer ensuite).
fn first_run(app: &tauri::App, db: &Db) {
    let conn = db.conn.lock();
    if db::get_setting(&conn, "first_run_done").is_some() {
        return;
    }
    let empty = conn.query_row("SELECT COUNT(*) FROM folders", [], |r| r.get::<_, i64>(0)).unwrap_or(0) == 0;
    if empty {
        if let Ok(music) = app.path().audio_dir() {
            if music.is_dir() {
                let _ = conn.execute("INSERT OR IGNORE INTO folders(path) VALUES(?1)", [music.to_string_lossy().to_string()]);
            }
        }
    }
    let _ = db::set_setting(&conn, "first_run_done", &serde_json::Value::Bool(true));
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().with_denylist(&["mini"]).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = Arc::new(Db::open(&dir.join("sillon.db"))?);
            first_run(app, &db);
            let covers = Arc::new(CoverCache::new(dir.join("covers")));
            let scan_state = Arc::new(ScanState::default());
            let watcher = Watcher::new();
            let engine = engine::spawn(handle.clone());
            analysis::spawn(handle.clone(), db.clone());
            watcher.restart(&handle, &db, &scan_state, &covers);
            scan::request_scan(&handle, &db, &scan_state, &covers);
            media::init(&handle);
            app.manage(Ctx { db, covers, scan: scan_state, watcher, engine });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fermer la fenêtre principale ferme aussi le mini-lecteur (et donc l'application).
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    if let Some(mini) = window.app_handle().get_webview_window("mini") {
                        let _ = mini.close();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_library,
            get_folders,
            add_folder,
            remove_folder,
            rescan,
            get_lyrics,
            search_lyrics,
            set_rating,
            set_loved,
            record_play,
            get_stats,
            write_tags,
            online_complete,
            get_playlists,
            save_playlist,
            delete_playlist,
            set_playlist_tracks,
            get_settings,
            set_setting,
            player_load,
            player_set_next,
            player_command,
            player_set_dsp,
            player_set_options,
            player_sleep,
            player_devices,
            media_update,
            open_mini,
            close_mini
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Sillon");
}
