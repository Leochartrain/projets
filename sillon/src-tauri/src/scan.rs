//! Scan récursif des dossiers, lecture des tags, cache des pochettes, surveillance.

use crate::db::{self, Db};
use anyhow::Result;
use lofty::file::{AudioFile, FileType, TaggedFileExt};
use lofty::tag::{Accessor, ItemKey, Tag};
use parking_lot::Mutex;
use rayon::prelude::*;
use rusqlite::params;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter};

pub const AUDIO_EXT: &[&str] = &["flac", "m4a", "mp4", "wav", "wave", "aif", "aiff", "mp3", "aac", "ogg", "oga", "opus"];
pub const COVER_SIZES: &[u32] = &[96, 320, 1000];
const COVER_NAMES: &[&str] = &["cover", "folder", "front", "album", "albumart"];
const COVER_EXT: &[&str] = &["jpg", "jpeg", "png", "webp"];

#[derive(Default)]
pub struct ScanState {
    running: AtomicBool,
    again: AtomicBool,
}

#[derive(Serialize, Clone)]
pub struct Progress {
    pub phase: &'static str,
    pub done: usize,
    pub total: usize,
}

pub struct Parsed {
    pub path: String,
    pub folder_id: i64,
    pub size: i64,
    pub mtime: i64,
    pub title: String,
    pub artist: String,
    pub album_artist: String,
    pub album: String,
    pub year: Option<i64>,
    pub genre: String,
    pub track_no: Option<i64>,
    pub disc_no: Option<i64>,
    pub composer: String,
    pub duration_ms: i64,
    pub format: String,
    pub sample_rate: i64,
    pub bit_depth: i64,
    pub bitrate: i64,
    pub channels: i64,
    pub cover: Option<String>,
    pub lyrics: Option<String>,
    pub rg_track: Option<f64>,
    pub rg_album: Option<f64>,
    pub peak: Option<f64>,
}

fn is_audio(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXT.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn text(tag: Option<&Tag>, key: ItemKey) -> String {
    tag.and_then(|t| t.get_string(key)).map(|s| s.trim().to_string()).unwrap_or_default()
}

fn parse_db(s: &str) -> Option<f64> {
    let s = s.trim().trim_end_matches("dB").trim_end_matches("db").trim();
    s.parse::<f64>().ok()
}

fn parse_year(s: &str) -> Option<i64> {
    let digits: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 4 {
        digits[..4].parse::<i64>().ok().filter(|y| *y > 1000)
    } else {
        None
    }
}

fn fnv(data: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in (data.len() as u64).to_le_bytes().iter().chain(data.iter().take(512 * 1024)) {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn hex(c: [f32; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0] as u8, c[1] as u8, c[2] as u8)
}

/// Trois teintes tirées de la pochette : dominante vive, secondaire, moyenne.
fn palette(img: &image::RgbImage) -> [String; 3] {
    let mut buckets: HashMap<u16, (f32, [f32; 3], f32)> = HashMap::new();
    let mut avg = [0f32; 3];
    let mut n = 0f32;
    for p in img.pixels() {
        let [r, g, b] = p.0;
        let (rf, gf, bf) = (r as f32, g as f32, b as f32);
        avg[0] += rf;
        avg[1] += gf;
        avg[2] += bf;
        n += 1.0;
        let max = rf.max(gf).max(bf);
        let min = rf.min(gf).min(bf);
        let sat = if max > 0.0 { (max - min) / max } else { 0.0 };
        let lum = (0.299 * rf + 0.587 * gf + 0.114 * bf) / 255.0;
        // On écarte le quasi-noir et le quasi-blanc, peu utiles comme teinte d'ambiance.
        let w = (0.15 + sat * sat) * if !(0.12..=0.92).contains(&lum) { 0.1 } else { 1.0 };
        let key = ((r as u16 >> 4) << 8) | ((g as u16 >> 4) << 4) | (b as u16 >> 4);
        let e = buckets.entry(key).or_insert((0.0, [0.0; 3], 0.0));
        e.0 += w;
        e.1[0] += rf;
        e.1[1] += gf;
        e.1[2] += bf;
        e.2 += 1.0;
    }
    let n = n.max(1.0);
    let avg = [avg[0] / n, avg[1] / n, avg[2] / n];
    let mut list: Vec<(f32, [f32; 3])> = buckets
        .values()
        .map(|(w, sum, c)| (*w, [sum[0] / c, sum[1] / c, sum[2] / c]))
        .collect();
    list.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let c1 = list.first().map(|x| x.1).unwrap_or(avg);
    let dist = |a: [f32; 3], b: [f32; 3]| ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt();
    let c2 = list.iter().map(|x| x.1).find(|c| dist(*c, c1) > 70.0).unwrap_or(avg);
    [hex(c1), hex(c2), hex(avg)]
}

pub struct CoverCache {
    pub dir: PathBuf,
    done: Mutex<HashSet<String>>,
    pub new_rows: Mutex<Vec<(String, [String; 3])>>,
}

impl CoverCache {
    pub fn new(dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        CoverCache { dir, done: Mutex::new(HashSet::new()), new_rows: Mutex::new(Vec::new()) }
    }

    /// Enregistre l'image en plusieurs tailles (une seule fois par image) et renvoie sa clé.
    pub fn store(&self, data: &[u8]) -> Option<String> {
        if data.len() < 64 {
            return None;
        }
        let key = format!("{:016x}", fnv(data));
        if !self.done.lock().insert(key.clone()) {
            return Some(key);
        }
        let small = self.dir.join(format!("{key}_{}.jpg", COVER_SIZES[0]));
        if small.exists() {
            return Some(key);
        }
        let img = match image::load_from_memory(data) {
            Ok(i) => i,
            Err(_) => {
                return None;
            }
        };
        // De la plus grande à la plus petite : chaque taille part de la précédente.
        let mut cur = img;
        for size in COVER_SIZES.iter().rev() {
            if cur.width() > *size || cur.height() > *size {
                cur = cur.resize(*size, *size, image::imageops::FilterType::CatmullRom);
            }
            let rgb = cur.to_rgb8();
            let path = self.dir.join(format!("{key}_{size}.jpg"));
            if let Ok(file) = std::fs::File::create(&path) {
                let mut w = std::io::BufWriter::new(file);
                let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut w, 88);
                let _ = rgb.write_with_encoder(enc);
            }
            if *size == COVER_SIZES[0] {
                self.new_rows.lock().push((key.clone(), palette(&rgb)));
            }
        }
        Some(key)
    }
}

fn folder_cover(dir: &Path) -> Option<Vec<u8>> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut best: Option<(usize, PathBuf)> = None;
    for e in entries.flatten() {
        let p = e.path();
        let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
        if !COVER_EXT.contains(&ext.as_str()) {
            continue;
        }
        let stem = p.file_stem().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
        if let Some(rank) = COVER_NAMES.iter().position(|n| *n == stem) {
            if best.as_ref().map(|b| rank < b.0).unwrap_or(true) {
                best = Some((rank, p));
            }
        }
    }
    std::fs::read(best?.1).ok()
}

