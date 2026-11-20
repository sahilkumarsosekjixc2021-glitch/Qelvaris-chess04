// Free vs Pro rules (pure, no browser). The plan lives in docs/paywall-plan.md.
export const LIMITS = {
  reviewsPerDay: 2,      // different games opened in Review per day
  puzzlesPerDay: 5,      // Leak Lab > Puzzles
  practicePerDay: 5,     // Openings > Practice
  repertoireMax: 3,      // Openings > Repertoire
  middlegameFree: 5,     // first N Middlegame Lab lessons
  topLeaks: 3,           // leaks a free player can open
  dnaDays: 30,           // DNA history window
};

// What the upgrade card can talk about
export const PRO_REASONS = ["reviews", "explore", "rule", "leaks", "puzzles", "analysis", "dna", "repertoire", "middlegame", "practice", "accounts", "autobackup"];

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- daily "different items opened" (Review games) ----
// usage = { day, ids: [] }. Reopening an item already counted today is always allowed.
export function openItem(usage, id, limit, day = dayKey()) {
  const u = usage && usage.day === day && Array.isArray(usage.ids) ? usage : { day, ids: [] };
  if (u.ids.includes(id)) return { allowed: true, usage: u };
  if (u.ids.length >= limit) return { allowed: false, usage: u };
  return { allowed: true, usage: { day, ids: [...u.ids, id] } };
}

// ---- daily counters (puzzles, practice) ----
// usage = { day, n }
export function countToday(usage, day = dayKey()) {
  return usage && usage.day === day ? Number(usage.n) || 0 : 0;
}
export function canCount(usage, limit, day = dayKey()) {
  return countToday(usage, day) < limit;
}
export function addCount(usage, day = dayKey()) {
  return { day, n: countToday(usage, day) + 1 };
}

// ---- leaks ----
// leaks: [{ id, points }] -> ids a free player may open (the most costly ones)
export function freeLeakIds(leaks, n = LIMITS.topLeaks) {
  return new Set([...(leaks || [])].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, n).map((l) => l.id));
}
export const leakLocked = (id, freeIds, pro) => !pro && !freeIds.has(id);

// ---- other simple rules ----
export const lessonLocked = (index, pro) => !pro && index >= LIMITS.middlegameFree;
export const repertoireFull = (count, pro) => !pro && count >= LIMITS.repertoireMax;
// Engine levels: "quick" | "normal" | "deep". Free = quick only.
export const depthAllowed = (level, pro) => pro || level === "quick";
export const dnaCutoffMs = (pro, now = Date.now()) => (pro ? 0 : now - LIMITS.dnaDays * 86400000);

// While billing is not configured nobody can buy, so nothing is locked.
export const paywallOn = (billingEnabled) => Boolean(billingEnabled);
