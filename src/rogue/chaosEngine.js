/* Qelvaris Rogue AI: Total Chaos engine.
   chess.js-style API on top of a custom move generator, so every rule
   (legal moves, check, mate, castling, AI search) uses the active transformations.
   Rule: one event at a time. An event picks a piece TYPE and transforms ONE random piece of that
   type per side (one-sided only if the other side has none). */

const F = "abcdefgh";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const sqName = (i) => F[i & 7] + ((i >> 3) + 1);
const sqIdx = (s) => s.charCodeAt(0) - 97 + (s.charCodeAt(1) - 49) * 8;
const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIR = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
DIR.q = DIR.b.concat(DIR.r);
const opp = (c) => (c === "w" ? "b" : "w");

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_CHAOS = {
  events: true,
  minGap: 2,        // min plies of calm after an event ends (and before the first one)
  maxGap: 12,       // max plies of calm
  maxRounds: 3,     // durations are 1..maxRounds full rounds
  chain: 0.25,      // chance a new event follows right after an expiry
  targets: ["n", "b", "r", "q"], // possible new movement types
};

export class ChaosGame {
  #rng; #until; #pending = [];

  constructor({ seed = Date.now() >>> 0, fen = START, config = {} } = {}) {
    this.seed = seed;
    this.cfg = { ...DEFAULT_CHAOS, ...config };
    this.#rng = mulberry32(seed);
    this.#until = this.#int(this.cfg.minGap, this.cfg.maxGap);
    this.#load(fen);
  }

  #int(a, b) { return a + Math.floor(this.#rng() * (b - a + 1)); }

