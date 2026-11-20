// Philidor Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const PHILIDOR = {
  id: "opn_philidor_defence",
  name: "Philidor Defence",
  side: "Black",
  trunk: "e4 e5 Nf3 d6",
  overview: {
    "name": "Philidor Defence",
    "level": "Beginner friendly",
    "idea": "Black defends e5 with a pawn and keeps a very solid structure. The cost is some passivity, the gain is a compact position that is hard to attack.",
    "white": "Take space with d4 and develop quickly. Use the extra space to build an attack or to squeeze Black.",
    "black": "Develop with ...Nf6 and ...Nbd7, then break with ...exd4 or ...c6. Stay compact and wait for chances.",
    "watch": "Do not become too passive. If White builds a big centre, find the right moment for ...exd4 or ...c6.",
    "middlegame": "Solid positions with a space advantage for White. Black's counterplay comes from central breaks.",
    "structures": "e5/d6 chain against e4/d4 pawns.",
    "mistakes": "Passive play, trapping your own pieces behind the pawns and missing the break ...exd4."
},
  tree: [
    n("d4", {"name": "3.d4 — main move", "idea": "White opens the centre immediately.", "white": "Take the centre and develop.", "black": "Choose between keeping the tension with ...Nf6 and taking on d4."}, [n("Nf6", null, [n("Nc3", null, [n("Nbd7", null, [n("Bc4", null, [n("Be7", null, [n("O-O", null, [n("O-O", null, [n("Qe2", null, [n("c6", null, [n("a4", null, [])])])])])])])])])]), n("exd4", null, [n("Nxd4", null, [n("Nf6", null, [n("Nc3", null, [n("Be7", null, [n("Be2", null, [n("O-O", null, [n("O-O", null, [n("Re8", null, [n("f4", null, [n("Bf8", null, [])])])])])])])])])])])]),
    n("Bc4", {"name": "3.Bc4 — quiet development", "idea": "White develops with an eye on f7 and keeps flexible.", "white": "Play c3 and d4 next.", "black": "Develop ...Be7 and ...Nf6 and keep the structure solid."}, [n("Be7", null, [n("c3", null, [n("Nf6", null, [n("d4", null, [n("Nbd7", null, [n("O-O", null, [n("O-O", null, [n("Nbd2", null, [])])])])])])])])]),
  ],
};
