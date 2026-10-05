'use strict';

const { Game, colorOf, typeOf, other } = Chess;
const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Pièces Unicode pleines ; ︎ force le rendu « texte » (pas en emoji).
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const OUTLINE = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const glyph = t => GLYPH[t] + '︎';

// Élément de pièce ; les blancs reçoivent leur glyphe contour (voir style.css)
function pieceEl(tag, cls, color, t) {
  const el = document.createElement(tag);
  el.className = `${cls} ${color}`;
  el.textContent = glyph(t);
  if (color === 'w') el.dataset.o = OUTLINE[t] + '︎';
  return el;
}
const START_COUNT = { q: 1, r: 2, b: 2, n: 2, p: 8 };

// ---------------------------------------------------------------------------
// Profil & Elo
// ---------------------------------------------------------------------------
// 400 : niveau d'un débutant qui connaît les règles (point de départ habituel
// sur les sites d'échecs pour un nouveau joueur sans expérience).
const START_ELO = 400;
const STORE = 'echecs-du-bois-v1';

function defaultProfile() { return { elo: START_ELO, peak: START_ELO, games: [] }; }
function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE));
    if (p && typeof p.elo === 'number' && Array.isArray(p.games)) return p;
  } catch {}
  return defaultProfile();
}
function saveProfile() { try { localStorage.setItem(STORE, JSON.stringify(profile)); } catch {} }

let profile = loadProfile();
let soundOn = true;
try { soundOn = localStorage.getItem(STORE + '-sound') !== 'off'; } catch {}

const ratedGames = () => profile.games.filter(g => g.rated);
const provisional = () => ratedGames().length < 10;
// K plus élevé pendant les 10 premières parties pour converger vite vers ton vrai niveau
const kFactor = () => (provisional() ? 40 : 24);
const expected = (me, opp) => 1 / (1 + Math.pow(10, (opp - me) / 400));
const eloDelta = (botElo, score) => Math.round(kFactor() * (score - expected(profile.elo, botElo)));
const signed = n => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0');

// ---------------------------------------------------------------------------
// État de la partie
// ---------------------------------------------------------------------------
const S = {
  bot: null, color: 'w', colorChoice: 'r',
  game: new Game(), sans: [], moves: [], fens: [new Game().fen()],
  view: null,            // null = position en direct, sinon index de demi-coup revu
  selected: null, hint: null, promo: null,
  over: true, rated: true, result: null,
  thinking: false, gid: 0,
  lastEval: 0, lastTalkPly: -9, drawPly: -99, botDrawOfferPly: -1, botOfferedDraw: false,
};
const botColor = () => other(S.color);
const playerHasMoved = () => S.moves.length >= (S.color === 'w' ? 1 : 2);

