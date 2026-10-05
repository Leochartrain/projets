'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const VW = 320, VH = 180;          // résolution logique (pixels du jeu)
const TILE = 16, MW = 48, MH = 36; // carte en tuiles
const WORLD_W = MW * TILE, WORLD_H = MH * TILE;
const SPRITES = '../sprites/';
const PLAYER_SPEED = 80;
const PLAYER_HP = 5;
const AK_FIRE_DELAY = 0.09;   // ~11 balles/s
const BULLET_SPEED = 360;
const MINI_W = 64, MINI_H = 48;   // minimap, même ratio que la carte (4:3)

// AK-47 en pixel art (le pack n'a pas d'arme à feu). W = bois, M = métal.
// Pivot (main) en x=5, y=2 ; canon vers la droite.
const AK_PIXELS = [
  '......M.......M...',
  'WWWWMMMMMMWWWWMMMM',
  'WWWWMMMMMMWWWW....',
  'WW..M.MM..........',
  '....M..MM.........',
  '........MM........',
];

const WAVES = [
  { slime: 4 },
  { slime: 5, skeleton: 2 },
  { slime: 4, skeleton: 4 },
];

// Animations : [ligne de base, nb de frames, fps]. Les lignes idle/move/attack/hurt
// existent en 3 directions (bas, droite, haut) ; la gauche = droite retournée.
const CHAR = {
  player: {
    img: 'player', cell: 48, ax: 24, ay: 41, r: 5,
    anims: { idle: [0, 6, 6], move: [3, 6, 10], attack: [6, 4, 14] },
    death: [9, 3, 5],
  },
  slime: {
    img: 'slime', cell: 32, ax: 16, ay: 22, r: 6,
    anims: { idle: [0, 4, 6], move: [3, 6, 10], attack: [6, 7, 12], hurt: [9, 3, 12] },
    death: [12, 5, 10],
    hp: 2, speed: 32, range: 16, hitFrame: 3, aggro: 110, cd: 1.2,
  },
  skeleton: {
    img: 'skeleton', cell: 48, ax: 22, ay: 38, r: 6,
    anims: { idle: [0, 6, 6], move: [3, 6, 10], attack: [6, 6, 11], hurt: [9, 3, 12] },
    death: [12, 5, 8],
    hp: 4, speed: 42, range: 20, hitFrame: 3, aggro: 140, cd: 1.0,
  },
};
const DIR_ROW = { down: 0, right: 1, up: 2, left: 1 };
const DIR_VEC = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// Décors tirés de objects.png : source + collider [x, y, w, h] relatif au sprite.
const PROPS = {
  tree:      { sx: 1,   sy: 80,  sw: 45, sh: 64, col: [15, 50, 16, 9] },
  appleTree: { sx: 49,  sy: 80,  sw: 45, sh: 64, col: [15, 50, 16, 9] },
  pine:      { sx: 3,   sy: 147, sw: 43, sh: 61, col: [14, 47, 15, 9] },
  pine2:     { sx: 51,  sy: 147, sw: 43, sh: 61, col: [14, 47, 15, 9] },
  bush:      { sx: 96,  sy: 112, sw: 32, sh: 32, col: [5, 18, 22, 10] },
  tallBush:  { sx: 132, sy: 102, sw: 23, sh: 42, col: [4, 30, 15, 9] },
  rock:      { sx: 0,   sy: 17,  sw: 15, sh: 15, col: [1, 5, 13, 8] },
  rocks:     { sx: 16,  sy: 17,  sw: 32, sh: 15, col: [1, 5, 30, 8] },
  stump:     { sx: 166, sy: 93,  sw: 20, sh: 17, col: [2, 5, 16, 9] },
  bigStump:  { sx: 163, sy: 120, sw: 26, sh: 18, col: [2, 5, 22, 10] },
  log:       { sx: 97,  sy: 146, sw: 45, sh: 13, col: [1, 2, 43, 9] },
};
const BORDER_KINDS = ['tree', 'tree', 'pine', 'pine2', 'appleTree'];
const INNER_KINDS = ['tree', 'pine', 'pine2', 'appleTree', 'bush', 'bush', 'tallBush',
  'rock', 'rocks', 'stump', 'bigStump', 'log'];

// ---------------------------------------------------------------------------
// Canvas & assets
// ---------------------------------------------------------------------------
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let scale = 1;

