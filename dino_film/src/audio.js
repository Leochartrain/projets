// Bande-son entièrement synthétisée (Web Audio hors ligne, 48 kHz stéréo) :
// ambiance de forêt, orchestre (cordes, cuivres, percussions), bruitages calés sur l'action.
import { rng, SEED, clamp } from './util.js';
import { KEY, DUR } from './shots.js';

const SR = 48000;

export async function renderAudio(film) {
  const ctx = new OfflineAudioContext(2, SR * DUR, SR), R = rng(SEED + 77);
  // ---------- Chaîne de sortie : compression « film » puis limiteur.
  const bus = ctx.createGain(), comp = ctx.createDynamicsCompressor(), lim = ctx.createDynamicsCompressor(), out = ctx.createGain();
  comp.threshold.value = -20; comp.ratio.value = 3.2; comp.attack.value = 0.012; comp.release.value = 0.28; comp.knee.value = 12;
  lim.threshold.value = -4; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.09; lim.knee.value = 2;
  bus.connect(comp); comp.connect(lim); lim.connect(out); out.connect(ctx.destination);
  out.gain.setValueAtTime(1, 0); out.gain.setValueAtTime(1, KEY.fadeOut); out.gain.linearRampToValueAtTime(0, DUR - 0.02);
  // Réverbération : réponse impulsionnelle générée (grande vallée).
  const irLen = SR * 3.2, ir = ctx.createBuffer(2, irLen, SR);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < irLen; i++) { const t = i / irLen; lp += ((R() * 2 - 1) - lp) * (0.75 - 0.55 * t); d[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1); } }
  const rev = ctx.createConvolver(); rev.buffer = ir; const revG = ctx.createGain(); revG.gain.value = 0.5; rev.connect(revG); revG.connect(bus);
  const nb = ctx.createBuffer(2, SR * 4, SR);
  for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }

  const T = (t) => clamp(t, 0, DUR - 0.001);
  const envOn = (param, pts) => { param.setValueAtTime(pts[0][1], T(pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], T(pts[i][0])); };
  // Sortie d'une voix : panoramique, niveau direct et envoi vers la réverbération.
  const voice = (pan = 0, wet = 0.15, dry = 1) => {
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p);
    const d = ctx.createGain(); d.gain.value = dry; p.connect(d); d.connect(bus);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w); w.connect(rev); }
    return g;
  };
  const filt = (type, f, Q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; };
  const shaper = (k) => { const w = ctx.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } w.curve = c; return w; };
  const noise = (t0, dur, dest, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = rate; s.connect(dest); s.start(T(t0), R() * 3); s.stop(T(t0 + dur)); return s; };
  const osc = (type, f, t0, dur, dest, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(dest); o.start(T(t0)); o.stop(T(t0 + dur)); return o; };
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------- Ambiance : rivière, vent, insectes, chants, selon la position de la caméra.
  { const g = voice(0, 0.05), f = filt('bandpass', 950, 0.5), f2 = filt('highpass', 300); f.connect(f2); f2.connect(g); noise(0, DUR, f);
    envOn(g.gain, [[0, 0.02], [2.45, 0.02], [2.5, 0.13], [4.95, 0.13], [5.0, 0.045], [7.5, 0.03], [9.95, 0.03], [10, 0.16], [12.45, 0.16], [12.5, 0.07], [15, 0.05]]);
    const g2 = voice(0.3, 0), f3 = filt('bandpass', 2600, 1.2); f3.connect(g2); noise(0, DUR, f3, 1.3);
    envOn(g2.gain, [[0, 0], [2.5, 0], [2.52, 0.035], [4.95, 0.035], [5, 0.01], [10, 0.01], [10.02, 0.05], [12.5, 0.05], [12.52, 0.015], [15, 0.01]]); }
  { const g = voice(0, 0.1), f = filt('lowpass', 420, 0.8); f.connect(g); noise(0, DUR, f, 0.7);
    const l = osc('sine', 0.23, 0, DUR, ctx.createGain()), lg = ctx.createGain(); lg.gain.value = 160; l.connect(lg); lg.connect(f.frequency);
    envOn(g.gain, [[0, 0.16], [2.45, 0.18], [2.5, 0.04], [7.5, 0.04], [7.52, 0.06], [10, 0.07], [10.02, 0.1], [12.5, 0.1], [12.6, 0.09], [14.5, 0.16], [15, 0.16]]); }
  for (const [f0, rate, pan] of [[5200, 37, -0.5], [6150, 43, 0.6], [4300, 29, 0.1]]) { // insectes
    const g = voice(pan, 0.03), am = ctx.createGain(); am.gain.value = 0; am.connect(g);
    osc('sine', f0, 0, DUR, am); const l = osc('square', rate, 0, DUR, ctx.createGain()), lg = ctx.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(am.gain); am.gain.value = 0.5;
    const gate = osc('sine', 0.31 + pan * 0.1, 0, DUR, ctx.createGain()), gg = ctx.createGain(); gg.gain.value = 0.004; gate.connect(gg); gg.connect(g.gain);
    envOn(g.gain, [[0, 0.003], [2.5, 0.003], [2.52, 0.009], [KEY.headUp, 0.009], [KEY.headUp + 0.3, 0.002], [5, 0.004], [7.5, 0.002], [10, 0], [12.5, 0], [13.5, 0.004], [15, 0.004]]); }
  const chirp = (t0, f0, n, pan, gain) => { for (let i = 0; i < n; i++) { const t = t0 + i * 0.11, g = voice(pan, 0.5), o = osc('sine', f0, t, 0.1, g);
    envOn(o.frequency, [[t, f0], [t + 0.04, f0 * 1.35], [t + 0.09, f0 * 0.9]]); envOn(g.gain, [[t, 0], [t + 0.012, gain], [t + 0.09, 0]]); } };
  for (const [t, f, n, pan] of [[0.35, 2500, 3, -0.6], [0.9, 3300, 2, 0.5], [1.5, 2100, 4, 0.2], [2.05, 2900, 2, -0.3], [2.7, 3100, 3, 0.7], [3.1, 2400, 2, -0.7], [13.6, 2300, 3, 0.6], [14.2, 2900, 2, -0.5]]) chirp(t, f, n, pan, 0.02);
  for (const [t, f, pan] of [[0.5, 82, -0.25], [1.5, 68, 0.1]]) { // appels lointains des sauropodes
    const g = voice(pan, 0.9, 0.5), b = filt('bandpass', 260, 2.5); b.connect(g); const o = osc('sawtooth', f, t, 1.3, b), o2 = osc('sawtooth', f * 1.5, t, 1.3, b, 8);
    for (const x of [o, o2]) envOn(x.detune, [[t, 0], [t + 0.5, 180], [t + 1.3, -120]]); envOn(g.gain, [[t, 0], [t + 0.35, 0.09], [t + 0.9, 0.07], [t + 1.3, 0]]); }

  // ---------- Musique.
  const strings = (notes, t0, t1, peak, cut0, cut1, att = 0.6, rel = 0.5, pan = 0) => {
    const g = voice(pan, 0.35), f = filt('lowpass', cut0, 0.6); f.connect(g);
    envOn(f.frequency, [[t0, cut0], [t1, cut1]]); envOn(g.gain, [[t0, 0], [t0 + att, peak * 0.7], [t1 - rel * 0.3, peak], [t1 + rel, 0]]);
    for (const n of notes) for (const d of [-9, 0, 8]) { const o = osc('sawtooth', hz(n), t0, t1 - t0 + rel, f, d + (R() - 0.5) * 4); const v = osc('sine', 5.2 + R(), t0, t1 - t0 + rel, ctx.createGain()), vg = ctx.createGain(); vg.gain.value = 5; v.connect(vg); vg.connect(o.detune); }
  };
  const brass = (notes, t0, dur, peak, cut = 1400, pan = 0, att = 0.07) => {
    const g = voice(pan, 0.4), f = filt('lowpass', 300, 1.2); f.connect(g);
    envOn(f.frequency, [[t0, 250], [t0 + att * 1.5, cut], [t0 + dur, cut * 0.55]]); envOn(g.gain, [[t0, 0], [t0 + att, peak], [t0 + dur * 0.7, peak * 0.75], [t0 + dur, 0]]);
    for (const n of notes) { osc('sawtooth', hz(n), t0, dur, f, -5); osc('sawtooth', hz(n), t0, dur, f, 6); osc('square', hz(n), t0, dur, f, 0).detune.value = 2; }
  };
  const boom = (t, gain, f0 = 66, dur = 1.8) => {
    const g = voice(0, 0.3), o = osc('sine', f0, t, dur, g); envOn(o.frequency, [[t, f0], [t + 0.25, f0 * 0.5], [t + dur, f0 * 0.38]]);
    envOn(g.gain, [[t, 0], [t + 0.008, gain], [t + 0.3, gain * 0.55], [t + dur, 0]]);
    const g2 = voice(0, 0.5), lp = filt('lowpass', 220, 0.7); lp.connect(g2); noise(t, 0.5, lp); envOn(g2.gain, [[t, 0], [t + 0.004, gain * 0.9], [t + 0.45, 0]]);
  };
  const taiko = (t, gain, pan = 0) => {
    const g = voice(pan, 0.3), o = osc('sine', 95, t, 0.4, g); envOn(o.frequency, [[t, 110], [t + 0.12, 52]]); envOn(g.gain, [[t, 0], [t + 0.004, gain], [t + 0.36, 0]]);
    const g2 = voice(pan, 0.2), lp = filt('lowpass', 900, 0.7); lp.connect(g2); noise(t, 0.12, lp); envOn(g2.gain, [[t, 0], [t + 0.003, gain * 0.5], [t + 0.1, 0]]);
  };
  const riser = (t0, t1, gain) => { const g = voice(0, 0.4), f = filt('bandpass', 300, 1.5); f.connect(g); noise(t0, t1 - t0, f); envOn(f.frequency, [[t0, 250], [t1, 4200]]); envOn(g.gain, [[t0, 0], [t1 - 0.03, gain], [t1, 0]]); };
  // Plan 1 : majestueux (ré mineur, quintes ouvertes) ; plan 2 : suspendu ; plan 3 : frottement grave ;
  // plan 4 : montée ; plan 5 : sommet avec ostinato ; plan 6 : résolution grave et large.
  strings([38, 45, 50, 53, 57], 0, 2.5, 0.05, 700, 1700, 0.9, 0.5);
  brass([50], 0.25, 1.2, 0.035, 1100, -0.2, 0.25); brass([57], 1.35, 1.25, 0.04, 1200, 0.2, 0.25);
  strings([34, 65, 74], 2.5, KEY.headUp, 0.022, 900, 1200, 0.5, 0.15); strings([81, 82], KEY.headUp + 0.05, 5.0, 0.014, 2500, 3200, 0.2, 0.05);
  strings([26, 39, 45], 5.0, 7.5, 0.06, 500, 900, 0.3, 0.1);
  strings([26, 38, 49, 52, 55, 58], 7.5, 10.0, 0.085, 700, 2600, 1.6, 0.25);
  brass([38, 44], KEY.roar, 1.25, 0.08, 1500, 0, 0.05);
  strings([38, 45, 50, 53, 57, 62], 10.0, 12.5, 0.085, 1900, 2800, 0.1, 0.2);
  strings([26, 38, 45, 50, 57], 12.5, 15.4, 0.075, 1500, 600, 0.25, 1.0);
  brass([38, 45], 12.5, 2.4, 0.05, 900, 0, 0.3);
  for (const [t, n] of [[10.0, [38, 50]], [10.8, [41, 53]], [11.6, [44, 56]], [12.1, [45, 57]]]) brass(n, t, 0.75, 0.085, 1800, 0, 0.04);
  const pat = [50, 50, 53, 50, 57, 50, 53, 52];
  for (let i = 0, t = 8.0; t < 12.48; t += 0.1, i++) { // ostinato de cordes
    if (t > 8.7 && t < 10.0) continue;
    const g = voice((i % 2) * 0.4 - 0.2, 0.2), f = filt('lowpass', 2600, 1); f.connect(g); const lvl = t < 10 ? 0.012 + (t - 8) * 0.03 : 0.05;
    osc('sawtooth', hz(pat[i % 8]), t, 0.09, f, -6); osc('sawtooth', hz(pat[i % 8] + 12), t, 0.09, f, 5); envOn(g.gain, [[t, 0], [t + 0.006, lvl], [t + 0.085, 0]]);
  }
  for (let t = 10.0, i = 0; t < 12.48; t += 0.2, i++) taiko(t, i % 2 ? 0.16 : 0.3, i % 2 ? 0.3 : -0.2);
  for (const t of [11.3, 12.1, 12.3]) { taiko(t + 0.1, 0.18, 0.4); }
  boom(5.0, 0.55); boom(7.5, 0.6); boom(10.0, 0.5, 60, 1.2); boom(12.5, 0.5, 55, 2.3);
  riser(6.9, 7.5, 0.035); riser(9.3, 10.0, 0.05); riser(4.6, 5.0, 0.02);

  // ---------- Bruitages.
  const burst = (t, dur, type, f, Q, gain, pan = 0, wet = 0.12, f1 = null) => { const g = voice(pan, wet), b = filt(type, f, Q); b.connect(g); noise(t, dur + 0.02, b); if (f1) envOn(b.frequency, [[t, f], [t + dur, f1]]); envOn(g.gain, [[t, 0], [t + Math.min(0.006, dur * 0.2), gain], [t + dur, 0]]); };
  const thud = (t, gain, pan = 0, f0 = 52, dur = 0.9) => {
    const g = voice(pan * 0.5, 0.25), o = osc('sine', f0, t, dur, g); envOn(o.frequency, [[t, f0 * 1.5], [t + 0.07, f0], [t + dur, f0 * 0.55]]); envOn(g.gain, [[t, 0], [t + 0.006, gain], [t + dur * 0.35, gain * 0.4], [t + dur, 0]]);
    burst(t, 0.16, 'lowpass', 180, 0.7, gain * 0.9, pan, 0.2);
  };
  // Plan 2 : lapements, grondement lointain, sursaut, gouttes.
  for (let k = 0, t = 2.52; t < KEY.headUp - 0.05; t += 0.323, k++) { burst(t, 0.07, 'bandpass', 520, 4, 0.11, 0.12, 0.05, 1500); burst(t + 0.09, 0.05, 'bandpass', 900, 5, 0.07, 0.12, 0.05, 1900);
    const g = voice(0.12, 0.05), o = osc('sine', 300, t + 0.02, 0.05, g); envOn(o.frequency, [[t + 0.02, 280], [t + 0.07, 620]]); envOn(g.gain, [[t + 0.02, 0], [t + 0.03, 0.05], [t + 0.07, 0]]); }
  thud(KEY.quake2, 0.3, -0.5, 40, 1.3);
  burst(KEY.headUp, 0.22, 'bandpass', 1700, 0.9, 0.16, 0.1, 0.15, 3200);
  burst(KEY.headUp + 0.28, 0.16, 'bandpass', 650, 2, 0.09, 0.1, 0.2);
  for (let k = 0; k < 18; k++) { const t = KEY.headUp + 0.5 + k * 0.075 + R() * 0.05, f = 1100 + R() * 1700, g = voice(0.05 + R() * 0.2, 0.2), o = osc('sine', f, t, 0.04, g); envOn(o.frequency, [[t, f], [t + 0.035, f * 1.5]]); envOn(g.gain, [[t, 0], [t + 0.004, 0.035], [t + 0.036, 0]]); }
  // Appuis des pattes : précalculés par la mise en scène, donc calés à l'image près.
  for (const e of film.events) {
    const near = 1 / (1 + e.dist * 0.1), rex = e.who === 'rex';
    if (e.shot === 2) { const main = Math.abs(e.t - KEY.impact) < 0.03, a = main ? 1 : 0.5;
      thud(e.t, 0.85 * a, e.pan, 44, 1.5); { const g = voice(0, 0.3), o = osc('sine', 31, e.t, 1.3, g); envOn(g.gain, [[e.t, 0], [e.t + 0.02, 0.6 * a], [e.t + 1.3, 0]]); }
      burst(e.t + 0.01, 0.3, 'bandpass', 420, 1.5, 0.35 * a, e.pan, 0.15, 950); burst(e.t + 0.05, 0.22, 'bandpass', 1600, 2, 0.12 * a, e.pan, 0.1, 700);
      for (let k = 0; k < 12; k++) burst(e.t + 0.06 + R() * 0.45, 0.012, 'highpass', 2500 + R() * 3000, 1, 0.05 * a, e.pan + R() - 0.5, 0.1);
    } else if (e.shot === 3) { thud(e.t, 0.5, e.pan, 46, 1.0); burst(e.t, 0.2, 'bandpass', 500, 1.2, 0.12, e.pan, 0.2);
    } else if (e.shot === 4) { thud(e.t, (rex ? 0.42 : 0.2) * (0.4 + near), e.pan, rex ? 44 : 70, rex ? 0.7 : 0.25);
      if (e.water) { burst(e.t, 0.2 + R() * 0.15, 'highpass', 1300 + R() * 900, 0.6, (rex ? 0.2 : 0.13) * (0.35 + near * 1.6), e.pan, 0.12); burst(e.t + 0.02, 0.12, 'bandpass', 700, 1, 0.09 * (0.3 + near), e.pan, 0.1); }
    } else if (e.shot === 5) { thud(e.t, 0.3, e.pan, 44, 1.0); burst(e.t, 0.15, 'lowpass', 600, 0.8, 0.06, e.pan, 0.3); }
  }
  // Rugissement : grognement grave + souffle + harmoniques criardes, glissant vers le grave, réverbéré.
  const roar = (t, dur, gain, pitch = 1, pan = 0) => {
    const g = voice(pan, 0.55), dl = ctx.createDelay(); dl.delayTime.value = 0.013; const pr = ctx.createStereoPanner(); pr.pan.value = 0.8; const wg = ctx.createGain(); wg.gain.value = 0.5;
    g.connect(dl); dl.connect(wg); wg.connect(pr); pr.connect(bus);
    const sh = shaper(3.5), mix = ctx.createGain(); mix.connect(sh);
    for (const [f, Q, a] of [[330, 3.5, 1], [760, 4.5, 0.8], [1450, 5, 0.45], [2600, 4, 0.2]]) { const b = filt('bandpass', f * pitch, Q), bg = ctx.createGain(); bg.gain.value = a; sh.connect(b); b.connect(bg); bg.connect(g); envOn(b.frequency, [[t, f * pitch * 1.15], [t + dur * 0.35, f * pitch], [t + dur, f * pitch * 0.8]]); }
    const am = ctx.createGain(); am.gain.value = 0.55; am.connect(mix);
    const l = osc('sawtooth', 27, t, dur, ctx.createGain()), lg = ctx.createGain(); lg.gain.value = 0.45; l.connect(lg); lg.connect(am.gain); envOn(l.frequency, [[t, 34], [t + dur, 21]]);
    for (const [f, d] of [[57, 0], [57, 14], [86, -9], [114, 5]]) { const o = osc('sawtooth', f * pitch, t, dur, am, d); envOn(o.frequency, [[t, f * pitch * 1.3], [t + 0.18, f * pitch * 1.12], [t + dur * 0.6, f * pitch * 0.92], [t + dur, f * pitch * 0.72]]);
      const v = osc('sine', 7.5, t, dur, ctx.createGain()), vg = ctx.createGain(); vg.gain.value = f * 0.035; v.connect(vg); vg.connect(o.frequency); }
    const sc = ctx.createGain(); sc.connect(mix); const so = osc('sawtooth', 236 * pitch, t + 0.06, dur - 0.06, sc); envOn(so.frequency, [[t + 0.06, 300 * pitch], [t + 0.3, 250 * pitch], [t + dur, 170 * pitch]]); envOn(sc.gain, [[t, 0], [t + 0.2, 0.3], [t + dur * 0.7, 0.22], [t + dur, 0]]);
    const nz = filt('bandpass', 1000 * pitch, 0.7), ng = ctx.createGain(); nz.connect(ng); ng.connect(g); noise(t, dur, nz); envOn(ng.gain, [[t, 0], [t + 0.08, 0.5], [t + dur * 0.6, 0.6], [t + dur, 0]]);
    const nm = ctx.createGain(); nm.gain.value = 0.25; nm.connect(mix); noise(t, dur, nm);
    const sub = voice(0, 0.2); osc('sine', 39 * pitch, t, dur, sub); envOn(sub.gain, [[t, 0], [t + 0.1, gain * 0.9], [t + dur * 0.7, gain * 0.6], [t + dur, 0]]);
    envOn(g.gain, [[t, 0], [t + 0.07, gain * 0.75], [t + 0.3, gain], [t + dur * 0.72, gain * 0.8], [t + dur, 0]]);
  };
  for (let k = 0; k < 2; k++) { const t = 7.55 + k * 0.95; burst(t, 0.5, 'bandpass', 420, 1.2, 0.1, 0, 0.3, 300); } // souffle avant le cri
  burst(KEY.roarIn, 0.26, 'bandpass', 600, 1, 0.14, 0, 0.3, 1400); // inspiration
  roar(KEY.roar, 1.75, 0.5, 1, 0);
  // Plan 5 : cris de panique du troupeau, grognement du poursuivant, vent de la course.
  const honk = (t, f, pan, gain) => { const g = voice(pan, 0.3), sh = shaper(2), b1 = filt('bandpass', 950, 3), b2 = filt('bandpass', 1900, 4); sh.connect(b1); sh.connect(b2); b1.connect(g); b2.connect(g);
    for (const d of [0, 11]) { const o = osc('sawtooth', f, t, 0.4, sh, d); envOn(o.frequency, [[t, f * 0.85], [t + 0.07, f * 1.12], [t + 0.38, f * 0.78]]); const v = osc('sine', 11, t, 0.4, ctx.createGain()), vg = ctx.createGain(); vg.gain.value = f * 0.03; v.connect(vg); vg.connect(o.frequency); }
    envOn(g.gain, [[t, 0], [t + 0.03, gain], [t + 0.28, gain * 0.7], [t + 0.4, 0]]); };
  for (const [t, f, pan] of [[10.22, 410, -0.5], [10.7, 520, 0.2], [11.05, 370, -0.1], [11.5, 600, 0.5], [11.9, 440, -0.6], [12.2, 500, 0.1]]) honk(t, f, pan, 0.11);
  roar(11.25, 0.95, 0.2, 1.1, 0.55);
  burst(10.0, 2.5, 'lowpass', 800, 0.6, 0.07, 0, 0.05, 1100);
  // Plan 6 : souffle lent du prédateur, vent.
  for (let k = 0; k < 2; k++) { const t = 12.95 + k * 1.25; burst(t, 0.75, 'bandpass', 380, 1.0, 0.13, 0.15, 0.4, 260);
    const g = voice(0.15, 0.3), am = ctx.createGain(); am.gain.value = 0.5; am.connect(g); const lp = filt('lowpass', 300, 1); lp.connect(am); osc('sawtooth', 44, t, 0.7, lp);
    const l = osc('square', 23, t, 0.7, ctx.createGain()), lg = ctx.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(am.gain); envOn(g.gain, [[t, 0], [t + 0.2, 0.12], [t + 0.7, 0]]); }

  const buf = await ctx.startRendering();
  // Normalisation de sécurité : crête à -1 dBFS, jamais de saturation.
  let peak = 0; for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const k = peak > 0 ? 0.891 / peak : 1;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
  buf.peakBefore = peak;
  return buf;
}

// WAV PCM 16 bits, renvoyé en base64 pour le script de rendu.
export function toWav(buf) {
  const n = buf.length, L = buf.getChannelData(0), Rr = buf.getChannelData(1), ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); ws(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.round(clamp(L[i], -1, 1) * 32767), true); v.setInt16(46 + i * 4, Math.round(clamp(Rr[i], -1, 1) * 32767), true); }
  const u8 = new Uint8Array(ab); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
