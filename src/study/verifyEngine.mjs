// Run in src/study:  node verifyEngine.mjs
// Built-in engine ki jaanch: move generator (perft) aur search (mate, free piece, poora game, legal moves).

import {
  createEngine, createPosition, setFen, perft, findMove, makeIfLegal, inCheck,
} from "./fallbackEngineCore.js";
import { createUciClient } from "./uciEngine.js";

let bad = 0;
const check = (name, ok, extra = "") => {
  if (!ok) bad += 1;
  console.log(ok ? "OK  " : "FAIL", name, extra);
};

const perftCases = [
  ["start position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902]],
  ["kiwipete (castling, ep)", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["promotions", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
];
for (const [name, fen, expect] of perftCases) {
  const pos = createPosition();
  setFen(pos, fen);
  const got = expect.map((_, i) => perft(pos, i + 1));
  check(`perft ${name}`, JSON.stringify(got) === JSON.stringify(expect), got.join(" "));
}

const engine = createEngine((t) => setTimeout(() => worker.onmessage({ data: t }), 0));
const worker = { postMessage: (c) => setTimeout(() => engine.handle(c), 0), terminate() {} };
const client = createUciClient(worker);
await client.init();

let a = await client.analyze("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", { multipv: 1, depth: 4 });
check("finds mate in 1", a.lines[0].scoreType === "mate" && a.lines[0].pv[0] === "a1a8");

a = await client.analyze("4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1", { multipv: 1, depth: 4 });
check("wins a free queen", a.lines[0].pv[0] === "c3d5");

a = await client.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", { multipv: 3, depth: 4 });
check("gives 3 different top moves", a.lines.length === 3 && new Set(a.lines.map((l) => l.pv[0])).size === 3);

function fenOf(p) {
  const rows = [];
  for (let r = 7; r >= 0; r -= 1) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f += 1) {
      const pc = p.board[r * 16 + f];
      if (!pc) { empty += 1; continue; }
      if (empty) { row += empty; empty = 0; }
      const ch = "pnbrqk"[(pc & 7) - 1];
      row += pc >> 3 ? ch : ch.toUpperCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const c = (p.castling & 1 ? "K" : "") + (p.castling & 2 ? "Q" : "") + (p.castling & 4 ? "k" : "") + (p.castling & 8 ? "q" : "");
  const ep = p.ep >= 0 ? "abcdefgh"[p.ep & 7] + ((p.ep >> 4) + 1) : "-";
  return `${rows.join("/")} ${p.side ? "b" : "w"} ${c || "-"} ${ep} ${p.half} ${p.full}`;
}

const pos = createPosition();
setFen(pos, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
let illegal = 0;
let plies = 0;
for (; plies < 60; plies += 1) {
  const fen = fenOf(pos);
  const uci = await client.bestMove(fen, { movetime: 100, skill: plies % 2 === 0 ? 14 : 3 });
  if (!uci) break;
  const m = findMove(pos, uci);
  if (!m || !makeIfLegal(pos, m)) { illegal += 1; break; }
}
check("plays 60 plies against itself, all legal", illegal === 0, `${plies} plies${inCheck(pos) ? " (ended in check)" : ""}`);

console.log(bad ? `\nProblems: ${bad}` : "\nBuilt-in engine OK");
process.exit(bad ? 1 : 0);
