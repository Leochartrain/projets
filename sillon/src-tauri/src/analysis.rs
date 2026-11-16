//! Analyse audio locale en arrière-plan : volume perçu (ReplayGain), tempo, tonalité,
//! énergie, intensité, dansabilité, humeur estimée. Ce sont des estimations.

use crate::db::{self, Db};
use crate::decode::Decoded;
use anyhow::{anyhow, Result};
use crossbeam_channel::{bounded, Sender};
use ebur128::{EbuR128, Mode};
use rusqlite::params;
use rustfft::{num_complex::Complex, FftPlanner};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static WAKE: OnceLock<Sender<()>> = OnceLock::new();

/// Réveille l'analyse (après un scan, ou quand le réglage change).
pub fn wake() {
    if let Some(tx) = WAKE.get() {
        let _ = tx.try_send(());
    }
}

pub struct Features {
    pub lufs: f64,
    pub peak: f64,
    pub bpm: f64,
    pub key: String,
    pub energy: f64,
    pub intensity: f64,
    pub danceability: f64,
    pub valence: f64,
    pub mood: &'static str,
}

const TARGET_SR: u32 = 11025;
const FFT: usize = 2048;
const HOP: usize = 256;
const MAX_SECONDS: usize = 420;
const NOTES: [&str; 12] = ["Do", "Do♯", "Ré", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
const MAJOR: [f64; 12] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR: [f64; 12] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

fn clamp01(x: f64) -> f64 {
    x.clamp(0.0, 1.0)
}

fn correlation(a: &[f64; 12], b: &[f64; 12], shift: usize) -> f64 {
    let ma = a.iter().sum::<f64>() / 12.0;
    let mb = b.iter().sum::<f64>() / 12.0;
    let (mut num, mut da, mut dbb) = (0.0, 0.0, 0.0);
    for i in 0..12 {
        let x = a[(i + shift) % 12] - ma;
        let y = b[i] - mb;
        num += x * y;
        da += x * x;
        dbb += y * y;
    }
    if da <= 0.0 || dbb <= 0.0 { 0.0 } else { num / (da * dbb).sqrt() }
}

pub fn analyze(path: &Path) -> Result<Features> {
    let mut dec = Decoded::open(path)?;
    let rate = dec.rate;
    let mut ebu: Option<(usize, EbuR128)> = None;
    let factor = ((rate as f32 / TARGET_SR as f32).round() as usize).max(1);
    let sr = rate as f64 / factor as f64;
    let max_len = (sr as usize) * MAX_SECONDS;
    let mut mono: Vec<f32> = Vec::new();
    let (mut acc, mut acc_n) = (0f32, 0usize);

    while let Some((ch, samples)) = dec.next() {
        if ebu.is_none() {
            let e = EbuR128::new(ch as u32, rate, Mode::I | Mode::SAMPLE_PEAK).map_err(|e| anyhow!("{e:?}"))?;
            ebu = Some((ch, e));
        }
        let (ech, e) = ebu.as_mut().unwrap();
        if *ech != ch {
            continue;
        }
        let _ = e.add_frames_f32(samples);
        if mono.len() < max_len {
            for f in samples.chunks_exact(ch) {
                acc += f.iter().sum::<f32>() / ch as f32;
                acc_n += 1;
                if acc_n == factor {
                    mono.push(acc / factor as f32);
                    acc = 0.0;
                    acc_n = 0;
                }
            }
        }
    }
    let (ch, e) = ebu.ok_or_else(|| anyhow!("fichier vide"))?;
    let lufs = e.loudness_global().unwrap_or(f64::NEG_INFINITY);
    let lufs = if lufs.is_finite() { lufs } else { -70.0 };
    let mut peak = 0f64;
    for c in 0..ch {
        peak = peak.max(e.sample_peak(c as u32).unwrap_or(0.0));
    }

    // --- Spectrogramme : flux spectral (attaques), centroïde, chroma.
    let fft = FftPlanner::<f32>::new().plan_fft_forward(FFT);
    let window: Vec<f32> = (0..FFT).map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (FFT - 1) as f32).cos()).collect();
    let half = FFT / 2;
    // Classe de hauteur de chaque case de fréquence (entre 65 Hz et 2 kHz).
    let pitch_class: Vec<Option<usize>> = (0..half)
        .map(|i| {
            let f = i as f64 * sr / FFT as f64;
            if !(65.0..=2000.0).contains(&f) {
                return None;
            }
            let midi = 69.0 + 12.0 * (f / 440.0).log2();
            Some((midi.round() as i64).rem_euclid(12) as usize)
        })
        .collect();
    let mut prev = vec![0f32; half];
    let mut flux: Vec<f64> = Vec::new();
    let mut chroma = [0f64; 12];
    let (mut centroid_sum, mut centroid_n) = (0f64, 0f64);
    let mut buf = vec![Complex::new(0f32, 0f32); FFT];
    let mut pos = 0;
    while pos + FFT <= mono.len() {
        for i in 0..FFT {
            buf[i] = Complex::new(mono[pos + i] * window[i], 0.0);
        }
        fft.process(&mut buf);
        let (mut fl, mut num, mut den) = (0f64, 0f64, 0f64);
        for i in 1..half {
            let m = buf[i].norm();
            let lm = (1.0 + 100.0 * m).ln();
            let d = lm - prev[i];
            if d > 0.0 {
                fl += d as f64;
            }
            prev[i] = lm;
            num += m as f64 * i as f64;
            den += m as f64;
            if let Some(pc) = pitch_class[i] {
                chroma[pc] += (m * m) as f64;
            }
        }
        flux.push(fl);
        if den > 1e-6 {
            centroid_sum += num / den * sr / FFT as f64;
            centroid_n += 1.0;
        }
        pos += HOP;
    }
    let fps = sr / HOP as f64;
    let centroid = if centroid_n > 0.0 { centroid_sum / centroid_n } else { 0.0 };

    // --- Tempo : autocorrélation de l'enveloppe d'attaques.
    let (mut bpm, mut beat_strength, mut onset_rate) = (0.0, 0.0, 0.0);
    if flux.len() > (fps * 8.0) as usize {
        // Retrait de la moyenne locale, redressement.
        let w = (fps * 0.5) as usize;
        let n = flux.len();
        let mut env = vec![0f64; n];
        let mut sum = 0.0;
        let mut q = std::collections::VecDeque::new();
        for i in 0..n {
            q.push_back(flux[i]);
            sum += flux[i];
            if q.len() > w * 2 {
                sum -= q.pop_front().unwrap();
            }
            env[i] = (flux[i] - sum / q.len() as f64).max(0.0);
        }
        let mean = env.iter().sum::<f64>() / n as f64;
        let thr = mean * 2.0;
        let mut onsets = 0;
        for i in 1..n - 1 {
            if env[i] > thr && env[i] >= env[i - 1] && env[i] > env[i + 1] {
                onsets += 1;
            }
        }
        onset_rate = onsets as f64 / (n as f64 / fps);
        let ac = |lag: usize| -> f64 {
            if lag == 0 || lag >= n {
                return 0.0;
            }
            let mut s = 0.0;
            for i in lag..n {
                s += env[i] * env[i - lag];
            }
            s / (n - lag) as f64
        };
        let ac0 = env.iter().map(|x| x * x).sum::<f64>() / n as f64;
        let lag_min = (60.0 * fps / 210.0).floor() as usize;
        let lag_max = (60.0 * fps / 50.0).ceil() as usize;
        let mut best = (0.0, 0usize);
        let mut scores = vec![0f64; lag_max + 2];
        for lag in lag_min.max(2)..=lag_max {
            let t = 60.0 * fps / lag as f64;
            // Préférence douce pour les tempos autour de 125 BPM.
            let prior = (-0.5 * ((t / 125.0).log2() / 0.7).powi(2)).exp();
            let s = (ac(lag) + 0.5 * ac(lag * 2)) * prior;
            scores[lag] = s;
            if s > best.0 {
                best = (s, lag);
            }
        }
        if best.1 > 0 && ac0 > 0.0 {
            let l = best.1;
            // Interpolation parabolique pour affiner entre deux retards.
            let (a, b, c) = (scores[l - 1], scores[l], scores[l + 1]);
            let denom = a - 2.0 * b + c;
            let shift = if l > lag_min.max(2) && l < lag_max && denom.abs() > 1e-12 { 0.5 * (a - c) / denom } else { 0.0 };
            bpm = 60.0 * fps / (l as f64 + shift.clamp(-0.5, 0.5));
            beat_strength = clamp01(ac(l) / ac0);
        }
    }

    // --- Tonalité : profils de Krumhansl-Kessler.
    let mut key = String::new();
    let mut major = true;
    if chroma.iter().sum::<f64>() > 0.0 {
        let mut best = f64::MIN;
        for tonic in 0..12 {
            let cmaj = correlation(&chroma, &MAJOR, tonic);
            let cmin = correlation(&chroma, &MINOR, tonic);
            if cmaj > best {
                best = cmaj;
                key = format!("{} majeur", NOTES[tonic]);
                major = true;
            }
            if cmin > best {
                best = cmin;
                key = format!("{} mineur", NOTES[tonic]);
                major = false;
            }
        }
    }

    // --- Descripteurs perceptifs (0 à 1).
    let loud = clamp01((lufs + 30.0) / 22.0);
    let bright = clamp01((centroid - 500.0) / 2000.0);
    let busy = clamp01(onset_rate / 6.0);
    let energy = clamp01(0.5 * loud + 0.2 * bright + 0.3 * busy);
    let intensity = clamp01(0.75 * loud + 0.25 * bright);
    let tempo_fit = if bpm > 0.0 { (-0.5 * ((bpm - 118.0) / 30.0_f64).powi(2)).exp() } else { 0.0 };
    let danceability = clamp01(0.7 * clamp01(beat_strength * 1.4) + 0.3 * tempo_fit);
    let valence = clamp01(0.5 + if major { 0.15 } else { -0.15 } + (energy - 0.5) * 0.3 + (danceability - 0.5) * 0.25);
    let mood = match (energy, valence) {
        (e, v) if e >= 0.62 && v >= 0.55 => "Joyeux",
        (e, _) if e >= 0.62 => "Intense",
        (e, v) if e < 0.38 && v >= 0.5 => "Paisible",
        (e, _) if e < 0.38 => "Mélancolique",
        (_, v) if v >= 0.55 => "Détendu",
        _ => "Rêveur",
    };

    Ok(Features {
        lufs,
        peak,
        bpm: (bpm * 10.0).round() / 10.0,
        key,
        energy,
        intensity,
        danceability,
        valence,
        mood,
    })
}

