/* Puzzle ka saara data (rating, attempts, review queue, best scores) browser me save hota hai.
   Abhi localStorage hai. Login aane par yehi functions server se jod dena, baaki code nahi badlega. */

const KEY = "qelvaris-puzzles-v1";
const DAY = 86400000;
const BOX_DAYS = [1, 3, 7]; // galat puzzle 1, 3, 7 din baad wapas aata hai
export const DAILY_GOAL = 5;

/* Ye tags tactic nahi hain (sirf phase ya length batate hain), weak themes me nahi ginte */
const NOT_TACTICS = new Set([
  "short", "long", "veryLong", "oneMove", "crushing", "advantage", "equality",
  "opening", "middlegame", "endgame", "master", "masterVsMaster", "superGM",
]);
export const isTactic = (theme) => !NOT_TACTICS.has(theme);

export function prettyTheme(theme) {
  return theme.replace(/([A-Z0-9])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

const fresh = () => ({ rating: 1200, attempts: [], queue: {}, bests: {} });

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
  } catch {
    return fresh();
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full ya band: ignore */
  }
}

const dayKey = (ts) => new Date(ts).toLocaleDateString("en-CA");

/* Ek puzzle ka result save karo. rated=false (Rush/Streak) me rating nahi badalti. */
export function recordAttempt(puzzle, { ok, hints = 0, ms = 0, rated = true }) {
  const state = loadState();
  let delta = 0;

  if (rated) {
    const k = state.attempts.length < 20 ? 48 : 24; // shuru me rating tezi se set hoti hai
    const expected = 1 / (1 + 10 ** ((puzzle.rating - state.rating) / 400));
    delta = Math.round(k * ((ok ? 1 : 0) - expected));
    if (ok && hints) delta = Math.max(0, Math.round(delta * (1 - 0.3 * hints))); // hint se gain kam
    state.rating += delta;
  }

  state.attempts.push({
    id: puzzle.id,
    ts: Date.now(),
    ok,
    ms,
    hints,
    rated,
    themes: puzzle.themes.filter(isTactic),
    after: state.rating,
  });
  if (state.attempts.length > 2000) state.attempts = state.attempts.slice(-2000);

  /* Spaced repetition: galat -> kal wapas. Review me sahi -> agle gap par. 7 din ke baad pass -> queue se hat gaya */
  const inQueue = state.queue[puzzle.id];
  if (!ok) {
    state.queue[puzzle.id] = { box: 0, due: Date.now() + DAY * BOX_DAYS[0] };
  } else if (inQueue) {
    const box = inQueue.box + 1;
    if (box >= BOX_DAYS.length) delete state.queue[puzzle.id];
    else state.queue[puzzle.id] = { box, due: Date.now() + DAY * BOX_DAYS[box] };
  }

  save(state);
  return { delta, rating: state.rating };
}

/* Har theme me kitne try kiye aur kitne solve. Kam se kam `min` attempts wale hi, sabse kamzor pehle. */
export function themeStats(state, min = 5) {
  const map = new Map();
  for (const a of state.attempts) {
    for (const theme of a.themes) {
      const row = map.get(theme) || { theme, tried: 0, solved: 0 };
      row.tried += 1;
      if (a.ok) row.solved += 1;
      map.set(theme, row);
    }
  }
  return [...map.values()]
    .filter((row) => row.tried >= min)
    .map((row) => ({ ...row, pct: Math.round((100 * row.solved) / row.tried) }))
    .sort((a, b) => a.pct - b.pct || b.tried - a.tried);
}

export function dueIds(state, now = Date.now()) {
  return Object.keys(state.queue).filter((id) => state.queue[id].due <= now);
}

export function todayCount(state) {
  const today = dayKey(Date.now());
  return state.attempts.filter((a) => dayKey(a.ts) === today).length;
}

/* Lagatar kitne din kam se kam ek puzzle kiya. Aaj abhi nahi kiya to kal tak streak zinda rehti hai. */
export function dayStreak(state) {
  const days = new Set(state.attempts.map((a) => dayKey(a.ts)));
  let cursor = Date.now();
  if (!days.has(dayKey(cursor))) cursor -= DAY;
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor -= DAY;
  }
  return count;
}

/* Rush/Streak ka best score. true deta hai agar naya record bana. */
export function setBest(mode, score) {
  const state = loadState();
  const record = score > (state.bests[mode] || 0);
  if (record) {
    state.bests[mode] = score;
    save(state);
  }
  return record;
}