pub fn parse_file(path: &Path, folder_id: i64, size: i64, mtime: i64, covers: &CoverCache) -> Parsed {
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Sans titre").to_string();
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    let mut p = Parsed {
        path: path.to_string_lossy().to_string(),
        folder_id,
        size,
        mtime,
        title: stem.clone(),
        artist: String::new(),
        album_artist: String::new(),
        album: String::new(),
        year: None,
        genre: String::new(),
        track_no: None,
        disc_no: None,
        composer: String::new(),
        duration_ms: 0,
        format: ext.to_ascii_uppercase(),
        sample_rate: 0,
        bit_depth: 0,
        bitrate: 0,
        channels: 2,
        cover: None,
        lyrics: None,
        rg_track: None,
        rg_album: None,
        peak: None,
    };
    let mut picture: Option<Vec<u8>> = None;

    if let Ok(tf) = lofty::read_from_path(path) {
        let props = tf.properties();
        p.duration_ms = props.duration().as_millis() as i64;
        p.sample_rate = props.sample_rate().unwrap_or(0) as i64;
        p.bit_depth = props.bit_depth().unwrap_or(0) as i64;
        p.bitrate = props.audio_bitrate().or(props.overall_bitrate()).unwrap_or(0) as i64;
        p.channels = props.channels().unwrap_or(2) as i64;
        p.format = match tf.file_type() {
            FileType::Flac => "FLAC".into(),
            FileType::Mpeg => "MP3".into(),
            FileType::Wav => "WAV".into(),
            FileType::Aiff => "AIFF".into(),
            FileType::Vorbis => "OGG".into(),
            FileType::Opus => "Opus".into(),
            FileType::Aac => "AAC".into(),
            FileType::Mp4 => if p.bit_depth > 0 { "ALAC".into() } else { "AAC".into() },
            _ => ext.to_ascii_uppercase(),
        };
        let tag = tf.primary_tag().or_else(|| tf.first_tag());
        if let Some(t) = tag {
            if let Some(v) = t.title() {
                if !v.trim().is_empty() {
                    p.title = v.trim().to_string();
                }
            }
            p.artist = t.artist().map(|v| v.trim().to_string()).unwrap_or_default();
            p.album = t.album().map(|v| v.trim().to_string()).unwrap_or_default();
            p.genre = t.genre().map(|v| v.trim().to_string()).unwrap_or_default();
            p.track_no = t.track().map(|v| v as i64);
            p.disc_no = t.disk().map(|v| v as i64);
        }
        p.album_artist = text(tag, ItemKey::AlbumArtist);
        p.composer = text(tag, ItemKey::Composer);
        p.year = [ItemKey::Year, ItemKey::RecordingDate, ItemKey::OriginalReleaseDate]
            .into_iter()
            .find_map(|k| parse_year(&text(tag, k)));
        p.rg_track = parse_db(&text(tag, ItemKey::ReplayGainTrackGain));
        p.rg_album = parse_db(&text(tag, ItemKey::ReplayGainAlbumGain));
        p.peak = text(tag, ItemKey::ReplayGainTrackPeak).parse::<f64>().ok();
        let lyr = text(tag, ItemKey::Lyrics);
        if !lyr.is_empty() {
            p.lyrics = Some(lyr);
        }
        // Pochette intégrée : la « front » d'abord, sinon la première image trouvée.
        for t in tf.tags() {
            let pics = t.pictures();
            let front = pics.iter().find(|x| x.pic_type() == lofty::picture::PictureType::CoverFront);
            if let Some(pic) = front.or(pics.first()) {
                picture = Some(pic.data().to_vec());
                break;
            }
        }
    }

    // Paroles synchronisées dans un .lrc voisin : prioritaires sur les paroles intégrées.
    let lrc = path.with_extension("lrc");
    if let Ok(bytes) = std::fs::read(&lrc) {
        let s = String::from_utf8_lossy(&bytes).to_string();
        if !s.trim().is_empty() {
            p.lyrics = Some(s);
        }
    }

    if picture.is_none() {
        if let Some(dir) = path.parent() {
            picture = folder_cover(dir);
        }
    }
    if let Some(data) = picture {
        p.cover = covers.store(&data);
    }
    p
}

