import { LEAK_DEFS } from "./leaks";
import { dbAll, dbPut } from "./storage";

/*
  Leak Lab ka dimaag.
  training store ka ek item = aapki apni game ki ek galat position.
  item: { id, gameId, ply, fen, userColor, best, bestSan, playedSan, cat, leak, winLoss, label,
          box, dueAt, status, attempts, solved }
*/

const DAY = 24 * 60 * 60 * 1000;
const PER_LEAK = 10;

export const OTHER_LEAK = { id: "other", title: "Other mistakes", text: "Mistakes you added yourself from Review." };

export function leakInfo(id) {
  return LEAK_DEFS.find((leak) => leak.id === id) || OTHER_LEAK;
}

/* ---------- Positions banana ---------- */

function candidate(record, move, leakId) {
  if (!move || !move.best || move.best === move.uci || !move.fenBefore) return null;

  return {
    id: `${record.id}:${move.ply}`,
    gameId: record.id,
    ply: move.ply,
    fen: move.fenBefore,
    userColor: move.userColor || record.userColor,
    best: move.best,
    bestSan: move.bestSan || "",
    playedSan: move.san,
    cat: move.cat,
    leak: leakId,
    winLoss: move.winLoss || 0,
    label: move.label || "your game",
  };
}

// Har leak ki sabse mehengi galtiyan (kam se kam 6% nuksaan)
export function buildCandidates(records, perLeak = PER_LEAK) {
  const byLeak = new Map();

  for (const record of records) {
    for (const move of record.userMoves) {
      if (!move.leak || (move.winLoss || 0) < 6) continue;
      const item = candidate(record, move, move.leak);
      if (item) byLeak.set(move.leak, [...(byLeak.get(move.leak) || []), item]);
    }

    for (const gameLeak of record.gameLeaks) {
      const item = candidate(record, gameLeak.example, gameLeak.leakId);
      if (item) byLeak.set(gameLeak.leakId, [...(byLeak.get(gameLeak.leakId) || []), item]);
    }
  }

  const out = [];

  for (const list of byLeak.values()) {
    const unique = new Map();
    for (const item of list) if (!unique.has(item.id)) unique.set(item.id, item);
    out.push(...[...unique.values()].sort((a, b) => b.winLoss - a.winLoss).slice(0, perLeak));
  }

  return out;
}

// Nayi positions store mein daalta hai (jo pehle se hain unhe chhedta nahi) aur poori list deta hai
export async function seedTraining(records, now = Date.now()) {
  const existing = await dbAll("training");
  const known = new Set(existing.map((item) => item.id));
  const fresh = buildCandidates(records)
    .filter((item) => !known.has(item.id))
    .map((item) => ({ ...item, box: 0, dueAt: now, status: "new", attempts: 0, solved: 0, addedAt: now }));

  for (const item of fresh) await dbPut("training", item);

  return [...existing, ...fresh];
}

/* ---------- Spaced repetition: 1, 3, 7 din ---------- */

// box 1 -> 1 din, box 2 -> 3 din, box 3 -> 7 din, box 4 -> 14 din
const INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14 };

export function afterSolve(item, now = Date.now()) {
  const box = Math.min(4, (item.box || 0) + 1);
  return { ...item, box, dueAt: now + INTERVALS[box] * DAY, status: box >= 3 ? "learned" : "learning", solved: (item.solved || 0) + 1, attempts: (item.attempts || 0) + 1 };
}

// Galat ya "Show answer": aaj hi wapas aayegi
export function afterMiss(item, now = Date.now()) {
  return { ...item, box: 0, dueAt: now, status: "learning", attempts: (item.attempts || 0) + 1 };
}

export function isDue(item, now = Date.now()) {
  return (item.dueAt ?? 0) <= now;
}

export function buildQueue(items, leakId, { force = false, limit = 10, now = Date.now() } = {}) {
  return items
    .filter((item) => (leakId === "all" || (item.leak || "other") === leakId) && (force || isDue(item, now)))
    .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0) || (b.winLoss || 0) - (a.winLoss || 0))
    .slice(0, limit)
    .map((item) => item.id);
}

const startOfDay = (time) => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// "Coming back": kitni positions kab wapas aayengi
export function comingBack(items, now = Date.now()) {
  const rows = [
    { id: "today", label: "Today", count: 0 },
    { id: "tomorrow", label: "Tomorrow", count: 0 },
    { id: "soon", label: "In 2 to 3 days", count: 0 },
    { id: "week", label: "In 4 to 7 days", count: 0 },
    { id: "later", label: "Later", count: 0 },
  ];

  for (const item of items) {
    const diff = Math.round((startOfDay(item.dueAt ?? now) - startOfDay(now)) / DAY);
    const row = diff <= 0 ? rows[0] : diff === 1 ? rows[1] : diff <= 3 ? rows[2] : diff <= 7 ? rows[3] : rows[4];
    row.count += 1;
  }

  return rows;
}

/* ---------- Proof: asli games mein leak band hua ya nahi ---------- */

// Har game mein leak kitni baar aaya, purane se naye
export function leakSeries(records, leakId) {
  return [...records]
    .sort((a, b) => a.time - b.time)
    .map(
      (record) =>
        record.userMoves.filter((m) => m.leak === leakId).length +
        record.gameLeaks.filter((g) => g.leakId === leakId).length
    );
}

export function proofText(series, status) {
  if (status === "Fixed") return "The last 5 games had none. This habit is marked Fixed.";
  if (series.length < 6) return `Needs ${6 - series.length} more reviewed games before we can judge this habit.`;

  const earlier = series.slice(0, -5).reduce((a, b) => a + b, 0);
  if (earlier < 2) {
    return "Not enough history yet. A habit is marked Fixed after 5 clean games, once it has shown up at least twice before.";
  }

  let clean = 0;
  for (let i = series.length - 1; i >= 0 && series[i] === 0 && clean < 5; i -= 1) clean += 1;

  const left = 5 - clean;
  return `${left} more clean ${left === 1 ? "game" : "games"} in a row and this habit is marked Fixed.`;
}

/* ---------- Sawal ka text ---------- */

export function promptFor(leakId, side) {
  switch (leakId) {
    case "hanging":
      return `${side} to move. Which move keeps every piece protected?`;
    case "missed-tactics":
      return `${side} to move. A capture or a forced mate is on the board. Find it.`;
    case "time-trouble":
      return `${side} to move with little time. Find the safe, strong move.`;
    case "opening-gaps":
      return `${side} to move in the opening. Find the best move.`;
    case "endgame-conversion":
      return `${side} to move in a winning endgame. Convert it.`;
    case "back-rank":
      return `${side} to move. Watch your first rank.`;
    default:
      return `${side} to move. Find the strongest move.`;
  }
}