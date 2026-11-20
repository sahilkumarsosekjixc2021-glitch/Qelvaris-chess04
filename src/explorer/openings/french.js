// French Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const FRENCH = {
  id: "opn_french_defence",
  name: "French Defence",
  side: "Black",
  trunk: "e4 e6",
  overview: {
    name: "French Defence",
    level: "Intermediate",
    idea:
      "Black builds a firm pawn chain with e6 and d5. The cost is a bad-looking c8-bishop, the gain is a very solid centre and clear plans against White's d4.",
    white:
      "Take space with e4-e5 or release the tension with exd5. Use the space advantage on the kingside.",
    black:
      "Break the centre with ...c5 and ...f6, and attack the d4 pawn with pieces and the queen.",
    watch:
      "The c8-bishop can stay shut in for a long time. Use ...c5 and ...f6 breaks and look for a trade of the bad bishop.",
    middlegame:
      "Locked pawn chains with play on opposite wings: White attacks on the kingside, Black on the queenside and d4.",
    structures: "d4-e5 vs d5-e6 chain; Advance and Winawer lead to the sharpest play.",
    mistakes:
      "Leaving the bishop shut in forever, and not breaking with ...c5 in time.",
  },
  tree: [
    n(
      "d4",
      {
        name: "2.d4 — main idea",
        idea: "White takes the full centre. Black challenges it at once with ...d5.",
        white: "Choose between Nc3, Nd2, exd5 and e5.",
        black: "Play 2...d5 and prepare ...c5.",
      },
      [
        n("d5", null, [
          n("Nc3", null, [
            n(
              "Nf6",
              {
                name: "Classical",
                idea: "Black attacks e4 and keeps the bishop on f8 flexible.",
                white: "Pin the knight with Bg5 or push e5.",
                black: "Trade the dark bishop and play ...c5.",
              },
              chain("Bg5", "Be7", "e5", "Nfd7", "Bxe7", "Qxe7", "f4", "O-O", "Nf3", "c5")
            ),
            n(
              "Bb4",
              {
                name: "Winawer",
                idea: "Black pins the knight and prepares to undouble White's pawns.",
                white: "Push e5 and answer ...Bxc3+ with bxc3.",
                black: "Strike back at once with ...c5.",
              },
              chain("e5", "c5", "a3", "Bxc3+", "bxc3", "Ne7", "Qg4", "Qc7", "Qxg7", "Rg8", "Qxh7", "cxd4", "Ne2", "Nbc6", "f4", "Bd7")
            ),
          ]),
          n(
            "Nd2",
            {
              name: "3.Nd2 — Tarrasch",
              idea: "White avoids the pin on the c3 knight and keeps the c-pawn free.",
              white: "Play e5 and bring the knight to f3 after c3.",
              black: "Attack d4 with ...c5 and ...Nc6.",
            },
            chain("Nf6", "e5", "Nfd7", "Bd3", "c5", "c3", "Nc6", "Ne2", "cxd4", "cxd4", "f6", "exf6", "Nxf6", "Nf3", "Bd6")
          ),
          n(
            "exd5",
            {
              name: "3.exd5 — Exchange",
              idea: "White releases the tension. The pawn structure becomes symmetrical and the game is calm.",
              white: "Develop with Nf3, Bd3 and castle.",
              black: "Develop naturally and avoid being too passive.",
            },
            chain("exd5", "Nf3", "Nf6", "Bd3", "Bd6", "O-O", "O-O", "Bg5", "Bg4")
          ),
          n(
            "e5",
            {
              name: "3.e5 — Advance",
              idea: "White gains space and locks the centre. Black must attack the d4 pawn.",
              white: "Support d4 with c3 and Nf3.",
              black: "Hit the base of the chain with ...c5, ...Nc6 and ...Qb6.",
            },
            chain("c5", "c3", "Nc6", "Nf3", "Qb6", "a3", "c4", "Nbd2", "Na5", "Be2", "Bd7")
          ),
        ]),
      ]
    ),
  ],
};
