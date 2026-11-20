// English Opening — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const ENGLISH = {
  id: "opn_english_opening",
  name: "English Opening",
  side: "White",
  trunk: "c4",
  overview: {
    name: "English Opening",
    level: "Intermediate",
    idea:
      "White controls d5 from the side and keeps the centre pawn structure flexible. Often it feels like a Sicilian with colours reversed.",
    white:
      "Develop with Nc3, Nf3 and g3, fianchetto the bishop and decide the pawn structure later.",
    black:
      "Take central space with ...e5 or mirror with ...c5, or choose a solid set-up with ...Nf6 and ...e6.",
    watch:
      "Transpositions: the English often turns into a Queen's Gambit, a King's Indian or a Sicilian structure. Know where you want to end up.",
    middlegame:
      "Pressure on the long diagonal and on d5, queenside expansion with b4 or a Maroczy-like bind, and a slow fight for the centre.",
    structures: "Symmetrical pawns, reversed Sicilian, or a Maroczy-like bind.",
    mistakes:
      "Playing d4 too early, forgetting the bishop on g2 needs open diagonals, and underestimating ...d5 breaks.",
  },
  tree: [
    n(
      "e5",
      {
        name: "1...e5 — reversed Sicilian",
        idea: "Black takes the centre at once. White has an extra move compared to a Sicilian with colours reversed.",
        white: "Develop Nc3, Nf3, g3 and Bg2, and fight for d5.",
        black: "Keep the centre and develop ...Nf6 and ...Nc6.",
      },
      chain("Nc3", "Nf6", "Nf3", "Nc6", "g3", "d5", "cxd5", "Nxd5", "Bg2", "Nb6", "O-O", "Be7")
    ),
    n(
      "c5",
      {
        name: "1...c5 — Symmetrical",
        idea: "Black copies White. The play is slow and about who finds the better plan first.",
        white: "Play Nf3, Nc3, g3 and Bg2, then prepare a3 and b4.",
        black: "Build the same set-up and prepare the ...d5 break.",
      },
      chain("Nf3", "Nf6", "Nc3", "Nc6", "g3", "g6", "Bg2", "Bg7", "O-O", "O-O", "d3", "d6")
    ),
    n(
      "Nf6",
      {
        name: "1...Nf6 — flexible reply",
        idea: "Black waits to see White's plan. Often leads to King's Indian structures.",
        white: "Take the centre with e4 and d4 while Black has not committed.",
        black: "Challenge the centre later with ...c5 or ...e5.",
      },
      chain("Nc3", "g6", "e4", "d6", "d4", "Bg7", "Nf3", "O-O")
    ),
    n(
      "e6",
      {
        name: "1...e6 — solid reply",
        idea: "Black prepares ...d5 and often transposes into a Queen's Gambit structure.",
        white: "Play Nc3 and d4 when ready.",
        black: "Aim for ...d5, ...Nf6 and ...Be7.",
      },
      chain("Nc3", "d5", "d4", "Nf6", "Nf3", "Be7", "Bg5", "O-O")
    ),
  ],
};
