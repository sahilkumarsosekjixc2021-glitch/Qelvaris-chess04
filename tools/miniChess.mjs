// Chhota chess engine (sirf lessons verify karne ke liye): legal moves, attacks, mate. Castling/en passant nahi.
export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const FILES = "abcdefgh";
export const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);
export const sqIdx = (s) => (Number(s[1]) - 1) * 8 + FILES.indexOf(s[0]);

export function parse(fen) {
  const [place, turn] = fen.split(" ");
  const b = Array(64).fill(null);
  place.split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        b[(7 - r) * 8 + f] = { t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? "w" : "b" };
        f += 1;
      }
    }
  });
  return { b, turn: turn || "w" };
}

const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BIS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

const inb = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

// piece jin squares ko attack karta hai (apne pieces wale squares bhi = defend)
export function attacksFrom(b, i) {
  const p = b[i];
  if (!p) return [];
  const f = i % 8, r = Math.floor(i / 8), out = [];
  const step = (df, dr) => { if (inb(f + df, r + dr)) out.push((r + dr) * 8 + f + df); };
  if (p.t === "p") {
    const d = p.c === "w" ? 1 : -1;
    step(-1, d); step(1, d);
  } else if (p.t === "n") KN.forEach(([a, c]) => step(a, c));
  else if (p.t === "k") KG.forEach(([a, c]) => step(a, c));
  else {
    const dirs = p.t === "r" ? ROOK : p.t === "b" ? BIS : [...ROOK, ...BIS];
    for (const [df, dr] of dirs) {
      let x = f + df, y = r + dr;
      while (inb(x, y)) {
        const j = y * 8 + x;
        out.push(j);
        if (b[j]) break;
        x += df; y += dr;
      }
    }
  }
  return out;
}

export function attackersOf(b, i, by) {
  const out = [];
  for (let j = 0; j < 64; j += 1) {
    if (b[j] && b[j].c === by && attacksFrom(b, j).includes(i)) out.push(j);
  }
  return out;
}

export const kingSq = (b, c) => b.findIndex((p) => p && p.t === "k" && p.c === c);
export const inCheck = (b, c) => attackersOf(b, kingSq(b, c), c === "w" ? "b" : "w").length > 0;

export function apply(b, m) {
  const n = b.slice();
  const p = n[m.from];
  n[m.to] = m.promo ? { t: m.promo, c: p.c } : p;
  n[m.from] = null;
  return n;
}

function pseudo(b, c) {
  const moves = [];
  for (let i = 0; i < 64; i += 1) {
    const p = b[i];
    if (!p || p.c !== c) continue;
    const f = i % 8, r = Math.floor(i / 8);
    if (p.t === "p") {
      const d = c === "w" ? 1 : -1, start = c === "w" ? 1 : 6, last = c === "w" ? 7 : 0;
      const add = (to) => moves.push({ from: i, to, promo: Math.floor(to / 8) === last ? "q" : null });
      if (inb(f, r + d) && !b[(r + d) * 8 + f]) {
        add((r + d) * 8 + f);
        if (r === start && !b[(r + 2 * d) * 8 + f]) add((r + 2 * d) * 8 + f);
      }
      for (const df of [-1, 1]) {
        if (inb(f + df, r + d)) {
          const j = (r + d) * 8 + f + df;
          if (b[j] && b[j].c !== c) add(j);
        }
      }
    } else {
      for (const j of attacksFrom(b, i)) if (!b[j] || b[j].c !== c) moves.push({ from: i, to: j, promo: null });
    }
  }
  return moves;
}

export function legalMoves(b, c) {
  return pseudo(b, c).filter((m) => !inCheck(apply(b, m), c));
}

export const uci = (m) => sqName(m.from) + sqName(m.to) + (m.promo || "");
export const isMate = (b, c) => inCheck(b, c) && legalMoves(b, c).length === 0;

export function validPosition(fen) {
  const { b, turn } = parse(fen);
  const wk = b.filter((p) => p && p.t === "k" && p.c === "w").length;
  const bk = b.filter((p) => p && p.t === "k" && p.c === "b").length;
  if (wk !== 1 || bk !== 1) return "need one king each";
  const other = turn === "w" ? "b" : "w";
  if (inCheck(b, other)) return "side not to move is in check";
  return null;
}

