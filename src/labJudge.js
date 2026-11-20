// QV-LABFIX: Leak Lab mein "engine ka pehla move hi sahi" wali sakhti hatane ke liye.
// User ka move best se alag ho toh engine se dono positions ki taqat napte hain (same depth par):
// agar user ka move best se kam se kam utna hi achha hai (ya dono clearly winning), toh sahi maana jaata hai.
import { Chess } from "chess.js";
import { getEngine } from "./engine2";

export const DEPTH = 12;
export const TOLERANCE_CP = 40; // best se itna kam (0.4 pawn) tak chalega
export const WIN_CP = 600; // dono moves isse upar = dono jeet wali position
const CAP = 1000;
const TIMEOUT_MS = 12000;

const cache = new Map();

// engine ki line (White ke hisaab se cp/mate) ko "chalne wale" ke hisaab se score mein badlo
export function moverScore(line, mover) {
  const sign = mover === "w" ? 1 : -1;
  if (line && line.mate !== null && line.mate !== undefined) {
    return line.mate * sign > 0 ? CAP : -CAP;
  }
  const cp = line && typeof line.cp === "number" ? line.cp : 0;
  return Math.max(-CAP, Math.min(CAP, cp * sign));
}

export function decide(refScore, userScore) {
  const loss = Math.max(0, refScore - userScore);
  const bothWinning = refScore >= WIN_CP && userScore >= WIN_CP;
  return { accept: loss <= TOLERANCE_CP || bothWinning, loss };
}

function applyMove(fen, uci) {
  const chess = new Chess(fen);
  const move = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  });
  return move ? chess : null;
}

async function scoreAfter(fen, uci, mover) {
  const key = `${fen}|${uci}`;
  if (cache.has(key)) return cache.get(key);

  const chess = applyMove(fen, uci);
  if (!chess) return null;

  let score;
  if (chess.isCheckmate()) score = CAP;
  else if (chess.isDraw() || chess.isStalemate()) score = 0;
  else {
    let best = null;
    const done = await getEngine().analyse(chess.fen(), {
      depth: DEPTH,
      multipv: 1,
      onUpdate: (lines) => {
        if (lines && lines[0]) best = lines[0];
      },
    });
    if (!done || !best) return null; // beech mein cancel ho gaya
    score = moverScore(best, mover);
  }

  cache.set(key, score);
  return score;
}

/* Returns { status: "accept" | "reject" | "unknown", loss } */
export async function judgeMove({ fen, uci, best }) {
  const mover = fen.split(" ")[1] || "w";

  const run = (async () => {
    const user = await scoreAfter(fen, uci, mover);
    const ref = await scoreAfter(fen, best, mover);
    if (user === null || ref === null) return { status: "unknown", loss: 0 };
    const { accept, loss } = decide(ref, user);
    return { status: accept ? "accept" : "reject", loss };
  })();

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve({ status: "unknown", loss: 0 }), TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([run, timeout]);
    if (result.status === "unknown") {
      try {
        getEngine().cancel();
      } catch {
        /* ignore */
      }
    }
    return result;
  } catch {
    return { status: "unknown", loss: 0 };
  }
}
