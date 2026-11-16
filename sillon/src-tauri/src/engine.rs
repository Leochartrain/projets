//! Moteur de lecture : un fil dédié décode, traite et alimente la sortie cpal.
//!
//! Chaîne : Source (décodage, gain ReplayGain, rééchantillonnage éventuel) → fondu enchaîné
//! → égaliseur / limiteur → tampon circulaire → rappel cpal (volume, pause).

use crate::decode::{PlayItem, Source};
use crate::dsp::{Dsp, DspConfig};
use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crossbeam_channel::{unbounded, Receiver, RecvTimeoutError, Sender};
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const BLOCK: usize = 1024;
const FFT_SIZE: usize = 2048;
const BANDS: usize = 56;

#[derive(Deserialize, Clone, Debug, Default)]
pub struct Options {
    /// Durée du fondu enchaîné (0 = désactivé).
    pub crossfade_ms: u64,
    /// Nom de la sortie choisie (None = sortie par défaut du système).
    pub device: Option<String>,
    /// Adapter la fréquence de la sortie à celle du fichier quand la carte son l'accepte.
    pub match_rate: bool,
}

pub enum Cmd {
    Load { item: PlayItem, position_ms: u64, autoplay: bool },
    SetNext(Option<PlayItem>),
    Play,
    Pause,
    Toggle,
    Seek(u64),
    Stop,
    Volume(f32),
    Dsp(DspConfig),
    Options(Options),
    Sleep { seconds: Option<u64>, end_of_track: bool },
    Visualizer(bool),
}

#[derive(Serialize, Clone, Default)]
pub struct State {
    pub status: &'static str,
    pub track_id: Option<i64>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub out_rate: u32,
    pub file_rate: u32,
    pub bits: u32,
    pub resampled: bool,
    pub dsp_active: bool,
    pub device: String,
    pub sleep_remaining: Option<u64>,
    pub sleep_end_of_track: bool,
}

/// État partagé avec le rappel audio (temps réel : uniquement des atomiques).
struct Shared {
    paused: AtomicBool,
    volume: AtomicU32,
    played: AtomicU64,
    flush: AtomicBool,
    vis: AtomicBool,
    error: AtomicBool,
}

struct Callback {
    cons: rtrb::Consumer<f32>,
    vis: rtrb::Producer<f32>,
    shared: Arc<Shared>,
    gain: f32,
    channels: usize,
    step: f32,
}

impl Callback {
    fn fill<T: Copy>(&mut self, data: &mut [T], conv: impl Fn(f32) -> T) {
        let sh = &self.shared;
        if sh.flush.load(Ordering::Acquire) {
            while self.cons.pop().is_ok() {}
            sh.flush.store(false, Ordering::Release);
        }
        let paused = sh.paused.load(Ordering::Relaxed);
        let target = if paused { 0.0 } else { f32::from_bits(sh.volume.load(Ordering::Relaxed)) };
        let vis = sh.vis.load(Ordering::Relaxed);
        let zero = conv(0.0);
        let mut played = 0u64;
        for frame in data.chunks_mut(self.channels) {
            // Rampe courte vers le volume cible : pas de clic à la pause ni au réglage.
            let diff = target - self.gain;
            if diff.abs() < 1e-4 {
                self.gain = target;
            } else {
                self.gain += diff * self.step;
            }
            if (paused && self.gain == 0.0) || self.cons.slots() < 2 {
                frame.fill(zero);
                continue;
            }
            let l = self.cons.pop().unwrap_or(0.0) * self.gain;
            let r = self.cons.pop().unwrap_or(0.0) * self.gain;
            played += 1;
            if vis {
                let _ = self.vis.push((l + r) * 0.5);
            }
            if self.channels == 1 {
                frame[0] = conv((l + r) * 0.5);
            } else {
                frame[0] = conv(l);
                frame[1] = conv(r);
                for x in frame[2..].iter_mut() {
                    *x = zero;
                }
            }
        }
        sh.played.fetch_add(played, Ordering::Release);
    }
}

