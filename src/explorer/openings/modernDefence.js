// Modern Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const MODERN = {
  id: "opn_modern_defence",
  name: "Modern Defence",
  side: "Black",
  trunk: "e4 g6",
  overview: {
    "name": "Modern Defence",
    "level": "Intermediate",
    "idea": "Black lets White build a big centre and plans to undermine it with pieces and pawn breaks. The bishop on g7 does most of the work.",
    "white": "Take the centre and play for a kingside attack with Be3, Qd2 and f3.",
    "black": "Develop the bishop on g7, play ...d6 and decide later between ...c5, ...e5 and ...a6/...b5.",
    "watch": "Do not let White's pawns run away with the game. Look for the break ...c5 or ...e5 at the right time.",
    "middlegame": "White often attacks on the kingside, Black counterattacks on the queenside and in the centre.",
    "structures": "d6/g6 set-up against e4/d4.",
    "mistakes": "Playing too passively and not breaking in the centre."
},
  tree: [
    n("d4", {"name": "2.d4 — big centre", "idea": "White takes the centre. Black will attack it later.", "white": "Develop and choose between Nc3 and Nf3.", "black": "Play ...Bg7 and ...d6."}, [n("Bg7", null, [n("Nc3", null, [n("d6", null, [n("Be3", null, [n("a6", null, [n("Qd2", null, [n("b5", null, [n("f3", null, [n("Nd7", null, [n("Nge2", null, [n("Ngf6", null, [n("Bh6", null, [n("O-O", null, [])])])])])])])])])])])]), n("Nf3", null, [n("d6", null, [n("Be2", null, [n("Nf6", null, [n("Nc3", null, [n("O-O", null, [n("O-O", null, [])])])])])])])])]),
  ],
};
