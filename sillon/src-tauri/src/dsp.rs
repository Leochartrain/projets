//! Égaliseur paramétrique, préampli et limiteur.

use serde::Deserialize;

#[derive(Deserialize, Clone, Debug)]
pub struct Band {
    pub freq: f32,
    pub gain: f32,
    pub q: f32,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct DspConfig {
    pub enabled: bool,
    /// Préampli en dB.
    pub preamp: f32,
    pub bands: Vec<Band>,
    pub limiter: bool,
}

/// Filtre en cloche (formules RBJ), forme directe II transposée, état par canal.
struct Biquad {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    z: [[f64; 2]; 2],
}

impl Biquad {
    fn peaking(rate: f64, freq: f64, gain_db: f64, q: f64) -> Biquad {
        let a = 10f64.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f64::consts::PI * (freq.min(rate * 0.45)) / rate;
        let alpha = w0.sin() / (2.0 * q.max(0.1));
        let cos = w0.cos();
        let a0 = 1.0 + alpha / a;
        Biquad {
            b0: (1.0 + alpha * a) / a0,
            b1: (-2.0 * cos) / a0,
            b2: (1.0 - alpha * a) / a0,
            a1: (-2.0 * cos) / a0,
            a2: (1.0 - alpha / a) / a0,
            z: [[0.0; 2]; 2],
        }
    }

    #[inline]
    fn run(&mut self, ch: usize, x: f64) -> f64 {
        let z = &mut self.z[ch];
        let y = self.b0 * x + z[0];
        z[0] = self.b1 * x - self.a1 * y + z[1];
        z[1] = self.b2 * x - self.a2 * y;
        y
    }
}

pub struct Dsp {
    cfg: DspConfig,
    rate: u32,
    filters: Vec<Biquad>,
    pre: f32,
    env: f32,
    release: f32,
}

const THRESHOLD: f32 = 0.985;

impl Dsp {
    pub fn new() -> Dsp {
        Dsp { cfg: DspConfig::default(), rate: 44100, filters: Vec::new(), pre: 1.0, env: 0.0, release: 0.999 }
    }

    pub fn set(&mut self, cfg: DspConfig) {
        self.cfg = cfg;
        self.rebuild();
    }

    pub fn set_rate(&mut self, rate: u32) {
        if rate != self.rate {
            self.rate = rate;
            self.rebuild();
        }
    }

    fn rebuild(&mut self) {
        let rate = self.rate as f64;
        // On conserve l'état des filtres quand leur nombre ne change pas (pas de clic au réglage).
        let old: Vec<[[f64; 2]; 2]> = self.filters.iter().map(|f| f.z).collect();
        self.filters = self
            .cfg
            .bands
            .iter()
            .filter(|b| b.gain.abs() > 0.01)
            .map(|b| Biquad::peaking(rate, b.freq as f64, b.gain as f64, b.q as f64))
            .collect();
        if old.len() == self.filters.len() {
            for (f, z) in self.filters.iter_mut().zip(old) {
                f.z = z;
            }
        }
        self.pre = 10f32.powf(self.cfg.preamp / 20.0);
        self.release = (-1.0 / (0.25 * self.rate as f32)).exp();
    }

    /// Vrai si le signal est modifié par l'égaliseur ou le préampli.
    pub fn active(&self) -> bool {
        self.cfg.enabled && (!self.filters.is_empty() || (self.pre - 1.0).abs() > 1e-4)
    }

    /// Traite un bloc stéréo entrelacé. `boosted` : un gain > 1 a été appliqué en amont.
    pub fn process(&mut self, buf: &mut [f32], boosted: bool) {
        let active = self.active();
        if active {
            let pre = self.pre as f64;
            for frame in buf.chunks_exact_mut(2) {
                for ch in 0..2 {
                    let mut x = frame[ch] as f64 * pre;
                    for f in self.filters.iter_mut() {
                        x = f.run(ch, x);
                    }
                    frame[ch] = x as f32;
                }
            }
        }
        // Le limiteur n'intervient que si le signal a pu dépasser 0 dBFS : sinon le flux reste intact.
        if self.cfg.limiter && (active || boosted) {
            for frame in buf.chunks_exact_mut(2) {
                let peak = frame[0].abs().max(frame[1].abs());
                self.env = if peak > self.env { peak } else { self.env * self.release + peak * (1.0 - self.release) };
                if self.env > THRESHOLD {
                    let g = THRESHOLD / self.env;
                    frame[0] *= g;
                    frame[1] *= g;
                }
            }
        }
    }
}
