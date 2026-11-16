//! Base SQLite locale : index de la bibliothèque, écoutes, playlists, réglages.

use anyhow::Result;
use parking_lot::Mutex;
use rusqlite::{params, Connection, Row};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct Db {
    pub path: PathBuf,
    pub conn: Mutex<Connection>,
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS folders(
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS tracks(
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  folder_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  album_artist TEXT NOT NULL DEFAULT '',
  album TEXT NOT NULL DEFAULT '',
  year INTEGER,
  genre TEXT NOT NULL DEFAULT '',
  track_no INTEGER,
  disc_no INTEGER,
  composer TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  format TEXT NOT NULL DEFAULT '',
  sample_rate INTEGER NOT NULL DEFAULT 0,
  bit_depth INTEGER NOT NULL DEFAULT 0,
  bitrate INTEGER NOT NULL DEFAULT 0,
  channels INTEGER NOT NULL DEFAULT 2,
  file_size INTEGER NOT NULL DEFAULT 0,
  mtime INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  cover TEXT,
  lyrics TEXT,
  has_lyrics INTEGER NOT NULL DEFAULT 0,
  rg_track REAL,
  rg_album REAL,
  peak REAL,
  lufs REAL,
  bpm REAL,
  key TEXT,
  energy REAL,
  intensity REAL,
  danceability REAL,
  valence REAL,
  mood TEXT,
  analyzed INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 0,
  loved INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_played INTEGER,
  mb_checked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_artist, album);
CREATE TABLE IF NOT EXISTS plays(
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ms_played INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plays_started ON plays(started_at);
CREATE TABLE IF NOT EXISTS covers(
  key TEXT PRIMARY KEY,
  c1 TEXT NOT NULL,
  c2 TEXT NOT NULL,
  c3 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlists(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual',
  rules TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_tracks(
  playlist_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pt ON playlist_tracks(playlist_id, position);
CREATE TABLE IF NOT EXISTS settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

pub fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

fn configure(conn: &Connection) -> Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(std::time::Duration::from_secs(10))?;
    Ok(())
}

impl Db {
    pub fn open(path: &Path) -> Result<Db> {
        let conn = Connection::open(path)?;
        configure(&conn)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Db { path: path.to_path_buf(), conn: Mutex::new(conn) })
    }

    /// Connexion séparée pour les tâches de fond (scan, analyse).
    pub fn connect(&self) -> Result<Connection> {
        let conn = Connection::open(&self.path)?;
        configure(&conn)?;
        Ok(conn)
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct Track {
    pub id: i64,
    pub path: String,
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
    pub file_size: i64,
    pub added_at: i64,
    pub cover: Option<String>,
    pub has_lyrics: bool,
    pub rg_track: Option<f64>,
    pub rg_album: Option<f64>,
    pub peak: Option<f64>,
    pub bpm: Option<f64>,
    pub key: Option<String>,
    pub energy: Option<f64>,
    pub intensity: Option<f64>,
    pub danceability: Option<f64>,
    pub valence: Option<f64>,
    pub mood: Option<String>,
    pub rating: i64,
    pub loved: bool,
    pub play_count: i64,
    pub skip_count: i64,
    pub last_played: Option<i64>,
}

pub const TRACK_COLS: &str = "id, path, title, artist, album_artist, album, year, genre, track_no, disc_no, composer, \
duration_ms, format, sample_rate, bit_depth, bitrate, channels, file_size, added_at, cover, has_lyrics, \
rg_track, rg_album, peak, bpm, key, energy, intensity, danceability, valence, mood, rating, loved, \
play_count, skip_count, last_played";

pub fn track_from_row(r: &Row) -> rusqlite::Result<Track> {
    Ok(Track {
        id: r.get(0)?,
        path: r.get(1)?,
        title: r.get(2)?,
        artist: r.get(3)?,
        album_artist: r.get(4)?,
        album: r.get(5)?,
        year: r.get(6)?,
        genre: r.get(7)?,
        track_no: r.get(8)?,
        disc_no: r.get(9)?,
        composer: r.get(10)?,
        duration_ms: r.get(11)?,
        format: r.get(12)?,
        sample_rate: r.get(13)?,
        bit_depth: r.get(14)?,
        bitrate: r.get(15)?,
        channels: r.get(16)?,
        file_size: r.get(17)?,
        added_at: r.get(18)?,
        cover: r.get(19)?,
        has_lyrics: r.get::<_, i64>(20)? != 0,
        rg_track: r.get(21)?,
        rg_album: r.get(22)?,
        peak: r.get(23)?,
        bpm: r.get(24)?,
        key: r.get(25)?,
        energy: r.get(26)?,
        intensity: r.get(27)?,
        danceability: r.get(28)?,
        valence: r.get(29)?,
        mood: r.get(30)?,
        rating: r.get(31)?,
        loved: r.get::<_, i64>(32)? != 0,
        play_count: r.get(33)?,
        skip_count: r.get(34)?,
        last_played: r.get(35)?,
    })
}

pub fn all_tracks(conn: &Connection) -> Result<Vec<Track>> {
    let mut st = conn.prepare(&format!("SELECT {TRACK_COLS} FROM tracks"))?;
    let rows = st.query_map([], track_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn all_covers(conn: &Connection) -> Result<HashMap<String, [String; 3]>> {
    let mut st = conn.prepare("SELECT key, c1, c2, c3 FROM covers")?;
    let rows = st.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, [r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?]))
    })?;
    Ok(rows.collect::<rusqlite::Result<HashMap<_, _>>>()?)
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<serde_json::Value> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get::<_, String>(0))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

pub fn set_setting(conn: &Connection, key: &str, value: &serde_json::Value) -> Result<()> {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value.to_string()],
    )?;
    Ok(())
}

// ---------------------------------------------------------------- statistiques

#[derive(Serialize)]
pub struct TopItem {
    pub name: String,
    pub sub: String,
    pub cover: Option<String>,
    pub track_id: Option<i64>,
    pub plays: i64,
    pub ms: i64,
}

#[derive(Serialize)]
pub struct Stats {
    pub total_ms: i64,
    pub total_plays: i64,
    pub distinct_tracks: i64,
    pub distinct_artists: i64,
    pub top_tracks: Vec<TopItem>,
    pub top_artists: Vec<TopItem>,
    pub top_albums: Vec<TopItem>,
    pub genres: Vec<TopItem>,
    /// 24 valeurs : millisecondes écoutées par heure locale de la journée.
    pub hours: Vec<i64>,
    /// 7 valeurs : millisecondes par jour de la semaine (lundi = 0).
    pub weekdays: Vec<i64>,
    /// Série chronologique (jour « AAAA-MM-JJ », millisecondes).
    pub days: Vec<(String, i64)>,
}

pub fn stats(conn: &Connection, from: i64, to: i64) -> Result<Stats> {
    let range = params![from, to];
    let (total_ms, total_plays, distinct_tracks, distinct_artists) = conn.query_row(
        "SELECT COALESCE(SUM(p.ms_played),0), COUNT(*), COUNT(DISTINCT p.track_id), COUNT(DISTINCT t.artist)
         FROM plays p JOIN tracks t ON t.id = p.track_id WHERE p.started_at >= ?1 AND p.started_at < ?2",
        range,
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )?;

    let top = |sql: &str| -> Result<Vec<TopItem>> {
        let mut st = conn.prepare(sql)?;
        let rows = st.query_map(params![from, to], |r| {
            Ok(TopItem {
                name: r.get(0)?,
                sub: r.get(1)?,
                cover: r.get(2)?,
                track_id: r.get(3)?,
                plays: r.get(4)?,
                ms: r.get(5)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    };
    const W: &str = "FROM plays p JOIN tracks t ON t.id = p.track_id WHERE p.started_at >= ?1 AND p.started_at < ?2";
    let top_tracks = top(&format!(
        "SELECT t.title, t.artist, t.cover, t.id, COUNT(*), SUM(p.ms_played) {W} GROUP BY t.id ORDER BY 5 DESC, 6 DESC LIMIT 25"
    ))?;
    let top_artists = top(&format!(
        "SELECT t.artist, '', MAX(t.cover), NULL, COUNT(*), SUM(p.ms_played) {W} AND t.artist <> '' GROUP BY t.artist ORDER BY 6 DESC LIMIT 25"
    ))?;
    let top_albums = top(&format!(
        "SELECT t.album, CASE WHEN t.album_artist <> '' THEN t.album_artist ELSE t.artist END, MAX(t.cover), MIN(t.id), COUNT(*), SUM(p.ms_played) {W} AND t.album <> '' GROUP BY t.album, 2 ORDER BY 6 DESC LIMIT 25"
    ))?;
    let genres = top(&format!(
        "SELECT t.genre, '', NULL, NULL, COUNT(*), SUM(p.ms_played) {W} AND t.genre <> '' GROUP BY t.genre ORDER BY 6 DESC LIMIT 12"
    ))?;

    let mut hours = vec![0i64; 24];
    let mut weekdays = vec![0i64; 7];
    {
        let mut st = conn.prepare(
            "SELECT CAST(strftime('%H', started_at, 'unixepoch', 'localtime') AS INTEGER),
                    CAST(strftime('%w', started_at, 'unixepoch', 'localtime') AS INTEGER),
                    SUM(ms_played)
             FROM plays WHERE started_at >= ?1 AND started_at < ?2 GROUP BY 1, 2",
        )?;
        let rows = st.query_map(params![from, to], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)))?;
        for row in rows {
            let (h, w, ms) = row?;
            hours[(h as usize) % 24] += ms;
            // SQLite : dimanche = 0 ; on veut lundi = 0.
            weekdays[((w + 6) % 7) as usize] += ms;
        }
    }
    let days = {
        let mut st = conn.prepare(
            "SELECT strftime('%Y-%m-%d', started_at, 'unixepoch', 'localtime'), SUM(ms_played)
             FROM plays WHERE started_at >= ?1 AND started_at < ?2 GROUP BY 1 ORDER BY 1",
        )?;
        let rows = st.query_map(params![from, to], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    Ok(Stats {
        total_ms,
        total_plays,
        distinct_tracks,
        distinct_artists,
        top_tracks,
        top_artists,
        top_albums,
        genres,
        hours,
        weekdays,
        days,
    })
}