// ---------------------------------------------------------------------------
// Sons (WebAudio, aucun fichier)
// ---------------------------------------------------------------------------
let actx = null;
function tone(freq, dur, type = 'triangle', vol = 0.18, when = 0) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {}
}
function moveSound(m, g) {
  if (g.inCheck()) { tone(700, 0.14, 'sine', 0.16); tone(520, 0.12, 'triangle', 0.12, 0.04); }
  else if (m.captured) { tone(260, 0.1, 'square', 0.09); tone(150, 0.14, 'triangle', 0.2, 0.02); }
  else { tone(330, 0.06, 'triangle', 0.18); tone(190, 0.08, 'triangle', 0.14, 0.015); }
}
function endSound(score) {
  const notes = score === 1 ? [523, 659, 784, 1046] : score === 0 ? [392, 330, 262] : [440, 440];
  notes.forEach((f, i) => tone(f, 0.22, 'sine', 0.14, i * 0.13));
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
const chatLog = $('chatLog');
let typing = 0, typingEl = null;

function addMsg(kind, text, actions) {
  const el = document.createElement('div');
  el.className = 'msg ' + kind;
  if (kind === 'bot') {
    const img = document.createElement('img');
    img.src = S.bot.avatar;
    img.alt = '';
    el.appendChild(img);
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  if (actions) {
    const row = document.createElement('div');
    row.className = 'bubble-actions';
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => { row.querySelectorAll('button').forEach(x => (x.disabled = true)); a.fn(); };
      row.appendChild(b);
    }
    bubble.appendChild(row);
  }
  el.appendChild(bubble);
  chatLog.insertBefore(el, typingEl && typingEl.isConnected ? typingEl : null);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}
const sys = text => addMsg('sys', text);

function setTyping(delta) {
  typing = Math.max(0, typing + delta);
  if (typing && !typingEl?.isConnected) {
    typingEl = document.createElement('div');
    typingEl.className = 'msg bot typing';
    typingEl.innerHTML = `<img src="${S.bot.avatar}" alt=""><div class="bubble">écrit</div>`;
    chatLog.appendChild(typingEl);
    chatLog.scrollTop = chatLog.scrollHeight;
  } else if (!typing && typingEl) {
    typingEl.remove();
    typingEl = null;
  }
}

// Le bot « tape » un moment avant que son message apparaisse
function botSay(text, { delay, actions, then } = {}) {
  if (!text || !S.bot) return;
  const gid = S.gid;
  const d = delay ?? 500 + Math.min(1400, text.length * 22) + Math.random() * 300;
  setTyping(1);
  setTimeout(() => {
    setTyping(-1);
    if (gid !== S.gid) return;
    addMsg('bot', text.replace('{elo}', S.bot.elo), actions);
    then?.();
  }, d);
}

// Réaction spontanée, avec un minimum d'écart entre deux messages
function talk(cat, prob) {
  if (Math.random() > prob || S.sans.length - S.lastTalkPly < 3) return false;
  S.lastTalkPly = S.sans.length;
  botSay(pick(S.bot.lines[cat]));
  return true;
}

const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function replyTo(text) {
  if (!S.bot) return;
  const t = normalize(text);
  const L = S.bot.lines, R = L.reply;
  if (!S.over && /(nul|nulle|egalite|draw)/.test(t) && /(propos|on fait|on dit|accept|veux|\?)/.test(t)) { offerDraw(); return; }
  if (!S.over && /(reprend|annule|takeback|undo|retour)/.test(t)) { requestTakeback(); return; }
  if (S.over && /(revanche|rejou|encore une|une autre)/.test(t)) { botSay(pick(L.rematch)); return; }
  let cat = 'default';
  if (/\b(bonjour|salut|coucou|hello|hey|yo|bonsoir|slt|cc|wesh)\b/.test(t)) cat = 'hello';
  else if (/(\bgg\b|\bwp\b|bien joue|bravo|joli|beau coup|bien vu|felicit|impression|trop fort)/.test(t)) cat = 'compliment';
  else if (/\b(merci|thx|thanks|mrc)\b/.test(t)) cat = 'thanks';
  else if (/\b(con|conne|connard|idiot|debile|naze|nase|nul|nulle|bete|merde|pourri|noob|tg|fdp|stupide|guignol)\b/.test(t)) cat = 'insult';
  else if (/(elo|niveau|classement|rating)/.test(t)) cat = 'elo';
  else if (/(qui es|t'es qui|tes qui|ton nom|tu t'appel|present|c'est qui)/.test(t)) cat = 'who';
  else if (/(conseil|astuce|aide|comment jouer|\btips?\b|ameliorer)/.test(t)) cat = 'tip';
  else if (/(haha|hihi|hehe|lol|mdr|ptdr|xd|😂|🤣)/.test(t)) cat = 'laugh';
  else if (/\?\s*$/.test(t)) cat = 'question';
  botSay(pick(R[cat]));
}

$('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('chatInput'), text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMsg('me', text);
  replyTo(text);
});

// ---------------------------------------------------------------------------
// Déroulement de la partie
// ---------------------------------------------------------------------------
function startGame(bot, colorChoice, rematch = false) {
  S.gid++;
  S.bot = bot;
  S.colorChoice = colorChoice;
  S.color = colorChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
  S.game = new Game();
  S.sans = []; S.moves = []; S.fens = [S.game.fen()];
  S.view = null; S.selected = null; S.hint = null; S.promo = null;
  S.over = false; S.rated = true; S.result = null; S.thinking = false;
  S.lastEval = 0; S.lastTalkPly = -9; S.drawPly = -99; S.botDrawOfferPly = -1; S.botOfferedDraw = false;

  typing = 0; typingEl = null;
  chatLog.replaceChildren();
  sys(`Partie contre ${bot.name} (${bot.elo}). Tu joues les ${S.color === 'w' ? 'blancs' : 'noirs'}.`);
  botSay(pick(rematch ? bot.lines.rematch : bot.lines.greet), { delay: 600 });

  hideModal('lobby');
  hideModal('endModal');
  renderAll();
  if (S.color === 'b') scheduleBotMove();
}

function applyMove(m) {
  const g = S.game, mover = g.turn;
  const san = g.san(m);
  g.make(m);
  S.sans.push(san);
  S.moves.push(m);
  S.fens.push(g.fen());
  S.selected = null;
  S.hint = null;
  S.view = null;
  moveSound(m, g);
  const st = g.status();
  renderAll();
  if (st) { endGame(st, mover); return true; }
  return false;
}

function canInteract() {
  return !S.over && S.view === null && !S.thinking && !S.promo && S.game.turn === S.color;
}

function tryPlayerMove(from, to) {
  const cands = S.game.moves().filter(m => m.from === from && m.to === to);
  if (!cands.length) { S.selected = null; renderBoard(); return false; }
  if (cands.length > 1) openPromo(cands);
  else playerMove(cands[0]);
  return true;
}

function playerMove(m) {
  if (applyMove(m)) return;
  const ev = AI.evalFor(S.game, botColor());
  if (m.captured && 'qr'.includes(typeOf(m.captured))) talk('lostPiece', 0.75);
  else if (ev - S.lastEval > 250 && ev > 150) talk('playerBlunder', 0.6);
  S.lastEval = ev;
  scheduleBotMove();
}

function scheduleBotMove() {
  const gid = S.gid;
  S.thinking = true;
  renderAll();
  const [a, b] = S.bot.think;
  const delay = a + Math.random() * (b - a), t0 = performance.now();
  // Petit délai pour que « réfléchit… » s'affiche avant le calcul (bloquant)
  setTimeout(() => {
    if (gid !== S.gid || S.over) return;
    const m = AI.pickMove(S.game, S.bot.ai);
    setTimeout(() => {
      if (gid !== S.gid || S.over) return;
      S.thinking = false;
      botMoveDone(m);
    }, Math.max(0, delay - (performance.now() - t0)));
  }, 50);
}

function botMoveDone(m) {
  if (applyMove(m)) return;
  const g = S.game, ev = AI.evalFor(g, botColor());
  S.lastEval = ev;
  if (m.captured && 'qr'.includes(typeOf(m.captured))) talk('botBigCapture', 0.7);
  else if (g.inCheck()) talk('botCheck', 0.45);
  else if (!S.botOfferedDraw && S.sans.length >= 50 && Math.abs(ev) < 40 && Math.random() < 0.1) botOfferDraw();
  else talk('idle', 0.07);
}

// ---------------------------------------------------------------------------
// Nulle, reprise, indice, abandon
// ---------------------------------------------------------------------------
function offerDraw() {
  if (S.over) return;
  if (!playerHasMoved()) { toast('Joue au moins un coup avant de proposer la nulle.'); return; }
  if (S.sans.length - S.drawPly < 6) { toast('Attends quelques coups avant de reproposer la nulle.'); return; }
  S.drawPly = S.sans.length;
  sys('Tu proposes la nulle.');
  const ev = AI.evalFor(S.game, botColor());
  // Le bot accepte s'il est moins bien, ou si c'est équilibré en fin de partie
  let accept = ev < -150 || (Math.abs(ev) <= 60 && S.sans.length >= 40);
  if (S.bot.elo <= 200) accept = Math.random() < 0.4;
  const gid = S.gid, ply = S.sans.length;
  botSay(pick(accept ? S.bot.lines.drawAccept : S.bot.lines.drawDecline), {
    delay: 900 + Math.random() * 600,
    then: () => { if (accept && gid === S.gid && !S.over && S.sans.length === ply) endGame('agreed'); },
  });
}

function botOfferDraw() {
  S.botOfferedDraw = true;
  S.botDrawOfferPly = S.sans.length;
  const ply = S.sans.length, gid = S.gid;
  const valid = () => gid === S.gid && !S.over && S.sans.length === ply;
  botSay(pick(S.bot.lines.offerDraw), {
    actions: [
      { label: 'Accepter', fn: () => { if (valid()) endGame('agreed'); else toast('L\'offre n\'est plus valable.'); } },
      { label: 'Refuser', fn: () => { if (valid()) sys('Tu as refusé la nulle.'); } },
    ],
  });
}

function makeUnrated(reason) {
  if (!S.rated) return;
  S.rated = false;
  sys(`Partie amicale (${reason}) : ton Elo ne changera pas.`);
}

function requestTakeback() {
  if (S.over || S.thinking) return;
  if (!playerHasMoved()) { toast('Rien à reprendre.'); return; }
  const n = S.game.turn === S.color ? 2 : 1;
  sys('Tu demandes à reprendre ton dernier coup.');
  const yes = Math.random() < S.bot.takeback;
  const gid = S.gid, ply = S.sans.length;
  botSay(pick(yes ? S.bot.lines.takebackYes : S.bot.lines.takebackNo), {
    then: () => {
      if (!yes || gid !== S.gid || S.over || S.thinking || S.sans.length !== ply) return;
      for (let i = 0; i < n; i++) { S.game.undo(); S.sans.pop(); S.moves.pop(); S.fens.pop(); }
      S.view = null; S.selected = null; S.hint = null;
      makeUnrated('coup repris');
      S.lastEval = AI.evalFor(S.game, botColor());
      renderAll();
    },
  });
}

function showHint() {
  if (!canInteract()) return;
  if (S.rated && !confirm('Utiliser un indice rend la partie amicale : ton Elo ne changera pas. Continuer ?')) return;
  makeUnrated('indice utilisé');
  const m = AI.bestMove(S.game, 3);
  S.hint = { from: m.from, to: m.to };
  renderAll();
}

function resign() {
  if (S.over) return;
  if (!playerHasMoved()) {
    if (confirm('Annuler la partie ? Elle ne comptera pas.')) endGame('aborted');
  } else if (confirm('Abandonner la partie ?')) {
    endGame('resign');
  }
}

const REASONS = {
  checkmate: 'par échec et mat',
  resign: 'par abandon',
  stalemate: 'par pat',
  insufficient: 'matériel insuffisant pour mater',
  fifty: 'règle des 50 coups',
  repetition: 'par triple répétition',
  agreed: 'nulle d\'un commun accord',
};

function endGame(reason, lastMover) {
  if (S.over) return;
  S.over = true;
  S.thinking = false;
  S.selected = null;
  S.promo = null;
  hideModal('promoModal');

  if (reason === 'aborted') {
    S.gid++;
    renderAll();
    openLobby();
    return;
  }
  const score = reason === 'checkmate' ? (lastMover === S.color ? 1 : 0)
    : reason === 'resign' ? 0 : 0.5;
  const before = profile.elo;
  let delta = 0;
  if (S.rated) {
    delta = eloDelta(S.bot.elo, score);
    profile.elo = Math.max(100, profile.elo + delta);
    profile.peak = Math.max(profile.peak, profile.elo);
  }
  S.result = { score, reason, delta, rated: S.rated, before, after: profile.elo };
  profile.games.push({
    bot: S.bot.id, botElo: S.bot.elo, color: S.color, score, reason,
    rated: S.rated, delta, elo: profile.elo, date: Date.now(), pgn: pgn(),
  });
  if (profile.games.length > 300) profile.games.splice(0, profile.games.length - 300);
  saveProfile();

  const L = S.bot.lines;
  botSay(pick(score === 1 ? L.lose : score === 0 ? L.win : L.draw), { delay: 700 });
  endSound(score);
  renderAll();
  const gid = S.gid;
  setTimeout(() => { if (gid === S.gid) showEndModal(); }, 1100);
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
const boardEl = $('board');

function viewPly() { return S.view === null ? S.moves.length : S.view; }
function viewGame() { return S.view === null ? S.game : new Game(S.fens[S.view]); }

function renderBoard() {
  const g = viewGame(), last = S.moves[viewPly() - 1], flip = S.color === 'b';
  const live = S.view === null;
  const targets = live && S.selected !== null ? S.game.moves().filter(m => m.from === S.selected).map(m => m.to) : [];
  const checkSq = g.inCheck() ? g.kings[g.turn] : -1;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const row = flip ? 7 - r : r, col = flip ? 7 - f : f, sq = row * 16 + col;
      const el = document.createElement('div');
      el.className = 'sq ' + ((row + col) % 2 ? 'dark' : 'light');
      el.dataset.sq = sq;
      el.style.setProperty('--grain', 84 + ((sq * 37) % 13) + 'deg');   // veinage varié
      if (last && (sq === last.from || sq === last.to)) el.classList.add('last');
      if (live && sq === S.selected) el.classList.add('sel');
      if (live && S.hint && (sq === S.hint.from || sq === S.hint.to)) el.classList.add('hint');
      if (sq === checkSq) el.classList.add('check');
      const p = g.b[sq];
      if (targets.includes(sq)) el.classList.add('target', ...(p ? ['occupied'] : []));
      if (f === 0) el.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - row}</span>`);
      if (r === 7) el.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[col]}</span>`);
      if (p) {
        const s = pieceEl('span', 'piece', colorOf(p), typeOf(p));
        if (colorOf(p) === S.color && canInteract()) s.classList.add('mine');
        el.appendChild(s);
      }
      frag.appendChild(el);
    }
  }
  boardEl.replaceChildren(frag);
  boardEl.classList.toggle('viewing', !live);
}

