// Extra verifiers: discovered attacks, mate-in-2 tree, KPK tablebase (white pawn). Sirf lessons verify karne ke liye.
import * as C from "./miniChess.mjs";
const { VAL, parse, legalMoves, apply, attacksFrom, attackersOf, inCheck, isMate, sqName, sqIdx } = C;

/* ---------- discovered attacks ---------- */
const SLIDE = ["b", "r", "q"];
function slidersHitting(b, c, target) { // friendly sliders attacking `target` square
  return attackersOf(b, target, c).filter((i) => SLIDE.includes(b[i].t));
}
// kind: "check" = discovered check; "win" = discovered check + mover hits/captures something valuable
export function discoverMoves(b, c, kind = "check") {
  const enemy = c === "w" ? "b" : "w";
  const ek = C.kingSq(b, enemy);
  const res = [];
  for (const m of legalMoves(b, c)) {
    const nb = apply(b, m);
    if (!inCheck(nb, enemy)) continue;
    const before = new Set(slidersHitting(b, c, ek));
    const after = slidersHitting(nb, c, ek).filter((i) => i !== m.to && !before.has(i));
    if (!after.length) continue; // check mover ne diya, uncover nahi hua
    if (kind === "check") { res.push({ m }); continue; }
    const X = nb[m.to];
    const captured = b[m.to];
    const hits = attacksFrom(nb, m.to).filter((j) => nb[j] && nb[j].c === enemy && nb[j].t !== "k" && (VAL[nb[j].t] > VAL[X.t] || attackersOf(nb, j, enemy).length === 0) && VAL[nb[j].t] >= 3);
    if ((captured && VAL[captured.t] >= 5) || hits.length) res.push({ m });
  }
  return res;
}

/* ---------- mate in 2 ---------- */
export function mate2(b, c) {
  const enemy = c === "w" ? "b" : "w";
  if (C.mateMoves(b, c).length) return null; // mate in 1 hai, mate-in-2 puzzle nahi
  const tree = {};
  for (const m1 of legalMoves(b, c)) {
    const nb = apply(b, m1);
    const replies = legalMoves(nb, enemy);
    if (!replies.length) continue; // mate/stalemate
    let ok = true;
    const lines = [];
    for (const r of replies) {
      const nb2 = apply(nb, r);
      const mates = C.mateMoves(nb2, c);
      if (!mates.length) { ok = false; break; }
      lines.push({ r: C.uci(r), mates: [...new Set(mates.map((x) => sqName(x.from) + sqName(x.to)))] });
    }
    if (ok) tree[sqName(m1.from) + sqName(m1.to)] = lines;
  }
  return Object.keys(tree).length ? tree : null;
}

/* ---------- KPK tablebase (white pawn moves up) ---------- */
const KN = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const NB = Array.from({ length: 64 }, (_, s) => KN.map(([df, dr]) => [s % 8 + df, Math.floor(s / 8) + dr]).filter(([f, r]) => f >= 0 && f < 8 && r >= 0 && r < 8).map(([f, r]) => r * 8 + f));
const adj = (a, b) => a !== b && NB[a].includes(b);
const pawnAtt = (p) => [p % 8 > 0 ? p + 7 : -1, p % 8 < 7 ? p + 9 : -1];
const idx = (wk, bk, p, t) => ((wk * 64 + bk) * 64 + p) * 2 + t;

function queenAtt(q, blockers, sq) { // queen on q attacks sq (blockers = set of squares)
  const dq = sq % 8 - q % 8, dr = Math.floor(sq / 8) - Math.floor(q / 8);
  if (!(dq === 0 || dr === 0 || Math.abs(dq) === Math.abs(dr)) || (dq === 0 && dr === 0)) return false;
  const sf = Math.sign(dq), sr = Math.sign(dr);
  let f = q % 8 + sf, r = Math.floor(q / 8) + sr;
  while (f !== sq % 8 || r !== Math.floor(sq / 8)) { if (blockers.has(r * 8 + f)) return false; f += sf; r += sr; }
  return true;
}
function promoWins(wk, bk, q) {
  if (adj(bk, q) && !adj(wk, q) && wk !== q) return false; // king queen kha sakta hai
  // black ke legal moves?
  let any = false;
  for (const n of NB[bk]) {
    if (adj(n, wk) || n === wk) continue;
    if (n === q) { if (!adj(wk, q)) { any = true; break; } else continue; }
    if (queenAtt(q, new Set([wk, bk]), n)) continue; // bk ko hata ke dekhna chahiye (x-ray)
    any = true; break;
  }
  if (!any) { const inChk = queenAtt(q, new Set([wk]), bk); return inChk; } // mate = win, stalemate = draw
  return true;
}

