// Onboarding logic (pure). Level + goal -> the first thing a new player should do.
export const LEVELS = ["beginner", "improving", "experienced"];
export const GOALS = ["tactics", "openings", "endgames", "play"];

// Returns { type: "lesson", course, lesson } or { type: "page", page }
export function firstStep(level, goal) {
  if (level === "beginner") return { type: "lesson", course: "basics", lesson: "values" };
  if (goal === "tactics") return { type: "lesson", course: "tactics", lesson: "forks" };
  if (goal === "openings") return { type: "lesson", course: "opening", lesson: "centre" };
  if (goal === "endgames") return { type: "lesson", course: "endgame", lesson: "promote" };
  if (goal === "play") return { type: "page", page: "Play" };
  return { type: "lesson", course: "basics", lesson: "values" };
}
