// Dutch Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const DUTCH = {
  id: "opn_dutch_defence",
  name: "Dutch Defence",
  side: "Black",
  trunk: "d4 f5",
  overview: {
    "name": "Dutch Defence",
    "level": "Intermediate",
    "idea": "Black takes control of e4 with the f-pawn and plays for an attack on the kingside. Ambitious but risky: the structure around the king is loosened.",
    "white": "Develop with g3 and Bg2, or Nc3 and Bg5, and attack the weak e6 square and the king's side.",
    "black": "Develop ...Nf6, ...e6 or ...g6, castle and play for ...e5 or an attack.",
    "watch": "The king can become exposed and e6 can become a weak square. Do not neglect development.",
    "middlegame": "Unbalanced positions with chances for both sides.",
    "structures": "Stonewall (c6-d5-e6-f5), Leningrad (g6) or Classical (e6-d6).",
    "mistakes": "Playing ...f5 without a plan and weakening the king."
},
  tree: [
    n("g3", {"name": "2.g3 — fianchetto", "idea": "White develops the bishop to the long diagonal.", "white": "Play Bg2, Nf3 and O-O.", "black": "Play ...Nf6 and choose between ...e6 and ...g6."}, [n("Nf6", null, [n("Bg2", null, [n("e6", null, [n("Nf3", null, [n("Be7", null, [n("O-O", null, [n("O-O", null, [n("c4", null, [n("d6", null, [])])])])])])]), n("g6", null, [n("Nf3", null, [n("Bg7", null, [n("O-O", null, [n("O-O", null, [n("c4", null, [n("d6", null, [n("Nc3", null, [n("Qe8", null, [])])])])])])])])])])])]),
    n("Nc3", {"name": "2.Nc3 — Bg5 plan", "idea": "White develops and pins the knight.", "white": "Play Bg5 and e4.", "black": "Develop quickly and challenge e4."}, [n("Nf6", null, [n("Bg5", null, [n("e6", null, [n("e4", null, [n("fxe4", null, [n("Nxe4", null, [n("Be7", null, [n("Bxf6", null, [n("Bxf6", null, [n("Nf3", null, [n("O-O", null, [])])])])])])])])])])])]),
    n("e4", {"name": "2.e4 — Staunton Gambit", "idea": "White offers a pawn for quick development.", "white": "Develop with Nc3 and Bg5.", "black": "Take the pawn and be ready to return it."}, [n("fxe4", null, [n("Nc3", null, [n("Nf6", null, [n("Bg5", null, [n("Nc6", null, [n("d5", null, [n("Ne5", null, [n("Qd4", null, [n("Nf7", null, [])])])])])])])])])]),
  ],
};
