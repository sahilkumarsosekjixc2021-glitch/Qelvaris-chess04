// Stonewall Attack — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const STONEWALL = {
  id: "opn_stonewall_attack",
  name: "Stonewall Attack",
  side: "White",
  trunk: "d4 d5 e3",
  overview: {
    "name": "Stonewall Attack",
    "level": "Beginner friendly",
    "idea": "White builds a wall of pawns on c3, d4, e3 and f4 and keeps the bishop on d3. The set-up is easy to learn and leads to a kingside attack.",
    "white": "Play Bd3, f4, Nf3, O-O and Ne5. Aim for a knight on e5 and a kingside attack.",
    "black": "Take space with ...c5 or ...e5 and challenge the knight on e5.",
    "watch": "The c1-bishop is shut in behind the pawns, and the e5 square can be attacked by Black.",
    "middlegame": "A kingside attack with the knight on e5 and the queen and bishop aiming at h7.",
    "structures": "d4-e3-f4 chain with a bishop on d3.",
    "mistakes": "Playing the same moves automatically and forgetting that Black can attack the centre with ...c5."
},
  tree: [
    n("Nf6", {"name": "3...Nf6 — natural reply", "idea": "Black develops and prepares ...e6.", "white": "Play Bd3, f4 and Nf3.", "black": "Play ...e6, ...c5 and ...Nc6."}, [n("Bd3", null, [n("e6", null, [n("f4", null, [n("c5", null, [n("c3", null, [n("Nc6", null, [n("Nd2", null, [n("Bd6", null, [n("Ngf3", null, [n("O-O", null, [n("O-O", null, [])])])])])])])])])])])]),
    n("e6", {"name": "3...e6 — solid reply", "idea": "Black plays the same set-up as in the Queen's Gambit.", "white": "Play f4 and Nf3.", "black": "Play ...Nf6, ...c5 and ...Nc6."}, [n("f4", null, [n("Nf6", null, [n("Nf3", null, [n("c5", null, [n("c3", null, [n("Nc6", null, [n("Bd3", null, [n("Bd6", null, [n("O-O", null, [n("O-O", null, [])])])])])])])])])])]),
    n("c5", {"name": "3...c5 — immediate break", "idea": "Black attacks the centre at once.", "white": "Play c3 and f4 and be ready for ...Nc6.", "black": "Take space and open the c-file."}, [n("c3", null, [n("Nc6", null, [n("f4", null, [n("Nf6", null, [n("Nf3", null, [n("e6", null, [n("Bd3", null, [n("Bd6", null, [n("O-O", null, [n("O-O", null, [])])])])])])])])])])]),
  ],
};
