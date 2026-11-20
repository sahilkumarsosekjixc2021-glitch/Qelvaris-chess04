// Qelvaris Practice — match ke baad ka review.
// Har user-move se pehle engine (MultiPV 3) chalta hai, phir chali hui chaal ko top 3 se milaya jata hai.
// Saari numbers engine se aati hain; explanation sirf unhi numbers par based simple text hai
// (concept-level explanation abhi nahi banti).

import { Chess } from "chess.js";
import { analyzePosition } from "../study/studyEngine";
import { lineToCp } from "../study/studyScoring";

export const REVIEW_VERSION = 1;
const REVIEW_DEPTH = 10;
const MATE_CP = 10000;

export const KIND = {
  great: "Only move",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

function kindFor(loss) {
  if (loss >= 250) return "blunder";
  if (loss >= 100) return "mistake";
  if (loss >= 50) return "inaccuracy";
  return "good";
}

export function uciToSan(fen, uci) {
  try {
    const chess = new Chess(fen);
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
    return m ? m.san : uci;
  } catch {
    return uci;
  }
}

export function moveNumberLabel(fenBefore, san) {
  const parts = fenBefore.split(" ");
  const num = Number(parts[5]) || 1;
  return parts[1] === "w" ? `${num}.${san}` : `${num}…${san}`;
}

// session.moves = [{ uci, san, by: "user"|"ai" }]
export async function reviewSession(session, onProgress, engineName = "") {
  const userColor = session.userSide === "white" ? "w" : "b";
  const chess = new Chess(session.startFen);
  const steps = [];

  for (const m of session.moves) {
    const fenBefore = chess.fen();
    const played = chess.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci.slice(4, 5) || undefined });
    if (m.by === "user") {
      steps.push({
        fenBefore,
        fenAfter: chess.fen(),
        uci: m.uci,
        san: played.san,
        afterMate: chess.isCheckmate(),
        afterOver: chess.isGameOver(),
      });
    }
  }

  // Start evaluation (user ke nazariye se)
  let startEvalCp = null;
  try {
    const start = await analyzePosition(session.startFen, { multipv: 1, depth: REVIEW_DEPTH });
    if (start.lines.length) {
      const cp = lineToCp(start.lines[0]);
      startEvalCp = new Chess(session.startFen).turn() === userColor ? cp : -cp;
    }
  } catch {
    startEvalCp = null;
  }

  const moves = [];

  for (let i = 0; i < steps.length; i += 1) {
    onProgress?.(i + 1, steps.length);
    const step = steps[i];
    const root = await analyzePosition(step.fenBefore, { multipv: 3, depth: REVIEW_DEPTH });
    const lines = root.lines;
    if (!lines.length) continue;

    const bestCp = lineToCp(lines[0]);
    const idx = lines.findIndex((l) => l.pv[0] === step.uci);
    let playedCp;

    if (idx >= 0) {
      playedCp = lineToCp(lines[idx]);
    } else if (step.afterMate) {
      playedCp = MATE_CP;
    } else if (step.afterOver) {
      playedCp = 0;
    } else {
      const after = await analyzePosition(step.fenAfter, { multipv: 1, depth: REVIEW_DEPTH });
      playedCp = after.lines.length ? -lineToCp(after.lines[0]) : 0;
    }

    const loss = Math.max(0, bestCp - playedCp);
    let kind = kindFor(loss);
    const second = lines[1] ? lineToCp(lines[1]) : null;
    const onlyMove = idx === 0 && second !== null && bestCp - second >= 150;
    if (onlyMove) kind = "great";

    moves.push({
      label: moveNumberLabel(step.fenBefore, step.san),
      fenBefore: step.fenBefore,
      uci: step.uci,
      san: step.san,
      bestUci: lines[0].pv[0],
      bestSan: uciToSan(step.fenBefore, lines[0].pv[0]),
      topSans: lines.map((l) => uciToSan(step.fenBefore, l.pv[0])),
      inTop3: idx >= 0,
      isBest: idx === 0,
      bestCp,
      playedCp,
      loss,
      kind,
      thrownAdvantage: bestCp >= 150 && playedCp < 50,
      missedMate: bestCp >= 9000 && playedCp < 9000,
    });
  }

  return { version: REVIEW_VERSION, depth: REVIEW_DEPTH, engine: engineName, startEvalCp, moves, summary: summarize(session, moves, startEvalCp, engineName) };
}

