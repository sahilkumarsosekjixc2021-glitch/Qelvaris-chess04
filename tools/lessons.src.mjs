// Lessons ka source. Text chhota rakho. "do"/"tap" ke answers generator engine se nikalta hai (kind se).
const T = (fen, text, o = {}) => ({ t: "teach", fen, text, ...o });
const D = (fen, prompt, kind, o = {}) => ({ t: "do", fen, prompt, kind, ...o });
const P = (fen, prompt, o = {}) => ({ t: "tap", fen, prompt, kind: "hanging", ...o });
const C = (fen, from, to, o = {}) => ({ t: "choice", fen, from, to, prompt: "Take it?", ...o });
const L = (fen, moves, prompt, o = {}) => ({ t: "line", fen, moves, prompt, ...o });
const M2 = (fen, o = {}) => ({ t: "mate2", fen, prompt: "Mate in 2.", ...o });
const E = (fen, prompt, o = {}) => ({ t: "kpkeval", fen, prompt, ...o });
const Q = (prompt, options, answer, why, fen) => ({ t: "quiz", prompt, options, answer, why, fen });

export const COURSES = [
  {
    id: "basics", title: "Foundations", color: "#4fd1c5", icon: "♙", blurb: "Values, safety, check and mate.",
    lessons: [
      {
        id: "values", title: "Piece values", goal: "Know what each piece is worth.",
        steps: [
          T("7k/8/8/8/8/8/PNBRQ3/K7 w - - 0 1", "Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9.", { marks: ["a2", "b2", "c2", "d2", "e2"].map((sq) => ({ sq, kind: "hint" })) }),
          Q("Which is worth more?", ["A rook", "A knight + a bishop"], 1, "Knight + bishop = 6. Rook = 5."),
          Q("They take your knight, you take their pawn. Good trade?", ["Yes", "No"], 1, "You gave 3 and got 1."),
          D("r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/2N2N2/PPPP1PPP/R1BQK2R w - - 0 1", "Win material.", "wins", { why: "A free piece. You gain without losing anything." }),
          D("4k3/8/8/3n4/8/5B2/8/4K3 w - - 0 1", "Win material.", "wins", { why: "Equal piece, but nothing can take back." }),
        ],
      },
      {
        id: "hanging", title: "Free pieces", goal: "Spot pieces that can be taken for free.",
        steps: [
          T("r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/2N2N2/PPPP1PPP/R1BQK2R w - - 0 1", "Hanging = attacked, and nobody protects it.", { marks: [{ sq: "e4", kind: "bad" }], arrows: [{ from: "c3", to: "e4" }] }),
          P("r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/b1N2N2/PPPP1PPP/R1BQK2R w - - 0 1", "Tap the hanging piece."),
          P("r1b1k2r/pp2bppp/2nqpn2/2pp4/3P1B2/2PBPN2/PP3PPP/RN1QK2R w - - 0 1", "Tap the hanging piece."),
          P("r1bqkb1r/pppp1ppp/2n2n2/4N3/2B1P3/2N5/PPPP1PPP/R1BQK2R b - - 0 1", "Tap the hanging piece."),
          D("r1b1k2r/pp2bppp/2nqpn2/2pp4/3P1B2/2PBPN2/PP3PPP/RN1QK2R w - - 0 1", "Take it.", "wins", { why: "Free queen." }),
        ],
      },
      {
        id: "safe", title: "Free or trap?", goal: "Look before you grab.",
        steps: [
          T("4k3/8/8/3n4/8/5B2/8/4K3 w - - 0 1", "Before you capture, ask: can they take back?", { arrows: [{ from: "f3", to: "d5" }] }),
          C("4k3/8/8/3n4/8/5B2/8/4K3 w - - 0 1", "f3", "d5"),
          C("2b1k3/1p6/8/8/8/8/1Q6/4K3 w - - 0 1", "b2", "b7"),
          C("4k3/8/2p5/3n4/4P3/8/8/4K3 w - - 0 1", "e4", "d5"),
          C("4k3/8/3p4/4p3/5B2/8/8/4K3 w - - 0 1", "f4", "e5"),
          C("r3k3/p7/8/8/8/8/8/R3K3 w - - 0 1", "a1", "a7"),
        ],
      },
      {
        id: "mate", title: "Check and mate", goal: "Know check, and finish the game.",
        steps: [
          T("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "Check: the king is attacked.", { play: ["a1a8"], marksAfter: [{ sq: "e8", kind: "bad" }] }),
          T("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "Mate: attacked, and no escape.", { play: ["d1d8"], marksAfter: [{ sq: "g8", kind: "bad" }] }),
          D("6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1", "Mate in 1.", "mate", { why: "Two rooks cover every escape." }),
          D("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", "Mate in 1.", "mate", { why: "Your king guards the queen." }),
          D("k7/8/1K6/8/8/8/8/7R w - - 0 1", "Mate in 1.", "mate", { why: "Your king takes away a7 and b7." }),
        ],
      },
    ],
  },
  {
    id: "tactics", title: "Tactics", color: "#ff7d7d", icon: "⚔", blurb: "Forks, pins, skewers, back-rank.",
    lessons: [
      {
        id: "forks", title: "Forks", goal: "One move, two targets.",
        steps: [
          T("2r1k3/8/8/8/4N3/8/8/4K3 w - - 0 1", "A fork attacks two pieces at once.", { play: ["e4d6"], marksAfter: [{ sq: "e8", kind: "bad" }, { sq: "c8", kind: "bad" }] }),
          Q("A fork attacks...", ["Two or more pieces at once", "Only the king", "Your own pieces"], 0, "They can only save one."),
          D("4k3/8/8/8/3n4/8/8/R3K3 b - - 0 1", "Find the fork.", "fork"),
          D("3q3r/8/8/4N3/8/8/8/4K2k w - - 0 1", "Find the fork.", "fork"),
          D("6k1/6pp/r7/8/8/8/2Q5/6K1 w - - 0 1", "Find the fork.", "fork"),
          D("4k3/8/8/2r1q3/8/3P4/8/3R2K1 w - - 0 1", "Find the fork.", "fork"),
        ],
      },
      {
        id: "pins", title: "Pins", goal: "Freeze a piece against a bigger one.",
        steps: [
          T("4k3/4n3/8/8/8/8/8/R5K1 w - - 0 1", "A pin: the piece cannot move without exposing something bigger.", { play: ["a1e1"], marksAfter: [{ sq: "e7", kind: "hint" }, { sq: "e8", kind: "bad" }] }),
          Q("Why can't the knight move?", ["It would expose the king", "It is too small", "It is tired"], 0, "Moving it leaves the king in check."),
          D("4k3/4n3/8/8/8/8/8/R5K1 w - - 0 1", "Pin the knight.", "pin"),
          D("r5k1/8/8/8/8/8/3N4/3K4 b - - 0 1", "Pin the knight.", "pin"),
          D("4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1", "Pin the knight.", "pin"),
        ],
      },
      {
        id: "skewers", title: "Skewers", goal: "Attack the big piece, win the one behind.",
        steps: [
          T("4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1", "A skewer: the big piece must move, and you take the one behind.", { play: ["a1e1"], marksAfter: [{ sq: "e5", kind: "bad" }, { sq: "e8", kind: "hint" }] }),
          Q("In a skewer, which is attacked first?", ["The bigger piece", "The smaller piece"], 0, "It runs away, then you capture behind it."),
          D("4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1", "Skewer the king.", "skewer"),
          D("r5k1/8/8/8/4K2Q/8/8/8 b - - 0 1", "Skewer the king.", "skewer"),
        ],
      },
      {
        id: "discover", title: "Discovered attacks", goal: "Move one piece, let another attack.",
        steps: [
          T("4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1", "Move the knight: the rook behind it gives check.", { play: ["e4c5"], marksAfter: [{ sq: "e8", kind: "bad" }, { sq: "e1", kind: "hint" }] }),
          Q("In a discovered attack, who gives the check?", ["The piece that did not move", "The piece that moved"], 0, "The moving piece uncovers the line. The one behind it attacks."),
          D("4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1", "Give a discovered check.", "discover", { why: "Any knight move opens the e-file for the rook." }),
          D("4k3/8/8/3q4/4N3/8/8/4R1K1 w - - 0 1", "Win the queen.", "discoverwin", { why: "Check first, so they cannot save the queen." }),
          D("4k3/7q/8/8/4B3/8/8/4R1K1 w - - 0 1", "Win the queen.", "discoverwin", { why: "The bishop moves with a threat, and the rook gives check." }),
          D("4r1k1/8/8/4b3/8/8/7Q/4K3 b - - 0 1", "Win the queen.", "discoverwin", { why: "The rook checks from behind, so the queen cannot escape." }),
        ],
      },
      {
        id: "backrank", title: "Back-rank mate", goal: "Trapped kings fall fast.",
        steps: [
          T("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "The king is boxed in by its own pawns.", { marks: [{ sq: "f7", kind: "hint" }, { sq: "g7", kind: "hint" }, { sq: "h7", kind: "hint" }], play: ["d1d8"], marksAfter: [{ sq: "g8", kind: "bad" }] }),
          D("r5k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "Mate in 1.", "mate"),
          D("2r3k1/5ppp/8/8/8/8/PP3PPP/2R3K1 w - - 0 1", "Mate in 1.", "mate"),
          D("3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", "Mate in 1.", "mate"),
          D("6k1/5ppp/8/3Q4/8/8/5PPP/6K1 w - - 0 1", "Mate in 1.", "mate"),
        ],
      },
      {
        id: "mixed", title: "Spot the tactic", goal: "Mix it all together.",
        steps: [
          D("4k3/8/8/8/3n4/8/8/R3K3 b - - 0 1", "Find the tactic.", "any"),
          D("r5k1/8/8/8/4K2Q/8/8/8 b - - 0 1", "Find the tactic.", "any"),
          D("4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1", "Find the tactic.", "any"),
          D("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "Find the tactic.", "any"),
          D("3q3r/8/8/4N3/8/8/8/4K2k w - - 0 1", "Find the tactic.", "any"),
        ],
      },
    ],
  },
  {
    id: "mates", title: "Checkmates", color: "#b794f4", icon: "♛", blurb: "Finish the game with style.",
    lessons: [
      {
        id: "queenmate", title: "Queen + king", goal: "Your king helps the queen deliver mate.",
        steps: [
          T("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", "The queen is protected by the king, so it cannot be taken.", { marks: [{ sq: "g6", kind: "hint" }, { sq: "f7", kind: "hint" }], play: ["f7g7"], marksAfter: [{ sq: "h8", kind: "bad" }] }),
          D("k7/8/1K6/8/8/8/8/6Q1 w - - 0 1", "Mate in 1.", "mate"),
          D("6k1/8/6K1/8/8/8/8/7Q w - - 0 1", "Mate in 1.", "mate"),
          D("7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", "Mate in 1.", "mate"),
        ],
      },
      {
        id: "smothered", title: "Smothered mate", goal: "A knight mates a king blocked by its own pieces.",
        steps: [
          T("6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", "The king has no squares: its own pieces are in the way.", { play: ["g5f7"], marksAfter: [{ sq: "h8", kind: "bad" }] }),
          D("6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", "Mate in 1.", "mate"),
          D("6k1/8/8/8/6n1/8/6PP/6RK b - - 0 1", "Mate in 1.", "mate"),
        ],
      },
      {
        id: "mate2", title: "Mate in 2", goal: "Plan one move ahead.",
        steps: [
          T("6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1", "Mate in 2: a quiet move first, mate next.", { play: ["a2a7", "g8f8", "b1b8"], marksAfter: [{ sq: "f8", kind: "bad" }] }),
          M2("6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1"),
          M2("4k3/8/8/8/8/8/8/R3K2R w - - 0 1"),
          M2("k7/8/2K5/8/8/8/8/7Q w - - 0 1"),
          M2("6k1/8/6K1/8/8/8/8/7R w - - 0 1"),
          M2("7k/8/8/8/8/8/1R6/R5K1 w - - 0 1"),
        ],
      },
    ],
  },
  {
    id: "opening", title: "Opening basics", color: "#f7b538", icon: "♞", blurb: "Centre, develop, castle.",
    lessons: [
      {
        id: "centre", title: "Take the centre", goal: "Pawns in the middle give your pieces room.",
        steps: [
          T("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "The four centre squares matter most.", { marks: ["d4", "e4", "d5", "e5"].map((sq) => ({ sq, kind: "hint" })) }),
          D("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "Claim the centre.", "fixed", { answers: ["e2e4", "d2d4"], why: "A centre pawn opens lines for your bishop and queen." }),
          Q("Which first move grabs the centre?", ["1. e4", "1. a3", "1. h4"], 0, "e4 and d4 fight for the middle."),
        ],
      },
      {
        id: "develop", title: "Develop pieces", goal: "Bring knights and bishops out early.",
        steps: [
          D("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "Develop a knight.", "fixed", { answers: ["g1f3", "b1c3"], why: "Knights come out before the queen." }),
          Q("Better second move?", ["2. Nf3", "2. Qh5", "2. a4"], 0, "Develop with a threat. Early queen moves get chased."),
          D("r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", "Develop the bishop.", "fixed", { answers: ["f1e2", "c1g5", "c1e3"], why: "Every piece should join the game." }),
        ],
      },
      {
        id: "castle", title: "Castle early", goal: "Safe king, active rook.",
        steps: [
          D("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "Castle.", "fixed", { answers: ["e1g1"], castle: true, why: "King to safety, rook to the centre." }),
          Q("Why castle early?", ["Safer king", "To lose a tempo"], 0, "Your king hides behind pawns and the rook gets active."),
        ],
      },
      {
        id: "italian", title: "Italian Game", goal: "A classic, easy-to-learn opening.",
        steps: [
          L("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [{ u: "e2e4", r: "e7e5" }, { u: "g1f3", r: "b8c6" }, { u: "f1c4", r: "f8c5" }, { u: "c2c3", r: "g8f6" }, { u: "d2d4" }], "Play the Italian Game.", { why: "Centre, knight, bishop, then c3 and d4." }),
          Q("What does Bc4 aim at?", ["The f7 pawn", "The a1 rook"], 0, "f7 is the weakest square near the king."),
        ],
      },
      {
        id: "qgambit", title: "Queen's Gambit", goal: "Fight for the centre with a flank pawn.",
        steps: [
          L("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [{ u: "d2d4", r: "d7d5" }, { u: "c2c4", r: "e7e6" }, { u: "b1c3", r: "g8f6" }, { u: "c1g5" }], "Play the Queen's Gambit.", { why: "c4 pressures d5. Then develop with knight and bishop." }),
          Q("Is it a real gambit?", ["No. You can win the pawn back", "Yes. White loses a pawn for good"], 0, "If Black takes c4, White can regain it."),
        ],
      },
      {
        id: "scholar", title: "Stop Scholar's mate", goal: "Meet the early queen attack.",
        steps: [
          T("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 3", "White threatens Qxf7 mate.", { arrows: [{ from: "h5", to: "f7" }], marks: [{ sq: "f7", kind: "bad" }] }),
          D("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 3", "Defend f7.", "fixed", { answers: ["g7g6", "g8f6", "d8e7"], why: "Qe7, Nf6 or g6 all stop the mate. Nf6 even attacks the queen." }),
        ],
      },
    ],
  },
  {
    id: "endgame", title: "Endgames", color: "#61d69a", icon: "♔", blurb: "Promote and mate with rooks.",
    lessons: [
      {
        id: "promote", title: "Promote a pawn", goal: "A pawn on the last rank becomes a queen.",
        steps: [
          T("8/3P4/8/8/8/8/k7/4K3 w - - 0 1", "Reach the last rank and become a queen.", { play: ["d7d8q"], marksAfter: [{ sq: "d8", kind: "good" }] }),
          D("8/3P4/8/8/8/8/k7/4K3 w - - 0 1", "Promote.", "fixed", { answers: ["d7d8"], why: "A new queen wins easily." }),
          D("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "Promote.", "fixed", { answers: ["a7a8"], why: "Always take the queen." }),
        ],
      },
      {
        id: "ladder", title: "Ladder mate", goal: "Two rooks drive the king to the edge.",
        steps: [
          T("6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1", "Rooks take turns checking, like climbing a ladder.", { play: ["a2a7", "g8f8", "b1b8"], marksAfter: [{ sq: "f8", kind: "bad" }] }),
          D("6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1", "Cut off the king.", "fixed", { answers: ["a2a7", "b1b7"], why: "One rook closes a rank, the other finishes." }),
          D("6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1", "Mate in 1.", "mate"),
        ],
      },
      {
        id: "keysq", title: "Key squares", goal: "Get your king in front of the pawn.",
        steps: [
          T("4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", "Your king in front of the pawn wins. These are the key squares.", { marks: ["d6", "e6", "f6"].map((sq) => ({ sq, kind: "hint" })) }),
          E("4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", "White to move. Who wins?"),
          E("8/8/4k3/4P3/4K3/8/8/8 w - - 0 1", "White to move. Who wins?"),
          E("7k/8/6K1/6P1/8/8/8/8 w - - 0 1", "White to move. Who wins?"),
          D("8/5k2/8/3KP3/8/8/8/8 w - - 0 1", "Take a key square.", "kpk"),
          D("8/4k3/8/2KP4/8/8/8/8 w - - 0 1", "Take a key square.", "kpk"),
          D("8/2k5/8/3PK3/8/8/8/8 w - - 0 1", "Take a key square.", "kpk"),
        ],
      },
      {
        id: "opposition", title: "Opposition", goal: "Facing the enemy king: whoever must move gives way.",
        steps: [
          T("8/6k1/8/6K1/6P1/8/8/8 w - - 0 1", "Kings face each other with one square between. The side to move must give way.", { marks: [{ sq: "g5", kind: "hint" }, { sq: "g7", kind: "hint" }] }),
          E("8/6k1/8/6K1/6P1/8/8/8 w - - 0 1", "White to move. Who wins?"),
          E("8/6k1/8/6K1/6P1/8/8/8 b - - 0 1", "Black to move. Who wins?"),
          D("8/4k3/8/5K2/4P3/8/8/8 w - - 0 1", "Take the opposition.", "kpk"),
          D("8/3k4/8/2K5/4P3/8/8/8 w - - 0 1", "Take the opposition.", "kpk"),
          D("8/5k2/8/6K1/3P4/8/8/8 w - - 0 1", "Take the opposition.", "kpk"),
        ],
      },
    ],
  },
];