let TB = null;
function build() {
  if (TB) return TB;
  const win = new Uint8Array(64 * 64 * 64 * 2);
  const valid = (wk, bk, p, t) => wk !== bk && wk !== p && bk !== p && !adj(wk, bk) && Math.floor(p / 8) >= 1 && Math.floor(p / 8) <= 6 && !(t === 0 && pawnAtt(p).includes(bk));
  const wMoves = (wk, bk, p) => {
    const out = [];
    for (const n of NB[wk]) if (n !== p && n !== bk && !adj(n, bk)) out.push({ wk: n, p, promo: false });
    const one = p + 8;
    if (one !== wk && one !== bk) {
      if (one >= 56) out.push({ wk, p: one, promo: true });
      else {
        out.push({ wk, p: one, promo: false });
        if (Math.floor(p / 8) === 1 && p + 16 !== wk && p + 16 !== bk) out.push({ wk, p: p + 16, promo: false });
      }
    }
    return out;
  };
  const bMoves = (wk, bk, p) => {
    const out = [];
    const pa = pawnAtt(p);
    for (const n of NB[bk]) {
      if (n === wk || adj(n, wk) || pa.includes(n)) continue;
      out.push(n); // n===p: capture (draw agar pawn undefended; adj(n,wk) pehle filter ho chuka)
    }
    return out;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let wk = 0; wk < 64; wk += 1) for (let bk = 0; bk < 64; bk += 1) for (let p = 8; p < 56; p += 1) {
      if (valid(wk, bk, p, 0) && !win[idx(wk, bk, p, 0)]) {
        for (const m of wMoves(wk, bk, p)) {
          if (m.promo ? promoWins(m.wk, bk, m.p) : (valid(m.wk, bk, m.p, 1) && win[idx(m.wk, bk, m.p, 1)])) { win[idx(wk, bk, p, 0)] = 1; changed = true; break; }
        }
      }
      if (valid(wk, bk, p, 1) && !win[idx(wk, bk, p, 1)]) {
        const mv = bMoves(wk, bk, p);
        let all = true;
        if (!mv.length) all = pawnAtt(p).includes(bk); // mate = win, stalemate = draw
        else for (const n of mv) { if (n === p || !win[idx(wk, n, p, 0)]) { all = false; break; } }
        if (all) { win[idx(wk, bk, p, 1)] = 1; changed = true; }
      }
    }
  }
  TB = { win, valid, wMoves, bMoves };
  return TB;
}

export function kpkParse(fen) {
  const { b, turn } = parse(fen);
  let wk = -1, bk = -1, p = -1, n = 0;
  b.forEach((x, i) => { if (!x) return; n += 1; if (x.t === "k") (x.c === "w" ? (wk = i) : (bk = i)); else if (x.t === "p" && x.c === "w") p = i; });
  if (n !== 3 || wk < 0 || bk < 0 || p < 0) return null;
  return { wk, bk, p, t: turn === "w" ? 0 : 1 };
}
export function kpkWins(fen) {
  const s = kpkParse(fen); if (!s) throw new Error("not KPK");
  const tb = build();
  return !!tb.win[idx(s.wk, s.bk, s.p, s.t)];
}
// White to move: saari moves jo jeet barkarar rakhti hain (uci strings)
export function kpkWinningMoves(fen) {
  const s = kpkParse(fen); if (!s || s.t !== 0) throw new Error("need KPK white to move");
  const tb = build();
  const out = [];
  for (const m of tb.wMoves(s.wk, s.bk, s.p)) {
    const ok = m.promo ? promoWins(m.wk, s.bk, m.p) : tb.valid(m.wk, s.bk, m.p, 1) && tb.win[idx(m.wk, s.bk, m.p, 1)];
    if (!ok) continue;
    if (m.wk !== s.wk) out.push(sqName(s.wk) + sqName(m.wk));
    else out.push(sqName(s.p) + sqName(m.p));
  }
  return out;
}