function resize() {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  cv.width = VW * scale;
  cv.height = VH * scale;
  cv.style.marginTop = Math.max(0, Math.floor((innerHeight - cv.height) / 2)) + 'px';
}
addEventListener('resize', resize);

const IMG = {};
const FILES = {
  player: 'characters/player.png',
  slime: 'characters/slime.png',
  skeleton: 'characters/skeleton.png',
  objects: 'objects/objects.png',
  chest: 'objects/chest_01.png',
  grass: 'tilesets/grass.png',
  plains: 'tilesets/plains.png',
  decor: 'tilesets/decor_16x16.png',
  dust: 'particles/dust_particles_01.png',
};

function loadAssets() {
  return Promise.all(Object.entries(FILES).map(([key, file]) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { IMG[key] = img; res(); };
    img.onerror = () => rej(new Error('Image introuvable : ' + SPRITES + file));
    img.src = SPRITES + file;
  })));
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
// e.code = position physique : KeyW/A/S/D correspond à Z/Q/S/D sur AZERTY.
const down = new Set(), pressed = new Set();
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
});
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', () => { down.clear(); mouse.down = false; });
// Souris, en pixels logiques du jeu
const mouse = { x: VW / 2, y: VH / 2, down: false, pressed: false };
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / scale;
  mouse.y = (e.clientY - r.top) / scale;
});
cv.addEventListener('mousedown', e => { if (e.button === 0) { mouse.down = true; mouse.pressed = true; } });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

const held = (...codes) => codes.some(c => down.has(c));
const hit = (...codes) => codes.some(c => pressed.has(c));

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

// ---------------------------------------------------------------------------
// État du jeu
// ---------------------------------------------------------------------------
let mode = 'title';           // title | play | over | win
let props, solids, ground, minimap, clearing, chest;
let player, enemies, dust, bullets, sparks;
let weapon = 'sword';         // sword | ak
let akSprite = null;
let wave, nextWaveT, kills, playTime, shake;
let banner = { text: '', t: 0 };

function say(text, dur = 2.5) { banner = { text, t: dur }; }

