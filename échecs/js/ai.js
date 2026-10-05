'use strict';

// IA : évaluation matériel + tables de position, recherche alpha-bêta.
// Le niveau des bots vient de la profondeur, du bruit ajouté aux scores et
// d'une part de coups aléatoires / gaffes volontaires.
const AI = (() => {
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;

  // Tables du point de vue des blancs, 8e rangée en premier.
  const PST = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20],
    k: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20],
    kEnd: [
      -50, -40, -30, -20, -20, -30, -40, -50,
      -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30,
      -50, -30, -30, -30, -30, -30, -30, -50],
  };

  const idxW = sq => (sq >> 4) * 8 + (sq & 7);
  const idxB = sq => (7 - (sq >> 4)) * 8 + (sq & 7);

  // Score en centipions du point de vue du camp au trait
  function evaluate(g) {
    let s = 0, npm = 0, bw = 0, bb = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = g.b[sq];
      if (!p) continue;
      const t = p.toLowerCase();
      if (t === 'k') continue;
      const white = p !== t;
      const v = VAL[t] + PST[t][white ? idxW(sq) : idxB(sq)];
      s += white ? v : -v;
      if (t !== 'p') npm += VAL[t];
      if (t === 'b') { if (white) bw++; else bb++; }
    }
    if (bw >= 2) s += 30;
    if (bb >= 2) s -= 30;
    const kt = npm <= 2600 ? PST.kEnd : PST.k;
    s += kt[idxW(g.kings.w)] - kt[idxB(g.kings.b)];
    return g.turn === 'w' ? s : -s;
  }

  const moveScore = m =>
    (m.captured ? 10000 + 10 * VAL[m.captured.toLowerCase()] - VAL[m.piece.toLowerCase()] : 0) +
    (m.promo ? 8000 + VAL[m.promo] : 0);
  const order = ms => ms.sort((a, b) => moveScore(b) - moveScore(a));

  function quiesce(g, alpha, beta, depth) {
    const stand = evaluate(g);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0) return alpha;
    const us = g.turn;
    for (const m of order(g.pseudo(true))) {
      g.make(m, true);
      if (g.attacked(g.kings[us], g.turn)) { g.undo(true); continue; }
      const sc = -quiesce(g, -beta, -alpha, depth - 1);
      g.undo(true);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function negamax(g, depth, alpha, beta, ply, q) {
    if (depth <= 0) return q ? quiesce(g, alpha, beta, 4) : evaluate(g);
    if (g.half >= 100) return 0;
    const us = g.turn;
    let legal = 0;
    for (const m of order(g.pseudo(false))) {
      g.make(m, true);
      if (g.attacked(g.kings[us], g.turn)) { g.undo(true); continue; }
      legal++;
      const sc = -negamax(g, depth - 1, -beta, -alpha, ply + 1, q);
      g.undo(true);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    if (!legal) return g.inCheck() ? -MATE + ply : 0;
    return alpha;
  }

  // Score de chaque coup légal (fenêtre complète pour pouvoir les comparer)
  function analyse(g, depth, q) {
    const res = [];
    for (const m of order(g.moves())) {
      g.make(m, true);
      let sc;
      if (!g.moves().length) sc = g.inCheck() ? MATE : 0;   // mat ou pat immédiat
      else sc = -negamax(g, depth - 1, -MATE - 1, MATE + 1, 1, q);
      g.undo(true);
      res.push({ move: m, score: sc });
    }
    return res.sort((a, b) => b.score - a.score);
  }

  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // cfg : { random, greedy, depth, quiesce, noise, blunder }
  function pickMove(g, cfg) {
    const legal = g.moves();
    if (legal.length === 1) return legal[0];
    if (Math.random() < cfg.random) {
      const caps = legal.filter(m => m.captured);
      if (caps.length && Math.random() < cfg.greedy) return rand(caps);
      return rand(legal);
    }
    const res = analyse(g, cfg.depth, cfg.quiesce);
    for (const r of res) r.noisy = r.score >= MATE - 100 ? r.score : r.score + gauss() * cfg.noise;
    res.sort((a, b) => b.noisy - a.noisy);
    if (res[0].score < MATE - 100 && Math.random() < cfg.blunder && res.length > 2) {
      return res[1 + Math.floor(Math.random() * Math.min(4, res.length - 1))].move;
    }
    return res[0].move;
  }

  // Évaluation « calme » (après les prises en cours) du point de vue d'une couleur
  function evalFor(g, color) {
    const s = quiesce(g, -MATE, MATE, 6);
    return g.turn === color ? s : -s;
  }

  const bestMove = (g, depth = 3) => analyse(g, depth, true)[0].move;

  return { pickMove, evalFor, bestMove, evaluate, VAL, MATE };
})();

if (typeof module !== 'undefined') module.exports = AI;
