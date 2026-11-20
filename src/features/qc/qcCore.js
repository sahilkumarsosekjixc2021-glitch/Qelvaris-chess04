// QC (Qelvaris Credits): saare rules aur store ka saaman yahan. Koi storage/React nahi.
// Numbers badalne hon toh sirf yahin badlo.

export const STEP_REWARD = 10; // Today ka har step (fix / review / mission)
export const PERFECT_BONUS = 20; // aaj ke saare steps poore
export const milestoneReward = (days) => days * 3; // 3-din streak = 30 QC, 7 = 21 ...

export const MAX_BOUGHT_FREEZES = 3; // store se kul itne extra freeze

export const WEEKLY_MISSIONS = [
  { id: "active5", title: "Be active on 5 days this week", target: 5, reward: 40, source: "days" },
  { id: "perfect2", title: "Complete every step on 2 days this week", target: 2, reward: 50, source: "perfect" },
];

export const DAILY_STEPS = [
  { id: "fix", title: "Fix: solve your Leak Lab positions", goTo: "Leak Lab" },
  { id: "review", title: "Review: study one turning point", goTo: "Review" },
  { id: "mission", title: "Mission: finish today's game mission", goTo: "Play" },
];

export const ITEMS = [
  {
    id: "freeze",
    kind: "freeze",
    name: "Streak Freeze",
    glyph: "❄",
    price: 100,
    blurb: "Saves your streak if you miss a day. Max 3 from the store.",
  },
  { id: "badge-pawn", kind: "badge", name: "Pawn", glyph: "♙", price: 60, blurb: "Small badge next to your QC." },
  { id: "badge-knight", kind: "badge", name: "Knight", glyph: "♘", price: 120, blurb: "For players who find the odd move." },
  { id: "badge-rook", kind: "badge", name: "Rook", glyph: "♖", price: 200, blurb: "Solid and hard to break." },
  { id: "badge-queen", kind: "badge", name: "Queen", glyph: "♕", price: 400, blurb: "The rarest badge for now." },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;

export function badgeGlyph(id) {
  const it = itemById(id);
  return it && it.kind === "badge" ? it.glyph : "";
}

// Hafte ke (Mon-Sun) kitne din active / perfect hue, daily key list se
export function weekProgress(dayKeys, perfectKeys, weekDays) {
  const set = new Set(weekDays);
  const count = (list) => (Array.isArray(list) ? new Set(list.filter((k) => set.has(k))).size : 0);
  return { days: count(dayKeys), perfect: count(perfectKeys) };
}
