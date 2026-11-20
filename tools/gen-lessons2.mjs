// node tools/gen-lessons2.mjs -> src/features/coach/lessons.generated.js (answers engine se verify)
import fs from "node:fs";
import * as C from "./miniChess.mjs";
import * as X from "./engineExtra.mjs";
import { COURSES } from "./lessons.src.mjs";

const bad = [];
const err = (id, m) => bad.push(`${id}: ${m}`);
const ucis = (ms) => [...new Set(ms.map((m) => C.sqName(m.from) + C.sqName(m.to)))];

function doAnswers(id, s, b, turn) {
  const legal = C.legalMoves(b, turn);
  let ms;
  switch (s.kind) {
    case "mate": ms = C.mateMoves(b, turn); break;
    case "fork": ms = C.forkMoves(b, turn).map((x) => x.m); break;
    case "pin": ms = C.lineMoves(b, turn, "pin").map((x) => x.m); break;
    case "skewer": ms = C.lineMoves(b, turn, "skewer").map((x) => x.m); break;
    case "wins": ms = legal.filter((m) => b[m.to] && C.captureVerdict(b, m.from, m.to)?.net > 0); break;
    case "any": ms = [...C.mateMoves(b, turn), ...C.forkMoves(b, turn).map((x) => x.m), ...C.lineMoves(b, turn, "pin").map((x) => x.m), ...C.lineMoves(b, turn, "skewer").map((x) => x.m)]; break;
    case "discover": ms = X.discoverMoves(b, turn, "check").map((x) => x.m); break;
    case "discoverwin": ms = X.discoverMoves(b, turn, "win").map((x) => x.m); break;
    case "kpk": { if (!X.kpkWins(s.fen)) { err(id, "kpk position is not a win"); return []; } const a = X.kpkWinningMoves(s.fen); if (!a.length) err(id, "no kpk move"); return a; }
    case "fixed": {
      if (!s.castle) for (const a of s.answers) if (!legal.some((m) => C.sqName(m.from) + C.sqName(m.to) === a)) err(id, `fixed answer ${a} not legal`);
      return s.answers;
    }
    default: err(id, `unknown kind ${s.kind}`); return [];
  }
  const a = ucis(ms);
  if (!a.length) err(id, `no answer for kind ${s.kind}`);
  return a;
}

