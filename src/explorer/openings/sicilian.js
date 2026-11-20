// Sicilian Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const SICILIAN = {
  id: "opn_sicilian_defence",
  name: "Sicilian Defence",
  side: "Black",
  trunk: "e4 c5",
  overview: {
    name: "Sicilian Defence",
    level: "Intermediate",
    idea:
      "Black fights for the centre from the side. The c-pawn trades for White's d-pawn, giving Black an open c-file and an unbalanced structure where both sides play to win.",
    white:
      "Open the centre with d4, develop quickly and use the lead in space and development, often with an attack on the kingside.",
    black:
      "Trade the c-pawn for the d-pawn, develop with ...Nc6, ...Nf6 and ...d6 or ...e6, and play on the queenside and in the centre.",
    watch:
      "Black's king can come under fire if development is slow. White must not overextend and lose the initiative.",
    middlegame:
      "Unbalanced fights: White attacks on the kingside, Black counterattacks on the c-file and queenside.",
    structures: "Open Sicilian with a d6/e5 or d6/e6 set-up for Black; Maroczy bind when White gets c4 and e4.",
    mistakes:
      "Grabbing pawns instead of developing, and passive play that lets White roll forward without resistance.",
  },
  tree: [
    n(
      "Nf3",
      {
        name: "2.Nf3 — Open Sicilian",
        idea: "White intends d4 to open the centre. Most Sicilian theory starts here.",
        white: "Play d4 next and recapture with the knight.",
        black: "Choose the set-up: ...d6, ...Nc6 or ...e6.",
      },
      [
        n("d6", null, chain("d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e5", "Nb3", "Be6", "f3", "Be7", "Qd2", "O-O")),
        n("Nc6", null, [
          n("d4", null, [
            n("cxd4", null, [
              n("Nxd4", null, [
                n("Nf6", null, chain("Nc3", "d6", "Be2", "e5", "Nb3", "Be7")),
                n("g6", null, chain("c4", "Bg7", "Be3", "Nf6", "Nc3", "O-O", "Be2", "d6")),
              ]),
            ]),
          ]),
        ]),
        n("e6", null, chain("d4", "cxd4", "Nxd4", "a6", "Bd3", "Nf6", "O-O", "Qc7")),
      ]
    ),
    n(
      "c3",
      {
        name: "2.c3 — Alapin",
        idea: "White prepares d4 with a pawn, avoiding deep theory and keeping a solid centre.",
        white: "Follow with d4 and meet ...Nf6 with e5.",
        black: "Challenge the centre with ...d5 or ...Nf6.",
      },
      chain("Nf6", "e5", "Nd5", "d4", "cxd4", "Nf3", "Nc6", "cxd4", "d6", "Bc4", "Nb6")
    ),
    n(
      "Nc3",
      {
        name: "2.Nc3 — Closed Sicilian",
        idea: "White avoids d4 and builds a slow position with a kingside fianchetto.",
        white: "Play g3, Bg2 and d3, then f4 and a kingside attack.",
        black: "Develop ...Nc6, ...g6 and ...Bg7 and counter on the queenside.",
      },
      chain("Nc6", "g3", "g6", "Bg2", "Bg7", "d3", "d6", "Be3", "e6")
    ),
  ],
};
