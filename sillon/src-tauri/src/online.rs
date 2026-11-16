//! Complément en ligne, optionnel et désactivé par défaut : pochette et année manquantes
//! via MusicBrainz et Cover Art Archive. Seuls le nom de l'artiste et de l'album sont envoyés.

use crate::db::{self, Db};
use crate::scan::CoverCache;
use anyhow::{anyhow, Result};
use rusqlite::params;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static RUNNING: AtomicBool = AtomicBool::new(false);
const UA: &str = "Sillon/0.1 (lecteur de musique local)";

fn encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn quote(s: &str) -> String {
    s.replace('\\', " ").replace('"', " ")
}

struct Found {
    cover: Option<Vec<u8>>,
    year: Option<i64>,
}

fn lookup(agent: &ureq::Agent, artist: &str, album: &str) -> Result<Found> {
    let query = format!("release:\"{}\" AND artist:\"{}\"", quote(album), quote(artist));
    let url = format!("https://musicbrainz.org/ws/2/release/?query={}&fmt=json&limit=5", encode(&query));
    let mut resp = agent.get(&url).header("User-Agent", UA).call().map_err(|e| anyhow!("{e}"))?;
    let v: serde_json::Value = resp.body_mut().read_json().map_err(|e| anyhow!("{e}"))?;
    let mut found = Found { cover: None, year: None };
    let empty = Vec::new();
    let releases = v["releases"].as_array().unwrap_or(&empty);
    for rel in releases.iter().filter(|r| r["score"].as_i64().unwrap_or(0) >= 90) {
        if found.year.is_none() {
            found.year = rel["date"].as_str().and_then(|d| d.get(..4)).and_then(|y| y.parse().ok());
        }
        let Some(id) = rel["id"].as_str() else { continue };
        std::thread::sleep(Duration::from_millis(1100));
        let cover_url = format!("https://coverartarchive.org/release/{id}/front-500");
        if let Ok(mut r) = agent.get(&cover_url).header("User-Agent", UA).call() {
            if let Ok(bytes) = r.body_mut().with_config().limit(12 * 1024 * 1024).read_to_vec() {
                found.cover = Some(bytes);
                break;
            }
        }
    }
    Ok(found)
}

/// Complète les albums sans pochette, un par seconde au plus (règle de MusicBrainz).
pub fn complete(app: AppHandle, db: Arc<Db>, covers: Arc<CoverCache>) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::spawn(move || {
        let run = || -> Result<()> {
            let conn = db.connect()?;
            const KEY: &str = "(CASE WHEN album_artist <> '' THEN album_artist ELSE artist END)";
            let albums: Vec<(String, String)> = {
                let mut st = conn.prepare(&format!(
                    "SELECT DISTINCT {KEY}, album FROM tracks
                     WHERE album <> '' AND {KEY} <> '' AND mb_checked = 0 AND cover IS NULL"
                ))?;
                let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
                rows.collect::<rusqlite::Result<_>>()?
            };
            let agent = ureq::Agent::new_with_defaults();
            let mut changed = false;
            for (artist, album) in albums {
                let enabled = db::get_setting(&conn, "online").and_then(|v| v.as_bool()).unwrap_or(false);
                if !enabled {
                    break;
                }
                if let Ok(found) = lookup(&agent, &artist, &album) {
                    let key = found.cover.as_deref().and_then(|d| covers.store(d));
                    for (k, colors) in covers.new_rows.lock().drain(..) {
                        conn.execute(
                            "INSERT OR REPLACE INTO covers(key, c1, c2, c3) VALUES(?1, ?2, ?3, ?4)",
                            params![k, colors[0], colors[1], colors[2]],
                        )?;
                    }
                    conn.execute(
                        &format!(
                            "UPDATE tracks SET mb_checked = 1, cover = COALESCE(cover, ?1), year = COALESCE(year, ?2)
                             WHERE {KEY} = ?3 AND album = ?4"
                        ),
                        params![key, found.year, artist, album],
                    )?;
                    changed |= key.is_some() || found.year.is_some();
                    if changed {
                        let _ = app.emit("library:changed", ());
                    }
                }
                std::thread::sleep(Duration::from_millis(1100));
            }
            Ok(())
        };
        let _ = run();
        RUNNING.store(false, Ordering::SeqCst);
    });
}