function genWorld(seed) {
  const rnd = mulberry32(seed);
  props = [];
  solids = [];

  const cx = MW / 2, cy = MH / 2;
  clearing = { x0: cx - 5, y0: cy - 4, x1: cx + 4, y1: cy + 3 };
  const clearPx = {
    x: clearing.x0 * TILE, y: clearing.y0 * TILE,
    w: (clearing.x1 - clearing.x0 + 1) * TILE, h: (clearing.y1 - clearing.y0 + 1) * TILE,
  };

  // Sol pré-rendu : herbe + touffes décoratives + clairière en terre (9-slice de plains.png)
  ground = document.createElement('canvas');
  ground.width = WORLD_W;
  ground.height = WORLD_H;
  const g = ground.getContext('2d');
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      g.drawImage(IMG.grass, tx * TILE, ty * TILE);
      if (rnd() < 0.12) {
        const dx = Math.floor(rnd() * 4), dy = Math.floor(rnd() * 4);
        g.drawImage(IMG.decor, dx * TILE, dy * TILE, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  for (let ty = clearing.y0; ty <= clearing.y1; ty++) {
    for (let tx = clearing.x0; tx <= clearing.x1; tx++) {
      const sx = tx === clearing.x0 ? 1 : tx === clearing.x1 ? 3 : 2;
      const sy = ty === clearing.y0 ? 0 : ty === clearing.y1 ? 2 : 1;
      g.drawImage(IMG.plains, sx * TILE, sy * TILE, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  const place = (kind, x, y, force) => {
    const p = PROPS[kind];
    x = Math.round(x); y = Math.round(y);
    const r = { x: x + p.col[0], y: y + p.col[1], w: p.col[2], h: p.col[3] };
    if (!force) {
      if (rectHit(r, grow(clearPx, 28))) return;
      if (solids.some(s => rectHit(grow(r, 12), s))) return;
    }
    props.push({ p, x, y, sort: r.y + r.h });
    solids.push(r);
  };

  // Lisière de forêt tout autour
  for (let x = -24; x < WORLD_W; x += 24) {
    place(pick(rnd, BORDER_KINDS), x + rnd() * 6, -34 + rnd() * 8, true);
    place(pick(rnd, BORDER_KINDS), x + rnd() * 6, WORLD_H - 58 + rnd() * 6, true);
  }
  for (let y = 0; y < WORLD_H - 40; y += 22) {
    place(pick(rnd, BORDER_KINDS), -24 + rnd() * 6, y + rnd() * 6, true);
    place(pick(rnd, BORDER_KINDS), WORLD_W - 22 - rnd() * 6, y + rnd() * 6, true);
  }
  // Décors intérieurs
  for (let i = 0; i < 220; i++) {
    place(pick(rnd, INNER_KINDS), 40 + rnd() * (WORLD_W - 100), 30 + rnd() * (WORLD_H - 100), false);
  }

  // Fond de la minimap : herbe, clairière, et la silhouette des décors
  minimap = document.createElement('canvas');
  minimap.width = MINI_W;
  minimap.height = MINI_H;
  const m = minimap.getContext('2d'), k = MINI_W / WORLD_W;
  m.fillStyle = '#3f8a52';
  m.fillRect(0, 0, MINI_W, MINI_H);
  m.fillStyle = '#9a6e4c';
  m.fillRect(Math.round(clearPx.x * k), Math.round(clearPx.y * k), Math.round(clearPx.w * k), Math.round(clearPx.h * k));
  for (const pr of props) {
    m.fillStyle = pr.p.sh > 40 ? '#1f4a2c' : pr.p.sy < 40 ? '#7a8394' : '#2c5e38';
    m.fillRect(Math.floor((pr.x + 6) * k), Math.floor((pr.y + 6) * k),
      Math.max(1, Math.round((pr.p.sw - 12) * k)), Math.max(1, Math.round((pr.p.sh - 14) * k)));
  }

  chest = {
    x: cx * TILE - 8, y: clearing.y0 * TILE + 14,
    state: 'locked', t: 0,
  };
  chest.rect = { x: chest.x + 2, y: chest.y + 6, w: 12, h: 9 };
  solids.push(chest.rect);
}

function makeChar(type, x, y) {
  const d = CHAR[type];
  return {
    type, d, x, y, kx: 0, ky: 0, dir: 'down', state: 'idle', t: 0,
    hp: d.hp || PLAYER_HP, maxHp: d.hp || PLAYER_HP,
    cd: 0, hitDone: false, inv: 0, wanderT: 0, wx: 0, wy: 0, deadT: 0, lx: 0, ly: 0,
  };
}

function reset() {
  genWorld(1337);
  player = makeChar('player', WORLD_W / 2, (clearing.y1 - 1) * TILE);
  enemies = [];
  dust = [];
  bullets = [];
  sparks = [];
  player.aimX = 0; player.aimY = 1; player.fireT = 0; player.flash = 0;
  wave = -1;
  nextWaveT = 0;
  kills = 0;
  playTime = 0;
  shake = 0;
  banner = { text: '', t: 0 };
}

// ---------------------------------------------------------------------------
// Personnages
// ---------------------------------------------------------------------------
function setState(e, s) {
  if (e.state !== s) { e.state = s; e.t = 0; e.hitDone = false; }
}

function frameOf(e) {
  const dead = e.state === 'dead';
  const [row, n, fps] = dead ? e.d.death : e.d.anims[e.state];
  const f = Math.floor(e.t * fps);
  const loop = e.state === 'idle' || e.state === 'move';
  return {
    row: dead ? row : row + DIR_ROW[e.dir],
    f: loop ? f % n : Math.min(f, n - 1),
    done: !loop && f >= n,
  };
}

function face(e, dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) e.dir = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) e.dir = dy > 0 ? 'down' : 'up';
}

function blocked(x, y, r) {
  if (x < r + 6 || y < r + 6 || x > WORLD_W - r - 6 || y > WORLD_H - r - 6) return true;
  const box = { x: x - r, y: y - 4, w: r * 2, h: 6 };
  return solids.some(s => rectHit(box, s));
}

function moveEnt(e, dx, dy) {
  const r = e.d.r;
  if (dx && !blocked(e.x + dx, e.y, r)) e.x += dx;
  if (dy && !blocked(e.x, e.y + dy, r)) e.y += dy;
}

function knock(e, fromX, fromY, force) {
  const dx = e.x - fromX, dy = e.y - fromY, d = Math.hypot(dx, dy) || 1;
  e.kx = dx / d * force;
  e.ky = dy / d * force;
}

function applyKnock(e, dt) {
  if (Math.abs(e.kx) + Math.abs(e.ky) < 2) { e.kx = e.ky = 0; return; }
  moveEnt(e, e.kx * dt, e.ky * dt);
  const k = Math.max(0, 1 - dt * 9);
  e.kx *= k;
  e.ky *= k;
}

function hurtPlayer(src) {
  const p = player;
  if (p.inv > 0 || p.state === 'dead') return;
  p.hp--;
  p.inv = 1.0;
  shake = 0.18;
  knock(p, src.x, src.y, 170);
  if (p.hp <= 0) setState(p, 'dead');
}

function damageEnemy(e, amount, fromX, fromY, force) {
  e.hp -= amount;
  knock(e, fromX, fromY, force);
  shake = Math.max(shake, 0.06);
  if (e.hp <= 0) { setState(e, 'dead'); kills++; }
  else setState(e, 'hurt');
}

function playerStrike() {
  const p = player, [vx, vy] = DIR_VEC[p.dir];
  const hx = p.x + vx * 14, hy = p.y - 6 + vy * 12;
  for (const e of enemies) {
    if (e.state === 'dead') continue;
    if (Math.hypot(e.x - hx, e.y - 6 - hy) > 20) continue;
    damageEnemy(e, 1, p.x, p.y, 150);
  }
}

// Position de la main (pivot de l'arme) et de la bouche du canon
const HAND_H = 9;   // hauteur de la main au-dessus des pieds
const handPos = p => ({ x: p.x + p.aimX * 6, y: p.y - HAND_H + p.aimY * 2 });
function muzzlePos(p) {
  const h = handPos(p);
  return { x: h.x + p.aimX * 13, y: h.y + p.aimY * 13 };
}

function fireAk() {
  const p = player, h = handPos(p);
  // légère dispersion pour l'effet rafale
  const a = Math.atan2(p.aimY, p.aimX) + (Math.random() - 0.5) * 0.06;
  // La balle part de la main (pour toucher un monstre collé à nous) mais n'est
  // dessinée qu'une fois sortie du canon.
  bullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: 0.9, travel: 0 });
  p.flash = 0.05;
  shake = Math.max(shake, 0.04);
}

function updateBullets(dt) {
  for (const b of bullets) {
    // sous-pas pour ne pas traverser un slime entre deux frames
    const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
    for (let i = 0; i < steps && b.life > 0; i++) {
      b.x += b.vx * dt / steps;
      b.y += b.vy * dt / steps;
      b.travel += BULLET_SPEED * dt / steps;
      const groundY = b.y + HAND_H;  // les balles volent à hauteur de main
      if (b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H ||
          solids.some(s => b.x >= s.x && b.x <= s.x + s.w && groundY >= s.y && groundY <= s.y + s.h)) {
        b.life = 0;
        sparks.push({ x: b.x, y: b.y, t: 0 });
        break;
      }
      for (const e of enemies) {
        if (e.state === 'dead') continue;
        if (Math.hypot(e.x - b.x, e.y - 8 - b.y) < 10) {
          damageEnemy(e, e.hp, b.x - b.vx, b.y - b.vy, 120);   // one shot
          b.life = 0;
          sparks.push({ x: b.x, y: b.y, t: 0, blood: true });
          break;
        }
      }
    }
    b.life -= dt;
  }
  bullets = bullets.filter(b => b.life > 0);
  for (const s of sparks) s.t += dt;
  sparks = sparks.filter(s => s.t < 0.15);
}

function updatePlayer(dt) {
  const p = player;
  p.inv = Math.max(0, p.inv - dt);
  p.t += dt;
  applyKnock(p, dt);

  if (p.state === 'dead') {
    if (frameOf(p).done && p.t > 1.6) mode = 'over';
    return;
  }

  // Visée vers le curseur (repère monde = position écran + caméra)
  const h = handPos(p);
  const ax = mouse.x + camX - h.x, ay = mouse.y + camY - h.y, al = Math.hypot(ax, ay);
  if (al > 2) { p.aimX = ax / al; p.aimY = ay / al; }

  if (p.state === 'attack') {
    const fr = frameOf(p);
    if (fr.f >= 1 && !p.hitDone) { p.hitDone = true; playerStrike(); }
    if (fr.done) setState(p, 'idle');
    return;
  }

  if (hit('Digit1', 'Numpad1')) { weapon = 'sword'; say('Épée', 1); }
  if (hit('Digit2', 'Numpad2')) { weapon = 'ak'; say('AK-47', 1); }
  if (hit('Tab')) { weapon = weapon === 'ak' ? 'sword' : 'ak'; say(weapon === 'ak' ? 'AK-47' : 'Épée', 1); }

  p.fireT = Math.max(0, p.fireT - dt);
  p.flash = Math.max(0, p.flash - dt);
  if (weapon === 'sword' && (hit('Space', 'KeyJ') || mouse.pressed)) {
    face(p, p.aimX, p.aimY);
    setState(p, 'attack');
    return;
  }
  if (weapon === 'ak' && (held('Space', 'KeyJ') || mouse.down) && p.fireT <= 0) { p.fireT = AK_FIRE_DELAY; fireAk(); }

  const ix = held('ArrowRight', 'KeyD') - held('ArrowLeft', 'KeyA');
  const iy = held('ArrowDown', 'KeyS') - held('ArrowUp', 'KeyW');
  // Avec l'AK le perso regarde le curseur ; avec l'épée il regarde où il marche
  if (weapon === 'ak') face(p, p.aimX, p.aimY);
  if (ix || iy) {
    const l = Math.hypot(ix, iy);
    moveEnt(p, ix / l * PLAYER_SPEED * dt, iy / l * PLAYER_SPEED * dt);
    if (weapon === 'sword') face(p, ix, iy);
    setState(p, 'move');
    p.dustT = (p.dustT || 0) - dt;
    if (p.dustT <= 0) { p.dustT = 0.22; dust.push({ x: p.x, y: p.y, t: 0 }); }
  } else {
    setState(p, 'idle');
  }

  if (hit('KeyE') && Math.hypot(p.x - (chest.x + 8), p.y - (chest.y + 14)) < 24) {
    if (chest.state === 'ready') { chest.state = 'opening'; chest.t = 0; }
    else if (chest.state === 'locked') say('Verrouillé : élimine tous les monstres !');
  }
}

function updateEnemy(e, dt) {
  e.t += dt;
  e.cd = Math.max(0, e.cd - dt);
  applyKnock(e, dt);
  const fr = frameOf(e);

  if (e.state === 'dead') {
    if (fr.done) { e.deadT += dt; if (e.deadT > 0.6) e.remove = true; }
    return;
  }
  if (e.state === 'hurt') {
    if (fr.done) setState(e, 'idle');
    return;
  }

  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
  const alive = player.state !== 'dead';

  if (e.state === 'attack') {
    if (e.type === 'slime' && fr.f >= 2 && fr.f <= 4) moveEnt(e, e.lx * 45 * dt, e.ly * 45 * dt);
    if (!e.hitDone && fr.f >= e.d.hitFrame) {
      e.hitDone = true;
      if (alive && d < e.d.range + 8) hurtPlayer(e);
    }
    if (fr.done) { setState(e, 'idle'); e.cd = e.d.cd; }
    return;
  }

  if (alive && d < e.d.range && e.cd <= 0) {
    face(e, dx, dy);
    e.lx = dx / d; e.ly = dy / d;
    setState(e, 'attack');
    return;
  }

  let mx = 0, my = 0;
  const chasing = alive && d < e.d.aggro;
  if (chasing) {
    if (d > e.d.range - 4) { mx = dx / d; my = dy / d; }
    face(e, dx, dy);
  } else {
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 1 + Math.random() * 2;
      const a = Math.random() * Math.PI * 2, go = Math.random() < 0.6;
      e.wx = go ? Math.cos(a) : 0;
      e.wy = go ? Math.sin(a) : 0;
    }
    mx = e.wx * 0.5; my = e.wy * 0.5;
  }
  // Évite que les monstres s'empilent
  for (const o of enemies) {
    if (o === e || o.state === 'dead') continue;
    const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
    if (od > 0 && od < 14) { mx += ox / od * 0.6; my += oy / od * 0.6; }
  }
  if (Math.abs(mx) + Math.abs(my) > 0.05) {
    moveEnt(e, mx * e.d.speed * dt, my * e.d.speed * dt);
    if (!chasing) face(e, mx, my);
    setState(e, 'move');
  } else {
    setState(e, 'idle');
  }
}

