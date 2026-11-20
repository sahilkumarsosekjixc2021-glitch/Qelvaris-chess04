// Queen's Gambit — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const QUEENS_GAMBIT = {
  id: "opn_queens_gambit",
  name: "Queen's Gambit",
  side: "White",
  trunk: "d4 d5 c4",
  overview: {
    name: "Queen's Gambit",
    level: "Intermediate",
    idea:
      "White offers the c-pawn to pull Black's d5 pawn away from the centre. If Black takes, White gets the centre back easily and keeps a space advantage.",
    white:
      "Develop with Nc3 and Nf3, play e3 and recapture on c4 if Black takes, then castle and aim for e4 or the queenside.",
    black:
      "Either hold d5 with ...e6 or ...c6, or take on c4 and give the pawn back at the right moment.",
    watch:
      "The pawn on c4 is only temporary. Do not try to keep it at the cost of development, and do not forget the pin Bg5 against the f6 knight.",
    middlegame:
      "Centre and queenside play: minority attack with b4-b5 in the exchange structure, or an isolated queen's pawn if the centre opens.",
    structures: "Exchange structure (c6 vs d5 pawns), isolated queen's pawn, or an open centre.",
    mistakes:
      "Playing e4 too early, forgetting about ...c5 breaks, and moving pieces twice before the centre is settled.",
  },
  tree: [
    n(
      "e6",
      {
        name: "2...e6 — Queen's Gambit Declined",
        idea: "Black simply defends d5 and keeps a solid but slightly passive position.",
        white: "Develop with Nc3, Nf3 and Bg5. Consider the exchange on d5 to fix the pawn structure.",
        black: "Develop ...Nf6, ...Be7, castle, then break with ...c5 or ...c6.",
        watch: "The c8-bishop is shut in until Black finds a way to free it.",
      },
      [
        n("Nc3", null, [
          n("Nf6", null, [
            n("Bg5", null, chain("Be7", "e3", "O-O", "Nf3", "Nbd7")),
            n("cxd5", null, chain("exd5", "Bg5", "Be7", "e3", "c6", "Bd3", "Nbd7", "Qc2", "O-O")),
          ]),
        ]),
      ]
    ),
    n(
      "dxc4",
      {
        name: "2...dxc4 — Accepted",
        idea: "Black takes the pawn and plans to give it back for freedom. White regains it calmly.",
        white: "Develop and take back on c4 with the bishop.",
        black: "Do not try to hold the pawn. Play ...c5 or ...a6 and ...b5 ideas to get active.",
      },
      chain("Nf3", "Nf6", "e3", "e6", "Bxc4", "c5", "O-O", "a6")
    ),
    n(
      "c6",
      {
        name: "2...c6 — Slav",
        idea: "Black defends d5 with a pawn and keeps the c8-bishop free to develop.",
        white: "Develop naturally with Nf3 and Nc3.",
        black: "Take on c4 at the right time and bring the bishop out before ...e6.",
      },
      chain("Nf3", "Nf6", "Nc3", "dxc4", "a4", "Bf5")
    ),
    n(
      "Nc6",
      {
        name: "2...Nc6 — Chigorin",
        idea: "Black ignores the classical structure and goes for piece activity, even at the cost of structure.",
        white: "Take on d5 and meet ...Bg4 with a pawn structure break.",
        black: "Use the bishop pair idea and open lines against White's doubled pawns.",
      },
      chain("Nf3", "Bg4", "cxd5", "Bxf3", "gxf3", "Qxd5", "e3", "e5")
    ),
  ],
};
