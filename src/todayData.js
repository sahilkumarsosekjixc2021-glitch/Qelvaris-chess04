// Today page ka data layer.
// Plan aur leak score ab asli hain: leaks.js ke reviewed games se. Koi game review nahi hui toh SAMPLE dikhta hai.

import { Chess } from "chess.js";
import { dbAll, getSetting, setSetting } from "./storage";
import { computeLeaks, inWindow, loadReviewedGames } from "./leaks";
import { SOURCE_LABELS, sourceKey } from "./gamesData";

export const STREAK_MIN_STEPS = 3; // default; asli threshold aaj ke plan ke steps hain (neeche total)

export const SAMPLE_FEN = "r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5";

// Local date (India), UTC nahi, warna raat 12 ke aas-paas din galat ginega
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/* ---------- Sample data (jab tak koi game review nahi hui) ---------- */

function samplePlan() {
  return {
    isSample: true,
    steps: [
      { id: "fix", kind: "Fix", title: "5 positions", from: "From your Hanging pieces leak", minutes: 6, goTo: "Leak Lab" },
      { id: "review", kind: "Review", title: "1 turning point", from: "From your last game", minutes: 4, goTo: "Review" },
      { id: "mission", kind: "Mission", title: "Safe hands", from: "Win a game without leaving a piece hanging", minutes: 5, goTo: "Play" },
    ],
  };
}

function sampleLeaks() {
  return {
    isSample: true,
    windowLabel: "last 30 days",
    total: -134,
    leaks: [
      { name: "Hanging pieces", points: -48 },
      { name: "Time trouble", points: -35 },
      { name: "Missed tactics", points: -29 },
    ],
    moreCount: 2,
    status: { fixed: 1, improving: 2, open: 2 },
  };
}

/* ---------- Asli leaks ---------- */

const MISSIONS = {
  hanging: { title: "Safe hands", text: "Win a game without leaving a piece hanging" },
  "time-trouble": { title: "Clock calm", text: "Reach move 25 with 3+ minutes left" },
  "endgame-conversion": { title: "Convert the win", text: "Start a winning endgame and finish it" },
};
const DEFAULT_MISSION = { title: "Clean game", text: "Play a game and check every move before you play it" };

function buildLeaks(records) {
  if (!records.length) return { summary: sampleLeaks(), top: null };

  let window = inWindow(records, 30);
  let windowLabel = "last 30 days";
  if (!window.length) {
    window = records;
    windowLabel = "all reviewed games";
  }

  const result = computeLeaks(window, records);
  const status = { fixed: 0, improving: 0, open: 0 };
  for (const leak of result.leaks) {
    if (leak.status === "Fixed") status.fixed += 1;
    else if (leak.status === "Improving") status.improving += 1;
    else status.open += 1;
  }

  // Fix step ke liye: sabse mehnga leak jo abhi Fixed nahi hai aur jiske examples hain
  const top = result.leaks.find((leak) => leak.status !== "Fixed" && leak.examples.length) || null;

  return {
    top,
    summary: {
      isSample: false,
      windowLabel,
      total: -result.total,
      leaks: result.leaks.slice(0, 3).map((leak) => ({ name: leak.title, points: -leak.points })),
      moreCount: Math.max(0, result.leaks.length - 3),
      status,
    },
  };
}

function buildPlan(records, top) {
  if (!records.length) return samplePlan();

  const steps = [];

  if (top) {
    const n = Math.min(5, top.examples.length);
    steps.push({
      id: "fix",
      kind: "Fix",
      title: `${n} position${n === 1 ? "" : "s"}`,
      from: `From your ${top.title} leak`,
      minutes: n + 1,
      goTo: "Leak Lab",
    });
  }

  const last = records[records.length - 1];
  steps.push({
    id: "review",
    kind: "Review",
    title: "1 turning point",
    from: `From your game vs ${last.opponent}`,
    minutes: 4,
    goTo: "Review",
  });

  const mission = MISSIONS[top?.id] || DEFAULT_MISSION;
  steps.push({ id: "mission", kind: "Mission", title: mission.title, from: mission.text, minutes: 5, goTo: "Play" });

  return { isSample: false, steps };
}

/* ---------- Last game ---------- */

