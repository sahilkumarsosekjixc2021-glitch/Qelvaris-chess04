// Vienna Game — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const VIENNA = {
  id: "opn_vienna_game",
  name: "Vienna Game",
  side: "White",
  trunk: "e4 e5 Nc3",
  overview: {
    name: "Vienna Game",
    level: "Beginner friendly",
    idea:
      "White develops a knight before the f-pawn or d-pawn moves. It keeps options open: a quiet Bc4 set-up, the f4 gambit or a fianchetto.",
    white:
      "Prepare f4 or d4 with natural development. Choose the plan after seeing Black's reply.",
    black:
      "Hit the centre with ...d5 or develop with ...Nc6, and be careful about the f2 pawn.",
    watch:
      "The f4 break weakens the king, so do not play it without a reason. The bishop on c4 also hits f7.",
    middlegame:
      "Open play along the f-file after f4, or a calm game with pawns on d3 and f2.",
    structures: "Open e-file after f4 exchanges, or e4-d3 chains with quiet play.",
    mistakes:
      "Pushing f4 while the king is still in the centre, and forgetting that the knight on c3 blocks the c-pawn.",
  },
  tree: [
    n(
      "Nf6",
      {
        name: "2...Nf6 — natural reply",
        idea: "Black attacks e4 straight away and invites White to choose between gambit and quiet play.",
        white: "Choose f4 for a sharp game, Bc4 for development or g3 for a fianchetto.",
        black: "Strike in the centre with ...d5 when it is safe.",
      },
      [
        n("Bc4", null, chain("Nxe4", "Qh5", "Nd6", "Bb3", "Be7", "Nf3", "Nc6")),
        n("f4", null, chain("d5", "fxe5", "Nxe4", "Nf3", "Be7", "d4", "O-O", "Bd3")),
        n("g3", null, chain("d5", "exd5", "Nxd5", "Bg2", "Nxc3", "bxc3", "Bd6", "Nf3")),
      ]
    ),
    n(
      "Nc6",
      {
        name: "2...Nc6 — develop first",
        idea: "Black develops quietly and keeps the pawn structure flexible.",
        white: "Choose between a quick Bc4 and a Scotch-like structure with Nf3 and d4.",
        black: "Aim for ...Nf6 and be ready to trade pieces in the centre.",
      },
      [
        n("Bc4", null, chain("Nf6", "d3", "Na5", "Nge2", "Nxc4", "dxc4", "d6")),
        n("Nf3", null, chain("Nf6", "d4", "exd4", "Nxd4", "Bb4", "Nxc6", "bxc6", "Bd3", "d5", "exd5", "cxd5", "O-O", "O-O", "Bg5", "c6")),
      ]
    ),
  ],
};
