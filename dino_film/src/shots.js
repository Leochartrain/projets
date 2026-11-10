// Mise en scène : les 6 plans, la caméra, le jeu des dinosaures, les particules.
// Chaque instant du film est une fonction pure du temps t (en secondes).
import * as THREE from 'three';
import { sat, lerp, ease, smooth, noise1, hash, U, SUN_AZ } from './util.js';
import { riverZ, groundY, ROCK, PATCH, groundU, MAX_RIP } from './world.js';
import { makeRex, makeCera, makeSauro } from './species.js';
import { makeMist, emitMist, emitMotes, emitFootfall, emitVapor, emitLeaves } from './fx.js';

export const DUR = 15, FPS = 30, FRAMES = 450;
export const SHOTS = [[0, 2.5], [2.5, 5], [5, 7.5], [7.5, 10], [10, 12.5], [12.5, 15]];
// Instants clés, partagés avec la bande-son pour une synchro à l'image près.
export const KEY = { quake2: 3.40, headUp: 3.56, impact: 5.95, roarIn: 8.45, roar: 8.72, stop6: 13.5, fadeOut: 14.5 };
export const STILLS = [1.5, 3.85, 6.02, 9.35, 11.45, 13.9];

const A2 = { x: 20, z: riverZ(20) - 10.6 };
const X4 = 65.3, Z4 = riverZ(62) - 19, RZ5 = 5.4;
const cosA = Math.cos(SUN_AZ), sinA = Math.sin(SUN_AZ);

export function keepOut(x, z, type) {
  const ad = Math.abs(z - riverZ(x)), tree = type === 'tree';
  if (x > -98 && x < -30 && ad < 36 && (tree || type === 'fern')) return true;
  if (Math.hypot(x - A2.x, z - A2.z) < 5) return true;
  if (!tree && x > A2.x - 25 && x < A2.x && Math.abs(z - (A2.z + 1.6)) < 3.4) return true;
  if (Math.hypot(x - PATCH.x, z - PATCH.z) < 6.4) return true;
  if (!tree && x > PATCH.x - 3 && x < PATCH.x + 9 && Math.abs(z - PATCH.z) < 2.6) return true;
  if (x > 53 && x < 86 && Math.abs(z - Z4) < (tree ? 6 : 2.6)) return true;
  if (x > 50 && x < 61 && z - Z4 > -2.6 && z - Z4 < 6.2) return true;
  if (Math.hypot(x - ROCK.x, z - ROCK.z) < 8.5) return true;
  if (!tree && x > ROCK.x - 27 && x < ROCK.x && Math.abs(z - (ROCK.z - 2)) < 4.5) return true;
  if (tree) for (const p of [A2, ROCK, PATCH, { x: X4 + 3, z: Z4 }]) { // trouées où passe le soleil rasant
    const dx = x - p.x, dz = z - p.z, al = dx * cosA + dz * sinA, la = -dx * sinA + dz * cosA;
    if (al > 4 && al < 240 && Math.abs(la) < 6 + al * 0.025) return true;
  }
  return false;
}

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const AY = V3(0, 1, 0), AZ = V3(0, 0, 1);
const qy = (a) => new THREE.Quaternion().setFromAxisAngle(AY, a), qz = (a) => new THREE.Quaternion().setFromAxisAngle(AZ, a);
const springUp = (x) => (x <= 0 ? 0 : 1 - Math.exp(-6.5 * x) * Math.cos(8.5 * x));

function handheld(cam, t, pos, rot, f = 1) {
  cam.position.x += noise1(t * 2.1 * f, 11) * pos; cam.position.y += noise1(t * 2.7 * f, 12) * pos * 0.7; cam.position.z += noise1(t * 1.8 * f, 13) * pos;
  cam.rotateX(noise1(t * 2.3 * f, 14) * rot); cam.rotateY(noise1(t * 1.9 * f, 15) * rot); cam.rotateZ(noise1(t * 1.5 * f, 16) * rot * 0.5);
}
function jolt(cam, age, amp) {
  if (age <= 0) return; const e = Math.exp(-age * 6.5) * amp;
  cam.position.y += e * 0.016 * Math.sin(age * 92); cam.rotateX(e * 0.011 * Math.sin(age * 78 + 1)); cam.rotateZ(e * 0.006 * Math.sin(age * 66));
}

