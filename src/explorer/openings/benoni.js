// Benoni Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const BENONI = {
  id: "opn_benoni_defence",
  name: "Benoni Defence",
  side: "Black",
  trunk: "d4 Nf6 c4 c5",
  overview: {
    "name": "Benoni Defence",
    "level": "Expert",
    "idea": "Black strikes at the d4 pawn at once and accepts an unbalanced structure: White gets a central pawn majority, Black gets the open e-file and queenside counterplay.",
    "white": "Use the central majority and the e4-e5 break. Keep the pieces active and the king safe.",
    "black": "Play ...e6, ...exd5, ...d6 and ...g6. Use the half-open e-file and the queenside majority.",
    "watch": "White's e4-e5 break can be very dangerous. Black must be ready with active piece play.",
    "middlegame": "Sharp, unbalanced fights where both sides have clear plans.",
    "structures": "Modern Benoni structure: White has pawns on d5/e4, Black has the queenside majority.",
    "mistakes": "Passive play and underestimating e4-e5."
},
  tree: [
    n("d5", {"name": "3.d5 — main move", "idea": "White grabs space and fixes the pawn structure.", "white": "Develop with Nc3 and e4.", "black": "Play ...e6 and exchange on d5."}, [n("e6", null, [n("Nc3", null, [n("exd5", null, [n("cxd5", null, [n("d6", null, [n("e4", null, [n("g6", null, [n("Nf3", null, [n("Bg7", null, [n("Be2", null, [n("O-O", null, [n("O-O", null, [n("Re8", null, [])])])])])])])]), n("Nf3", null, [n("g6", null, [n("Bf4", null, [n("Bg7", null, [n("e3", null, [n("O-O", null, [])])])])])])])])])])])]),
  ],
};