fn upsert(tx: &rusqlite::Transaction, p: &Parsed, existing_id: Option<i64>) -> rusqlite::Result<()> {
    let has_lyrics = p.lyrics.is_some() as i64;
    match existing_id {
        Some(id) => {
            // Fichier modifié ou renommé : on garde les écoutes, la note et l'analyse.
            tx.execute(
                "UPDATE tracks SET path=?1, folder_id=?2, title=?3, artist=?4, album_artist=?5, album=?6, year=?7, genre=?8,
                 track_no=?9, disc_no=?10, composer=?11, duration_ms=?12, format=?13, sample_rate=?14, bit_depth=?15,
                 bitrate=?16, channels=?17, file_size=?18, mtime=?19, cover=COALESCE(?20, cover), lyrics=?21, has_lyrics=?22,
                 rg_track=COALESCE(?23, rg_track), rg_album=COALESCE(?24, rg_album), peak=COALESCE(?25, peak)
                 WHERE id=?26",
                params![
                    p.path, p.folder_id, p.title, p.artist, p.album_artist, p.album, p.year, p.genre, p.track_no,
                    p.disc_no, p.composer, p.duration_ms, p.format, p.sample_rate, p.bit_depth, p.bitrate, p.channels,
                    p.size, p.mtime, p.cover, p.lyrics, has_lyrics, p.rg_track, p.rg_album, p.peak, id
                ],
            )?;
        }
        None => {
            tx.execute(
                "INSERT INTO tracks(path, folder_id, title, artist, album_artist, album, year, genre, track_no, disc_no,
                 composer, duration_ms, format, sample_rate, bit_depth, bitrate, channels, file_size, mtime, added_at,
                 cover, lyrics, has_lyrics, rg_track, rg_album, peak)
                 VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26)
                 ON CONFLICT(path) DO NOTHING",
                params![
                    p.path, p.folder_id, p.title, p.artist, p.album_artist, p.album, p.year, p.genre, p.track_no,
                    p.disc_no, p.composer, p.duration_ms, p.format, p.sample_rate, p.bit_depth, p.bitrate, p.channels,
                    p.size, p.mtime, db::now(), p.cover, p.lyrics, has_lyrics, p.rg_track, p.rg_album, p.peak
                ],
            )?;
        }
    }
    Ok(())
}