export class Film {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, camera, sunCtl, water, rocks, P (particules)
    this.rex = makeRex(1);
    this.juv = makeCera(1, 0, 1);
    this.herd = [makeCera(1.75, 1, 2), makeCera(1.6, 1, 3), makeCera(1.85, 1, 4), makeCera(1.45, 0.75, 5), makeCera(1.7, 1, 6)];
    this.sauros = [0, 1, 2, 3, 4, 5].map((i) => makeSauro(0.82 + hash(i, 3, 5) * 0.36, i));
    this.all = [this.rex, this.juv, ...this.herd, ...this.sauros];
    this.all.forEach((c, i) => { c.phase0 = i * 1.7; this.scene.add(c.rig); });
    const cw = this.juv.gaits.walk;
    this.stand = { ...cw, S: 0.5, beta: 1, sway: 0, bob: 0, roll: 0, yaw: 0, pitch: 0, tailYaw: 0, tailBob: 0, headBob: 0 };
    this.mist = makeMist();
    this.events = []; this.tracks = {}; this.cur = -1;
    this.fns = [this.s1, this.s2, this.s3, this.s4, this.s5, this.s6].map((f) => f.bind(this));
  }
  shotAt(t) { return Math.min(5, Math.max(0, Math.floor(t / 2.5))); }
  show(list) { for (const c of this.all) c.rig.visible = list.includes(c); this.vis = list; }

  // ---------- Précalcul : appuis des pattes (éclaboussures, sons) et trajectoires des museaux (vapeur).
  precompute() {
    const dt = 1 / 120, v = V3(), f = V3();
    for (let i = 0; i < 6; i++) {
      const [t0, t1] = SHOTS[i], pre = 2.0;
      const tr = (this.tracks[i] = { t0: t0 - pre, nostril: [], mouth: [], snout: [] });
      const prev = new Map();
      for (let t = t0 - pre; t < t1 + 1e-6; t += dt) {
        this.rip = []; this.fns[i](t, true);
        const c = i === 1 ? this.juv : this.rex;
        if (i === 1 || i === 3 || i === 5) for (const n of ['nostril', 'mouth', 'snout']) {
          c.worldPoint(n, v); f.set(1, 0, 0).transformDirection(c.head.matrixWorld);
          tr[n].push({ x: v.x, y: v.y, z: v.z, dx: f.x, dy: f.y, dz: f.z });
        }
        for (const cr of this.vis) for (const L of cr.legs) {
          const k = cr.name + L.name, was = prev.get(k); prev.set(k, L.st.stance);
          if (was === false && L.st.stance && t >= t0 && t < t1) {
            v.set(L.st.land.x, L.st.landY, L.st.land.z);
            const nd = v.clone().project(this.camera), d = v.distanceTo(this.camera.position);
            this.events.push({ t, shot: i, id: this.events.length, x: v.x, y: Math.max(v.y, 0), z: v.z, water: v.y < -0.015, w: cr.scale * (cr.name === 'rex' ? 2.2 : cr.name.startsWith('sauro') ? 2.5 : 0.75),
              who: cr.name, pan: sat((nd.x + 1) / 2) * 2 - 1, dist: d, vx: cr.vel ? cr.vel.x : 0, vz: cr.vel ? cr.vel.z : 0 });
          }
        }
      }
    }
    this.events.sort((a, b) => a.t - b.t);
  }
  track(i, name) { const tr = this.tracks[i]; return (tb) => tr[name][Math.round((tb - tr.t0) * 120)] || null; }

  // ---------- Appelé pour chaque (sous-)image.
  apply(t, emit = true) {
    t = Math.min(Math.max(t, 0), DUR - 1e-4);
    const i = this.shotAt(t);
    U.uTime.value = t; U.uQuake.value = 0;
    this.rip = [];
    const p = { focus: 20, apert: 0, exposure: 1, bloom: 0.5, streak: 0.45, god: 0.5, ca: 0.0016, vig: 0.55, grain: 0.05, fade: 1, drops: [], fog: 0.012, near: 0.3, mist: 0, ...this.fns[i](t, false) };
    const cam = this.camera;
    if (this.debugCam) { const d = this.debugCam; cam.position.set(...d.pos); cam.up.set(0, 1, 0); cam.lookAt(...d.look); Object.assign(p, { fov: d.fov || 40, apert: 0, drops: [] }, d.p || {}); }
    this.scene.environmentIntensity = p.env || 1.15;
    cam.near = p.near; cam.far = 14000; cam.fov = p.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    this.scene.fog.density = p.fog;
    if (this.cur !== i) { this.cur = i; this.sunCtl.setBox(...p.box); if (i !== 2) this.rocks.updateHero([]); }
    // Ronds dans l'eau : derniers appuis dans la rivière + lapements et gouttes.
    for (const e of this.events) if (e.shot === i && e.water && e.t <= t && t - e.t < 3.5) this.rip.push([e.x, e.z, e.t, 0.03 * Math.sqrt(e.w)]);
    this.rip.sort((a, b) => b[2] - a[2]);
    const R = this.water.uni.uRip.value;
    for (let k = 0; k < MAX_RIP; k++) { const r = this.rip[k]; if (r) R[k].set(r[0], r[1], r[2], r[3]); else R[k].set(0, 0, -99, 0); }
    if (emit) {
      const P = this.P; P.begin();
      if (p.mistV) emitMist(P, this.mist.valley, t, p.mistV, cam);
      if (p.mistG) emitMist(P, this.mist.ground, t, p.mistG, cam);
      if (p.motes) emitMotes(P, cam, t, p.focus, 420, p.motes);
      if (p.leaves) emitLeaves(P, cam, t);
      if (i !== 0) for (const e of this.events) if (e.shot === i && e.t <= t && t - e.t < 1.7) emitFootfall(P, t, e);
      if (p.fx) p.fx(P);
      P.end(cam);
    }
    return p;
  }

  // ---------- PLAN 1 : survol de la canopée, troupeau de sauropodes dans la rivière.
  s1(t) {
    this.show(this.sauros);
    const h = Math.atan2(-0.985, 0.17), g = this.sauros[0].gaits.walk;
    this.sauros.forEach((c, i) => {
      const ox = -78 + (i % 2) * 9 + i * 2.5, s = 4 + i * 12.5 + 1.7 * t + hash(i, 1, 3) * 4;
      c.pose({ origin: V3(ox, 0, riverZ(ox) - 36), heading: h, s, gait: g, move: 1, t, neckPitch: -0.15 + 0.12 * Math.sin(t * 0.5 + i * 2), headPitch: -0.3, neckYaw: 0.2 * Math.sin(t * 0.3 + i), breathAmp: 0.012 }, groundY);
    });
    const cam = this.camera, k = t / 2.5;
    cam.position.set(-338 + 7.5 * t, 82 - 1.2 * t, riverZ(-338) + 7); cam.up.set(0, 1, 0);
    cam.lookAt(cam.position.x + 100, cam.position.y - 12.5 - 1.0 * k, cam.position.z - 5.5);
    handheld(cam, t, 0.05, 0.0012, 0.5);
    return { fov: 33, focus: 280, apert: 1.5, exposure: 0.6, fog: 0.0036, near: 2, mistV: 0.28, god: 1.0, bloom: 0.55, streak: 0.5, box: [-80, 0, riverZ(-80), 300] };
  }

  // ---------- PLAN 2 : le jeune cératopsien boit, puis relève brusquement la tête.
  s2(t) {
    this.show([this.juv]);
    const c = this.juv, h = Math.atan2(-0.89, -0.45), dir = V3(Math.cos(h), 0, -Math.sin(h));
    const up = springUp((t - KEY.headUp) / 0.42), upC = sat(up), lap = Math.sin(t * 2 * Math.PI * 3.1);
    const low = V3(A2.x + dir.x * 3.0, 0.005 + 0.012 * lap, A2.z + dir.z * 3.0), high = V3(A2.x + dir.x * 2.5, 1.62, A2.z + dir.z * 2.5);
    const target = low.clone().lerp(high, up);
    const alert = smooth(KEY.headUp + 0.3, KEY.headUp + 0.6, t);
    const look = qy(h + 0.4 * alert * (0.8 + 0.2 * Math.sin((t - 4) * 5))).multiply(qz(lerp(-0.72, 0.42, up)));
    c.uni.uWetY.value = 0.2;
    c.pose({ origin: V3(A2.x, 0, A2.z), heading: h, s: 0, gait: this.stand, move: 0, t, crouch: lerp(0.9, 1.0, upC), pitch: lerp(-0.085, 0.07, upC),
      jaw: lerp(0.12 + 0.08 * lap, 0.05, upC), tremble: 0.35 * alert, breathRate: lerp(2.4, 7, alert), breathAmp: lerp(0.03, 0.05, alert), tailYaw: 0.25 * Math.sin(t * 1.3) * (1 - alert) + 0.3 * alert,
      headIK: { target, look, w: 1, maxAngle: 1.05, iter: 9 } }, groundY);
    const cam = this.camera, head = c.worldPoint('nostril', V3());
    cam.position.set(A2.x - 21.5, 0.2, A2.z + 3.4); cam.up.set(0, 1, 0);
    const aim = V3(A2.x + dir.x * 1.5, 0.66, A2.z + dir.z * 1.9).lerp(V3(A2.x + dir.x * 1.5, 1.05, A2.z + dir.z * 1.9), ease(sat((t - KEY.headUp) / 0.5)));
    aim.y += 0.14; cam.lookAt(aim); handheld(cam, t, 0.004, 0.0009, 0.6);
    U.uQuake.value = 0.6 * Math.exp(-Math.max(t - KEY.quake2, 0) * 2.2) * (t > KEY.quake2 ? 1 : 0);
    for (let k = 0; k < 4; k++) { const tl = 2.52 + k * 0.323; if (tl < KEY.headUp) this.rip.push([low.x, low.z, tl, 0.028]); }
    this.rip.push([low.x, low.z, 1.9, 0.02], [low.x, low.z, 2.2, 0.02]);
    const drops = [];
    for (let k = 0; k < 18; k++) { // gouttes qui tombent du bec
      const tb = KEY.headUp + 0.04 + k * 0.075 + hash(k, 1, 21) * 0.05; drops.push(tb);
    }
    const trk = this.tracks[1] && this.track(1, 'snout');
    if (trk) for (const tb of drops) { const s = trk(tb); if (s) { const th = tb + Math.sqrt(2 * Math.max(s.y, 0) / 9.81); this.rip.push([s.x, s.z, th, 0.012]); } }
    return { fov: 7.4, focus: cam.position.distanceTo(head) - 0.1, apert: 46, exposure: 0.9, fog: 0.012, near: 1, mistG: 0.7, motes: 0.0, god: 0.35, bloom: 0.6, streak: 0.6,
      box: [A2.x + 2, 0, A2.z, 26],
      fx: (P) => {
        if (!trk) return;
        drops.forEach((tb, k) => { const age = t - tb, s = trk(tb); if (!s || age < 0) return; const y = s.y - 0.04 - 4.905 * age * age;
          if (y > 0) P.add(s.x + (hash(k, 2, 21) - 0.5) * 0.05, y, s.z + (hash(k, 3, 21) - 0.5) * 0.08, 0.007 + hash(k, 4, 21) * 0.007, 0.8, 0.85, 0.9, 0.95, 1, 0, Math.min(age * 6, 2.5)); });
        if (t < KEY.headUp) for (let k = 0; k < 6; k++) { const ph = (t * 3.1 + k * 0.17) % 1; P.add(low.x + (hash(k, 5, 21) - 0.5) * 0.12, 0.02 + ph * 0.08 - ph * ph * 0.08, low.z + (hash(k, 6, 21) - 0.3) * 0.15, 0.012, 0.8, 0.85, 0.9, 0.8 * (1 - ph), 1); }
      } };
  }

  // ---------- PLAN 3 : la patte du prédateur s'enfonce dans la boue devant l'objectif.
  s3(t) {
    this.show([this.rex]);
    const c = this.rex, g = c.gaits.walk, S = g.S, v = 2.9, kL = 2, T = S / v;
    const h = Math.atan2(0.94, -0.35), dir = V3(Math.cos(h), 0, -Math.sin(h)), lat = V3(Math.sin(h), 0, Math.cos(h));
    const F = V3(PATCH.x - 0.3, 0, PATCH.z + 0.05), along = (kL - 0.5) * S + 0.05 + g.beta * S / 2;
    const O = F.clone().addScaledVector(dir, -along).addScaledVector(lat, 0.5);
    c.uni.uWetY.value = 0.55; c.vel = dir.clone().multiplyScalar(v);
    c.pose({ origin: O, heading: h, s: (kL - 0.5) * S + v * (t - KEY.impact), gait: g, move: 1, t, sink: 0.085, neckPitch: -0.1, jaw: 0.05 }, groundY);
    // Empreintes : les trois appuis visibles autour de la caméra.
    const ang = Math.atan2(dir.z, dir.x), imp = [];
    const prints = [[F, KEY.impact], [O.clone().addScaledVector(dir, (kL - 1) * S + 0.05 + g.beta * S / 2).addScaledVector(lat, 0.5), KEY.impact - T / 2], [O.clone().addScaledVector(dir, kL * S + 0.05 + g.beta * S / 2).addScaledVector(lat, 0.5), KEY.impact + T / 2]];
    let quake = 0;
    prints.forEach(([p, tl], k) => {
      groundU.uFoot.value[k].set(p.x - PATCH.x, p.z - PATCH.z, ang, 0.1 * smooth(tl - 0.02, tl + 0.1, t));
      imp.push([t - tl, p.x, p.z, k === 0 ? 1.3 : 0.8]);
      if (t > tl) quake += Math.exp(-(t - tl) * 2.6) * (k === 0 ? 1 : 0.6);
    });
    U.uQuake.value = quake; groundU.uQuakeC.value.set(F.x, F.z);
    this.rocks.updateHero(imp);
    const cam = this.camera, gy = groundY(PATCH.x - 1.75, PATCH.z - 0.2);
    cam.position.set(PATCH.x - 1.95, gy + 0.26, PATCH.z - 0.25); cam.up.set(0, 1, 0);
    cam.lookAt(PATCH.x + 0.6, gy + 0.2, PATCH.z + 0.12);
    handheld(cam, t, 0.0012, 0.0006, 0.7);
    for (const [age, , , a] of imp) jolt(cam, age, a);
    return { fov: 36, focus: 1.7, apert: 10, exposure: 0.95, fog: 0.016, near: 0.04, mistG: 0.5, motes: 0.35, god: 0.45, bloom: 0.5, streak: 0.4, box: [PATCH.x, 0, PATCH.z, 9],
      fx: (P) => { // gerbe de boue et d'eau à l'impact principal
        const age = t - KEY.impact; if (age < 0 || age > 1.2) return;
        for (let k = 0; k < 70; k++) {
          const a = hash(k, 1, 33) * 6.283, vr = 0.4 + 2.2 * hash(k, 2, 33), vy = 0.8 + 3.2 * hash(k, 3, 33);
          const y = gy + 0.03 + vy * age - 4.905 * age * age; if (y < gy) continue;
          const wet = hash(k, 5, 33) < 0.35;
          P.add(F.x + Math.cos(a) * (0.25 + vr * age), y, F.z + Math.sin(a) * (0.25 + vr * age), 0.012 + 0.03 * hash(k, 4, 33), wet ? 0.7 : 0.055, wet ? 0.75 : 0.04, wet ? 0.8 : 0.026, wet ? 0.9 : hash(k, 6, 33), wet ? 1 : 2, age * 10 + k);
        }
      } };
  }

  // ---------- PLAN 4 : le prédateur émerge de la brume et rugit vers la caméra.
  s4(t) {
    this.show([this.rex]);
    const c = this.rex, g = c.gaits.walk, S = g.S, sEnd = 3.05 * S, D = 2.0, u = sat((t - 7.5) / 1.2);
    const s = sEnd - D * (1 - u) * (1 - u), speed = 2 * D * (1 - u) / 1.2;
    const ant = smooth(KEY.roarIn, KEY.roar - 0.02, t) * (1 - smooth(KEY.roar, KEY.roar + 0.14, t)), R = smooth(KEY.roar, KEY.roar + 0.26, t);
    const cam = this.camera; cam.position.set(X4 - 11.6, groundY(X4 - 11.6, Z4 + 3.6) + 0.5, Z4 + 3.6);
    c.uni.uWetY.value = 0.9; c.vel = V3(-speed, 0, 0);
    c.pose({ origin: V3(X4 + sEnd, 0, Z4), heading: Math.PI, s, gait: g, move: sat(speed / 2.6), t, crouch: 1 - 0.05 * R, pitch: 0.045 * ant - 0.11 * R,
      neckPitch: 0.3 * ant - 0.2 * R, headPitch: 0.12 * ant + 0.32 * R, jaw: 0.14 * ant + R * (0.9 + 0.1 * Math.sin(t * 21)), tremble: R, tailLift: 0.22 * R, tailYaw: 0.12 * Math.sin(t * 1.4),
      breathAmp: 0.03 + 0.03 * R, breathRate: 3,
      headIK: { target: V3(X4 - 7.0, cam.position.y + 2.7, Z4 + 1.1), look: qy(Math.PI - 0.22).multiply(qz(0.04)), w: 0.9 * R, maxAngle: 0.6 } }, groundY);
    const mouth = c.worldPoint('mouth', V3()), k = ease(sat((t - 7.5) / 1.55));
    cam.up.set(0, 1, 0);
    cam.lookAt(V3(X4 - 3.2, 1.3, Z4).lerp(mouth.clone().add(V3(0, 0.25, 0)), k * 0.95));
    handheld(cam, t, 0.006 + 0.012 * R, 0.0014 + 0.004 * R, 1 + 9 * R);
    for (const e of this.events) if (e.shot === 3) jolt(cam, t - e.t, 0.5);
    const nos = this.tracks[3] && this.track(3, 'nostril'), mth = this.tracks[3] && this.track(3, 'mouth');
    return { fov: 34, focus: cam.position.distanceTo(mouth), apert: 9, exposure: 0.8, fog: 0.026, near: 0.15, mistG: 1.5, motes: 1.2, leaves: 1, god: 0.9, bloom: 0.65, streak: 0.7, box: [X4 - 3, 0, Z4, 22],
      fx: (P) => {
        if (!nos) return;
        const breathI = (tb) => (tb < KEY.roarIn ? Math.pow(Math.max(0, Math.sin((tb - 7.3) * 2 * Math.PI / 0.95)), 2) * 0.9 : 0);
        emitVapor(P, t, nos, breathI, { rate: 70, alpha: 0.12, size: 0.12, grow: 0.7, speed: 2.2 });
        emitVapor(P, t, mth, (tb) => smooth(KEY.roar, KEY.roar + 0.15, tb) * 1.3, { rate: 110, alpha: 0.2, size: 0.25, grow: 1.5, speed: 5.5, life: 1.5, push: true });
        // Filets de salive entre les mâchoires et postillons.
        const up = V3(), lo = V3(), jawOpen = 0.14 * ant + R;
        if (jawOpen > 0.05) for (let sIdx = 0; sIdx < 5; sIdx++) {
          const x = 4.9 + sIdx * 0.18, z = (sIdx % 2 ? 1 : -1) * (0.24 - sIdx * 0.02), snap = 0.35 + hash(sIdx, 1, 41) * 0.5;
          c.B.head.localToWorld(up.set(x, 4.31, z).sub(c.rest.head)); c.B.jaw.localToWorld(lo.set(x, 4.27, z).sub(c.rest.jaw));
          const brk = smooth(snap, snap + 0.2, R + (t - KEY.roar) * 0.25);
          for (let b = 0; b <= 14; b++) { const f = b / 14; if (brk > 0 && Math.abs(f - 0.5) < brk * 0.5) continue;
            P.add(lerp(up.x, lo.x, f), lerp(up.y, lo.y, f) - Math.sin(f * Math.PI) * 0.03, lerp(up.z, lo.z, f), 0.006 + 0.005 * Math.abs(f - 0.5), 0.85, 0.85, 0.8, 0.8, 1); }
        }
        const age = t - KEY.roar - 0.1;
        if (age > 0 && age < 1.2) { const m0 = mth(KEY.roar + 0.12); if (m0) for (let q = 0; q < 46; q++) {
          const a = age - hash(q, 7, 41) * 0.5; if (a < 0) continue;
          const sp = 3 + 6 * hash(q, 1, 41), sx = (hash(q, 2, 41) - 0.5) * 2.4, sy = (hash(q, 3, 41) - 0.3) * 2.2;
          P.add(m0.x + m0.dx * sp * a + m0.dz * sx * a, m0.y + m0.dy * sp * a + sy * a - 4.905 * a * a, m0.z + m0.dz * sp * a - m0.dx * sx * a, 0.006 + 0.012 * hash(q, 4, 41), 0.85, 0.85, 0.8, 0.85, 1, 0, 0.8);
        } }
      } };
  }

  // ---------- PLAN 5 : la fuite du troupeau dans la rivière, le prédateur à ses trousses.
  s5(t) {
    const herd = [...this.herd, this.juv];
    this.show([...herd, this.rex]);
    const tl = t - 10, camX = 46 - 8.6 * tl, h = Math.PI;
    const cfg = [[2.5, -2.6, 9.7, 0.0], [7.0, 0.2, 9.4, 0.37], [12.0, 2.6, 9.9, 0.71], [4.5, 4.6, 9.3, 0.13], [17.0, -0.4, 10.2, 0.55], [9.2, -1.6, 9.8, 0.83]];
    herd.forEach((c, i) => {
      const [dx, lane, v, ph] = cfg[i], g = c.gaits.gallop, S = g.S * c.scale;
      c.uni.uWetY.value = 0.75; c.vel = V3(-v, 0, 0);
      const cry = Math.pow(Math.max(0, Math.sin((t + ph * 3) * 2.6)), 6);
      c.pose({ origin: V3(46 + dx + ph * S, 0, RZ5 + lane), heading: h, s: v * tl + ph * S, gait: g, move: 1, t, neckPitch: 0.12, headPitch: 0.1 + 0.15 * cry, jaw: 0.15 + 0.7 * cry, tailLift: 0.25, breathRate: 9, breathAmp: 0.05 }, groundY);
    });
    const r = this.rex, gr = r.gaits.run, vr = 11.4; r.uni.uWetY.value = 1.6; r.vel = V3(-vr, 0, 0);
    r.pose({ origin: V3(46 + 21.5, 0, RZ5 + 1.6), heading: h, s: vr * tl + 1.3, gait: gr, move: 1, t, pitch: -0.07, neckPitch: -0.18, headPitch: 0.12, jaw: 0.45 + 0.2 * Math.sin(t * 5), tailLift: 0.12, breathRate: 7, breathAmp: 0.05 }, groundY);
    const cam = this.camera; cam.position.set(camX, 0.78 + 0.05 * Math.sin(t * 2 * Math.PI * 2.9), RZ5 - 8.7); cam.up.set(0, 1, 0);
    cam.lookAt(camX + 4.3, 1.25, RZ5 + 0.6);
    handheld(cam, t, 0.05, 0.011, 2.4); cam.rotateZ(0.02 * Math.sin(t * 3.1));
    const drops = [[10.42, 0.2, 0.34, 0.055], [10.95, 0.71, 0.62, 0.075], [11.3, 0.43, 0.2, 0.04], [11.72, 0.86, 0.3, 0.06], [12.05, 0.1, 0.7, 0.05], [11.55, 0.55, 0.8, 0.035]]
      .filter((d) => t > d[0]).map((d) => [d[1], d[2] - 0.035 * (t - d[0]) * (d[3] / 0.05), d[3] * (0.6 + 0.4 * sat((t - d[0]) * 12)), sat((t - d[0]) * 14)]);
    return { fov: 36, focus: 8.5, apert: 4, exposure: 1.0, fog: 0.017, near: 0.15, mistG: 0.7, motes: 0.5, god: 0.6, bloom: 0.6, streak: 0.6, drops, box: [34, 0, RZ5, 50] };
  }

  // ---------- PLAN 6 : le prédateur s'arrête sur le rocher, la brume se referme, fondu au noir.
  s6(t) {
    this.show([this.rex]);
    const c = this.rex, g = c.gaits.walk, S = g.S, sEnd = 4.05 * S, D = 2.4, u = sat((t - 12.5) / 1.0), tl = t - 12.5;
    const h = Math.atan2(-0.9, 0.44), dir = V3(0.44, 0, 0.9).normalize();
    const s = sEnd - D * (1 - u) * (1 - u), speed = 2 * D * (1 - u), settle = smooth(13.4, 14.1, t);
    c.uni.uWetY.value = 1.1; c.vel = dir.clone().multiplyScalar(speed);
    const bre = Math.pow(Math.max(0, Math.sin((t - 12.9) * 2 * Math.PI / 1.25)), 2);
    c.pose({ origin: V3(ROCK.x, 0, ROCK.z).addScaledVector(dir, -sEnd + 0.4), heading: h, s, gait: g, move: sat(speed / 2.6), t, neckPitch: 0.22 * settle, headPitch: 0.06 * settle,
      neckYaw: 0.5 * settle * Math.sin((t - 13.3) * 0.8), headYaw: 0.28 * settle * Math.sin((t - 13.3) * 0.8), jaw: 0.06 + 0.1 * bre, tailYaw: 0.16 * Math.sin(t * 1.2), tailLift: 0.05, breathAmp: 0.035, breathRate: 2 * Math.PI / 1.25 }, groundY);
    const cam = this.camera, e = ease(tl / 2.5), gy = groundY(ROCK.x, ROCK.z);
    cam.position.set(ROCK.x - 23 - 2.5 * e, 1.15 + 4.9 * e, ROCK.z - 4.6); cam.up.set(0, 1, 0);
    cam.lookAt(ROCK.x + 1.2, gy + 3.7 + 0.5 * e, ROCK.z + 0.6);
    handheld(cam, t, 0.012, 0.0008, 0.4);
    const nos = this.tracks[5] && this.track(5, 'nostril');
    return { fov: 30, focus: 23, apert: 4, exposure: 0.68, fog: lerp(0.016, 0.044, e), near: 0.4, mistG: lerp(0.8, 2.6, e), motes: 0.8, leaves: 1, god: 1.0, bloom: 0.7, streak: 0.8,
      fade: 1 - smooth(KEY.fadeOut, 15 - 1 / 30, t), box: [ROCK.x, 0, ROCK.z, 34],
      fx: (P) => { if (nos) emitVapor(P, t, nos, (tb) => (tb > 12.6 ? Math.pow(Math.max(0, Math.sin((tb - 12.9) * 2 * Math.PI / 1.25)), 2) : 0), { rate: 70, alpha: 0.13, size: 0.15, grow: 0.85, speed: 2.4, life: 2.0 }); } };
  }
}
