'use strict';

// Règles complètes des échecs, représentation 0x88 (index = ligne * 16 + colonne,
// ligne 0 = 8e rangée). Pièces : majuscules = blancs, minuscules = noirs.
const Chess = (() => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';
  const KNIGHT = [-33, -31, -18, -14, 14, 18, 31, 33];
  const KING = [-17, -16, -15, -1, 1, 15, 16, 17];
  const DIAG = [-17, -15, 15, 17];
  const ORTHO = [-16, -1, 1, 16];
  const WK = 1, WQ = 2, BK = 4, BQ = 8;

  // Droits de roque perdus quand une pièce part de / arrive sur ces cases
  const CASTLE_MASK = new Array(128).fill(15);
  CASTLE_MASK[0x74] = 15 & ~(WK | WQ); // e1
  CASTLE_MASK[0x77] = 15 & ~WK;        // h1
  CASTLE_MASK[0x70] = 15 & ~WQ;        // a1
  CASTLE_MASK[0x04] = 15 & ~(BK | BQ); // e8
  CASTLE_MASK[0x07] = 15 & ~BK;        // h8
  CASTLE_MASK[0x00] = 15 & ~BQ;        // a8

  const name = sq => FILES[sq & 7] + (8 - (sq >> 4));
  const parse = s => (8 - +s[1]) * 16 + FILES.indexOf(s[0]);
  const colorOf = p => (p === p.toUpperCase() ? 'w' : 'b');
  const typeOf = p => p.toLowerCase();
  const other = c => (c === 'w' ? 'b' : 'w');

  class Game {
    constructor(fen = START) { this.load(fen); }

    load(fen) {
      const [pos, turn, cas, ep, half, full] = fen.trim().split(/\s+/);
      this.b = new Array(128).fill(null);
      this.kings = { w: -1, b: -1 };
      let sq = 0;
      for (const c of pos) {
        if (c === '/') sq += 8;
        else if (/\d/.test(c)) sq += +c;
        else {
          if (c === 'K') this.kings.w = sq;
          if (c === 'k') this.kings.b = sq;
          this.b[sq++] = c;
        }
      }
      this.turn = turn || 'w';
      this.castling = [...(cas || '-')].reduce((a, c) => a | ({ K: WK, Q: WQ, k: BK, q: BQ }[c] || 0), 0);
      this.ep = ep && ep !== '-' ? parse(ep) : -1;
      this.half = +half || 0;
      this.full = +full || 1;
      this.hist = [];
      this.keys = [this.key()];
    }

    placement() {
      let s = '';
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.b[r * 16 + f];
          if (!p) empty++;
          else { if (empty) { s += empty; empty = 0; } s += p; }
        }
        if (empty) s += empty;
        if (r < 7) s += '/';
      }
      return s;
    }

    castleStr() {
      let c = '';
      if (this.castling & WK) c += 'K';
      if (this.castling & WQ) c += 'Q';
      if (this.castling & BK) c += 'k';
      if (this.castling & BQ) c += 'q';
      return c || '-';
    }

    fen() {
      return `${this.placement()} ${this.turn} ${this.castleStr()} ${this.ep >= 0 ? name(this.ep) : '-'} ${this.half} ${this.full}`;
    }

    // Clé de position pour la triple répétition : la case en passant ne compte
    // que si une prise en passant est réellement possible.
    key() {
      let ep = '-';
      if (this.ep >= 0) {
        const pawn = this.turn === 'w' ? 'P' : 'p', back = this.turn === 'w' ? 16 : -16;
        for (const d of [back - 1, back + 1]) {
          const s = this.ep + d;
          if (!(s & 0x88) && this.b[s] === pawn) ep = name(this.ep);
        }
      }
      return `${this.placement()} ${this.turn} ${this.castleStr()} ${ep}`;
    }

    attacked(sq, by) {
      const b = this.b, w = by === 'w';
      const pd = w ? 16 : -16, pawn = w ? 'P' : 'p';
      for (const d of [pd - 1, pd + 1]) {
        const s = sq + d;
        if (!(s & 0x88) && b[s] === pawn) return true;
      }
      const N = w ? 'N' : 'n', K = w ? 'K' : 'k', B = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q';
      for (const d of KNIGHT) { const s = sq + d; if (!(s & 0x88) && b[s] === N) return true; }
      for (const d of KING) { const s = sq + d; if (!(s & 0x88) && b[s] === K) return true; }
      for (const d of DIAG) {
        for (let s = sq + d; !(s & 0x88); s += d) {
          const p = b[s];
          if (p) { if (p === B || p === Q) return true; break; }
        }
      }
      for (const d of ORTHO) {
        for (let s = sq + d; !(s & 0x88); s += d) {
          const p = b[s];
          if (p) { if (p === R || p === Q) return true; break; }
        }
      }
      return false;
    }

    inCheck(color = this.turn) { return this.attacked(this.kings[color], other(color)); }

    // Coups pseudo-légaux (le roi peut rester en échec). capsOnly : prises et promotions.
    pseudo(capsOnly = false) {
      const b = this.b, us = this.turn, them = other(us), out = [];
      const add = (from, to, flags, promo) => out.push({
        from, to, piece: b[from], flags, promo,
        captured: flags.includes('e') ? (us === 'w' ? 'p' : 'P') : b[to],
      });
      for (let from = 0; from < 128; from++) {
        if (from & 0x88) { from += 7; continue; }
        const p = b[from];
        if (!p || colorOf(p) !== us) continue;
        const t = typeOf(p);
        if (t === 'p') {
          const dir = us === 'w' ? -16 : 16, startRow = us === 'w' ? 6 : 1, lastRow = us === 'w' ? 0 : 7;
          const push = (to, fl) => {
            if ((to >> 4) === lastRow) for (const pr of 'qrbn') add(from, to, fl + 'p', pr);
            else if (!capsOnly || fl) add(from, to, fl);
          };
          const one = from + dir;
          if (!(one & 0x88) && !b[one]) {
            push(one, '');
            const two = one + dir;
            if (!capsOnly && (from >> 4) === startRow && !b[two]) add(from, two, 'b');
          }
          for (const d of [dir - 1, dir + 1]) {
            const to = from + d;
            if (to & 0x88) continue;
            if (b[to] && colorOf(b[to]) === them) push(to, 'c');
            else if (to === this.ep) add(from, to, 'e');
          }
        } else if (t === 'n' || t === 'k') {
          for (const d of (t === 'n' ? KNIGHT : KING)) {
            const to = from + d;
            if (to & 0x88) continue;
            const q = b[to];
            if (!q) { if (!capsOnly) add(from, to, ''); }
            else if (colorOf(q) === them) add(from, to, 'c');
          }
          if (t === 'k' && !capsOnly) this.castles(from, add);
        } else {
          const dirs = t === 'b' ? DIAG : t === 'r' ? ORTHO : KING;
          for (const d of dirs) {
            for (let to = from + d; !(to & 0x88); to += d) {
              const q = b[to];
              if (!q) { if (!capsOnly) add(from, to, ''); }
              else { if (colorOf(q) === them) add(from, to, 'c'); break; }
            }
          }
        }
      }
      return out;
    }

    castles(from, add) {
      const b = this.b, us = this.turn, them = other(us);
      const home = us === 'w' ? 0x74 : 0x04;
      if (from !== home || this.attacked(home, them)) return;
      const [kBit, qBit, rook] = us === 'w' ? [WK, WQ, 'R'] : [BK, BQ, 'r'];
      if ((this.castling & kBit) && !b[home + 1] && !b[home + 2] && b[home + 3] === rook &&
          !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) add(from, home + 2, 'k');
      if ((this.castling & qBit) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook &&
          !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) add(from, home - 2, 'q');
    }

    // quiet = true : pas de suivi des répétitions (utilisé par la recherche du bot)
    make(m, quiet = false) {
      const b = this.b, us = this.turn;
      this.hist.push({ m, castling: this.castling, ep: this.ep, half: this.half, full: this.full });
      b[m.to] = m.promo ? (us === 'w' ? m.promo.toUpperCase() : m.promo) : m.piece;
      b[m.from] = null;
      if (m.flags.includes('e')) b[us === 'w' ? m.to + 16 : m.to - 16] = null;
      if (m.flags.includes('k')) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
      if (m.flags.includes('q')) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
      if (typeOf(m.piece) === 'k') this.kings[us] = m.to;
      this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
      this.ep = m.flags.includes('b') ? (m.from + m.to) / 2 : -1;
      this.half = typeOf(m.piece) === 'p' || m.captured ? 0 : this.half + 1;
      if (us === 'b') this.full++;
      this.turn = other(us);
      if (!quiet) this.keys.push(this.key());
    }

    undo(quiet = false) {
      const h = this.hist.pop();
      if (!h) return null;
      const m = h.m, b = this.b;
      this.turn = other(this.turn);
      const us = this.turn;
      if (!quiet) this.keys.pop();
      b[m.from] = m.piece;
      if (m.flags.includes('e')) {
        b[m.to] = null;
        b[us === 'w' ? m.to + 16 : m.to - 16] = m.captured;
      } else {
        b[m.to] = m.captured || null;
      }
      if (m.flags.includes('k')) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
      if (m.flags.includes('q')) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
      if (typeOf(m.piece) === 'k') this.kings[us] = m.from;
      this.castling = h.castling;
      this.ep = h.ep;
      this.half = h.half;
      this.full = h.full;
      return m;
    }

    moves() {
      const us = this.turn;
      return this.pseudo(false).filter(m => {
        this.make(m, true);
        const ok = !this.attacked(this.kings[us], this.turn);
        this.undo(true);
        return ok;
      });
    }

    insufficient() {
      const minors = [];
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.b[sq];
        if (!p) continue;
        const t = typeOf(p);
        if (t === 'p' || t === 'r' || t === 'q') return false;
        if (t !== 'k') minors.push({ t, shade: ((sq >> 4) + (sq & 7)) % 2 });
      }
      if (minors.length <= 1) return true;
      // Uniquement des fous, tous sur des cases de même couleur
      return minors.every(m => m.t === 'b' && m.shade === minors[0].shade);
    }

    repetitions() {
      const k = this.keys[this.keys.length - 1];
      return this.keys.filter(x => x === k).length;
    }

    // null si la partie continue, sinon la raison de la fin
    status() {
      if (!this.moves().length) return this.inCheck() ? 'checkmate' : 'stalemate';
      if (this.insufficient()) return 'insufficient';
      if (this.half >= 100) return 'fifty';
      if (this.repetitions() >= 3) return 'repetition';
      return null;
    }

    // Notation algébrique abrégée (à appeler AVANT de jouer le coup)
    san(m, legal = this.moves()) {
      let s;
      if (m.flags.includes('k')) s = 'O-O';
      else if (m.flags.includes('q')) s = 'O-O-O';
      else {
        const t = typeOf(m.piece);
        if (t === 'p') {
          s = (m.captured ? FILES[m.from & 7] + 'x' : '') + name(m.to);
          if (m.promo) s += '=' + m.promo.toUpperCase();
        } else {
          s = t.toUpperCase();
          const amb = legal.filter(o => o.piece === m.piece && o.to === m.to && o.from !== m.from);
          if (amb.length) {
            const sameFile = amb.some(o => (o.from & 7) === (m.from & 7));
            const sameRank = amb.some(o => (o.from >> 4) === (m.from >> 4));
            if (!sameFile) s += FILES[m.from & 7];
            else if (!sameRank) s += 8 - (m.from >> 4);
            else s += name(m.from);
          }
          if (m.captured) s += 'x';
          s += name(m.to);
        }
      }
      this.make(m, true);
      if (this.inCheck()) s += this.moves().length ? '+' : '#';
      this.undo(true);
      return s;
    }

    perft(depth) {
      if (depth === 0) return 1;
      let n = 0;
      for (const m of this.moves()) {
        this.make(m, true);
        n += this.perft(depth - 1);
        this.undo(true);
      }
      return n;
    }
  }

  return { Game, START, name, parse, colorOf, typeOf, other };
})();

if (typeof module !== 'undefined') module.exports = Chess;