/// Gain d'album : moyenne énergétique des volumes des pistes, pondérée par leur durée.
fn album_gains(conn: &rusqlite::Connection) -> Result<()> {
    let rows: Vec<(String, f64, i64, bool)> = {
        let mut st = conn.prepare(
            "SELECT (CASE WHEN album_artist <> '' THEN album_artist ELSE artist END) || char(31) || album,
                    lufs, duration_ms, rg_album IS NULL
             FROM tracks WHERE album <> ''",
        )?;
        let r = st.query_map([], |r| Ok((r.get(0)?, r.get::<_, Option<f64>>(1)?.unwrap_or(f64::NAN), r.get(2)?, r.get(3)?)))?;
        r.collect::<rusqlite::Result<_>>()?
    };
    let mut groups: HashMap<String, (f64, f64, bool, bool)> = HashMap::new();
    for (key, lufs, dur, missing) in rows {
        let g = groups.entry(key).or_insert((0.0, 0.0, true, false));
        if lufs.is_nan() {
            g.2 = false;
        } else {
            let d = dur.max(1) as f64;
            g.0 += d * 10f64.powf(lufs / 10.0);
            g.1 += d;
        }
        g.3 |= missing;
    }
    for (key, (sum, dur, complete, missing)) in groups {
        if !complete || !missing || dur <= 0.0 {
            continue;
        }
        let gain = -18.0 - 10.0 * (sum / dur).log10();
        conn.execute(
            "UPDATE tracks SET rg_album = ?1 WHERE rg_album IS NULL
             AND (CASE WHEN album_artist <> '' THEN album_artist ELSE artist END) || char(31) || album = ?2",
            params![gain, key],
        )?;
    }
    Ok(())
}