struct Output {
    _stream: cpal::Stream,
    rate: u32,
    name: String,
    prod: rtrb::Producer<f32>,
    vis: rtrb::Consumer<f32>,
}

pub fn devices() -> Vec<String> {
    let host = cpal::default_host();
    match host.output_devices() {
        Ok(list) => list.map(|d| d.to_string()).collect(),
        Err(_) => Vec::new(),
    }
}

fn pick(opts: &Options, file_rate: u32) -> Result<(cpal::Device, cpal::SupportedStreamConfig, String)> {
    let host = cpal::default_host();
    let chosen = opts
        .device
        .as_ref()
        .and_then(|name| host.output_devices().ok()?.find(|d| &d.to_string() == name));
    let device = chosen.or_else(|| host.default_output_device()).ok_or_else(|| anyhow!("aucune sortie audio"))?;
    let default = device.default_output_config().map_err(|e| anyhow!("sortie audio : {e}"))?;
    let mut cfg = default.clone();
    if opts.match_rate && file_rate != default.sample_rate() {
        if let Ok(list) = device.supported_output_configs() {
            let mut best: Option<cpal::SupportedStreamConfig> = None;
            for c in list {
                if c.min_sample_rate() <= file_rate && file_rate <= c.max_sample_rate() && c.channels() == default.channels() {
                    let same_fmt = c.sample_format() == default.sample_format();
                    if best.is_none() || same_fmt {
                        best = Some(c.with_sample_rate(file_rate));
                    }
                }
            }
            if let Some(b) = best {
                cfg = b;
            }
        }
    }
    let name = device.to_string();
    Ok((device, cfg, name))
}

fn open_output(shared: &Arc<Shared>, device: cpal::Device, cfg: cpal::SupportedStreamConfig, name: String) -> Result<Output> {
    let rate = cfg.sample_rate();
    let channels = cfg.channels() as usize;
    // ~0,35 s de tampon : assez pour ne jamais manquer, assez peu pour que l'égaliseur réagisse vite.
    let (prod, cons) = rtrb::RingBuffer::<f32>::new((rate as usize * 2 * 35 / 100).max(8192));
    let (vprod, vcons) = rtrb::RingBuffer::<f32>::new(16384);
    let mut cb = Callback {
        cons,
        vis: vprod,
        shared: shared.clone(),
        gain: 0.0,
        channels,
        step: 1.0 - (-1.0 / (0.008 * rate as f32)).exp(),
    };
    let sh = shared.clone();
    let err = move |_e: cpal::Error| {
        sh.error.store(true, Ordering::Relaxed);
    };
    let config = cfg.config();
    use cpal::SampleFormat as F;
    let stream = match cfg.sample_format() {
        F::F32 => device.build_output_stream(config, move |d: &mut [f32], _: &cpal::OutputCallbackInfo| cb.fill(d, |x| x), err, None),
        F::I16 => device.build_output_stream(
            config,
            move |d: &mut [i16], _: &cpal::OutputCallbackInfo| cb.fill(d, |x| (x.clamp(-1.0, 1.0) * 32767.0) as i16),
            err,
            None,
        ),
        F::I32 => device.build_output_stream(
            config,
            move |d: &mut [i32], _: &cpal::OutputCallbackInfo| cb.fill(d, |x| (x.clamp(-1.0, 1.0) as f64 * 2147483647.0) as i32),
            err,
            None,
        ),
        F::U16 => device.build_output_stream(
            config,
            move |d: &mut [u16], _: &cpal::OutputCallbackInfo| cb.fill(d, |x| ((x.clamp(-1.0, 1.0) * 32767.0) as i32 + 32768) as u16),
            err,
            None,
        ),
        other => return Err(anyhow!("format de sortie non géré : {other:?}")),
    }
    .map_err(|e| anyhow!("ouverture de la sortie : {e}"))?;
    stream.play().map_err(|e| anyhow!("démarrage de la sortie : {e}"))?;
    Ok(Output { _stream: stream, rate, name, prod, vis: vcons })
}

