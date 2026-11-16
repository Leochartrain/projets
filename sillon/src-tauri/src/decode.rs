//! Décodage (Symphonia) et source stéréo à la fréquence de sortie.

use anyhow::{anyhow, Result};
use rubato::{FftFixedIn, Resampler};
use serde::Deserialize;
use std::fs::File;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{Decoder, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

/// Fichier audio décodé paquet par paquet, échantillons f32 entrelacés.
pub struct Decoded {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn Decoder>,
    track_id: u32,
    pub rate: u32,
    pub channels: usize,
    pub n_frames: Option<u64>,
    pub bits: u32,
    sbuf: Option<SampleBuffer<f32>>,
    skip: u64,
}

impl Decoded {
    pub fn open(path: &Path) -> Result<Self> {
        let file = File::open(path)?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }
        let fmt_opts = FormatOptions { enable_gapless: true, ..Default::default() };
        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &fmt_opts, &MetadataOptions::default())
            .map_err(|e| anyhow!("format non reconnu ({e})"))?;
        let format = probed.format;
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or_else(|| anyhow!("aucune piste audio"))?;
        let params = track.codec_params.clone();
        let track_id = track.id;
        let decoder = symphonia::default::get_codecs()
            .make(&params, &DecoderOptions::default())
            .map_err(|_| anyhow!("ce format audio n'est pas encore pris en charge"))?;
        Ok(Decoded {
            format,
            decoder,
            track_id,
            rate: params.sample_rate.unwrap_or(44100),
            channels: params.channels.map(|c| c.count()).unwrap_or(2).max(1),
            n_frames: params.n_frames,
            bits: params.bits_per_sample.unwrap_or(0),
            sbuf: None,
            skip: 0,
        })
    }

    pub fn seek(&mut self, secs: f64) -> Result<()> {
        let to = SeekTo::Time { time: Time::from(secs.max(0.0)), track_id: Some(self.track_id) };
        let res = self.format.seek(SeekMode::Accurate, to).map_err(|e| anyhow!("{e}"))?;
        self.decoder.reset();
        self.skip = res.required_ts.saturating_sub(res.actual_ts);
        Ok(())
    }

    /// Paquet suivant (entrelacé, `self.channels` canaux). `None` en fin de fichier.
    pub fn next(&mut self) -> Option<(usize, &[f32])> {
        loop {
            let packet = match self.format.next_packet() {
                Ok(p) => p,
                Err(_) => return None,
            };
            if packet.track_id() != self.track_id {
                continue;
            }
            match self.decoder.decode(&packet) {
                Ok(decoded) => {
                    let spec = *decoded.spec();
                    let frames = decoded.frames();
                    if frames == 0 {
                        continue;
                    }
                    self.channels = spec.channels.count().max(1);
                    let need_new = match &self.sbuf {
                        Some(b) => b.capacity() < decoded.capacity() * self.channels,
                        None => true,
                    };
                    if need_new {
                        self.sbuf = Some(SampleBuffer::<f32>::new(decoded.capacity() as u64, spec));
                    }
                    let sbuf = self.sbuf.as_mut().unwrap();
                    sbuf.copy_interleaved_ref(decoded);
                    let skip = (self.skip as usize).min(frames);
                    self.skip -= skip as u64;
                    if skip == frames {
                        continue;
                    }
                    let ch = self.channels;
                    // Réemprunt immuable pour renvoyer la tranche.
                    let samples = self.sbuf.as_ref().unwrap().samples();
                    return Some((ch, &samples[skip * ch..frames * ch]));
                }
                Err(SymError::DecodeError(_)) => continue,
                Err(_) => return None,
            }
        }
    }
}

