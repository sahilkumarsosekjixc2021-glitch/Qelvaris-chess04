// Benko Gambit — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const BENKO = {
  id: "opn_benko_gambit",
  name: "Benko Gambit",
  side: "Black",
  trunk: "d4 Nf6 c4 c5 d5 b5",
  overview: {
    "name": "Benko Gambit",
    "level": "Expert",
    "idea": "Black sacrifices a pawn for long-term pressure on the queenside. Open a- and b-files and a bishop on g7 give lasting compensation.",
    "white": "Take the pawn, return it at the right moment and develop calmly.",
    "black": "Open lines on the queenside, play ...g6 and ...Bg7 and put the rooks on the open files.",
    "watch": "Black is a pawn down, so patience is required. Do not rush the attack and avoid trading pieces without a reason.",
    "middlegame": "Positional compensation: pressure on the queenside with open files and active pieces.",
    "structures": "Black pawn majority replaced by open files, with a bishop on g7.",
    "mistakes": "Giving up the pawn without following up, and trading the bishop pair."
},
  tree: [
    n("cxb5", {"name": "4.cxb5 — accepted", "idea": "White takes the pawn. Black plays ...a6 to open the a-file.", "white": "Return the pawn at the right moment and develop.", "black": "Open the a- and b-files and play ...g6."}, [n("a6", null, [n("bxa6", null, [n("Bxa6", null, [n("Nc3", null, [n("g6", null, [n("e4", null, [n("Bxf1", null, [n("Kxf1", null, [n("d6", null, [])])])])])])])])])]),
    n("Nf3", {"name": "4.Nf3 — declined", "idea": "White develops and avoids the gambit.", "white": "Play g3 and Bg2.", "black": "Play ...g6 and ...Bg7."}, [n("g6", null, [n("g3", null, [n("Bg7", null, [n("Bg2", null, [n("O-O", null, [n("O-O", null, [n("bxc4", null, [])])])])])])])]),
    n("f3", {"name": "4.f3 — central support", "idea": "White supports e4 and keeps the structure.", "white": "Play e4 and develop.", "black": "Take on c4 and play ...g6."}, [n("bxc4", null, [n("e4", null, [n("d6", null, [n("Bxc4", null, [n("g6", null, [n("Ne2", null, [n("Bg7", null, [n("Nbc3", null, [n("O-O", null, [])])])])])])])])])]),
  ],
};
