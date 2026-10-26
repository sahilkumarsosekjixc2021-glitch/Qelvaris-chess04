// Settings ka data layer.
// Har setting storage.js ke "settings" store mein save hoti hai:
//   "board-theme"    -> "default" | "slate" | "sand" | "midnight"   (Board ke rang, turant apply hote hain)
//   "language"       -> "en" | "hi"                                  (Review page padh sakta hai: getSetting("language", "en"))
//   "analysis-depth" -> 8 | 10 | 14 | 18                             (engine.js padh sakta hai: getSetting("analysis-depth", 10))

import { getSetting, setSetting } from "./storage";

export const BOARD_THEMES = [
  { id: "default", label: "Default", vars: null },
  { id: "slate", label: "Slate", vars: { light: "#d7dde6", dark: "#7b8ba3", highlight: "rgba(255, 214, 102, 0.45)" } },
  { id: "sand", label: "Sand", vars: { light: "#f0d9b5", dark: "#b58863", highlight: "rgba(255, 214, 102, 0.5)" } },
  { id: "midnight", label: "Midnight", vars: { light: "#8c9bb5", dark: "#3f4b63", highlight: "rgba(78, 204, 163, 0.35)" } },
];

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
];

export const DEPTHS = [8, 10, 14, 18];

export function applyBoardTheme(id) {
  const root = document.documentElement;
  const names = ["--board-light", "--board-dark", "--board-highlight"];
  for (const name of names) root.style.removeProperty(name);

  const theme = BOARD_THEMES.find((t) => t.id === id);
  if (!theme || !theme.vars) return; // "default": theme.css ke apne rang

  root.style.setProperty("--board-light", theme.vars.light);
  root.style.setProperty("--board-dark", theme.vars.dark);
  root.style.setProperty("--board-highlight", theme.vars.highlight);
}

// App start par ek baar call hota hai, taaki chuni hui theme har page par lage
export async function applySavedSettings() {
  try {
    applyBoardTheme(await getSetting("board-theme", "default"));
  } catch (error) {
    console.error("Could not apply settings:", error);
  }
}

export async function loadSettings() {
  const [boardTheme, language, depth] = await Promise.all([
    getSetting("board-theme", "default"),
    getSetting("language", "en"),
    getSetting("analysis-depth", 10),
  ]);
  return { boardTheme, language, depth };
}

export function saveSetting(key, value) {
  return setSetting(key, value);
}

/* ---------- Plans (sirf dikhane ke liye, payment abhi nahi) ---------- */

export const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: "₹0",
    yearly: "₹0",
    per: "forever",
    features: ["Bot play and missions", "10 reviews a month", "Last 20 games", "Top finding only"],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: "₹199",
    yearly: "₹1,499",
    per: "month",
    features: ["Everything in Free", "All leaks and trends", "500 games, auto-sync", "Unlimited Leak Lab"],
  },
  {
    id: "elite",
    name: "Elite",
    monthly: "₹399",
    yearly: "₹2,999",
    per: "month",
    features: ["Everything in Pro", "Opponent prep", "Gap-finder and deep analysis", "Monthly progress PDF"],
  },
];