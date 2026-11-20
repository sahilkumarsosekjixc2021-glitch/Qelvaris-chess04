// Catalan Opening — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const CATALAN = {
  id: "opn_catalan_opening",
  name: "Catalan Opening",
  side: "White",
  trunk: "d4 Nf6 c4 e6 g3",
  overview: {
    "name": "Catalan Opening",
    "level": "Expert",
    "idea": "White fianchettoes the king's bishop to exert long-term pressure on the queenside and on the d5 square. The play is strategic and patient.",
    "white": "Play Bg2, Nf3 and castle. Win back the c4 pawn if Black takes it and use the bishop on the long diagonal.",
    "black": "Play ...d5, develop and decide whether to hold the pawn on c4 or return it.",
    "watch": "Do not let the bishop on g2 dominate the long diagonal. Break with ...c5 at the right time.",
    "middlegame": "A slow squeeze with a small but lasting advantage for White. Black must find active counterplay.",
    "structures": "Pawns on d4/c4 against d5/e6 with a bishop on g2.",
    "mistakes": "Playing too passively and letting White build up pressure for free."
},
  tree: [
    n("d5", {"name": "3...d5 — main reply", "idea": "Black holds the centre and keeps the structure solid.", "white": "Play Bg2, Nf3 and O-O.", "black": "Develop with ...Be7 and ...O-O, then decide whether to take on c4."}, [n("Bg2", null, [n("Be7", null, [n("Nf3", null, [n("O-O", null, [n("O-O", null, [n("dxc4", null, [n("Qc2", null, [n("a6", null, [n("Qxc4", null, [n("b5", null, [n("Qc2", null, [n("Bb7", null, [])])])])])])])])])])]), n("dxc4", null, [n("Qa4+", null, [n("Nbd7", null, [n("Qxc4", null, [n("c5", null, [n("Nf3", null, [n("a6", null, [])])])])])])])])]),
  ],
};
