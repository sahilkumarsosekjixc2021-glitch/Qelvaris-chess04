// Queen's Gambit Declined — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const QGD = {
  id: "opn_qgd",
  name: "Queen's Gambit Declined",
  side: "Black",
  trunk: "d4 d5 c4 e6",
  overview: {
    "name": "Queen's Gambit Declined",
    "level": "Intermediate",
    "idea": "Black defends d5 with a pawn and keeps a solid structure. One of the oldest and most reliable defences against 1.d4.",
    "white": "Develop with Nc3, Nf3 and Bg5, castle and decide whether to exchange on d5 or keep the tension.",
    "black": "Develop ...Nf6, ...Be7 and castle, then free the position with ...c5 or ...dxc4 at the right time.",
    "watch": "The c8-bishop is shut in. Solve this with ...b6 and ...Bb7 or ...c5 and ...dxc4.",
    "middlegame": "A slow strategic fight: minority attack, isolated pawns or an open centre depending on White's choices.",
    "structures": "d5/e6 chain against d4/c4 pawns; exchange structure after cxd5.",
    "mistakes": "Leaving the bishop on c8 undeveloped, and being too passive."
},
  tree: [
    n("Nc3", {"name": "3.Nc3 — main move", "idea": "White develops and keeps the pin Bg5 in reserve.", "white": "Play Bg5, e3 and Nf3.", "black": "Develop and castle quickly."}, [n("Nf6", null, [n("Bg5", null, [n("Be7", null, [n("e3", null, [n("O-O", null, [n("Nf3", null, [n("h6", null, [n("Bh4", null, [n("b6", null, [n("cxd5", null, [n("Nxd5", null, [n("Bxe7", null, [n("Qxe7", null, [n("Nxd5", null, [n("exd5", null, [])])])])])])])])])])])])])]), n("cxd5", null, [n("exd5", null, [n("Bg5", null, [n("c6", null, [n("e3", null, [n("Be7", null, [n("Bd3", null, [n("Nbd7", null, [n("Qc2", null, [n("O-O", null, [])])])])])])])])])])])]),
    n("Nf3", {"name": "3.Nf3 — flexible", "idea": "White keeps the option of Nc3 or g3.", "white": "Develop with Bg5 and e3.", "black": "Develop ...Nf6 and ...Be7."}, [n("Nf6", null, [n("Bg5", null, [n("Be7", null, [n("e3", null, [n("h6", null, [n("Bh4", null, [n("O-O", null, [n("Nc3", null, [n("Ne4", null, [n("Bxe7", null, [n("Qxe7", null, [])])])])])])])])])])])]),
  ],
};
