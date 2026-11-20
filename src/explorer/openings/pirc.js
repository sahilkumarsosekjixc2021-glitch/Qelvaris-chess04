// Pirc Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const PIRC = {
  id: "opn_pirc_defence",
  name: "Pirc Defence",
  side: "Black",
  trunk: "e4 d6 d4 Nf6",
  overview: {
    "name": "Pirc Defence",
    "level": "Expert",
    "idea": "Black waits with pieces, lets White build a centre and attacks it later with ...c5 or ...e5. The idea is flexibility at the cost of space.",
    "white": "Choose a set-up: Classical (Nf3, Be2), Austrian (f4) or the 150 Attack (Be3, Qd2, f3).",
    "black": "Fianchetto the king's bishop, castle and strike the centre with ...c5 or ...e5.",
    "watch": "White's space can become dangerous. Do not let the centre roll forward without a counterstrike.",
    "middlegame": "Unbalanced fights where White has the space and Black has the counterplay.",
    "structures": "d6/g6 set-up against e4/d4.",
    "mistakes": "Waiting too long to strike back, and ignoring White's kingside attack."
},
  tree: [
    n("Nc3", {"name": "3.Nc3 — the main move", "idea": "White develops the knight and prepares to take the centre.", "white": "Choose a plan after ...g6.", "black": "Play ...g6 and ...Bg7."}, [n("g6", null, [n("Nf3", null, [n("Bg7", null, [n("Be2", null, [n("O-O", null, [n("O-O", null, [n("c6", null, [])])])])])]), n("f4", null, [n("Bg7", null, [n("Nf3", null, [n("O-O", null, [n("Bd3", null, [n("Na6", null, [])])])])])]), n("Be3", null, [n("Bg7", null, [n("Qd2", null, [n("c6", null, [n("f3", null, [n("b5", null, [])])])])])])])]),
  ],
};
