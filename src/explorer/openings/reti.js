// Réti Opening — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const RETI = {
  id: "opn_reti_opening",
  name: "Réti Opening",
  side: "White",
  trunk: "Nf3",
  overview: {
    "name": "Réti Opening",
    "level": "Intermediate",
    "idea": "White develops flexibly and waits to see Black's set-up. A hypermodern approach: control the centre with pieces first, pawns later.",
    "white": "Play c4, g3 and Bg2 and decide on the centre later. Keep options open.",
    "black": "Take the centre with ...d5 or ...Nf6 and be ready for White's flexible play.",
    "watch": "White's flexibility means Black must keep its own plan. Do not be too passive.",
    "middlegame": "Strategic play with the bishop on g2 on the long diagonal and queenside space.",
    "structures": "Many transpositions: Catalan, English and Queen's Gambit.",
    "mistakes": "Aimless development and giving Black a free centre."
},
  tree: [
    n("d5", {"name": "1...d5 — central reply", "idea": "Black takes the centre at once.", "white": "Play c4 and g3 to pressure d5.", "black": "Develop ...e6 and ...Nf6."}, [n("c4", null, [n("e6", null, [n("g3", null, [n("Nf6", null, [n("Bg2", null, [n("Be7", null, [n("O-O", null, [n("O-O", null, [n("b3", null, [n("c5", null, [n("Bb2", null, [n("Nc6", null, [])])])])])])])])])])])])]),
    n("Nf6", {"name": "1...Nf6 — flexible reply", "idea": "Black waits and keeps options open.", "white": "Play c4 and b4 or g3.", "black": "Play ...g6 and ...Bg7."}, [n("c4", null, [n("g6", null, [n("b4", null, [n("Bg7", null, [n("Bb2", null, [n("O-O", null, [n("e3", null, [n("d6", null, [n("Be2", null, [n("Nbd7", null, [])])])])])])])])])])]),
    n("c5", {"name": "1...c5 — symmetrical", "idea": "Black copies White and aims for a Sicilian-like set-up.", "white": "Play c4 and g3.", "black": "Play ...b6 and ...Bb7."}, [n("c4", null, [n("Nf6", null, [n("g3", null, [n("b6", null, [n("Bg2", null, [n("Bb7", null, [n("O-O", null, [n("e6", null, [n("Nc3", null, [n("Be7", null, [])])])])])])])])])])]),
  ],
};
