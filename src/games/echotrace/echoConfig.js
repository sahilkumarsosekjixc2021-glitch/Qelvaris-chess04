/*
 * ECHO-TRACE configuration. Every rule of the mode lives here, so you can
 * tune visibility, hints, footprints and the knight rule without touching UI code.
 */
export const PIECE_NAMES = { p: "Pawn", r: "Rook", b: "Bishop", n: "Knight", q: "Queen", k: "King" };
export const PIECE_GLYPH = { p: "\u2659", r: "\u2656", b: "\u2657", n: "\u2658", q: "\u2655", k: "\u2654" };

/* Footprint ageing is counted in plies (half-moves) since the opponent moved.
 * age 0 = fresh, then fading, then almost gone, then removed. */
const STAGES = [
  { name: "fresh", maxAge: 0, opacity: 1, glow: 1 },
  { name: "fading", maxAge: 1, opacity: 0.55, glow: 0.4 },
  { name: "faint", maxAge: 2, opacity: 0.2, glow: 0.05 },
];

export const ECHO_CONFIG = {
  visibility: {
    showOwnPieces: true,
    showOpponentPieces: false, // set true only for debugging
    revealOnGameOver: true,
  },

  /* "ownBoard": hints are computed on a board that only contains YOUR pieces,
   *             so they never leak where hidden enemy pieces stand. The real
   *             board then accepts or rejects the attempt (Kriegspiel style).
   * "exact"   : true legal moves (leaks blockers and pins). */
  hints: "ownBoard",

  autoPromote: "q",
  announceCheck: true, // tell the player when a king is in check
  historyRevealsSquares: false, // echo history shows piece sound only, never squares
  soundReveal: true, // indicator names the piece type of the detected sound

  /* Normal piece footprints (pawn, rook, bishop, queen, king) */
  footprints: {
    showOrigin: true,
    showPath: true,
    showLanding: true,
    stages: STAGES,
  },

  /* SPECIAL KNIGHT RULE: edit only this block to change how knights leave echoes.
   * A knight jumps, so it leaves no trail: only a jump arc plus origin and landing rings.
   * The arc is visible only in the listed stages, the landing ring vanishes earlier. */
  knight: {
    showOrigin: true,
    showPath: false,
    showLanding: true,
    showArc: true,
    arcStages: ["fresh"],
    landingStages: ["fresh", "fading"],
    stages: STAGES,
  },

  messages: {
    rejected: "Move rejected by the real board. Try something else.",
    yourCheck: "Your king is under attack!",
    theirCheck: "Opponent king is in check.",
  },
};