// ---------------------------------------------------------------------------
// Vagues & coffre
// ---------------------------------------------------------------------------
function spawn(type) {
  const r = CHAR[type].r;
  for (let i = 0; i < 200; i++) {
    const x = 40 + Math.random() * (WORLD_W - 80), y = 40 + Math.random() * (WORLD_H - 80);
    if (Math.hypot(x - player.x, y - player.y) < 140) continue;
    if (blocked(x, y, r + 4)) continue;
    enemies.push(makeChar(type, x, y));
    return;
  }
}

function startWave(i) {
  wave = i;
  for (const [type, n] of Object.entries(WAVES[i])) for (let k = 0; k < n; k++) spawn(type);
  say(`Vague ${i + 1} / ${WAVES.length}`);
}

function updateWaves(dt) {
  if (chest.state !== 'locked') return;
  if (enemies.some(e => e.state !== 'dead')) return;
  if (wave + 1 < WAVES.length) {
    if (nextWaveT <= 0) { nextWaveT = 2.2; if (wave >= 0) say('Vague terminée !', 2); }
    nextWaveT -= dt;
    if (nextWaveT <= 0) startWave(wave + 1);
  } else {
    chest.state = 'ready';
    say('La forêt est sûre. Ouvre le coffre (E) !', 4);
  }
}

