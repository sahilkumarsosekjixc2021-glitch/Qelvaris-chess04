// Alekhine's Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const ALEKHINE = {
  id: "opn_alekhine_defence",
  name: "Alekhine's Defence",
  side: "Black",
  trunk: "e4 Nf6",
  overview: {
    "name": "Alekhine's Defence",
    "level": "Expert",
    "idea": "Black attacks the e4 pawn with a knight to provoke it forward. White gets a space advantage, but the pawns can become targets.",
    "white": "Gain space with e5 and d4, then hold the centre together.",
    "black": "Retreat the knight to d5, challenge the centre with ...d6 and attack the white pawns with pieces.",
    "watch": "White's big centre can become dangerous if Black does not break it down. The knight may be chased again.",
    "middlegame": "White has more space, Black plays for counterattacks on the pawn chain.",
    "structures": "Space advantage for White with pawns on e5/d4/c4.",
    "mistakes": "Moving the same knight repeatedly, and not undermining the centre in time."
},
  tree: [
    n("e5", {"name": "2.e5 — main reply", "idea": "White pushes the pawn, gaining space and time.", "white": "Follow with d4 and develop.", "black": "Move the knight to d5 and challenge with ...d6."}, [n("Nd5", null, [n("d4", null, [n("d6", null, [n("Nf3", null, [n("Bg4", null, [n("Be2", null, [n("e6", null, [n("O-O", null, [n("Be7", null, [n("h3", null, [n("Bh5", null, [n("c4", null, [n("Nb6", null, [])])])])])])])])])]), n("c4", null, [n("Nb6", null, [n("f4", null, [n("dxe5", null, [n("fxe5", null, [n("Nc6", null, [n("Be3", null, [n("Bf5", null, [n("Nc3", null, [n("e6", null, [])])])])])])])])])])])])])]),
  ],
};