#[derive(Clone)]
struct Segment {
    /// Indice (en trames écrites) où ce morceau commence dans le flux.
    start: u64,
    item: PlayItem,
    offset: u64,
    duration_ms: u64,
    file_rate: u32,
    bits: u32,
    resampled: bool,
    /// Vrai pour un enchaînement automatique (à annoncer à l'interface).
    announce: bool,
}

struct Fade {
    old: Source,
    len: u64,
    pos: u64,
}

#[derive(PartialEq, Clone, Copy)]
enum Status {
    Stopped,
    Playing,
    Paused,
}

struct Inner {
    app: AppHandle,
    shared: Arc<Shared>,
    out: Option<Output>,
    cur: Option<Source>,
    next: Option<Source>,
    fade: Option<Fade>,
    pending_switch: Option<Source>,
    segments: VecDeque<Segment>,
    active: Option<Segment>,
    written: u64,
    played_base: u64,
    status: Status,
    opts: Options,
    dsp: Dsp,
    block: Vec<f32>,
    tmp: Vec<f32>,
    sleep_at: Option<Instant>,
    sleep_eot: bool,
    vis_buf: Vec<f32>,
    fft: Arc<dyn Fft<f32>>,
    last_state: Instant,
    last_vis: Instant,
    dirty: bool,
}

#[derive(Clone)]
pub struct Engine {
    tx: Sender<Cmd>,
}

impl Engine {
    pub fn send(&self, cmd: Cmd) {
        let _ = self.tx.send(cmd);
    }
}

pub fn spawn(app: AppHandle) -> Engine {
    let (tx, rx) = unbounded::<Cmd>();
    std::thread::Builder::new()
        .name("sillon-audio".into())
        .spawn(move || {
            let shared = Arc::new(Shared {
                paused: AtomicBool::new(true),
                volume: AtomicU32::new(1f32.to_bits()),
                played: AtomicU64::new(0),
                flush: AtomicBool::new(false),
                vis: AtomicBool::new(false),
                error: AtomicBool::new(false),
            });
            let mut inner = Inner {
                app,
                shared,
                out: None,
                cur: None,
                next: None,
                fade: None,
                pending_switch: None,
                segments: VecDeque::new(),
                active: None,
                written: 0,
                played_base: 0,
                status: Status::Stopped,
                opts: Options::default(),
                dsp: Dsp::new(),
                block: Vec::with_capacity(BLOCK * 2),
                tmp: Vec::with_capacity(BLOCK * 2),
                sleep_at: None,
                sleep_eot: false,
                vis_buf: Vec::with_capacity(FFT_SIZE * 2),
                fft: FftPlanner::<f32>::new().plan_fft_forward(FFT_SIZE),
                last_state: Instant::now(),
                last_vis: Instant::now(),
                dirty: false,
            };
            inner.run(rx);
        })
        .expect("fil audio");
    Engine { tx }
}