function updateChest(dt) {
  chest.t += dt;
  if (chest.state === 'opening' && chest.t > 4 / 8 + 0.9) { chest.state = 'open'; mode = 'win'; }
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
let camX = 0, camY = 0;

function drawChar(e) {
  if (e.inv > 0 && e.state !== 'dead' && Math.floor(e.inv * 16) % 2) return;
  const fr = frameOf(e), c = e.d.cell;
  ctx.save();
  if (e.deadT) ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.6);
  ctx.translate(Math.round(e.x - camX), Math.round(e.y - camY));
  if (e.dir === 'left') ctx.scale(-1, 1);
  ctx.drawImage(IMG[e.d.img], fr.f * c, fr.row * c, c, c, -e.d.ax, -e.d.ay, c, c);
  ctx.restore();

  if (e !== player && e.state !== 'dead' && e.hp < e.maxHp) {
    const w = 14, x = Math.round(e.x - camX - w / 2), y = Math.round(e.y - camY - e.d.ay + (c === 48 ? 18 : 8));
    ctx.fillStyle = '#1a1214'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#e43b44'; ctx.fillRect(x, y, Math.round(w * e.hp / e.maxHp), 2);
  }
}

function buildAkSprite() {
  akSprite = document.createElement('canvas');
  akSprite.width = AK_PIXELS[0].length;
  akSprite.height = AK_PIXELS.length;
  const g = akSprite.getContext('2d');
  const COLORS = { W: '#8b5a2b', M: '#2e2b30' };
  AK_PIXELS.forEach((row, y) => [...row].forEach((c, x) => {
    if (COLORS[c]) { g.fillStyle = COLORS[c]; g.fillRect(x, y, 1, 1); }
  }));
}