function materialInfo(g) {
  const count = { w: {}, b: {} };
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = g.b[sq];
    if (p) { const c = colorOf(p), t = typeOf(p); count[c][t] = (count[c][t] || 0) + 1; }
  }
  const lost = c => {
    let s = '';
    for (const t of ['q', 'r', 'b', 'n', 'p']) s += glyph(t).repeat(Math.max(0, START_COUNT[t] - (count[c][t] || 0)));
    return s;
  };
  const mat = c => Object.entries(count[c]).reduce((a, [t, n]) => a + ({ p: 1, n: 3, b: 3, r: 5, q: 9 }[t] || 0) * n, 0);
  return { lost, diff: mat('w') - mat('b') };
}

function renderCards() {
  const g = viewGame(), info = materialInfo(g);
  const card = (el, who) => {
    const isBot = who === 'bot';
    const col = isBot ? botColor() : S.color;
    const name = isBot ? (S.bot ? S.bot.name : 'Adversaire') : 'Toi';
    const elo = isBot ? (S.bot ? S.bot.elo : '?') : profile.elo;
    const avatar = isBot ? (S.bot ? S.bot.avatar : '') : PLAYER_AVATAR;
    const ring = isBot ? (S.bot ? S.bot.color : '') : '#e8b04a';
    const adv = col === 'w' ? info.diff : -info.diff;
    const captured = info.lost(other(col));
    const thinking = isBot && S.thinking && !S.over;
    el.classList.toggle('turn', !S.over && S.game.turn === col);
    el.innerHTML = `
      <img class="avatar" src="${avatar}" alt="" style="--ring:${ring}">
      <div class="pc-main">
        <div class="pc-name">${name}<span class="elo">(${elo})</span></div>
        <div class="pc-sub">
          ${thinking ? '<span class="thinking">réfléchit</span>' : ''}
          <span class="captured">${captured}</span>
          ${adv > 0 ? `<span class="adv">+${adv}</span>` : ''}
        </div>
      </div>
      <div class="pc-color">${col === 'w' ? '♔' : '♚'}</div>`;
  };
  card($('topCard'), 'bot');
  card($('bottomCard'), 'me');
}

