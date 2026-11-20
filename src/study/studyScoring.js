// Qelvaris Study — scoring (pure functions, engine ka data input mein aata hai).
// Metrics alag alag rakhe gaye hain, ek percentage mein nahi milaaye.
// Thresholds yahin likhe hain taaki baad mein tune kar sako (ye validated rating nahi hain).

export const THRESHOLDS = {
  // centipawns (white ke nazariye se) -> 5 level band
  clearlyBetter: 150,
  slightlyBetter: 50,
  // candidate ki quality: best move se kitna nuksaan (centipawns)
  reasonableLoss: 30,
  inaccurateLoss: 100,
};

const MATE_CP = 10000;

// score ko centipawns mein badlo (side-to-move nazariya same rehta hai)
export function lineToCp(line) {
  if (!line) return null;
  if (line.scoreType === "mate") {
    const sign = line.score >= 0 ? 1 : -1;
    return sign * (MATE_CP - Math.min(Math.abs(line.score), 999));
  }
  return line.score;
}

export function cpToLevel(whiteCp) {
  if (whiteCp >= THRESHOLDS.clearlyBetter) return "white_better";
  if (whiteCp >= THRESHOLDS.slightlyBetter) return "slight_white";
  if (whiteCp > -THRESHOLDS.slightlyBetter) return "equal";
  if (whiteCp > -THRESHOLDS.clearlyBetter) return "slight_black";
  return "black_better";
}

const LEVEL_ORDER = ["white_better", "slight_white", "equal", "slight_black", "black_better"];

// 100 = bilkul sahi band, 50 = ek band door, 0 = zyada door
export function evaluationUnderstanding(userLevel, whiteCp) {
  if (!userLevel || whiteCp === null) return null;
  const gap = Math.abs(LEVEL_ORDER.indexOf(userLevel) - LEVEL_ORDER.indexOf(cpToLevel(whiteCp)));
  return gap === 0 ? 100 : gap === 1 ? 50 : 0;
}

export function classifyLoss(loss) {
  if (loss <= THRESHOLDS.reasonableLoss) return "reasonable";
  if (loss <= THRESHOLDS.inaccurateLoss) return "inaccurate";
  return "mistake";
}

/*
  Input:
    root     = { lines: [...] }   engine analysis, starting position (mover ke nazariye se)
    cands    = [{ uci, san, after: { lines: [...] }, expectedReplyUci }]
              after = candidate ke BAAD ki position ka analysis (opponent ke nazariye se)
    turn     = "w" | "b"  (starting position mein kiski chaal)
    userEval = user ka assessment level id
  Output: { rootBestCp, whiteCp, evalScore, candidates: [...], candidateQuality, opponentRealism }
*/
export function scoreAttempt({ root, cands, turn, userEval }) {
  const rootBestCp = lineToCp(root.lines[0]);
  const whiteCp = turn === "w" ? rootBestCp : -rootBestCp;
  const topMoves = root.lines.map((l) => l.pv?.[0]).filter(Boolean);

  const candidates = cands.map((c) => {
    const afterBest = lineToCp(c.after?.lines?.[0]);
    const candCp = afterBest === null ? null : -afterBest; // mover ke nazariye se
    const loss = candCp === null ? null : Math.max(0, rootBestCp - candCp);
    const replies = (c.after?.lines || []).map((l) => l.pv?.[0]).filter(Boolean);
    return {
      uci: c.uci,
      san: c.san,
      inEngineTop3: topMoves.includes(c.uci),
      candCp,
      loss,
      verdict: loss === null ? null : classifyLoss(loss),
      engineReplyUci: replies[0] || null,
      replyInTop3: c.expectedReplyUci ? replies.includes(c.expectedReplyUci) : null,
    };
  });

  const judged = candidates.filter((c) => c.loss !== null);
  const best = judged.length ? Math.min(...judged.map((c) => c.loss)) : null;

  const candidateQuality =
    best === null
      ? null
      : best <= THRESHOLDS.reasonableLoss
        ? 100
        : best <= THRESHOLDS.inaccurateLoss
          ? 50
          : 0;

  const replyChecked = candidates.filter((c) => c.replyInTop3 !== null);
  const opponentRealism = replyChecked.length
    ? Math.round((replyChecked.filter((c) => c.replyInTop3).length / replyChecked.length) * 100)
    : null;

  return {
    rootBestCp,
    whiteCp,
    evalScore: evaluationUnderstanding(userEval, whiteCp),
    candidates,
    candidateQuality,
    opponentRealism,
    engineTop: topMoves,
  };
}