function drawGun(p) {
  if (!akSprite) buildAkSprite();
  const h = handPos(p), a = Math.atan2(p.aimY, p.aimX);
  ctx.save();
  ctx.translate(Math.round(h.x - camX), Math.round(h.y - camY));
  ctx.rotate(a);
  if (p.aimX < 0) ctx.scale(1, -1);   // garde la crosse en bas quand on vise à gauche
  ctx.drawImage(akSprite, -5, -2);
  ctx.restore();
  if (p.flash > 0) {
    const m = muzzlePos(p);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(Math.round(m.x - camX - 2), Math.round(m.y - camY - 2), 4, 4);
    ctx.fillStyle = '#fff6c2';
    ctx.fillRect(Math.round(m.x - camX - 1), Math.round(m.y - camY - 1), 2, 2);
  }
}

function drawPlayer() {
  const p = player;
  const showGun = weapon === 'ak' && p.state !== 'dead' && !(p.inv > 0 && Math.floor(p.inv * 16) % 2);
  if (showGun && p.aimY < -0.5) drawGun(p);   // de dos : l'arme passe derrière
  drawChar(p);
  if (showGun && p.aimY >= -0.5) drawGun(p);
}

function drawShots() {
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#ffe9a0';
  for (const b of bullets) {
    if (b.travel < 20) continue;
    ctx.beginPath();
    ctx.moveTo(b.x - camX, b.y - camY);
    ctx.lineTo(b.x - camX - b.vx * 0.018, b.y - camY - b.vy * 0.018);
    ctx.stroke();
  }
  for (const s of sparks) {
    const r = Math.round(1 + s.t * 20);
    ctx.fillStyle = s.blood ? '#8fd3ff' : '#ffd34d';   // les slimes « saignent » bleu
    for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
      ctx.fillRect(Math.round(s.x - camX + dx), Math.round(s.y - camY + dy), 1, 1);
    }
  }
}