/// Lance un scan en arrière-plan. Si un scan tourne déjà, il sera relancé à la fin.
pub fn request_scan(app: &AppHandle, db: &Arc<Db>, state: &Arc<ScanState>, covers: &Arc<CoverCache>) {
    if state.running.swap(true, Ordering::SeqCst) {
        state.again.store(true, Ordering::SeqCst);
        return;
    }
    let (app, db, state, covers) = (app.clone(), db.clone(), state.clone(), covers.clone());
    std::thread::spawn(move || {
        loop {
            state.again.store(false, Ordering::SeqCst);
            match scan(&app, &db, &covers) {
                Ok(changed) => {
                    if changed {
                        let _ = app.emit("library:changed", ());
                    }
                }
                Err(e) => {
                    let _ = app.emit("app:error", format!("Scan : {e}"));
                }
            }
            let _ = app.emit("scan:progress", Progress { phase: "done", done: 0, total: 0 });
            if !state.again.load(Ordering::SeqCst) {
                break;
            }
        }
        state.running.store(false, Ordering::SeqCst);
        crate::analysis::wake();
    });
}

struct Found {
    path: PathBuf,
    folder_id: i64,
    size: i64,
    mtime: i64,
}

fn scan(app: &AppHandle, db: &Db, covers: &CoverCache) -> Result<bool> {
    let mut conn = db.connect()?;
    let folders: Vec<(i64, String)> = {
        let mut st = conn.prepare("SELECT id, path FROM folders")?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect::<rusqlite::Result<_>>()?
    };
    let _ = app.emit("scan:progress", Progress { phase: "walk", done: 0, total: 0 });

    // 1. Inventaire des fichiers présents sur le disque.
    let mut found: Vec<Found> = Vec::new();
    let mut offline: HashSet<i64> = HashSet::new();
    let mut lrcs: HashMap<PathBuf, i64> = HashMap::new();
    for (fid, root) in &folders {
        if !Path::new(root).is_dir() {
            // Disque débranché : on ne touche pas aux morceaux de ce dossier.
            offline.insert(*fid);
            continue;
        }
        for entry in walkdir::WalkDir::new(root).follow_links(true).into_iter().flatten() {
            if !entry.file_type().is_file() {
                continue;
            }
            let is_lrc = entry.path().extension().map(|e| e.eq_ignore_ascii_case("lrc")).unwrap_or(false);
            if !is_lrc && !is_audio(entry.path()) {
                continue;
            }
            let Ok(meta) = entry.metadata() else { continue };
            let mtime = meta
                .modified()
                .ok()
                .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            if is_lrc {
                lrcs.insert(entry.path().with_extension(""), mtime);
            } else {
                found.push(Found { path: entry.into_path(), folder_id: *fid, size: meta.len() as i64, mtime });
            }
        }
    }
    // Un .lrc ajouté ou modifié doit faire relire le morceau voisin.
    for f in found.iter_mut() {
        if let Some(m) = lrcs.get(&f.path.with_extension("")) {
            f.mtime = f.mtime.max(*m);
        }
    }

    // 2. Comparaison avec l'index.
    struct Known {
        id: i64,
        folder_id: i64,
        size: i64,
        mtime: i64,
        title: String,
        duration_ms: i64,
    }
    let mut known: HashMap<String, Known> = {
        let mut st = conn.prepare("SELECT path, id, folder_id, file_size, mtime, title, duration_ms FROM tracks")?;
        let rows = st.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                Known {
                    id: r.get(1)?,
                    folder_id: r.get(2)?,
                    size: r.get(3)?,
                    mtime: r.get(4)?,
                    title: r.get(5)?,
                    duration_ms: r.get(6)?,
                },
            ))
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let mut todo: Vec<(Found, Option<i64>)> = Vec::new();
    for f in found {
        let key = f.path.to_string_lossy().to_string();
        match known.remove(&key) {
            Some(k) if k.size == f.size && k.mtime == f.mtime => {}
            Some(k) => todo.push((f, Some(k.id))),
            None => todo.push((f, None)),
        }
    }
    // Ce qui reste dans `known` a disparu du disque (sauf dossiers hors ligne).
    let folder_ids: HashSet<i64> = folders.iter().map(|f| f.0).collect();
    let mut missing: Vec<Known> = known
        .into_values()
        .filter(|k| !offline.contains(&k.folder_id) || !folder_ids.contains(&k.folder_id))
        .collect();

    let total = todo.len();
    let mut changed = false;
    let mut done = 0usize;
    let _ = app.emit("scan:progress", Progress { phase: "read", done, total });

    // 3. Lecture des tags en parallèle, écriture par lots.
    for chunk in todo.chunks(48) {
        let parsed: Vec<(Parsed, Option<i64>)> = chunk
            .par_iter()
            .map(|(f, id)| (parse_file(&f.path, f.folder_id, f.size, f.mtime, covers), *id))
            .collect();
        let tx = conn.transaction()?;
        for (key, colors) in covers.new_rows.lock().drain(..) {
            tx.execute(
                "INSERT OR REPLACE INTO covers(key, c1, c2, c3) VALUES(?1, ?2, ?3, ?4)",
                params![key, colors[0], colors[1], colors[2]],
            )?;
        }
        for (p, id) in &parsed {
            let mut id = *id;
            if id.is_none() {
                // Renommage / déplacement : même taille, même titre, même durée qu'un fichier disparu.
                if let Some(pos) = missing
                    .iter()
                    .position(|k| k.size == p.size && k.title == p.title && (k.duration_ms - p.duration_ms).abs() < 50)
                {
                    id = Some(missing.swap_remove(pos).id);
                }
            }
            upsert(&tx, p, id)?;
        }
        tx.commit()?;
        changed = true;
        done += chunk.len();
        let _ = app.emit("scan:progress", Progress { phase: "read", done, total });
    }

    // 4. Suppression des morceaux disparus.
    if !missing.is_empty() {
        let tx = conn.transaction()?;
        for k in &missing {
            tx.execute("DELETE FROM tracks WHERE id = ?1", [k.id])?;
            tx.execute("DELETE FROM playlist_tracks WHERE track_id = ?1", [k.id])?;
        }
        tx.commit()?;
        changed = true;
    }
    Ok(changed)
}

