// Qelvaris Middlegames — lessons ko chess.js se verify karke FEN/UCI ke saath banata hai.
// Illegal chaal mili toh wo lesson skip hota hai (warning milti hai) — app crash nahi hota.

import { Chess } from "chess.js";
import { MIDDLEGAMES } from "./middlegameData";

function label(fenBefore, san) {
  const parts = fenBefore.split(" ");
  const num = Number(parts[5]) || 1;
  return parts[1] === "w" ? `${num}.${san}` : `${num}…${san}`;
}

export function buildMiddlegames() {
  const list = [];
  const warnings = [];

  for (const mg of MIDDLEGAMES) {
    const chess = new Chess();
    let ok = true;

    for (const san of mg.line.split(" ")) {
      try {
        if (!chess.move(san)) throw new Error("illegal");
      } catch {
        ok = false;
        warnings.push(`${mg.id}: illegal move "${san}" in line`);
        break;
      }
    }
    if (!ok) continue;

    const startFen = chess.fen();
    const turn = chess.turn() === "w" ? "white" : "black";
    if (turn !== mg.side) {
      warnings.push(`${mg.id}: side to move is ${turn}, lesson says ${mg.side}`);
      continue;
    }

    const steps = [];
    for (const step of mg.steps) {
      const fenBefore = chess.fen();
      const by = chess.turn() === (mg.side === "white" ? "w" : "b") ? "user" : "opp";
      let played = null;
      try {
        played = chess.move(step.san);
      } catch {
        played = null;
      }
      if (!played) {
        ok = false;
        warnings.push(`${mg.id}: illegal step "${step.san}"`);
        break;
      }
      steps.push({
        san: played.san,
        why: step.why,
        by,
        uci: played.from + played.to + (played.promotion || ""),
        from: played.from,
        to: played.to,
        fenBefore,
        fenAfter: chess.fen(),
        label: label(fenBefore, played.san),
      });
    }
    if (!ok) continue;

    list.push({ ...mg, startFen, steps });
  }

  return { list, warnings };
}

let CACHE = null;
export function getMiddlegames() {
  if (!CACHE) {
    try {
      CACHE = buildMiddlegames();
      if (CACHE.warnings.length) console.warn("[Middlegames] skipped:", CACHE.warnings);
    } catch (err) {
      console.error("[Middlegames] build failed:", err);
      CACHE = { list: [], warnings: [String(err)] };
    }
  }
  return CACHE;
}

export const getMiddlegame = (id) => getMiddlegames().list.find((m) => m.id === id) || null;
export const middlegamesFor = (opening) => getMiddlegames().list.filter((m) => m.opening === opening);
