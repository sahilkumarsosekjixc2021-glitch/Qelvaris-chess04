// Nimzo-Indian Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const NIMZO = {
  id: "opn_nimzo_indian",
  name: "Nimzo-Indian Defence",
  side: "Black",
  trunk: "d4 Nf6 c4 e6 Nc3 Bb4",
  overview: {
    "name": "Nimzo-Indian Defence",
    "level": "Expert",
    "idea": "Black pins the c3 knight to stop e4 and is ready to give up the bishop pair to double White's pawns. One of the most respected defences to 1.d4.",
    "white": "Choose between the solid Rubinstein (e3), the Qc2 system and the Sämisch (a3).",
    "black": "Develop with ...O-O, ...d5 or ...c5 and decide whether to take on c3.",
    "watch": "White's bishop pair and big centre are the compensation for the doubled pawns. Black must use the weak pawns.",
    "middlegame": "Strategic play around the pawn structure and the control of e4.",
    "structures": "Doubled c-pawns for White, or a normal centre if Black does not take on c3.",
    "mistakes": "Taking on c3 without a clear plan and ignoring White's centre."
},
  tree: [
    n("e3", {"name": "4.e3 — Rubinstein", "idea": "White develops solidly and keeps the structure flexible.", "white": "Develop Bd3, Nf3 and O-O.", "black": "Castle and strike with ...d5 or ...c5."}, [n("O-O", null, [n("Bd3", null, [n("d5", null, [n("Nf3", null, [n("c5", null, [n("O-O", null, [n("Nc6", null, [n("a3", null, [n("Bxc3", null, [n("bxc3", null, [n("dxc4", null, [n("Bxc4", null, [n("Qc7", null, [])])])])])])])])])])])])])]),
    n("Qc2", {"name": "4.Qc2 — Classical", "idea": "White protects c3 and avoids doubled pawns.", "white": "Play a3 and take back with the queen.", "black": "Take on c3 or play ...d5."}, [n("O-O", null, [n("a3", null, [n("Bxc3+", null, [n("Qxc3", null, [n("b6", null, [n("Bg5", null, [n("Bb7", null, [n("f3", null, [n("h6", null, [n("Bh4", null, [n("d6", null, [])])])])])])])])])])])]),
    n("f3", {"name": "4.f3 — Sämisch-like", "idea": "White prepares e4 and takes a big centre.", "white": "Follow with e4 and a3.", "black": "Strike with ...d5."}, [n("d5", null, [n("a3", null, [n("Be7", null, [n("e4", null, [n("dxe4", null, [n("fxe4", null, [n("e5", null, [])])])])])])])]),
  ],
};