/// Relit un seul fichier (après édition des tags).
pub fn rescan_file(db: &Db, covers: &CoverCache, id: i64) -> Result<()> {
    let mut conn = db.connect()?;
    let (path, folder_id): (String, i64) =
        conn.query_row("SELECT path, folder_id FROM tracks WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    let meta = std::fs::metadata(&path)?;
    let mtime = meta.modified().ok().and_then(|m| m.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64).unwrap_or(0);
    let p = parse_file(Path::new(&path), folder_id, meta.len() as i64, mtime, covers);
    let tx = conn.transaction()?;
    for (key, colors) in covers.new_rows.lock().drain(..) {
        tx.execute(
            "INSERT OR REPLACE INTO covers(key, c1, c2, c3) VALUES(?1, ?2, ?3, ?4)",
            params![key, colors[0], colors[1], colors[2]],
        )?;
    }
    upsert(&tx, &p, Some(id))?;
    // Après une édition, la pochette lue fait foi (même si elle a été retirée).
    tx.execute("UPDATE tracks SET cover = ?1 WHERE id = ?2", params![p.cover, id])?;
    tx.commit()?;
    Ok(())
}

// ------------------------------------------------------------------ surveillance

pub struct Watcher {
    inner: Mutex<Option<Box<dyn std::any::Any + Send>>>,
}

impl Watcher {
    pub fn new() -> Self {
        Watcher { inner: Mutex::new(None) }
    }

    /// (Re)démarre la surveillance de tous les dossiers de la bibliothèque.
    pub fn restart(&self, app: &AppHandle, db: &Arc<Db>, state: &Arc<ScanState>, covers: &Arc<CoverCache>) {
        use notify_debouncer_full::{new_debouncer, notify::RecursiveMode};
        let folders: Vec<String> = {
            let conn = db.conn.lock();
            let Ok(mut st) = conn.prepare("SELECT path FROM folders") else { return };
            let Ok(rows) = st.query_map([], |r| r.get::<_, String>(0)) else { return };
            rows.flatten().collect()
        };
        let (app2, db2, state2, covers2) = (app.clone(), db.clone(), state.clone(), covers.clone());
        let debouncer = new_debouncer(
            std::time::Duration::from_secs(3),
            None,
            move |res: notify_debouncer_full::DebounceEventResult| {
                if let Ok(events) = res {
                    let relevant = events.iter().any(|e| {
                        !e.kind.is_access()
                            && e.paths.iter().any(|p| {
                                let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
                                p.extension().is_none()
                                    || AUDIO_EXT.contains(&ext.as_str())
                                    || COVER_EXT.contains(&ext.as_str())
                                    || ext == "lrc"
                            })
                    });
                    if relevant {
                        request_scan(&app2, &db2, &state2, &covers2);
                    }
                }
            },
        );
        let Ok(mut debouncer) = debouncer else { return };
        for f in folders {
            let _ = debouncer.watch(Path::new(&f), RecursiveMode::Recursive);
        }
        *self.inner.lock() = Some(Box::new(debouncer));
    }
}