  #load(fen) {
    const [pos, turn = "w", cas = "-", ep = "-", hm = "0", fm = "1"] = fen.trim().split(/\s+/);
    this.bd = Array(64).fill(null);
    pos.split("/").forEach((row, ri) => {
      let f = 0; const r = 7 - ri;
      for (const ch of row) {
        if (/\d/.test(ch)) f += +ch;
        else { this.bd[r * 8 + f] = { t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? "w" : "b" }; f++; }
      }
    });
    this.turnC = turn;
    this.castle = (cas.includes("K") ? 1 : 0) | (cas.includes("Q") ? 2 : 0) | (cas.includes("k") ? 4 : 0) | (cas.includes("q") ? 8 : 0);
    this.ep = ep === "-" ? -1 : sqIdx(ep);
    this.half = +hm; this.full = +fm;
    this.tr = {}; this.hist = []; this.counts = {};
    this.#count(1);
  }

  clone() {
    const g = new ChaosGame({ seed: this.seed, fen: this.fen(), config: { ...this.cfg, events: false } });
    g.tr = Object.fromEntries(Object.entries(this.tr).map(([k, v]) => [k, { ...v }]));
    g.hist = this.hist.slice(); g.counts = { ...this.counts };
    return g;
  }

  /* ---------- basic info ---------- */
  turn() { return this.turnC; }
  fen() {
    let s = "";
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.bd[r * 8 + f];
        if (!p) e++; else { if (e) { s += e; e = 0; } s += p.c === "w" ? p.t.toUpperCase() : p.t; }
      }
      if (e) s += e; if (r) s += "/";
    }
    const cas = (this.castle & 1 ? "K" : "") + (this.castle & 2 ? "Q" : "") + (this.castle & 4 ? "k" : "") + (this.castle & 8 ? "q" : "") || "-";
    return `${s} ${this.turnC} ${cas} ${this.ep < 0 ? "-" : sqName(this.ep)} ${this.half} ${this.full}`;
  }
  _eff(i) { const t = this.tr[i]; return t ? t.as : this.bd[i].t; }
  _king(c) { for (let i = 0; i < 64; i++) { const p = this.bd[i]; if (p && p.t === "k" && p.c === c) return i; } return -1; }
  get(sq) {
    const i = sqIdx(sq), p = this.bd[i];
    if (!p) return null;
    const t = this.tr[i];
    return { type: p.t, color: p.c, square: sq, chaos: t ? { as: t.as, roundsLeft: Math.ceil(t.left / 2) } : null };
  }
  board() {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      const row = [];
      for (let f = 0; f < 8; f++) { const p = this.bd[r * 8 + f]; row.push(p ? { square: F[f] + (r + 1), type: p.t, color: p.c } : null); }
      rows.push(row);
    }
    return rows;
  }

  /* ---------- attacks (respect transformations) ---------- */
  _att(sq, by) {
    const sf = sq & 7, sr = sq >> 3;
    for (let i = 0; i < 64; i++) {
      const p = this.bd[i];
      if (!p || p.c !== by) continue;
      const e = this._eff(i), f = i & 7, r = i >> 3, df = sf - f, dr = sr - r;
      if (e === "p") { if (dr === (by === "w" ? 1 : -1) && Math.abs(df) === 1) return true; }
      else if (e === "n") { const a = Math.abs(df), b = Math.abs(dr); if ((a === 1 && b === 2) || (a === 2 && b === 1)) return true; }
      else if (e === "k") { if (Math.max(Math.abs(df), Math.abs(dr)) === 1) return true; }
      else {
        const diag = Math.abs(df) === Math.abs(dr) && df !== 0, ortho = (df === 0) !== (dr === 0);
        if ((e === "b" && !diag) || (e === "r" && !ortho) || (e === "q" && !diag && !ortho)) continue;
        const sx = Math.sign(df), sy = Math.sign(dr);
        let x = f + sx, y = r + sy, ok = true;
        while (x !== sf || y !== sr) { if (this.bd[y * 8 + x]) { ok = false; break; } x += sx; y += sy; }
        if (ok) return true;
      }
    }
    return false;
  }
  _inCheck(c) { const k = this._king(c); return k >= 0 && this._att(k, opp(c)); }

  /* ---------- move generation ---------- */
  _gen(i, out) {
    const p = this.bd[i], c = p.c, e = this._eff(i), f = i & 7, r = i >> 3, o = opp(c), last = c === "w" ? 7 : 0;
    const add = (to, flags, capSq) => {
      const cp = this.bd[capSq === undefined ? to : capSq];
      if (cp && cp.t === "k") return;
      const base = { from: i, to, piece: p.t, color: c, captured: cp ? cp.t : undefined, flags };
      if (p.t === "p" && (to >> 3) === last) for (const pr of "qrbn") out.push({ ...base, promotion: pr });
      else out.push(base);
    };
    if (e === "p") {
      const d = c === "w" ? 1 : -1, one = i + d * 8;
      if (one >= 0 && one < 64 && !this.bd[one]) {
        add(one, "n");
        if (r === (c === "w" ? 1 : 6) && !this.bd[i + d * 16]) add(i + d * 16, "b");
      }
      for (const dx of [-1, 1]) {
        const x = f + dx; if (x < 0 || x > 7 || r + d < 0 || r + d > 7) continue;
        const t = (r + d) * 8 + x, tp = this.bd[t];
        if (tp && tp.c === o) add(t, "c");
        else if (!tp && t === this.ep) add(t, "e", r * 8 + x);
      }
    } else if (e === "n" || e === "k") {
      for (const [dx, dy] of e === "n" ? KN : KG) {
        const x = f + dx, y = r + dy; if (x < 0 || x > 7 || y < 0 || y > 7) continue;
        const t = y * 8 + x, tp = this.bd[t];
        if (!tp || tp.c === o) add(t, tp ? "c" : "n");
      }
      if (e === "k" && p.t === "k") {
        const home = c === "w" ? 4 : 60, bit = c === "w" ? [1, 2] : [4, 8];
        if (i === home && !this._att(i, o)) {
          const rk = (s) => this.bd[s] && this.bd[s].t === "r" && this.bd[s].c === c;
          if ((this.castle & bit[0]) && !this.bd[home + 1] && !this.bd[home + 2] && rk(home + 3) && !this._att(home + 1, o)) add(home + 2, "k");
          if ((this.castle & bit[1]) && !this.bd[home - 1] && !this.bd[home - 2] && !this.bd[home - 3] && rk(home - 4) && !this._att(home - 1, o)) add(home - 2, "q");
        }
      }
    } else {
      for (const [dx, dy] of DIR[e]) {
        let x = f + dx, y = r + dy;
        while (x >= 0 && x < 8 && y >= 0 && y < 8) {
          const t = y * 8 + x, tp = this.bd[t];
          if (!tp) add(t, "n");
          else { if (tp.c === o) add(t, "c"); break; }
          x += dx; y += dy;
        }
      }
    }
  }
  _do(m) {
    const b = this.bd, c = m.color;
    const u = { m, castle: this.castle, ep: this.ep, half: this.half, full: this.full, turn: this.turnC };
    const mover = b[m.from]; u.mover = mover; u.trFrom = this.tr[m.from];
    const capSq = m.flags.includes("e") ? (m.from >> 3) * 8 + (m.to & 7) : m.to;
    u.capSq = capSq; u.cap = b[capSq]; u.trCap = this.tr[capSq];
    delete this.tr[capSq]; delete this.tr[m.from];
    if (u.trFrom && !m.promotion) this.tr[m.to] = u.trFrom;
    b[capSq] = null; b[m.from] = null; b[m.to] = m.promotion ? { t: m.promotion, c } : mover;
    if (m.flags === "k" || m.flags === "q") {
      const k = m.flags === "k", rf = c === "w" ? (k ? 7 : 0) : (k ? 63 : 56), rt = c === "w" ? (k ? 5 : 3) : (k ? 61 : 59);
      u.rook = [rf, rt]; u.trRook = this.tr[rf];
      b[rt] = b[rf]; b[rf] = null;
      if (u.trRook) { this.tr[rt] = u.trRook; delete this.tr[rf]; }
    }
    if (mover.t === "k") this.castle &= c === "w" ? ~3 : ~12;
    for (const s of [m.from, m.to]) { if (s === 0) this.castle &= ~2; if (s === 7) this.castle &= ~1; if (s === 56) this.castle &= ~8; if (s === 63) this.castle &= ~4; }
    this.ep = m.flags === "b" ? (m.from + m.to) / 2 : -1;
    this.half = mover.t === "p" || u.cap ? 0 : this.half + 1;
    if (c === "b") this.full++;
    this.turnC = opp(c);
    return u;
  }
  _undo(u) {
    const m = u.m, b = this.bd;
    b[m.from] = u.mover; b[m.to] = null; b[u.capSq] = u.cap;
    delete this.tr[m.to];
    if (u.rook) { const [rf, rt] = u.rook; b[rf] = b[rt]; b[rt] = null; delete this.tr[rt]; if (u.trRook) this.tr[rf] = u.trRook; }
    if (u.trFrom) this.tr[m.from] = u.trFrom; else delete this.tr[m.from];
    if (u.trCap) this.tr[u.capSq] = u.trCap;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.full = u.full; this.turnC = u.turn;
  }
  legal(color = this.turnC) {
    const out = [], o = opp(color), pseudo = [];
    for (let i = 0; i < 64; i++) { const p = this.bd[i]; if (p && p.c === color) this._gen(i, pseudo); }
    for (const m of pseudo) {
      const u = this._do(m), k = this._king(color);
      const bad = k < 0 || this._att(k, o);
      this._undo(u);
      if (!bad) out.push(m);
    }
    return out;
  }
  _san(m, legal) {
    if (m.flags === "k") return "O-O";
    if (m.flags === "q") return "O-O-O";
    let s = "";
    const others = legal.filter((x) => x !== m && x.piece === m.piece && x.to === m.to && x.promotion === m.promotion);
    if (m.piece !== "p") s = m.piece.toUpperCase();
    if (others.length && (m.piece !== "p" || !m.captured)) {
      const sameF = others.some((x) => (x.from & 7) === (m.from & 7)), sameR = others.some((x) => (x.from >> 3) === (m.from >> 3));
      s += !sameF ? F[m.from & 7] : !sameR ? (m.from >> 3) + 1 : sqName(m.from);
    } else if (m.piece === "p" && m.captured) s += F[m.from & 7];
    if (m.captured) s += "x";
    s += sqName(m.to);
    if (m.promotion) s += "=" + m.promotion.toUpperCase();
    return s;
  }
  _verbose(m, legal) {
    return { color: m.color, from: sqName(m.from), to: sqName(m.to), piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags, san: this._san(m, legal) };
  }

  /* ---------- chess.js-style public API ---------- */
  moves({ square, verbose } = {}) {
    const legal = this.legal(), list = square ? legal.filter((m) => m.from === sqIdx(square)) : legal;
    return list.map((m) => (verbose ? this._verbose(m, legal) : this._san(m, legal)));
  }
  /* movement preview for any piece, even when it is not that side's turn */
  previewMoves(square) {
    const p = this.bd[sqIdx(square)];
    if (!p) return [];
    const legal = this.legal(p.c);
    return legal.filter((m) => m.from === sqIdx(square)).map((m) => this._verbose(m, legal));
  }
  isCheck() { return this._inCheck(this.turnC); }
  isCheckmate() { return this.isCheck() && this.legal().length === 0; }
  isStalemate() { return !this.isCheck() && this.legal().length === 0; }
  isInsufficientMaterial() { return this.bd.every((p) => !p || p.t === "k"); } // any other piece can be transformed into a mating piece
  isThreefoldRepetition() { return (this.counts[this.#key()] || 0) >= 3; }
  isDrawByFiftyMoves() { return this.half >= 100; }
  isDraw() { return this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition() || this.isDrawByFiftyMoves(); }
  isGameOver() { return this.legal().length === 0 || this.isDraw(); }
  history({ verbose } = {}) { return verbose ? this.hist : this.hist.map((h) => h.san); }
  pgn() {
    let s = "";
    this.hist.forEach((h, i) => { if (i % 2 === 0) s += (i / 2 + 1) + ". "; s += h.san + " "; });
    return s.trim();
  }
  activeTransformations() {
    return Object.entries(this.tr).map(([k, t]) => ({ square: sqName(+k), color: t.c, piece: t.orig, as: t.as, roundsLeft: Math.ceil(t.left / 2) }));
  }
  takeEvents() { const e = this.#pending; this.#pending = []; return e; }

  #key() {
    return this.bd.map((p) => (p ? (p.c === "w" ? p.t.toUpperCase() : p.t) : "-")).join("") + this.turnC + this.castle + this.ep +
      Object.entries(this.tr).map(([k, t]) => k + t.as).join(",");
  }
  #count(n) { const k = this.#key(); this.counts[k] = (this.counts[k] || 0) + n; }

  move(arg) {
    const legal = this.legal();
    let m;
    if (typeof arg === "string") {
      const s = arg.replace(/[+#!?]/g, "");
      m = legal.find((x) => this._san(x, legal) === s);
    } else {
      const from = sqIdx(arg.from), to = sqIdx(arg.to), c = legal.filter((x) => x.from === from && x.to === to);
      m = c.find((x) => !x.promotion) || c.find((x) => x.promotion === (arg.promotion || "q"));
    }
    if (!m) throw new Error("Invalid move");
    const v = this._verbose(m, legal);
    this._do(m);
    const mover = m.color, o = opp(mover), oppLegal = this.legal();
    const chk = this._inCheck(o);
    v.san += chk ? (oppLegal.length ? "+" : "#") : "";
    v.ply = this.hist.length + 1;
    this.hist.push(v);
    if (oppLegal.length > 0 && this.cfg.events && !this.isDraw()) this.#runEvents(mover);
    this.#count(1);
    return v;
  }

  /* ---------- chaos scheduler (internal, never exposes the next event) ---------- */
  #runEvents(mover) {
    const o = opp(mover), ply = this.hist.length;
    let expired = false;
    const keys = Object.keys(this.tr);
    if (keys.length) {
      for (const k of keys) this.tr[k].left--;
      if (this.tr[keys[0]].left <= 0) {
        const removed = keys.map((k) => [k, this.tr[k]]);
        keys.forEach((k) => delete this.tr[k]);
        if (this._inCheck(mover)) {
          // king safety: the expiry would leave the player who just moved in check, so it waits one more ply
          removed.forEach(([k, t]) => { t.left = 1; this.tr[k] = t; });
        } else {
          const t = removed[0][1];
          expired = true;
          this.#pending.push({ kind: "end", ply, piece: t.orig, as: t.as, colors: [...new Set(removed.map(([, x]) => x.c))] });
        }
      }
      if (Object.keys(this.tr).length) return;           // one event at a time
      if (expired && this.#rng() < this.cfg.chain) this.#until = 0; else this.#until--;
    } else this.#until--;
    if (this.#until > 0) return;

    // pick a piece TYPE that is on the board, and a new movement type, both at random
    const present = [...new Set(this.bd.filter((p) => p && p.t !== "k").map((p) => p.t))];
    const combos = [];
    for (const t of present) for (const as of this.cfg.targets) if (as !== t) combos.push([t, as]);
    while (combos.length) {
      const [t, as] = combos.splice(Math.floor(this.#rng() * combos.length), 1)[0];
      const rounds = this.#int(1, this.cfg.maxRounds), sq = [];
      for (const c of ["w", "b"]) {                       // one random piece of that type per side
        const own = [];
        for (let i = 0; i < 64; i++) { const p = this.bd[i]; if (p && p.t === t && p.c === c) own.push(i); }
        if (own.length) { const i = own[Math.floor(this.#rng() * own.length)]; this.tr[i] = { as, left: rounds * 2, rounds, c, orig: t }; sq.push(i); }
      }
      // hits both sides; it is one-sided automatically when only one side has that piece type.
      // Never leave the mover in check, never mate or stalemate the other side instantly.
      if (!this._inCheck(mover) && this.legal(o).length > 0) {
        this.#pending.push({ kind: "start", ply, piece: t, as, rounds, colors: [...new Set(sq.map((i) => this.bd[i].c))], squares: sq.map(sqName) });
        this.#until = this.#int(this.cfg.minGap, this.cfg.maxGap);
        return;
      }
      sq.forEach((i) => delete this.tr[i]);
    }
    this.#until = 1;
  }
}

/* ---------- Chaos-aware AI (does not use plain Stockfish moves) ---------- */
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const LEVEL = { easy: { d: 1, noise: 1.2, blunder: 0.25 }, medium: { d: 2, noise: 0.5, blunder: 0.08 }, hard: { d: 3, noise: 0.15, blunder: 0 }, nightmare: { d: 3, noise: 0.03, blunder: 0 } };

function evalPos(g, color) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = g.bd[i]; if (!p) continue;
    let v = VAL[p.t] + 0.12 * (VAL[g._eff(i)] - VAL[p.t]); // a piece moving like a queen is worth more right now
    const f = i & 7, r = i >> 3; v += 0.03 * (3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)));
    s += p.c === color ? v : -v;
  }
  return s;
}
function nm(g, depth, a, b, color) {
  const ms = g.legal(color);
  if (!ms.length) return g._inCheck(color) ? -1000 - depth : 0;
  if (depth === 0) return evalPos(g, color);
  ms.sort((x, y) => (y.captured ? VAL[y.captured] : 0) - (x.captured ? VAL[x.captured] : 0));
  for (const m of ms) {
    const u = g._do(m), v = -nm(g, depth - 1, -b, -a, opp(color));
    g._undo(u);
    if (v > a) a = v; if (a >= b) break;
  }
  return a;
}
function bonus(g, m, kind, rng) {
  // g is the position after m
  const o = opp(m.color), ok = g._king(o);
  const near = ok >= 0 ? 8 - Math.max(Math.abs((m.to & 7) - (ok & 7)), Math.abs((m.to >> 3) - (ok >> 3))) : 0;
  switch (kind) {
    case "predator": return (g._inCheck(o) ? 0.5 : 0) + (m.captured ? 0.2 : 0) + 0.02 * near;
    case "trickster": return (g.tr[m.to] ? 0.35 : 0) + rng() * 0.3;
    case "gambler": return (m.captured ? 0.25 : 0) + (((m.to >> 3) >= 4) === (m.color === "w") ? 0.15 : 0);
    case "shadow": return (!m.captured && m.piece !== "q" ? 0.12 : -0.1) + (m.piece === "p" ? 0.05 : 0);
    case "chaos": return rng() * 0.8;
    default: return 0;
  }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function chaosChooseMove(game, { personality = "predator", difficulty = "medium", signal } = {}) {
  const g = game.clone(), color = g.turn(), L = LEVEL[difficulty] || LEVEL.medium;
  const rng = mulberry32((game.seed ^ (game.hist.length * 2654435761)) >>> 0);
  const ms = g.legal(color);
  if (!ms.length) throw new Error("No legal moves");
  // type-wide events can make the number of moves explode, so search shallower when there are many
  const depth = Math.max(1, ms.length > 90 ? 1 : ms.length > 55 ? Math.min(L.d, 2) : L.d);
  const scored = [];
  for (const m of ms) {
    if (signal && signal.aborted) throw new Error("aborted");
    const u = g._do(m);
    const replies = g.legal(opp(color));
    let s;
    if (!replies.length && g._inCheck(opp(color))) s = 10000;           // always take a mate in one
    else s = -nm(g, depth - 1, -Infinity, Infinity, opp(color)) + bonus(g, m, personality, rng);
    g._undo(u);
    scored.push({ m, s: s + (s > 5000 ? 0 : (rng() - 0.5) * 2 * L.noise) });
    await tick();                                                        // keep the UI responsive
  }
  scored.sort((a, b) => b.s - a.s);
  let pick = scored[0];
  if (L.blunder && scored[0].s < 5000 && rng() < L.blunder) pick = scored[Math.floor(rng() * Math.min(5, scored.length))];
  const m = pick.m;
  return { from: sqName(m.from), to: sqName(m.to), promotion: m.promotion };
}