/* ---------- Teaching predicates ---------- */

export function hangingSet(b) {
  const out = [];
  for (let i = 0; i < 64; i += 1) {
    const p = b[i];
    if (!p || p.t === "k") continue;
    const enemy = p.c === "w" ? "b" : "w";
    const att = attackersOf(b, i, enemy);
    if (!att.length) continue;
    const def = attackersOf(b, i, p.c);
    const minAtt = Math.min(...att.map((a) => VAL[b[a].t]));
    if (def.length === 0 || minAtt < VAL[p.t]) out.push({ sq: i, attackers: att, defenders: def, minAtt });
  }
  return out;
}

export function forkMoves(b, c) {
  const enemy = c === "w" ? "b" : "w";
  const res = [];
  for (const m of legalMoves(b, c)) {
    const nb = apply(b, m);
    const X = nb[m.to];
    const targets = attacksFrom(nb, m.to).filter((j) => {
      const t = nb[j];
      if (!t || t.c !== enemy || t.t === "p") return false;
      return t.t === "k" || VAL[t.t] > VAL[X.t] || attackersOf(nb, j, enemy).length === 0;
    });
    if (targets.length < 2) continue;
    const att = attackersOf(nb, m.to, enemy);
    const def = attackersOf(nb, m.to, c);
    const unsafe = att.some((a) => VAL[nb[a].t] < VAL[X.t]) || (att.length > 0 && def.length === 0);
    if (!unsafe) res.push({ m, targets, piece: X.t });
  }
  return res;
}

export function mateMoves(b, c) {
  const enemy = c === "w" ? "b" : "w";
  return legalMoves(b, c).filter((m) => isMate(apply(b, m), enemy));
}

export function captureVerdict(b, from, to) {
  const m = legalMoves(b, b[from].c).find((x) => x.from === from && x.to === to);
  if (!m) return null;
  const gain = VAL[b[to].t];
  const nb = apply(b, m);
  const enemy = b[from].c === "w" ? "b" : "w";
  const back = attackersOf(nb, to, enemy);
  const net = gain - (back.length ? VAL[b[from].t] : 0);
  return { net, recapture: back.length > 0, gain, moved: b[from].t, captured: b[to].t, safe: net > 0 };
}

/* Pin / skewer: chalne wala slider (b/r/q) ek enemy piece X ko dekhta hai, uske peeche Y.
   Pin = Y zyada keemti (ya king); Skewer = X zyada keemti (ya king) aur peeche Y. Mover safe hona chahiye. */
function lineHits(nb, from) {
  const p = nb[from];
  if (!["b", "r", "q"].includes(p.t)) return [];
  const f0 = from % 8, r0 = Math.floor(from / 8);
  const dirs = p.t === "r" ? ROOK : p.t === "b" ? BIS : [...ROOK, ...BIS];
  const res = [];
  for (const [df, dr] of dirs) {
    let x = f0 + df, y = r0 + dr, first = null;
    while (inb(x, y)) {
      const j = y * 8 + x;
      if (nb[j]) {
        if (!first) { if (nb[j].c === p.c) break; first = j; }
        else { if (nb[j].c !== p.c) res.push([first, j]); break; }
      }
      x += df; y += dr;
    }
  }
  return res;
}
function safeMover(nb, to, c) {
  const enemy = c === "w" ? "b" : "w";
  const att = attackersOf(nb, to, enemy);
  const def = attackersOf(nb, to, c);
  return !(att.some((a) => VAL[nb[a].t] < VAL[nb[to].t]) || (att.length > 0 && def.length === 0));
}
export function lineMoves(b, c, kind) {
  const res = [];
  for (const m of legalMoves(b, c)) {
    const nb = apply(b, m);
    if (!safeMover(nb, m.to, c)) continue;
    for (const [X, Y] of lineHits(nb, m.to)) {
      const vx = VAL[nb[X].t], vy = VAL[nb[Y].t];
      if (kind === "pin" && vy > vx && nb[X].t !== "k") res.push({ m, X, Y });
      if (kind === "skewer" && vx > vy && nb[Y].t !== "k") res.push({ m, X, Y });
    }
  }
  return res;
}