function renderMoves() {
  const ol = $('moves');
  const cur = viewPly() - 1;
  if (!S.sans.length) {
    ol.innerHTML = '<li class="moves-empty" style="grid-column:1/-1">Aucun coup joué.</li>';
    return;
  }
  let html = '';
  for (let i = 0; i < S.sans.length; i += 2) {
    html += `<li><span class="num">${i / 2 + 1}.</span>` +
      `<span class="mv${cur === i ? ' cur' : ''}" data-ply="${i + 1}">${S.sans[i]}</span>` +
      (S.sans[i + 1] ? `<span class="mv${cur === i + 1 ? ' cur' : ''}" data-ply="${i + 2}">${S.sans[i + 1]}</span>` : '<span></span>') +
      '</li>';
  }
  ol.innerHTML = html;
  const curEl = ol.querySelector('.cur');
  if (S.view === null) ol.scrollTop = ol.scrollHeight;
  else curEl?.scrollIntoView({ block: 'nearest' });
}

function renderStatus() {
  const st = $('status'), stakes = $('stakes');
  if (S.view !== null) {
    st.textContent = `Revue : coup ${S.view} / ${S.moves.length}`;
  } else if (S.over && S.result) {
    const r = S.result;
    st.textContent = (r.score === 1 ? 'Victoire' : r.score === 0 ? 'Défaite' : 'Match nul') + ' — ' + REASONS[r.reason];
  } else if (S.over) {
    st.textContent = 'Choisis un adversaire pour commencer.';
  } else {
    const check = S.game.inCheck() ? ' — Échec !' : '';
    st.textContent = (S.game.turn === S.color ? 'À toi de jouer' : `${S.bot.name} réfléchit…`) + check;
  }

  if (!S.bot || (S.over && !S.result)) { stakes.innerHTML = ''; return; }
  if (S.over) {
    const r = S.result;
    stakes.innerHTML = r.rated
      ? `Elo : ${r.before} → <b>${r.after}</b> (<span class="${r.delta >= 0 ? 'win' : 'loss'}">${signed(r.delta)}</span>)`
      : 'Partie amicale : Elo inchangé.';
  } else if (S.rated) {
    stakes.innerHTML = `Enjeu : <span class="win">${signed(eloDelta(S.bot.elo, 1))}</span> victoire · ` +
      `${signed(eloDelta(S.bot.elo, 0.5))} nulle · <span class="loss">${signed(eloDelta(S.bot.elo, 0))}</span> défaite`;
  } else {
    stakes.innerHTML = '<span class="badge">Partie amicale</span> Elo inchangé.';
  }
}