function gameTime(game) {
  const t = new Date(game.playedAt || game.date || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function getLastGame(records) {
  const games = (await dbAll("games")).filter((g) => g?.pgn);

  if (!games.length) {
    return {
      isSample: true,
      title: "vs sunil_k · Ruy Lopez",
      result: "1-0",
      source: "Lichess",
      accuracy: 91.2,
      turningPoints: 3,
      fen: SAMPLE_FEN,
    };
  }

  const latest = [...games].sort((a, b) => gameTime(b) - gameTime(a))[0];
  let headers = {};
  let fen = SAMPLE_FEN;

  try {
    const chess = new Chess();
    chess.loadPgn(latest.pgn);
    headers = chess.getHeaders();
    fen = chess.fen();
  } catch (error) {
    console.error("Could not read last game:", error);
  }

  const color = latest.userColor || "w";
  const opponent = (color === "w" ? headers.Black : headers.White) || "Opponent";
  const record = records.find((r) => r.id === latest.id);
  const opening = record?.opening || headers.Opening || "";
  const sourceLabel = SOURCE_LABELS[sourceKey(latest)];

  return {
    isSample: false,
    title: `vs ${opponent}${opening ? ` · ${opening}` : ""}`,
    result: headers.Result || "",
    source: sourceLabel === "Saved" ? "" : sourceLabel,
    accuracy: typeof record?.accuracy === "number" ? Math.round(record.accuracy * 10) / 10 : null,
    turningPoints: null,
    fen,
  };
}

/* ---------- Roz ki progress aur streak ---------- */

async function readRow(key) {
  const row = await getSetting(`today-${key}`, null);
  return {
    done: Array.isArray(row?.done) ? row.done : [],
    total: typeof row?.total === "number" ? row.total : STREAK_MIN_STEPS,
  };
}

async function readStreakDays() {
  const days = await getSetting("streak-days", []);
  return Array.isArray(days) ? days : [];
}

function countStreak(days) {
  const set = new Set(days);
  let cursor = new Date();
  // Aaj abhi pura nahi hua toh kal se ginti shuru, taaki din bhar streak toot-ti na dikhe
  if (!set.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let count = 0;
  while (set.has(dateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function buildWeek(days) {
  const set = new Set(days);
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -mondayOffset);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];

  return labels.map((label, i) => {
    const d = addDays(monday, i);
    const key = dateKey(d);
    return {
      label,
      key,
      done: set.has(key),
      isToday: key === dateKey(today),
      isFuture: d > today && key !== dateKey(today),
    };
  });
}

function streakState(days) {
  return { count: countStreak(days), week: buildWeek(days) };
}

export async function loadToday() {
  const key = dateKey();

  let records = [];
  try {
    records = await loadReviewedGames();
  } catch (error) {
    console.error("Could not load reviewed games:", error);
  }

  const { summary, top } = buildLeaks(records);
  const plan = buildPlan(records, top);

  const [row, streakDays, lastGame] = await Promise.all([readRow(key), readStreakDays(), getLastGame(records)]);

  // Aaj ke plan mein kitne steps hain, wo yaad rakho, taaki streak ka hisaab sahi rahe
  if (row.total !== plan.steps.length) {
    await setSetting(`today-${key}`, { done: row.done, total: plan.steps.length });
  }

  const validIds = new Set(plan.steps.map((s) => s.id));

  return {
    dateKey: key,
    plan,
    doneIds: row.done.filter((id) => validIds.has(id)),
    leaks: summary,
    lastGame,
    streak: streakState(streakDays),
  };
}

// Dusre pages (Leak Lab, Review, Play) session poora hone par ye call karenge:
//   import { setStepDone } from "./todayData";  await setStepDone("fix", true);
export async function setStepDone(stepId, done = true) {
  const key = dateKey();
  const row = await readRow(key);
  const next = done ? [...new Set([...row.done, stepId])] : row.done.filter((id) => id !== stepId);
  await setSetting(`today-${key}`, { done: next, total: row.total });

  let days = await readStreakDays();
  if (next.length >= row.total) {
    days = [...new Set([...days, key])];
  } else {
    days = days.filter((d) => d !== key);
  }
  await setSetting("streak-days", days);

  return { doneIds: next, streak: streakState(days) };
}