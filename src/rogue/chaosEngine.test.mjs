import { ChaosGame, chaosChooseMove, mulberry32 } from "./chaosEngine.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } };

// 1. perft with events off: proves normal chess rules (castling, ep, promotion, check) are correct
function perft(g, d) { if (!d) return 1; let n = 0; for (const m of g.legal()) { const u = g._do(m); n += perft(g, d - 1); g._undo(u); } return n; }
const P = [
 ["start", undefined, [20, 400, 8902, 197281]],
 ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
 ["pos3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
 ["pos4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
];
for (const [name, fen, exp] of P) {
  const g = new ChaosGame({ fen, config: { events: false } });
  exp.forEach((e, i) => { const got = perft(g, i + 1); ok(got === e, `perft ${name} d${i + 1}: ${got} != ${e}`); });
  console.log("perft ok:", name, exp.join("/"));
}

// 2. a Knight transformed to a Rook moves like a Rook but is still a Knight
{
  const g = new ChaosGame({ fen: "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1", config: { events: false } });
  g.tr[27] = { as: "r", left: 4, rounds: 2, c: "w", orig: "n" };
  const to = g.moves({ square: "d4", verbose: true }).map((m) => m.to).sort();
  ok(to.join() === "a4,b4,c4,d1,d2,d3,d5,d6,d7,d8,e4,f4,g4,h4", "knight-as-rook moves: " + to);
  ok(g.get("d4").type === "n" && g.get("d4").chaos.as === "r", "identity kept");
  const mv = g.move({ from: "d4", to: "d8" });
  ok(mv.piece === "n" && g.isCheck(), "moved as rook, still a knight, gives check");
  ok(g.tr[59] && g.tr[59].as === "r", "transformation follows the piece");
}
// 3. a transformed enemy piece creates check, and the king cannot step onto its lines
{
  const g = new ChaosGame({ fen: "4k3/8/8/8/8/8/8/n3K3 w - - 0 1", config: { events: false } });
  ok(!g.isCheck(), "plain knight on a1 does not check e1");
  g.tr[0] = { as: "r", left: 4, rounds: 2, c: "b", orig: "n" };
  ok(g.isCheck(), "knight-as-rook on a1 checks e1");
  const to = g.moves({ square: "e1", verbose: true }).map((m) => m.to).sort();
  ok(to.join() === "d2,e2,f2", "king escapes only off rank 1: " + to);
}
// 3b. an event hits both sides (one piece each); one-sided when the other side has none
{
  const g = new ChaosGame({ seed: 3, fen: "4k3/8/8/2b5/8/8/8/2B1K2B w - - 0 1", config: { events: true, minGap: 0, maxGap: 0, targets: ["q"] } });
  let seen = null;
  for (let i = 0; i < 40 && !seen; i++) { const ms = g.moves({ verbose: true }); g.move(ms[0]); const ev = g.takeEvents().find((e) => e.kind === "start" && e.piece === "b"); if (ev) seen = ev; if (g.isGameOver()) break; }
  ok(seen && seen.colors.length === 2 && seen.squares.length === 2, "bishop event: one bishop per side: " + JSON.stringify(seen));
}
{
  const g = new ChaosGame({ seed: 4, fen: "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", config: { events: true, minGap: 0, maxGap: 0, targets: ["q"] } });
  let seen = null;
  for (let i = 0; i < 30 && !seen; i++) { const ms = g.moves({ verbose: true }); g.move(ms[0]); const ev = g.takeEvents().find((e) => e.kind === "start" && e.piece === "b"); if (ev) seen = ev; if (g.isGameOver()) break; }
  ok(seen && seen.colors.length === 1 && seen.colors[0] === "w", "only White has a bishop => one-sided: " + JSON.stringify(seen));
}
// 4. random playouts with events ON: invariants + determinism
function playout(seed, plies = 160) {
  const g = new ChaosGame({ seed }), rng = mulberry32(seed + 99), log = [];
  let starts = 0, ends = 0, maxActive = 0, both = 0, one = 0;
  for (let i = 0; i < plies; i++) {
    const ms = g.moves({ verbose: true });
    if (!ms.length) break;
    const m = ms[Math.floor(rng() * ms.length)];
    const mover = g.turn();
    g.move(m);
    for (const e of g.takeEvents()) { log.push(`${e.kind}:${e.ply}:${e.piece}${e.as}${e.square}${e.rounds || ""}`); if (e.kind === "start") { starts++; e.colors.length === 2 ? both++ : one++; } else ends++; }
    ok(!g._inCheck(mover), `seed ${seed} ply ${i}: mover king in check`);
    if (!g.isGameOver()) ok(g.legal().length > 0, "side to move has moves");
    for (const [k, t] of Object.entries(g.tr)) { ok(g.bd[k] && g.bd[k].t !== "k", "tr on missing/king piece"); ok(t.left > 0 && t.left <= 6, "bad left " + t.left); ok(g.bd[k].c === t.c && g.bd[k].t === t.orig, "tr identity drifted"); }
    const ent = Object.values(g.tr); maxActive = Math.max(maxActive, new Set(ent.map((t) => t.orig + t.as + t.left)).size);
    ok(new Set(ent.map((t) => t.orig + t.as + t.left)).size <= 1, "more than one event active at once");
    ok(ent.filter((t) => t.c === "w").length <= 1 && ent.filter((t) => t.c === "b").length <= 1, "more than one transformed piece for a side");
    if (g.isGameOver()) break;
  }
  return { log, starts, ends, maxActive, both, one };
}
let S = 0, E = 0, M = 0, B = 0, O = 0;
for (let s = 1; s <= 120; s++) { const r = playout(s); S += r.starts; E += r.ends; M = Math.max(M, r.maxActive); B += r.both; O += r.one; }
ok(S > 100 && E > 50, "events happen");
ok(M <= 1, "one event at a time " + M);
ok(B > 0 && O > 0, "both-sided and one-sided events both occur");
console.log(`120 random games: ${S} events (${B} both sides, ${O} one side), ${E} expired, max simultaneous events ${M}`);
const a = playout(7), b = playout(7), c = playout(8);
ok(JSON.stringify(a.log) === JSON.stringify(b.log), "same seed => same events");
ok(JSON.stringify(a.log) !== JSON.stringify(c.log), "different seed => different events");
console.log("seeded reproducibility ok");

// 5. AI always returns a legal move under current rules, all personalities x difficulties
const sigs = ["predator", "trickster", "gambler", "shadow", "chaos"], diffs = ["easy", "medium", "hard", "nightmare"];
let aiMoves = 0, t0 = Date.now(), slow = 0;
for (const p of sigs) for (const d of diffs) {
  const g = new ChaosGame({ seed: 5 + aiMoves });
  const rng = mulberry32(42);
  for (let i = 0; i < 14 && !g.isGameOver(); i++) {
    if (i % 2 === 0) { const ms = g.moves({ verbose: true }); g.move(ms[Math.floor(rng() * ms.length)]); }
    else { const t = Date.now(); const mv = await chaosChooseMove(g, { personality: p, difficulty: d }); slow = Math.max(slow, Date.now() - t);
      const legal = g.moves({ verbose: true }).some((m) => m.from === mv.from && m.to === mv.to); ok(legal, `AI illegal ${p}/${d}`); g.move(mv); aiMoves++; }
    g.takeEvents();
  }
}
console.log(`AI: ${aiMoves} moves all legal, slowest single move ${slow} ms`);
// 6. AI takes mate in one
{
  const g = new ChaosGame({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", config: { events: false } });
  const mv = await chaosChooseMove(g, { difficulty: "easy" }); ok(mv.from === "a1" && mv.to === "a8", "mate in one: " + JSON.stringify(mv));
}
console.log(fails ? `${fails} FAILURES` : "ALL TESTS PASSED");