pub fn spawn(app: AppHandle, db: Arc<Db>) {
    let (tx, rx) = bounded::<()>(1);
    let _ = WAKE.set(tx);
    let _ = std::thread::Builder::new().name("sillon-analyse".into()).spawn(move || {
        let Ok(conn) = db.connect() else { return };
        loop {
            let _ = rx.recv_timeout(Duration::from_secs(120));
            let mut done = 0usize;
            loop {
                let enabled = db::get_setting(&conn, "analysis").and_then(|v| v.as_bool()).unwrap_or(true);
                if !enabled {
                    break;
                }
                let remaining: i64 = conn.query_row("SELECT COUNT(*) FROM tracks WHERE analyzed = 0", [], |r| r.get(0)).unwrap_or(0);
                let next: Option<(i64, String)> = conn
                    .query_row("SELECT id, path FROM tracks WHERE analyzed = 0 ORDER BY added_at DESC, id LIMIT 1", [], |r| {
                        Ok((r.get(0)?, r.get(1)?))
                    })
                    .ok();
                let Some((id, path)) = next else { break };
                let _ = app.emit("analysis:progress", serde_json::json!({ "done": done, "remaining": remaining }));
                match analyze(Path::new(&path)) {
                    Ok(f) => {
                        let _ = conn.execute(
                            "UPDATE tracks SET analyzed = 1, lufs = ?1, peak = COALESCE(peak, ?2), rg_track = COALESCE(rg_track, ?3),
                             bpm = ?4, key = ?5, energy = ?6, intensity = ?7, danceability = ?8, valence = ?9, mood = ?10 WHERE id = ?11",
                            params![f.lufs, f.peak, -18.0 - f.lufs, f.bpm, f.key, f.energy, f.intensity, f.danceability, f.valence, f.mood, id],
                        );
                    }
                    Err(_) => {
                        // Fichier illisible : on ne réessaie pas en boucle.
                        let _ = conn.execute("UPDATE tracks SET analyzed = 2 WHERE id = ?1", [id]);
                    }
                }
                done += 1;
                if done % 40 == 0 {
                    let _ = album_gains(&conn);
                    let _ = app.emit("library:changed", ());
                }
                // On laisse respirer la machine entre deux morceaux.
                std::thread::sleep(Duration::from_millis(30));
            }
            if done > 0 {
                let _ = album_gains(&conn);
                let _ = app.emit("library:changed", ());
            }
            let _ = app.emit("analysis:progress", serde_json::json!({ "done": done, "remaining": 0 }));
        }
    });
}
