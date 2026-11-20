// Qelvaris Study — engine adapter.
// Study Lab aur Practice isi se engine use karte hain. Asli kaam engineBridge.js / uciEngine.js mein hota hai.
//
//   initEngine()                  -> Promise<boolean>   engine mila aur chal raha hai?
//   analyzePosition(fen, opts)    -> Promise<{ depth, lines: [{ multipv, scoreType, score, pv }] }>
//   score hamesha SIDE-TO-MOVE ke nazariye se (positive = jiski chaal hai uske liye accha).
//   scoreType "mate": score = mate ki doori.

import { cachedAnalyze, getEngine } from "./engineBridge";

let override = null;

// Test ya custom engine ke liye: setEngineImpl(async (fen, opts) => ({ depth, lines }))
export function setEngineImpl(fn) {
  override = typeof fn === "function" ? fn : null;
}

export async function initEngine() {
  if (override) return true;
  return Boolean(await getEngine());
}

export async function analyzePosition(fen, options = {}) {
  const opts = { multipv: 3, depth: 12, ...options };
  if (override) return override(fen, opts);
  return cachedAnalyze(fen, opts);
}