function renderActions() {
  const playing = !S.over && !!S.bot;
  const drawBtn = $('drawBtn'), resignBtn = $('resignBtn');
  if (S.over && S.bot && S.result) {
    drawBtn.textContent = '↻ Revanche';
    drawBtn.disabled = false;
    resignBtn.textContent = '♞ Nouvelle partie';
    resignBtn.classList.remove('danger');
  } else {
    drawBtn.textContent = '½ Nulle';
    drawBtn.disabled = !playing || !playerHasMoved();
    resignBtn.textContent = playing && !playerHasMoved() ? '✕ Annuler' : '🏳 Abandonner';
    resignBtn.classList.add('danger');
    resignBtn.disabled = !playing && !S.result;
  }
  $('takebackBtn').disabled = !playing || S.thinking || !playerHasMoved();
  $('hintBtn').disabled = !canInteract();
  $('pgnBtn').disabled = !S.sans.length;
  $('navFirst').disabled = $('navPrev').disabled = viewPly() === 0;
  $('navNext').disabled = $('navLast').disabled = S.view === null;
}

function renderEloChip() {
  $('eloChip').innerHTML = `${profile.elo} Elo${provisional() ? ' <small>(provisoire)</small>' : ''}`;
  $('soundBtn').textContent = soundOn ? '🔊' : '🔇';
}