let nSteps = 0;
for (const c of COURSES) for (const l of c.lessons) l.steps.forEach((s, i) => {
  const id = `${c.id}/${l.id}#${i + 1}`;
  nSteps += 1;
  if (s.fen) { const v = C.validPosition(s.fen); if (v) err(id, v); }
  const { b, turn } = s.fen ? C.parse(s.fen) : { b: null, turn: "w" };
  s.flip = turn === "b";
  if (s.t === "do") s.answers = doAnswers(id, s, b, turn);
  if (s.t === "tap") {
    s.answers = C.hangingSet(b).filter((h) => b[h.sq].c !== turn || true).map((h) => C.sqName(h.sq));
    // sirf wo piece jo side-to-move ko free mil sake (enemy ka)
    s.answers = C.hangingSet(b).filter((h) => b[h.sq].c !== turn).map((h) => C.sqName(h.sq));
    if (s.answers.length !== 1) err(id, `tap needs exactly 1 hanging enemy piece, got ${s.answers}`);
    s.why = s.why || (() => { const h = C.hangingSet(b).find((x) => C.sqName(x.sq) === s.answers[0]); const p = b[h.sq]; return `The ${C.NAME[p.t]} on ${s.answers[0]} can be taken ${h.defenders.length ? "and it is worth more than the piece taking it" : "and nothing protects it"}.`; })();
  }
  if (s.t === "teach" && s.play) {
    let bb = b, side = turn;
    for (const mv of s.play) {
      const from = C.sqIdx(mv.slice(0, 2)), to = C.sqIdx(mv.slice(2, 4));
      const m = C.legalMoves(bb, side).find((x) => x.from === from && x.to === to);
      if (!m) { err(id, `play move ${mv} illegal`); break; }
      bb = C.apply(bb, m); side = side === "w" ? "b" : "w";
    }
    if (/Check:/.test(s.text) && !C.inCheck(bb, side)) err(id, "claimed check, not check");
    if (/Mate:|ladder|Rooks take/.test(s.text) && s.play.length && /Mate:/.test(s.text) && !C.isMate(bb, side)) err(id, "claimed mate, not mate");
    if (l.id === "ladder" && !C.isMate(bb, side)) err(id, "ladder line does not end in mate");
  }
  if (s.t === "kpkeval") {
    const w = X.kpkWins(s.fen);
    Object.assign(s, { t: "quiz", options: ["White wins", "Draw"], answer: w ? 0 : 1, why: w ? "Yes. White's king gets in front of the pawn." : "Not quite. Black holds the key squares, so it is a draw." });
    console.log(id.padEnd(22), "kpkeval", w ? "white wins" : "draw");
  }
  if (s.t === "line") {
    let bb = b, side = turn;
    const play = (mv) => { const f = C.sqIdx(mv.slice(0, 2)), t = C.sqIdx(mv.slice(2, 4)); const m = C.legalMoves(bb, side).find((x) => x.from === f && x.to === t); if (!m) { err(id, `line move ${mv} illegal`); return false; } bb = C.apply(bb, m); side = side === "w" ? "b" : "w"; return true; };
    for (const mv of s.moves) { if (!play(mv.u)) break; if (mv.r && !play(mv.r)) break; }
  }
  if (s.t === "mate2") {
    const tr = X.mate2(b, turn);
    if (!tr) err(id, "no mate in 2");
    else {
      s.tree = {};
      for (const [m1, lines] of Object.entries(tr)) s.tree[m1] = { reply: lines[0].r.slice(0, 4), mates: lines[0].mates };
      s.why = "A quiet move first, and every reply allows mate.";
      console.log(id.padEnd(22), "mate2  ", Object.keys(s.tree).join(","));
    }
  }
  if (s.t === "choice") {
    const v = C.captureVerdict(b, C.sqIdx(s.from), C.sqIdx(s.to));
    if (!v) err(id, "capture not legal");
    else {
      const safe = v.net > 0;
      s.answers = [safe ? "take" : "trap"];
      s.why = safe ? (v.recapture ? `They can take back, but you still win a ${C.NAME[v.captured]} for a ${C.NAME[v.moved]}.` : `Nothing can take back. You win the ${C.NAME[v.captured]} for free.`) : `They simply take back. You lose a ${C.NAME[v.moved]} for a ${C.NAME[v.captured]}.`;
      s.arrow = { from: s.from, to: s.to };
      console.log(id.padEnd(22), "choice ", s.answers[0]);
    }
  }
  if (s.t === "quiz") { if (s.answer >= s.options.length) err(id, "quiz answer index"); }
  if (s.t === "do" && s.kind !== "fixed") s.why = s.why || ({ mate: "The king is attacked and has no escape.", fork: "One piece attacks two targets. They can only save one.", pin: "The pinned piece cannot move without losing something bigger.", skewer: "The big piece must move, and you win the piece behind it.", any: "That is the tactic.", wins: "You win material." }[s.kind]);
  if (s.t === "do" && s.kind === "kpk") s.why = "Your king gets in front of the pawn, so it can escort it home.";
  if (s.t === "do" && s.answers) console.log(id.padEnd(22), s.kind.padEnd(7), s.answers.join(","));
});
if (bad.length) { console.error("\nPROBLEMS:\n" + bad.join("\n")); process.exit(1); }
// Course test: har lesson ka aakhri interactive step (max 8)
for (const c of COURSES) {
  const pool = c.lessons.map((l) => [...l.steps].reverse().find((s) => ["do", "tap", "choice", "mate2"].includes(s.t))).filter(Boolean);
  c.lessons.push({ id: "exam", title: "Course test", goal: "Prove what you learned.", exam: true, steps: [{ t: "teach", fen: pool[0].fen, text: "Test time. No hints from me.", flip: pool[0].flip }, ...pool.slice(0, 8).map((s) => ({ ...s }))] });
}
const out = COURSES.map((c) => ({ ...c, lessons: c.lessons.map((l) => ({ ...l, steps: l.steps.map(({ castle, from, to, ...s }) => (s.t === "choice" ? { ...s } : { ...s, ...(from ? { from } : {}), ...(to ? { to } : {}) })) })) }));
fs.writeFileSync(new URL("../src/features/coach/lessons.generated.js", import.meta.url), "// GENERATED by tools/gen-lessons2.mjs from tools/lessons.src.mjs. Haath se mat badlo.\nexport const COURSES = " + JSON.stringify(out, null, 1) + ";\n");
console.log(`\nOK: ${COURSES.reduce((a, c) => a + c.lessons.length, 0)} lessons, ${nSteps} steps`);
