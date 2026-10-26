import { moveAccuracy } from "./chessUtils";

/*
  DNA ke numbers. Har skill = us situation mein aapki chaalon ki average accuracy (0 se 100).
  Koi skill tabhi dikhti hai jab us situation ki kam se kam 8 chaalein hon, warna "—".
*/

const MIN_MOVES = 8;
const MIN_BUCKET_MOVES = 5;

const advantage = (move) => (move.color === "w" ? 1 : -1) * (typeof move.evalBefore === "number" ? move.evalBefore : 0);
const accuracyOf = (move) => moveAccuracy(move.winLoss ?? 0);

function mean(values, minimum) {
  if (values.length < minimum) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export const SKILL_DEFS = [
  { id: "tactics", label: "Tactics", how: "your middlegame moves", test: (m) => m.phase === "Middlegame" },
  { id: "openings", label: "Openings", how: "your opening moves", test: (m) => m.phase === "Opening" },
  { id: "endgames", label: "Endgames", how: "your endgame moves", test: (m) => m.phase === "Endgame" },
  { id: "time", label: "Time use", how: "moves with 2 minutes or less left", test: (m) => typeof m.clock === "number" && m.clock <= 120 },
  { id: "converting", label: "Converting wins", how: "moves when you were clearly winning", test: (m) => advantage(m) >= 2 },
  { id: "defence", label: "Defence", how: "moves when you were clearly worse", test: (m) => advantage(m) <= -1.5 },
];

export function computeSkills(records) {
  const moves = records.flatMap((record) => record.userMoves);

  return SKILL_DEFS.map((def) => {
    const subset = moves.filter(def.test);
    return { id: def.id, label: def.label, how: def.how, moves: subset.length, value: mean(subset.map(accuracyOf), MIN_MOVES) };
  });
}

export const CLOCK_BUCKETS = [
  { id: "high", label: "> 5 min", test: (c) => c > 300 },
  { id: "mid", label: "2 to 5", test: (c) => c > 120 && c <= 300 },
  { id: "low", label: "1 to 2", test: (c) => c > 60 && c <= 120 },
  { id: "panic", label: "< 1 min", test: (c) => c <= 60 },
];

// Time bacha tha toh accuracy kitni thi. Clock data na ho toh hasClocks false.
export function clockAccuracy(records) {
  const moves = records.flatMap((record) => record.userMoves).filter((m) => typeof m.clock === "number");

  return {
    hasClocks: moves.length > 0,
    buckets: CLOCK_BUCKETS.map((bucket) => {
      const subset = moves.filter((m) => bucket.test(m.clock));
      return { id: bucket.id, label: bucket.label, moves: subset.length, value: mean(subset.map(accuracyOf), MIN_BUCKET_MOVES) };
    }),
  };
}

export function averageAccuracy(records) {
  const values = records.map((r) => r.accuracy).filter((v) => typeof v === "number");
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

// Abhi ke `days` din aur usse pehle ke utne hi din
export function periodRecords(records, days) {
  if (days === "all") return { current: records, previous: [] };

  const span = Number(days) * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return {
    current: records.filter((r) => r.time >= now - span),
    previous: records.filter((r) => r.time >= now - 2 * span && r.time < now - span),
  };
}

export function verdict({ leakNow, leakPrev, accNow, accPrev, weakest }) {
  if (leakPrev === null || accPrev === null || accNow === null) return "";

  const leakBetter = leakNow < leakPrev;
  const accBetter = accNow > accPrev;

  let head;
  if (leakBetter && accBetter) head = "Better in both.";
  else if (leakBetter) head = "Fewer leaks, but accuracy is flat or lower.";
  else if (accBetter) head = "Higher accuracy, but your leaks cost a little more.";
  else head = "A little behind your earlier games.";

  return weakest ? `${head} ${weakest} is still your weakest skill.` : head;
}