function drawMinimap() {
  const x0 = VW - MINI_W - 5, y0 = VH - MINI_H - 5, k = MINI_W / WORLD_W;
  const blink = Math.floor(performance.now() / 250) % 2;
  ctx.fillStyle = '#1a1214';
  ctx.fillRect(x0 - 1, y0 - 1, MINI_W + 2, MINI_H + 2);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(minimap, x0, y0);
  ctx.globalAlpha = 1;

  // Zone visible à l'écran
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x0 + camX * k + 0.25, y0 + camY * k + 0.25, VW * k - 0.5, VH * k - 0.5);

  const dot = (x, y, color, size = 2) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x0 + x * k - size / 2), Math.round(y0 + y * k - size / 2), size, size);
  };
  if (chest.state === 'ready' && blink) dot(chest.x + 8, chest.y + 8, '#ffd34d', 3);
  for (const e of enemies) {
    if (e.state !== 'dead') dot(e.x, e.y, e.type === 'skeleton' ? '#f4f4f4' : '#ff4d5a');
  }
  dot(player.x, player.y, '#ffd34d', 3);
}

function drawCrosshair() {
  const x = Math.round(mouse.x), y = Math.round(mouse.y);
  const arms = [[-4, 0, 3, 1], [2, 0, 3, 1], [0, -4, 1, 3], [0, 2, 1, 3]];
  ctx.fillStyle = '#1a1214';
  for (const [dx, dy, w, h] of arms) ctx.fillRect(x + dx - 1, y + dy - 1, w + 2, h + 2);
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = weapon === 'ak' ? '#ff4d5a' : '#ffffff';
  for (const [dx, dy, w, h] of arms) ctx.fillRect(x + dx, y + dy, w, h);
  ctx.fillRect(x, y, 1, 1);
}