export function fmtEval(cp) {
  if (cp === null || cp === undefined) return "–";
  if (Math.abs(cp) >= 9000) return cp > 0 ? "mate for you" : "mate against you";
  const v = (cp / 100).toFixed(2);
  return cp > 0 ? `+${v}` : v;
}

function summarize(session, moves, startEvalCp, engineName) {
  const analysed = moves.length;
  const counts = { great: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const m of moves) counts[m.kind] += 1;

  const top3 = moves.filter((m) => m.inTop3).length;
  const top1 = moves.filter((m) => m.isBest).length;
  const avgLoss = analysed ? Math.round(moves.reduce((sum, m) => sum + Math.min(m.loss, 500), 0) / analysed) : null;

  const critical = [...moves].filter((m) => m.loss >= 100).sort((a, b) => b.loss - a.loss).slice(0, 3);
  const bestMoves = moves.filter((m) => m.kind === "great").slice(0, 3);

  const result = session.result;
  let objective = "not_met";
  if (session.objective === "convert_advantage") objective = result === "user_win" ? "met" : result === "draw" ? "partly" : "not_met";
  else if (session.objective === "defend") objective = result === "user_loss" ? "not_met" : "met";
  else objective = result === "user_win" ? "met" : result === "draw" ? "partly" : "not_met";

  const top3Pct = analysed ? Math.round((top3 / analysed) * 100) : null;
  const top1Pct = analysed ? Math.round((top1 / analysed) * 100) : null;

  const opinion = [];
  const resultText = { user_win: "You won this game.", user_loss: "You lost this game.", draw: "The game was drawn." }[result];
  if (resultText) opinion.push(resultText);

  if (top3Pct !== null) {
    const feel =
      top3Pct >= 70
        ? "Most of your moves matched the engine's top 3."
        : top3Pct >= 50
          ? "More than half of your moves matched the engine's top 3."
          : top3Pct >= 30
            ? "Less than half of your moves matched the engine's top 3."
            : "Few of your moves matched the engine's top 3.";
    opinion.push(`${feel} (${top3} of ${analysed}, ${top3Pct}%).`);
  }

  if (counts.blunder + counts.mistake > 0) {
    const worst = critical[0];
    if (worst) {
      opinion.push(
        `Your costliest moment was ${worst.label}: the engine preferred ${worst.bestSan}.${worst.missedMate ? " That was a missed mate." : worst.thrownAdvantage ? " That move gave away a clear advantage." : ""}`
      );
    }
    opinion.push("Before every move, check the opponent's checks, captures and threats. Most big swings start there.");
  } else if (analysed) {
    opinion.push("You made no serious mistakes. That is the hardest part of middlegame play.");
  }

  if (counts.great > 0) opinion.push(`You found ${counts.great} difficult ${counts.great === 1 ? "move" : "moves"} where the alternatives were clearly worse.`);

  if (session.objective === "defend" && result === "user_loss" && avgLoss !== null && avgLoss < 60) {
    opinion.push("A loss in a worse position can still be good defence. Your accuracy was high.");
  }

  if (session.hints > 0) {
    opinion.push(`You used ${session.hints} ${session.hints === 1 ? "hint" : "hints"}. Try the next game with fewer.`);
  }

  opinion.push(
    counts.blunder + counts.mistake >= 2
      ? "Next: try Middlegame Lab exercises and focus on candidate moves and the opponent's best reply."
      : "Next: try another position, or a harder engine level."
  );
  if (engineName && engineName !== "Stockfish") {
    opinion.push(`The analysis was done by the ${engineName.toLowerCase()}, which is much weaker than Stockfish, so some "mistakes" may be wrong.`);
  }
  opinion.push("This is one game analysed at a modest depth, so treat it as a guide and not a rating.");

  return { analysed, counts, top3, top3Pct, top1Pct, avgLoss, critical, bestMoves, objective, startEvalCp, opinion };
}