impl Inner {
    fn run(&mut self, rx: Receiver<Cmd>) {
        loop {
            // Commandes : sans attente si on a du décodage à faire.
            let mut produced = false;
            loop {
                match rx.try_recv() {
                    Ok(cmd) => self.handle(cmd),
                    Err(crossbeam_channel::TryRecvError::Empty) => break,
                    Err(crossbeam_channel::TryRecvError::Disconnected) => return,
                }
            }
            if self.shared.error.swap(false, Ordering::Relaxed) {
                self.recover();
            }
            for _ in 0..8 {
                if !self.produce() {
                    break;
                }
                produced = true;
            }
            self.track_progress();
            self.tick();
            if !produced {
                match rx.recv_timeout(Duration::from_millis(8)) {
                    Ok(cmd) => self.handle(cmd),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
        }
    }

    fn error(&self, id: Option<i64>, message: String) {
        let _ = self.app.emit("player:error", serde_json::json!({ "id": id, "message": message }));
    }

    fn played(&self) -> u64 {
        self.shared.played.load(Ordering::Acquire).saturating_sub(self.played_base)
    }

    fn position_ms(&self) -> u64 {
        let (Some(seg), Some(out)) = (&self.active, &self.out) else { return 0 };
        let frames = self.played().saturating_sub(seg.start) + seg.offset;
        let ms = frames * 1000 / out.rate.max(1) as u64;
        if seg.duration_ms > 0 { ms.min(seg.duration_ms) } else { ms }
    }

    /// Vide le tampon de sortie et remet les compteurs à zéro.
    fn flush(&mut self) {
        if self.out.is_some() {
            self.shared.flush.store(true, Ordering::Release);
            let t = Instant::now();
            while self.shared.flush.load(Ordering::Acquire) && t.elapsed() < Duration::from_millis(250) {
                std::thread::sleep(Duration::from_millis(1));
            }
        }
        self.written = 0;
        self.played_base = self.shared.played.load(Ordering::Acquire);
        self.segments.clear();
    }

    fn ensure_output(&mut self, file_rate: u32) -> Result<()> {
        let (device, cfg, name) = pick(&self.opts, file_rate)?;
        let same = self.out.as_ref().map(|o| o.rate == cfg.sample_rate() && o.name == name).unwrap_or(false);
        if !same {
            self.out = None;
            self.shared.flush.store(false, Ordering::Release);
            let out = open_output(&self.shared, device, cfg, name)?;
            self.dsp.set_rate(out.rate);
            self.out = Some(out);
        }
        Ok(())
    }

    fn segment_for(src: &Source, start: u64, announce: bool) -> Segment {
        Segment {
            start,
            item: src.item.clone(),
            offset: src.start_frames,
            duration_ms: src.duration_ms(),
            file_rate: src.file_rate,
            bits: src.bits,
            resampled: src.resampled(),
            announce,
        }
    }

    fn load(&mut self, item: PlayItem, position_ms: u64, autoplay: bool) {
        let id = item.id;
        let mut src = match Source::open(item) {
            Ok(s) => s,
            Err(e) => {
                self.error(Some(id), format!("Lecture impossible : {e}"));
                return;
            }
        };
        if let Err(e) = self.ensure_output(src.file_rate) {
            self.error(Some(id), format!("{e}"));
            return;
        }
        self.shared.paused.store(!autoplay, Ordering::Relaxed);
        self.flush();
        let rate = self.out.as_ref().map(|o| o.rate).unwrap_or(src.file_rate);
        src.set_out_rate(rate);
        if position_ms > 0 {
            let _ = src.seek(position_ms);
        }
        let seg = Self::segment_for(&src, 0, false);
        self.active = Some(seg);
        self.cur = Some(src);
        self.next = None;
        self.fade = None;
        self.pending_switch = None;
        self.status = if autoplay { Status::Playing } else { Status::Paused };
        self.dirty = true;
    }

    fn open_next(&mut self, item: PlayItem) -> Option<Source> {
        let mut src = Source::open(item).ok()?;
        if let Some(out) = &self.out {
            src.set_out_rate(out.rate);
        }
        Some(src)
    }

    fn handle(&mut self, cmd: Cmd) {
        match cmd {
            Cmd::Load { item, position_ms, autoplay } => self.load(item, position_ms, autoplay),
            Cmd::SetNext(item) => {
                self.next = match item {
                    Some(it) => {
                        let id = it.id;
                        let n = self.open_next(it);
                        if n.is_none() {
                            self.error(Some(id), "Morceau suivant illisible".into());
                        }
                        n
                    }
                    None => None,
                };
            }
            Cmd::Play => {
                if self.status == Status::Stopped {
                    // Fin de file : on relance le dernier morceau depuis le début.
                    if let Some(seg) = self.active.clone() {
                        self.load(seg.item, 0, true);
                    }
                } else if self.active.is_some() {
                    self.shared.paused.store(false, Ordering::Relaxed);
                    self.status = Status::Playing;
                    self.dirty = true;
                }
            }
            Cmd::Pause => {
                if self.status == Status::Playing {
                    self.shared.paused.store(true, Ordering::Relaxed);
                    self.status = Status::Paused;
                    self.dirty = true;
                }
            }
            Cmd::Toggle => {
                let c = if self.status == Status::Playing { Cmd::Pause } else { Cmd::Play };
                self.handle(c);
            }
            Cmd::Seek(ms) => self.seek(ms),
            Cmd::Stop => {
                self.shared.paused.store(true, Ordering::Relaxed);
                self.flush();
                self.cur = None;
                self.next = None;
                self.fade = None;
                self.pending_switch = None;
                self.active = None;
                self.status = Status::Stopped;
                self.dirty = true;
            }
            Cmd::Volume(v) => {
                self.shared.volume.store(v.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
            }
            Cmd::Dsp(cfg) => {
                self.dsp.set(cfg);
                self.dirty = true;
            }
            Cmd::Options(o) => {
                let changed = o.device != self.opts.device || o.match_rate != self.opts.match_rate;
                self.opts = o;
                if changed && self.active.is_some() {
                    self.recover();
                }
            }
            Cmd::Sleep { seconds, end_of_track } => {
                self.sleep_at = seconds.map(|s| Instant::now() + Duration::from_secs(s));
                self.sleep_eot = end_of_track;
                self.dirty = true;
            }
            Cmd::Visualizer(on) => {
                self.shared.vis.store(on, Ordering::Relaxed);
            }
        }
    }

    /// Rouvre la sortie (périphérique changé ou débranché) en gardant la position.
    fn recover(&mut self) {
        let Some(seg) = self.active.clone() else {
            self.out = None;
            return;
        };
        let pos = self.position_ms();
        let playing = self.status == Status::Playing;
        let next = self.upcoming_item();
        self.out = None;
        if self.status == Status::Stopped {
            return;
        }
        self.load(seg.item, pos, playing);
        if let Some(n) = next {
            self.next = self.open_next(n);
        }
    }

    /// Le morceau prévu après celui qu'on entend.
    fn upcoming_item(&self) -> Option<PlayItem> {
        let audible = self.active.as_ref()?.item.id;
        if let Some(seg) = self.segments.front() {
            return Some(seg.item.clone());
        }
        if let Some(c) = &self.cur {
            if c.item.id != audible {
                return Some(c.item.clone());
            }
        }
        if let Some(p) = &self.pending_switch {
            return Some(p.item.clone());
        }
        self.next.as_ref().map(|n| n.item.clone())
    }

    fn seek(&mut self, ms: u64) {
        let Some(seg) = self.active.clone() else { return };
        let simple = self.fade.is_none()
            && self.segments.is_empty()
            && self.cur.as_ref().map(|c| c.item.id == seg.item.id).unwrap_or(false);
        if simple {
            self.flush();
            let cur = self.cur.as_mut().unwrap();
            if cur.seek(ms).is_err() {
                return;
            }
            let mut s = seg;
            s.start = 0;
            s.offset = cur.start_frames;
            self.active = Some(s);
            if self.status == Status::Stopped {
                self.status = Status::Paused;
            }
        } else {
            // On décodait déjà la suite (fin de morceau, fondu) : on repart du morceau audible.
            let next = self.upcoming_item();
            let playing = self.status == Status::Playing;
            self.load(seg.item, ms, playing);
            if let Some(n) = next {
                self.next = self.open_next(n);
            }
        }
        self.dirty = true;
    }

    /// Décode et pousse un bloc vers la sortie. Renvoie faux s'il n'y a rien à faire.
    fn produce(&mut self) -> bool {
        let Some(out) = &self.out else { return false };
        if self.cur.is_none() || out.prod.slots() < BLOCK * 2 {
            return false;
        }
        let rate = out.rate as u64;
        self.block.clear();

        // Début d'un fondu enchaîné ?
        let xfade = self.opts.crossfade_ms * rate / 1000;
        if self.fade.is_none() && xfade > 0 {
            let start = match (&self.cur, &self.next) {
                (Some(cur), Some(next)) if !next.item.no_xfade => match cur.remaining() {
                    Some(rem) if rem <= xfade && rem > rate / 4 => Some(rem),
                    _ => None,
                },
                _ => None,
            };
            if let Some(len) = start {
                let old = self.cur.take().unwrap();
                let new = self.next.take().unwrap();
                self.segments.push_back(Self::segment_for(&new, self.written, true));
                self.fade = Some(Fade { old, len, pos: 0 });
                self.cur = Some(new);
            }
        }

        let mut boosted = false;
        let cur = self.cur.as_mut().unwrap();
        boosted |= cur.gain() > 1.0;
        let got = cur.read(&mut self.block, BLOCK);

        if let Some(f) = &mut self.fade {
            self.tmp.clear();
            let n = f.old.read(&mut self.tmp, got);
            boosted = true;
            for i in 0..got {
                let t = ((f.pos + i as u64) as f32 / f.len.max(1) as f32).min(1.0);
                let (a_new, a_old) = ((t * std::f32::consts::FRAC_PI_2).sin(), (t * std::f32::consts::FRAC_PI_2).cos());
                let (ol, or) = if i < n { (self.tmp[i * 2], self.tmp[i * 2 + 1]) } else { (0.0, 0.0) };
                self.block[i * 2] = self.block[i * 2] * a_new + ol * a_old;
                self.block[i * 2 + 1] = self.block[i * 2 + 1] * a_new + or * a_old;
            }
            f.pos += got as u64;
            if f.pos >= f.len || n < got {
                self.fade = None;
            }
        }

        if got < BLOCK {
            // Fin du morceau courant : on enchaîne sans blanc dans le même bloc.
            self.fade = None;
            self.cur = None;
            if let Some(mut next) = self.next.take() {
                let switch = self.opts.match_rate
                    && next.file_rate != out.rate
                    && pick(&self.opts, next.file_rate).map(|(_, c, _)| c.sample_rate() != out.rate).unwrap_or(false);
                if switch {
                    self.pending_switch = Some(next);
                } else {
                    self.segments.push_back(Self::segment_for(&next, self.written + got as u64, true));
                    boosted |= next.gain() > 1.0;
                    next.read(&mut self.block, BLOCK - got);
                    self.cur = Some(next);
                }
            }
        }

        if self.block.is_empty() {
            return self.cur.is_some();
        }
        self.dsp.process(&mut self.block, boosted);
        let out = self.out.as_mut().unwrap();
        for s in self.block.iter() {
            let _ = out.prod.push(*s);
        }
        self.written += (self.block.len() / 2) as u64;
        true
    }

    fn track_progress(&mut self) {
        let played = self.played();
        while self.segments.front().map(|s| s.start <= played).unwrap_or(false) {
            let seg = self.segments.pop_front().unwrap();
            if seg.announce {
                let _ = self.app.emit("player:track", serde_json::json!({ "id": seg.item.id }));
                if self.sleep_eot {
                    self.sleep_eot = false;
                    self.shared.paused.store(true, Ordering::Relaxed);
                    self.status = Status::Paused;
                }
            }
            self.active = Some(seg);
            self.dirty = true;
        }
        if self.status != Status::Playing || self.cur.is_some() || played < self.written {
            return;
        }
        // Tout ce qui a été décodé a été joué.
        if let Some(mut next) = self.pending_switch.take() {
            // Morceau suivant à une autre fréquence : on rouvre la sortie à sa fréquence native.
            if self.ensure_output(next.file_rate).is_ok() {
                self.flush();
                let rate = self.out.as_ref().map(|o| o.rate).unwrap_or(next.file_rate);
                next.set_out_rate(rate);
                self.segments.push_back(Self::segment_for(&next, 0, true));
                self.cur = Some(next);
            }
            return;
        }
        self.status = Status::Stopped;
        self.shared.paused.store(true, Ordering::Relaxed);
        self.sleep_eot = false;
        self.dirty = true;
        let _ = self.app.emit("player:ended", ());
    }

    fn tick(&mut self) {
        let now = Instant::now();
        if let Some(at) = self.sleep_at {
            if now >= at {
                self.sleep_at = None;
                self.handle(Cmd::Pause);
                self.dirty = true;
            }
        }
        let period = if self.status == Status::Playing { 250 } else { 1000 };
        if self.dirty || now.duration_since(self.last_state) >= Duration::from_millis(period) {
            self.dirty = false;
            self.last_state = now;
            let _ = self.app.emit("player:state", self.state());
        }
        if self.shared.vis.load(Ordering::Relaxed) && now.duration_since(self.last_vis) >= Duration::from_millis(33) {
            self.last_vis = now;
            self.spectrum();
        }
    }

    fn state(&self) -> State {
        let seg = self.active.as_ref();
        State {
            status: match self.status {
                Status::Playing => "playing",
                Status::Paused => "paused",
                Status::Stopped => "stopped",
            },
            track_id: seg.map(|s| s.item.id),
            position_ms: self.position_ms(),
            duration_ms: seg.map(|s| s.duration_ms).unwrap_or(0),
            out_rate: self.out.as_ref().map(|o| o.rate).unwrap_or(0),
            file_rate: seg.map(|s| s.file_rate).unwrap_or(0),
            bits: seg.map(|s| s.bits).unwrap_or(0),
            resampled: seg.map(|s| s.resampled).unwrap_or(false),
            dsp_active: self.dsp.active(),
            device: self.out.as_ref().map(|o| o.name.clone()).unwrap_or_default(),
            sleep_remaining: self.sleep_at.map(|t| t.saturating_duration_since(Instant::now()).as_secs()),
            sleep_end_of_track: self.sleep_eot,
        }
    }

    fn spectrum(&mut self) {
        let Some(out) = self.out.as_mut() else { return };
        while let Ok(s) = out.vis.pop() {
            self.vis_buf.push(s);
        }
        if self.vis_buf.len() > FFT_SIZE {
            let cut = self.vis_buf.len() - FFT_SIZE;
            self.vis_buf.drain(..cut);
        }
        if self.status != Status::Playing || self.vis_buf.len() < FFT_SIZE {
            return;
        }
        let mut buf: Vec<Complex<f32>> = self
            .vis_buf
            .iter()
            .enumerate()
            .map(|(i, s)| {
                let w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (FFT_SIZE - 1) as f32).cos();
                Complex::new(s * w, 0.0)
            })
            .collect();
        self.fft.process(&mut buf);
        let rate = out.rate as f32;
        let (lo, hi) = (40f32, 16000f32.min(rate * 0.45));
        let mut bands = Vec::with_capacity(BANDS);
        for b in 0..BANDS {
            let f0 = lo * (hi / lo).powf(b as f32 / BANDS as f32);
            let f1 = lo * (hi / lo).powf((b + 1) as f32 / BANDS as f32);
            let i0 = ((f0 / rate * FFT_SIZE as f32) as usize).max(1);
            let i1 = ((f1 / rate * FFT_SIZE as f32) as usize).max(i0 + 1).min(FFT_SIZE / 2);
            let mut peak = 0f32;
            for c in &buf[i0..i1] {
                peak = peak.max(c.norm());
            }
            let db = 20.0 * (peak / (FFT_SIZE as f32 / 4.0) + 1e-9).log10();
            // Légère compensation vers les aigus, naturellement moins énergiques.
            let tilt = b as f32 / BANDS as f32 * 14.0;
            bands.push((((db + tilt + 62.0) / 62.0).clamp(0.0, 1.0) * 255.0) as u8);
        }
        let _ = self.app.emit("player:spectrum", bands);
    }
}
