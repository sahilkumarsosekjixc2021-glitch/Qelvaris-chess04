// King's Gambit — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const KINGS_GAMBIT = {
  id: "opn_kings_gambit",
  name: "King's Gambit",
  side: "White",
  trunk: "e4 e5 f4",
  overview: {
    "name": "King's Gambit",
    "level": "Expert",
    "idea": "White offers a pawn to deflect Black's e-pawn and to open the f-file. The play is sharp: White gets the centre and development, Black gets an extra pawn and a target.",
    "white": "Play Nf3, Bc4 and d4, castle quickly and use the open f-file. Accept a risky king in return for attacking chances.",
    "black": "Take the pawn and hold it with ...g5 or return it at the right moment to finish development.",
    "watch": "White's king is exposed and Black's too if it plays ...g5 with a loose kingside. Every tempo matters.",
    "middlegame": "Attack against attack. Open lines, fast development and tactics decide the game.",
    "structures": "Open f-file, pawn on e4 against black's pawns on e5/d5.",
    "mistakes": "Taking pawns in the wrong order, ignoring development and not castling in time."
},
  tree: [
    n("exf4", {"name": "2...exf4 — Accepted", "idea": "Black takes the pawn. White gets the centre and tempo for the pawn.", "white": "Develop with Nf3 and aim for d4.", "black": "Hold the pawn with ...g5 or give it back.", "watch": "Do not let the kingside open against your own king."}, [n("Nf3", null, [n("g5", null, [n("h4", null, [n("g4", null, [n("Ne5", null, [n("Nf6", null, [n("Bc4", null, [n("d5", null, [n("exd5", null, [n("Bd6", null, [n("d4", null, [n("Nh5", null, [n("O-O", null, [])])])])])])])])])])])]), n("d6", null, [n("Bc4", null, [n("h6", null, [n("d4", null, [n("g5", null, [n("h4", null, [n("Bg7", null, [n("Nc3", null, [n("c6", null, [])])])])])])])])])])]),
    n("Bc5", {"name": "2...Bc5 — Classical", "idea": "Black develops first and does not accept the pawn at once. A quieter reply.", "white": "Play Nf3 and c3 to prepare d4.", "black": "Develop and prepare ...d6 and ...Nf6."}, [n("Nf3", null, [n("d6", null, [n("c3", null, [n("Nf6", null, [n("d4", null, [])])])])])]),
    n("d5", {"name": "2...d5 — Falkbeer", "idea": "Black counters in the centre at once, offering a pawn of its own.", "white": "Take the pawn and be ready for ...e4.", "black": "Strike in the centre and develop with tempo."}, [n("exd5", null, [n("e4", null, [n("d3", null, [n("Nf6", null, [n("dxe4", null, [n("Nxe4", null, [n("Nf3", null, [n("Bc5", null, [n("Qe2", null, [n("Qe7", null, [n("Nc3", null, [n("Nxc3", null, [n("bxc3", null, [])])])])])])])])])])])])])]),
  ],
};
