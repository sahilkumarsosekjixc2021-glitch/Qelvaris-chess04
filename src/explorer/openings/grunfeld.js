// Grünfeld Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const GRUNFELD = {
  id: "opn_grunfeld_defence",
  name: "Grünfeld Defence",
  side: "Black",
  trunk: "d4 Nf6 c4 g6 Nc3 d5",
  overview: {
    "name": "Grünfeld Defence",
    "level": "Expert",
    "idea": "Black allows White to build a big centre and then attacks it with pieces and the ...c5 break. A very active and respected defence.",
    "white": "Take the centre with e4 and defend it. Develop pieces to put pressure on the long diagonal and the d5 square.",
    "black": "Take on d5, hit the centre with ...c5 and use the fianchettoed bishop on g7.",
    "watch": "White's centre can be dangerous if Black does not attack it quickly. Pieces must be active.",
    "middlegame": "Sharp fights where White has the centre and Black has active pieces.",
    "structures": "Big white centre with pawns on d4/e4 against Black's pieces on the long diagonal.",
    "mistakes": "Not attacking the centre in time and playing passively."
},
  tree: [
    n("cxd5", {"name": "4.cxd5 — Exchange", "idea": "White gains the centre at once. Black counters with piece pressure.", "white": "Play e4 and build the pawn centre.", "black": "Hit the centre with ...c5 and ...Bg7."}, [n("Nxd5", null, [n("e4", null, [n("Nxc3", null, [n("bxc3", null, [n("Bg7", null, [n("Nf3", null, [n("c5", null, [n("Rb1", null, [n("O-O", null, [n("Be2", null, [n("cxd4", null, [n("cxd4", null, [n("Qa5+", null, [n("Bd2", null, [n("Qxa2", null, [])])])])])])])])])])])])])])])]),
    n("Nf3", {"name": "4.Nf3 — Russian", "idea": "White develops and prepares Qb3.", "white": "Play Qb3 and e4 after Black takes on c4.", "black": "Take on c4 and strike with ...c5."}, [n("Bg7", null, [n("Qb3", null, [n("dxc4", null, [n("Qxc4", null, [n("O-O", null, [n("e4", null, [n("Na6", null, [n("Be2", null, [n("c5", null, [])])])])])])])])])]),
    n("Bf4", {"name": "4.Bf4 — quiet", "idea": "White develops and keeps the structure flexible.", "white": "Play e3 and Rc1.", "black": "Fight the centre with ...c5."}, [n("Bg7", null, [n("e3", null, [n("O-O", null, [n("Rc1", null, [n("c5", null, [n("dxc5", null, [n("Be6", null, [])])])])])])])]),
  ],
};
