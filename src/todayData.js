// Today page ka data layer.
// Plan aur leak score ab asli hain: leaks.js ke reviewed games se. Koi game review nahi hui toh SAMPLE dikhta hai.

import { Chess } from "chess.js";
import { dbAll, getSetting, setSetting } from "./storage";
import { computeLeaks, inWindow, loadReviewedGames } from "./leaks";
import { SOURCE_LABELS, sourceKey } from "./gamesData";
import { computeStreak, weekView } from "./features/streak/streakCore"; // QV-STREAK
import { awardDetailed, readBonusFreezes } from "./features/qc/qcStore"; // QV-QC
import { celebrate } from "./features/celebrate/celebrate"; // QV-CELEBRATE
import { track } from "./features/telemetry/track"; // QV-TRACK
import { PERFECT_BONUS, STEP_REWARD, milestoneReward } from "./features/qc/qcCore"; // QV-QC

export const STREAK_MIN_STEPS = 3; // default; asli threshold aaj ke plan ke steps hain (neeche total)

export const SAMPLE_FEN = "r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5";

// Local date (India), UTC nahi, warna raat 12 ke aas-paas din galat ginega
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

// QV-STREAK: hisaab ab features/streak/streakCore.js mein hai (freeze, milestones, week view).
function streakState(days, bonus = 0) {
  return { ...computeStreak(days, new Date(), bonus), week: weekView(days, new Date(), bonus) };
}

// Badge (topbar) aur Today dono isse streak padhte hain
export async function loadStreak() {
  const [days, bonus] = await Promise.all([readStreakDays(), readBonusFreezes()]);
  return streakState(days, bonus);
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

  const [row, streakDays, lastGame, bonusFreezes] = await Promise.all([
    readRow(key),
    readStreakDays(),
    getLastGame(records),
    readBonusFreezes(),
  ]);

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
    streak: streakState(streakDays, bonusFreezes),
  };
}

// QV-COACH: Coach drills jaise kaam bhi din ko "active" ginte hain (streak badhti hai), bina daily-plan ka step tick kiye.
export async function markDayActive() {
  const key = dateKey();
  const days = await readStreakDays();
  if (days.includes(key)) return;
  const next = [...new Set([...days, key])];
  await setSetting("streak-days", next);
  const streak = streakState(next, await readBonusFreezes());
  try {
    window.dispatchEvent(new CustomEvent("qelvaris-streak-changed", { detail: streak }));
  } catch {
    /* ignore */
  }
}

// Dusre pages (Leak Lab, Review, Play) session poora hone par ye call karenge:
//   import { setStepDone } from "./todayData";  await setStepDone("fix", true);
export async function setStepDone(stepId, done = true) {
  const key = dateKey();
  const row = await readRow(key);
  const next = done ? [...new Set([...row.done, stepId])] : row.done.filter((id) => id !== stepId);
  await setSetting(`today-${key}`, { done: next, total: row.total });

  // QV-STREAK: koi bhi 1 step = din active. Teeno poore = "perfect day" (alag list, bonus ke liye).
  let days = await readStreakDays();
  if (next.length >= 1) {
    days = [...new Set([...days, key])];
  } else {
    days = days.filter((d) => d !== key);
  }
  await setSetting("streak-days", days);

  const perfect = await getSetting("streak-perfect", []);
  const perfectList = Array.isArray(perfect) ? perfect : [];
  const isPerfect = row.total > 0 && next.length >= row.total;
  const nextPerfect = isPerfect
    ? [...new Set([...perfectList, key])]
    : perfectList.filter((d) => d !== key);
  await setSetting("streak-perfect", nextPerfect);

  const streak = streakState(days, await readBonusFreezes());

  // QV-QC: QC rewards (har reward ek din/step ke liye sirf ek baar, dobara tick karne se nahi milta)
  let qcEarned = 0;
  if (done) {
    const entries = [{ id: `step:${key}:${stepId}`, amount: STEP_REWARD, reason: `Completed a daily step (${stepId})` }];
    if (isPerfect) entries.push({ id: `perfect:${key}`, amount: PERFECT_BONUS, reason: "All of today's steps done" });
    if (streak.hitMilestone) {
      entries.push({
        id: `ms:${streak.hitMilestone}:${key}`,
        amount: milestoneReward(streak.hitMilestone),
        reason: `${streak.hitMilestone}-day streak milestone`,
      });
    }
    try {
      const { gained, granted } = await awardDetailed(entries);
      qcEarned = gained;
      const got = new Set(granted);
      if (got.has(`step:${key}:${stepId}`)) track("step_done", { step: stepId, perfect: isPerfect, streak: streak.count });
      if (streak.hitMilestone && got.has(`ms:${streak.hitMilestone}:${key}`)) track("streak_milestone", { days: streak.hitMilestone });

      // QV-CELEBRATE: sabse bada moment ek hi celebration dikhao
      if (streak.hitMilestone && got.has(`ms:${streak.hitMilestone}:${key}`)) {
        celebrate({
          kind: "milestone",
          title: `${streak.hitMilestone}-day streak!`,
          sub: "You kept showing up. That is how rating gets built.",
          qc: gained,
        });
      } else if (got.has(`perfect:${key}`)) {
        celebrate({
          kind: "perfect",
          title: "Perfect day!",
          sub: "Every step done. See you tomorrow.",
          qc: gained,
        });
      } else if (got.has(`step:${key}:${stepId}`)) {
        celebrate({
          kind: streak.count === 1 && days.length === 1 ? "start" : "step",
          title: streak.count === 1 && days.length === 1 ? "Streak started!" : "Step complete",
          sub: streak.count === 1 && days.length === 1 ? "Day 1. Come back tomorrow to keep it going." : "Nice work. Keep going.",
          qc: gained,
        });
      }
    } catch (error) {
      console.error("QC award failed:", error);
    }
  }

  // Topbar badge ko batao ki streak badli
  try {
    window.dispatchEvent(new CustomEvent("qelvaris-streak-changed", { detail: streak }));
  } catch {
    /* ignore */
  }

  return { doneIds: next, streak, perfectToday: isPerfect, qcEarned };
}