function drawChest() {
  const f = chest.state === 'opening' || chest.state === 'open' ? Math.min(3, Math.floor(chest.t * 8)) : 0;
  const x = Math.round(chest.x - camX), y = Math.round(chest.y - camY);
  ctx.drawImage(IMG.chest, f * 16, 0, 16, 16, x, y, 16, 16);
  if (chest.state === 'ready') {
    const by = y - 10 + Math.round(Math.sin(performance.now() / 180) * 2);
    text('E', x + 8, by, 7, '#ffd34d', 'center');
  }
}

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function drawHeart(x, y, full) {
  for (let j = 0; j < HEART.length; j++) {
    for (let i = 0; i < 7; i++) {
      if (HEART[j][i] !== 'X') continue;
      ctx.fillStyle = '#1a1214'; ctx.fillRect(x + i + 1, y + j + 1, 1, 1);
      ctx.fillStyle = full ? '#e43b44' : '#4a3438'; ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

function text(s, x, y, size, color = '#fff', align = 'left') {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, size / 4);
  ctx.strokeStyle = '#1a1214';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function overlay(lines) {
  ctx.fillStyle = 'rgba(20,17,15,0.72)';
  ctx.fillRect(0, 0, VW, VH);
  let y = VH / 2 - (lines.length - 1) * 7;
  for (const [s, size, color] of lines) { text(s, VW / 2, y, size, color, 'center'); y += size + 5; }
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;

  camX = clamp(Math.round(player.x - VW / 2), 0, WORLD_W - VW);
  camY = clamp(Math.round(player.y - 10 - VH / 2), 0, WORLD_H - VH);
  if (shake > 0) {
    camX += Math.round((Math.random() - 0.5) * 4);
    camY += Math.round((Math.random() - 0.5) * 4);
  }

  ctx.drawImage(ground, camX, camY, VW, VH, 0, 0, VW, VH);

  // Tri par profondeur (y des pieds) pour que les persos passent derrière les arbres
  const list = [];
  for (const pr of props) {
    if (pr.x + pr.p.sw < camX || pr.x > camX + VW || pr.y + pr.p.sh < camY || pr.y > camY + VH) continue;
    list.push({ sort: pr.sort, draw: () => ctx.drawImage(IMG.objects, pr.p.sx, pr.p.sy, pr.p.sw, pr.p.sh,
      pr.x - camX, pr.y - camY, pr.p.sw, pr.p.sh) });
  }
  for (const d of dust) {
    list.push({ sort: d.y - 2, draw: () => ctx.drawImage(IMG.dust, Math.min(3, Math.floor(d.t * 14)) * 12, 0, 12, 12,
      Math.round(d.x - camX - 6), Math.round(d.y - camY - 10), 12, 12) });
  }
  list.push({ sort: chest.rect.y + chest.rect.h, draw: drawChest });
  for (const e of enemies) list.push({ sort: e.y, draw: () => drawChar(e) });
  list.push({ sort: player.y + 0.1, draw: drawPlayer });
  list.sort((a, b) => a.sort - b.sort);
  for (const it of list) it.draw();
  drawShots();

  // HUD
  for (let i = 0; i < player.maxHp; i++) drawHeart(6 + i * 9, 6, i < player.hp);
  if (mode !== 'title') {
    text(`Vague ${Math.max(1, wave + 1)}/${WAVES.length}`, VW - 6, 9, 7, '#fff', 'right');
    text(`Monstres : ${kills}`, VW - 6, 19, 7, '#cfe8a9', 'right');
    text('[1] Épée', 6, VH - 9, 7, weapon === 'sword' ? '#ffd34d' : '#8a8a8a');
    text('[2] AK-47', 56, VH - 9, 7, weapon === 'ak' ? '#ffd34d' : '#8a8a8a');
    drawMinimap();
  }
  if (banner.t > 0 && mode === 'play') {
    ctx.globalAlpha = Math.min(1, banner.t * 2);
    text(banner.text, VW / 2, 34, 9, '#ffd34d', 'center');
    ctx.globalAlpha = 1;
  }

  if (mode === 'title') {
    overlay([
      ['MYSTIC WOODS', 18, '#ffd34d'],
      ['', 4],
      ['Survis à 3 vagues de monstres', 7, '#fff'],
      ['puis ouvre le coffre de la clairière.', 7, '#fff'],
      ['', 4],
      ['Déplacement : ZQSD / flèches', 7, '#cfe8a9'],
      ['Viser : souris   Attaque / tir : clic', 7, '#cfe8a9'],
      ['Armes : 1 Épée   2 AK-47   Coffre : E', 7, '#cfe8a9'],
      ['', 4],
      ['Clic ou Entrée pour jouer', 8, '#ffd34d'],
    ]);
  } else if (mode === 'over') {
    overlay([
      ['GAME OVER', 18, '#e43b44'],
      [`Vague ${wave + 1}  ·  ${kills} monstres vaincus`, 7, '#fff'],
      ['', 4],
      ['R pour recommencer', 8, '#ffd34d'],
    ]);
  } else if (mode === 'win') {
    overlay([
      ['VICTOIRE !', 18, '#ffd34d'],
      [`${kills} monstres vaincus en ${Math.floor(playTime)} s`, 7, '#fff'],
      ['', 4],
      ['R pour rejouer', 8, '#cfe8a9'],
    ]);
  }
  drawCrosshair();
}

// ---------------------------------------------------------------------------
// Boucle
// ---------------------------------------------------------------------------
let last = 0;

function update(dt) {
  if (mode === 'title') {
    player.t += dt;
    if (hit('Enter', 'NumpadEnter', 'Space') || mouse.pressed) { mode = 'play'; pressed.clear(); mouse.pressed = false; }
    return;
  }
  if (mode === 'over' || mode === 'win') {
    if (hit('KeyR', 'Enter', 'NumpadEnter') || mouse.pressed) { reset(); mode = 'play'; mouse.pressed = false; }
    return;
  }

  playTime += dt;
  shake = Math.max(0, shake - dt);
  banner.t = Math.max(0, banner.t - dt);
  updatePlayer(dt);
  updateBullets(dt);
  for (const e of enemies) updateEnemy(e, dt);
  enemies = enemies.filter(e => !e.remove);
  for (const d of dust) d.t += dt;
  dust = dust.filter(d => d.t < 4 / 14);
  updateWaves(dt);
  updateChest(dt);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt);
  render();
  pressed.clear();
  mouse.pressed = false;
  requestAnimationFrame(frame);
}

resize();
loadAssets()
  .then(() => { reset(); requestAnimationFrame(t => { last = t; frame(t); }); })
  .catch(err => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#14110f'; ctx.fillRect(0, 0, VW, VH);
    text(err.message, VW / 2, VH / 2, 7, '#e43b44', 'center');
    console.error(err);
  });