/// Mixe un paquet entrelacé de `ch` canaux en stéréo, ajouté à `l` et `r`.
pub fn to_stereo(samples: &[f32], ch: usize, l: &mut Vec<f32>, r: &mut Vec<f32>) {
    match ch {
        1 => {
            l.extend_from_slice(samples);
            r.extend_from_slice(samples);
        }
        2 => {
            for f in samples.chunks_exact(2) {
                l.push(f[0]);
                r.push(f[1]);
            }
        }
        _ => {
            // Réduction simple : avant gauche/droite + centre et arrières atténués.
            for f in samples.chunks_exact(ch) {
                let c = if ch >= 3 { f[2] * 0.707 } else { 0.0 };
                let (sl, sr) = if ch >= 6 { (f[4] * 0.707, f[5] * 0.707) } else { (0.0, 0.0) };
                l.push((f[0] + c + sl) * 0.6);
                r.push((f[1] + c + sr) * 0.6);
            }
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
pub struct PlayItem {
    pub id: i64,
    pub path: String,
    /// Gain ReplayGain à appliquer (dB), 0 si désactivé.
    #[serde(default)]
    pub gain_db: f32,
    /// Vrai si ce morceau suit le précédent sur le même album : pas de fondu.
    #[serde(default)]
    pub no_xfade: bool,
    #[serde(default)]
    pub duration_ms: u64,
}

const RS_CHUNK: usize = 1024;

/// Morceau en lecture : stéréo, à la fréquence de la sortie, gain appliqué.
pub struct Source {
    pub item: PlayItem,
    dec: Decoded,
    pub file_rate: u32,
    pub bits: u32,
    out_rate: u32,
    rs: Option<FftFixedIn<f32>>,
    rs_in: [Vec<f32>; 2],
    rs_trim: usize,
    tmp: [Vec<f32>; 2],
    buf: Vec<f32>,
    buf_pos: usize,
    pub eof: bool,
    /// Position de départ (en trames de sortie) après un saut.
    pub start_frames: u64,
    delivered: u64,
    gain: f32,
}

impl Source {
    pub fn open(item: PlayItem) -> Result<Source> {
        let dec = Decoded::open(Path::new(&item.path))?;
        let gain = 10f32.powf(item.gain_db / 20.0);
        Ok(Source {
            file_rate: dec.rate,
            bits: dec.bits,
            out_rate: dec.rate,
            item,
            dec,
            rs: None,
            rs_in: [Vec::new(), Vec::new()],
            rs_trim: 0,
            tmp: [Vec::new(), Vec::new()],
            buf: Vec::new(),
            buf_pos: 0,
            eof: false,
            start_frames: 0,
            delivered: 0,
            gain,
        })
    }

    pub fn gain(&self) -> f32 {
        self.gain
    }

    pub fn resampled(&self) -> bool {
        self.out_rate != self.file_rate
    }

    fn make_resampler(&mut self) {
        self.rs_in[0].clear();
        self.rs_in[1].clear();
        self.rs = None;
        self.rs_trim = 0;
        if self.out_rate != self.file_rate {
            if let Ok(rs) = FftFixedIn::<f32>::new(self.file_rate as usize, self.out_rate as usize, RS_CHUNK, 2, 2) {
                self.rs_trim = rs.output_delay();
                self.rs = Some(rs);
            }
        }
    }

    pub fn set_out_rate(&mut self, rate: u32) {
        self.out_rate = rate;
        self.make_resampler();
    }

    pub fn seek(&mut self, ms: u64) -> Result<()> {
        self.dec.seek(ms as f64 / 1000.0)?;
        self.make_resampler();
        self.buf.clear();
        self.buf_pos = 0;
        self.eof = false;
        self.delivered = 0;
        self.start_frames = ms * self.out_rate as u64 / 1000;
        Ok(())
    }

    pub fn duration_ms(&self) -> u64 {
        match self.dec.n_frames {
            Some(n) if self.file_rate > 0 => n * 1000 / self.file_rate as u64,
            _ => self.item.duration_ms,
        }
    }

    /// Trames de sortie restantes avant la fin (si la durée est connue).
    pub fn remaining(&self) -> Option<u64> {
        let total = self.duration_ms() * self.out_rate as u64 / 1000;
        if total == 0 {
            return None;
        }
        Some(total.saturating_sub(self.start_frames + self.delivered))
    }

    fn push_resampled(&mut self, out: Vec<Vec<f32>>) {
        let n = out[0].len();
        let skip = self.rs_trim.min(n);
        self.rs_trim -= skip;
        for i in skip..n {
            self.buf.push(out[0][i]);
            self.buf.push(out[1][i]);
        }
    }

    fn refill(&mut self) {
        if self.buf_pos > 0 && self.buf_pos >= self.buf.len() {
            self.buf.clear();
            self.buf_pos = 0;
        }
        self.tmp[0].clear();
        self.tmp[1].clear();
        let got = match self.dec.next() {
            Some((ch, samples)) => {
                let (l, r) = self.tmp.split_at_mut(1);
                to_stereo(samples, ch, &mut l[0], &mut r[0]);
                true
            }
            None => false,
        };
        if got {
            if self.rs.is_some() {
                self.rs_in[0].extend_from_slice(&self.tmp[0]);
                self.rs_in[1].extend_from_slice(&self.tmp[1]);
                while self.rs_in[0].len() >= RS_CHUNK {
                    let chunk = [self.rs_in[0][..RS_CHUNK].to_vec(), self.rs_in[1][..RS_CHUNK].to_vec()];
                    self.rs_in[0].drain(..RS_CHUNK);
                    self.rs_in[1].drain(..RS_CHUNK);
                    if let Ok(out) = self.rs.as_mut().unwrap().process(&chunk, None) {
                        self.push_resampled(out);
                    }
                }
            } else {
                for i in 0..self.tmp[0].len() {
                    self.buf.push(self.tmp[0][i]);
                    self.buf.push(self.tmp[1][i]);
                }
            }
        } else {
            // Fin du fichier : on vide le rééchantillonneur.
            if let Some(mut rs) = self.rs.take() {
                let rest = [std::mem::take(&mut self.rs_in[0]), std::mem::take(&mut self.rs_in[1])];
                if let Ok(out) = rs.process_partial(Some(&rest), None) {
                    self.push_resampled(out);
                }
                if let Ok(out) = rs.process_partial::<Vec<f32>>(None, None) {
                    self.push_resampled(out);
                }
            }
            self.eof = true;
        }
    }

    /// Ajoute jusqu'à `frames` trames stéréo à `out`. Renvoie le nombre de trames écrites.
    pub fn read(&mut self, out: &mut Vec<f32>, frames: usize) -> usize {
        let mut written = 0;
        while written < frames {
            let avail = (self.buf.len() - self.buf_pos) / 2;
            if avail == 0 {
                if self.eof {
                    break;
                }
                self.refill();
                continue;
            }
            let n = avail.min(frames - written);
            let slice = &self.buf[self.buf_pos..self.buf_pos + n * 2];
            if self.gain == 1.0 {
                out.extend_from_slice(slice);
            } else {
                out.extend(slice.iter().map(|s| s * self.gain));
            }
            self.buf_pos += n * 2;
            written += n;
        }
        self.delivered += written as u64;
        written
    }
}