function renderAll() {
  renderBoard();
  renderCards();
  renderMoves();
  renderStatus();
  renderActions();
  renderEloChip();
}

// ---------------------------------------------------------------------------
// Revue des coups
// ---------------------------------------------------------------------------
function setView(ply) {
  ply = Math.max(0, Math.min(S.moves.length, ply));
  S.view = ply === S.moves.length ? null : ply;
  S.selected = null;
  renderAll();
}
$('navFirst').onclick = () => setView(0);
$('navPrev').onclick = () => setView(viewPly() - 1);
$('navNext').onclick = () => setView(viewPly() + 1);
$('navLast').onclick = () => setView(S.moves.length);
$('moves').addEventListener('click', e => {
  const mv = e.target.closest('.mv');
  if (mv) setView(+mv.dataset.ply);
});
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'ArrowLeft') { setView(viewPly() - 1); e.preventDefault(); }
  if (e.key === 'ArrowRight') { setView(viewPly() + 1); e.preventDefault(); }
  if (e.key === 'Escape' && S.promo) cancelPromo();
});

// ---------------------------------------------------------------------------
// Souris : clic-clic ou glisser-déposer
// ---------------------------------------------------------------------------
let drag = null;

boardEl.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const sqEl = e.target.closest('.sq');
  if (!sqEl || !canInteract()) return;
  const sq = +sqEl.dataset.sq, p = S.game.b[sq];
  if (S.selected !== null && S.selected !== sq && S.game.moves().some(m => m.from === S.selected && m.to === sq)) {
    tryPlayerMove(S.selected, sq);
    return;
  }
  if (p && colorOf(p) === S.color) {
    const wasSelected = S.selected === sq;
    S.selected = sq;
    renderBoard();
    drag = { sq, wasSelected, moved: false, x0: e.clientX, y0: e.clientY, ghost: null };
    e.preventDefault();
  } else if (S.selected !== null) {
    S.selected = null;
    renderBoard();
  }
});

addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
  if (!drag.ghost) {
    const p = S.game.b[drag.sq];
    drag.ghost = pieceEl('span', 'ghost', colorOf(p), typeOf(p));
    drag.ghost.style.fontSize = (boardEl.clientWidth / 8) * 0.83 + 'px';
    document.body.appendChild(drag.ghost);
    boardEl.querySelector(`.sq[data-sq="${drag.sq}"] .piece`)?.classList.add('lifted');
    drag.moved = true;
  }
  drag.ghost.style.left = e.clientX + 'px';
  drag.ghost.style.top = e.clientY + 'px';
});

addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.ghost?.remove();
  if (d.moved) {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.sq');
    const to = el && boardEl.contains(el) ? +el.dataset.sq : -1;
    if (to >= 0 && to !== d.sq && canInteract() && tryPlayerMove(d.sq, to)) return;
    renderBoard();
  } else if (d.wasSelected) {
    S.selected = null;
    renderBoard();
  }
});

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------
function openPromo(cands) {
  S.promo = cands;
  const box = $('promoChoices');
  box.replaceChildren();
  for (const t of ['q', 'r', 'b', 'n']) {
    const b = document.createElement('button');
    b.appendChild(pieceEl('span', 'piece', S.color, t));
    b.title = { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier' }[t];
    b.onclick = () => {
      const m = S.promo.find(x => x.promo === t);
      S.promo = null;
      hideModal('promoModal');
      playerMove(m);
    };
    box.appendChild(b);
  }
  showModal('promoModal');
}
function cancelPromo() {
  S.promo = null;
  S.selected = null;
  hideModal('promoModal');
  renderBoard();
}
$('promoModal').addEventListener('click', e => { if (e.target.id === 'promoModal') cancelPromo(); });

// ---------------------------------------------------------------------------
// Lobby (choix du bot) & fin de partie
// ---------------------------------------------------------------------------
let lobbyBot = null;

function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden'); }

function recordVs(botId) {
  const gs = profile.games.filter(g => g.bot === botId);
  return {
    w: gs.filter(g => g.score === 1).length,
    d: gs.filter(g => g.score === 0.5).length,
    l: gs.filter(g => g.score === 0).length,
  };
}

function sparkline() {
  const pts = [START_ELO, ...ratedGames().map(g => g.elo)].slice(-40);
  if (pts.length < 2) return '<div class="spark" style="display:flex;align-items:center;color:var(--muted);font-size:13px">Ta courbe d\'Elo apparaîtra ici.</div>';
  const min = Math.min(...pts) - 10, max = Math.max(...pts) + 10;
  const xy = pts.map((v, i) => `${(i / (pts.length - 1)) * 200},${46 - ((v - min) / (max - min)) * 42 - 2}`).join(' ');
  return `<svg class="spark" viewBox="0 0 200 46" preserveAspectRatio="none">
    <polyline points="${xy}" fill="none" stroke="#e8b04a" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderLobby() {
  const all = profile.games.filter(g => g.score !== null);
  const w = all.filter(g => g.score === 1).length, d = all.filter(g => g.score === 0.5).length, l = all.filter(g => g.score === 0).length;
  $('profile').innerHTML = `
    <img class="avatar" src="${PLAYER_AVATAR}" alt="" style="--ring:#e8b04a">
    <div class="profile-elo">${profile.elo}<small>Elo${provisional() ? ' provisoire (' + ratedGames().length + '/10 parties)' : ''} · record ${profile.peak}</small></div>
    <div class="profile-stats"><span>Victoires <b>${w}</b></span><span>Nulles <b>${d}</b></span><span>Défaites <b>${l}</b></span></div>
    ${sparkline()}
    <button class="link-btn reset-link" id="resetBtn" title="Remettre l'Elo à ${START_ELO} et effacer l'historique">Réinitialiser</button>`;
  $('resetBtn').onclick = () => {
    if (!confirm(`Remettre ton Elo à ${START_ELO} et effacer tout l'historique ?`)) return;
    profile = defaultProfile();
    saveProfile();
    renderLobby();
    renderAll();
  };

  if (!lobbyBot) {
    lobbyBot = BOTS.reduce((best, b) => (Math.abs(b.elo - profile.elo) < Math.abs(best.elo - profile.elo) ? b : best));
  }
  const grid = $('botGrid');
  grid.replaceChildren();
  for (const bot of BOTS) {
    const rec = recordVs(bot.id);
    const btn = document.createElement('button');
    btn.className = 'bot-card' + (bot === lobbyBot ? ' selected' : '');
    btn.innerHTML = `
      <img class="avatar" src="${bot.avatar}" alt="" style="--ring:${bot.color}">
      <div>
        <div class="bc-name">${bot.name}</div>
        <div class="bc-elo">${bot.elo} Elo</div>
        <div class="bc-bio">${bot.bio}</div>
        <div class="bc-meta">
          Gain <span class="win">${signed(eloDelta(bot.elo, 1))}</span> · Perte <span class="loss">${signed(eloDelta(bot.elo, 0))}</span>
          ${rec.w + rec.d + rec.l ? ` · Toi : ${rec.w}V ${rec.d}N ${rec.l}D` : ''}
        </div>
      </div>`;
    btn.onclick = () => { lobbyBot = bot; renderLobby(); };
    btn.ondblclick = () => { lobbyBot = bot; play(); };
    grid.appendChild(btn);
  }
}

