// Bird's Opening — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const BIRD = {
  id: "opn_birds_opening",
  name: "Bird's Opening",
  side: "White",
  trunk: "f4",
  overview: {
    "name": "Bird's Opening",
    "level": "Intermediate",
    "idea": "White controls e5 with the f-pawn and aims for a kingside attack. A Dutch Defence with colours reversed.",
    "white": "Play Nf3, e3, Be2, O-O and d3. Build a solid set-up and look for a kingside attack.",
    "black": "Take the centre with ...d5, ...Nf6 and ...e5, or hit f4 with ...e5.",
    "watch": "The e1-h4 diagonal is weakened, so watch for ...e5 breaks and early queen checks.",
    "middlegame": "Slow strategic play with a kingside attack for White, active play in the centre for Black.",
    "structures": "f4/e3/d3 set-up for White, like a Dutch with colours reversed.",
    "mistakes": "Weakening the king and neglecting the centre."
},
  tree: [
    n("d5", {"name": "1...d5 — solid reply", "idea": "Black takes the centre and develops naturally.", "white": "Play Nf3, e3 and Be2.", "black": "Play ...Nf6, ...g6 and ...Bg7."}, [n("Nf3", null, [n("Nf6", null, [n("e3", null, [n("g6", null, [n("Be2", null, [n("Bg7", null, [n("O-O", null, [n("O-O", null, [n("d3", null, [n("c5", null, [])])])])])])])])])])]),
    n("e5", {"name": "1...e5 — From's Gambit", "idea": "Black offers a pawn for activity and an attack on the white king.", "white": "Take the pawn and be careful of ...Bxd6 and ...g5.", "black": "Open lines and develop fast."}, [n("fxe5", null, [n("d6", null, [n("exd6", null, [n("Bxd6", null, [n("Nf3", null, [n("Nf6", null, [n("g3", null, [n("O-O", null, [])])])])])])])])]),
    n("Nf6", {"name": "1...Nf6 — flexible reply", "idea": "Black develops and keeps options open.", "white": "Play Nf3 and e3.", "black": "Play ...g6 and ...Bg7."}, [n("Nf3", null, [n("g6", null, [n("e3", null, [n("Bg7", null, [n("Be2", null, [n("O-O", null, [n("O-O", null, [n("d6", null, [n("d3", null, [])])])])])])])])])]),
  ],
};
