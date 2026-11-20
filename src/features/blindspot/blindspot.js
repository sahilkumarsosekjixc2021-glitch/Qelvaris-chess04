// Blind-Spot Map: pure helpers (no React). Heat = where on the board your mistakes happen.
// Squares are shown from YOUR side: for games played as Black the board is rotated 180 degrees.

const FILES = "abcdefgh";

export function toViewSquare(sq, userColor) {
  if (!sq || sq.length < 2) return null;
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  if (f < 0 || !(r >= 1 && r <= 8)) return null;
  if (userColor === "b") return FILES[7 - f] + (9 - r);
  return sq;
}

// records: from loadReviewedGames(). leakId: "all" or a leak id.
export function computeHeat(records, leakId = "all") {
  const cells = {}; // sq -> { weight, count, examples[] }
  let moves = 0;
  for (const rec of records) {
    for (const m of rec.userMoves || []) {
      if (!m.isError || !m.leak) continue;
      if (leakId !== "all" && m.leak !== leakId) continue;
      const sq = toViewSquare(m.to, m.userColor || rec.userColor);
      if (!sq) continue;
      const w = Math.max(1, Number(m.winLoss) || 1);
      const c = (cells[sq] ||= { weight: 0, count: 0, examples: [] });
      c.weight += w;
      c.count += 1;
      c.examples.push({ label: m.label, san: m.san, loss: Math.round(w), leak: m.leak, gameId: rec.id });
      moves += 1;
    }
  }
  const max = Math.max(0, ...Object.values(cells).map((c) => c.weight));
  for (const c of Object.values(cells)) {
    c.level = max ? c.weight / max : 0;
    c.examples.sort((a, b) => b.loss - a.loss);
  }
  const top = Object.entries(cells).sort((a, b) => b[1].weight - a[1].weight).slice(0, 3).map(([sq]) => sq);
  return { cells, moves, top };
}

// Leak id -> Coach lesson (same mapping the Coach's pick uses)
export const TRAIN_MAP = {
  hanging: ["basics", "hanging"],
  "missed-tactics": ["tactics", "forks"],
  "back-rank": ["tactics", "backrank"],
  "opening-gaps": ["opening", "develop"],
  "endgame-conversion": ["endgame", "promote"],
};

export const COACH_OPEN_KEY = "qv-coach-open";

export function requestCoachLesson(leakId) {
  const m = TRAIN_MAP[leakId];
  if (!m) return false;
  try { sessionStorage.setItem(COACH_OPEN_KEY, JSON.stringify({ courseId: m[0], lessonId: m[1] })); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: "Coach" }));
  return true;
}

export function takeCoachLessonRequest() {
  try {
    const raw = sessionStorage.getItem(COACH_OPEN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(COACH_OPEN_KEY);
    return JSON.parse(raw);
  } catch { return null; }
}

// DNA skill id -> Leak Lab leak id (to reuse TRAIN_MAP)
export const SKILL_TO_LEAK = {
  tactics: "missed-tactics",
  openings: "opening-gaps",
  endgames: "endgame-conversion",
  converting: "endgame-conversion",
  defence: "hanging",
};