function openLobby() {
  hideModal('endModal');
  renderLobby();
  showModal('lobby');
}

function play() {
  const choice = document.querySelector('input[name="color"]:checked').value;
  startGame(lobbyBot, choice);
}
$('playBtn').onclick = play;

function showEndModal() {
  const r = S.result;
  $('endAvatar').innerHTML = `<img src="${S.bot.avatar}" alt="" style="--ring:${S.bot.color}">`;
  $('endTitle').textContent = r.score === 1 ? 'Victoire ! 🎉' : r.score === 0 ? 'Défaite' : 'Match nul';
  $('endReason').textContent = `${REASONS[r.reason]} contre ${S.bot.name}`;
  $('endElo').innerHTML = r.rated
    ? `${r.before} → <b>${r.after}</b> <span class="delta ${r.delta >= 0 ? 'win' : 'loss'}">${signed(r.delta)}</span>`
    : 'Partie amicale : Elo inchangé.';
  showModal('endModal');
}

function rematch() {
  // On inverse les couleurs à chaque revanche
  startGame(S.bot, other(S.color), true);
}
$('rematchBtn').onclick = rematch;
$('lobbyBtn').onclick = openLobby;
$('reviewBtn').onclick = () => hideModal('endModal');

$('drawBtn').onclick = () => (S.over ? rematch() : offerDraw());
$('resignBtn').onclick = () => (S.over ? openLobby() : resign());
$('takebackBtn').onclick = requestTakeback;
$('hintBtn').onclick = showHint;
$('soundBtn').onclick = () => {
  soundOn = !soundOn;
  try { localStorage.setItem(STORE + '-sound', soundOn ? 'on' : 'off'); } catch {}
  renderEloChip();
};

// ---------------------------------------------------------------------------
// PGN
// ---------------------------------------------------------------------------
function pgn() {
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const r = S.result;
  let res = '*';
  if (S.over && r) {
    const whiteScore = S.color === 'w' ? r.score : 1 - r.score;
    res = whiteScore === 1 ? '1-0' : whiteScore === 0 ? '0-1' : '1/2-1/2';
  } else if (S.over) {
    const st = S.game.status();
    if (st === 'checkmate') res = S.game.turn === 'w' ? '0-1' : '1-0';
    else if (st) res = '1/2-1/2';
  }
  const me = ['Toi', profile.elo], bot = [S.bot.name, S.bot.elo];
  const [W, B] = S.color === 'w' ? [me, bot] : [bot, me];
  let moves = '';
  S.sans.forEach((s, i) => { moves += (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + s + ' '; });
  return `[Event "${S.rated ? 'Partie classée' : 'Partie amicale'}"]\n[Site "Échecs du Bois"]\n[Date "${date}"]\n` +
    `[White "${W[0]}"]\n[Black "${B[0]}"]\n[WhiteElo "${W[1]}"]\n[BlackElo "${B[1]}"]\n[Result "${res}"]\n\n${moves}${res}\n`;
}

$('pgnBtn').onclick = async () => {
  const text = pgn();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Partie copiée au format PGN.');
};

let toastT = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
S.bot = null;
renderAll();
openLobby();
