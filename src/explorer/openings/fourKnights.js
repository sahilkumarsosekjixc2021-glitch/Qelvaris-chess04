// Four Knights Game — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n } from "./nodeHelper.js";

export const FOUR_KNIGHTS = {
  id: "opn_four_knights",
  name: "Four Knights Game",
  side: "White",
  trunk: "e4 e5 Nf3 Nc6 Nc3 Nf6",
  overview: {
    "name": "Four Knights Game",
    "level": "Beginner friendly",
    "idea": "Both sides develop all four knights to natural squares. A solid, classical opening where the plans are easy to understand and there is little to memorise.",
    "white": "Develop the bishops, castle, and then choose between a quiet set-up with d3 or the open fight with d4.",
    "black": "Mirror White's development, pin the c3 knight with ...Bb4 and castle before opening the centre.",
    "watch": "Do not rush the d4 break before your pieces are ready, and watch the pin on the c3 knight.",
    "middlegame": "A calm manoeuvring game in the Spanish line, or an open game with chances for both sides after d4.",
    "structures": "Open e-file after d4 exchanges, or a closed centre with pawns on d3 and e4.",
    "mistakes": "Pushing d4 too early, ignoring the pin ...Bb4, and trading pieces without a plan."
},
  tree: [
    n("Bb5", {"name": "4.Bb5 — Spanish Four Knights", "idea": "White pins the c6 knight and builds slowly. A very solid line where both sides castle.", "white": "Castle, play d3 and Bg5 to pin the knight.", "black": "Copy the set-up with ...Bb4 and ...d6, or break with ...Nd4.", "watch": "Trades on c3 give White doubled pawns, so know what you get for them."}, [n("Bb4", null, [n("O-O", null, [n("O-O", null, [n("d3", null, [n("d6", null, [n("Bg5", null, [n("Bxc3", null, [n("bxc3", null, [n("Qe7", null, [n("Re1", null, [n("Nd8", null, [n("d4", null, [n("Ne6", null, [])])])])])])])])])])])])])]),
    n("d4", {"name": "4.d4 — Scotch Four Knights", "idea": "White opens the centre and the game becomes sharper.", "white": "Recapture on d4 and develop quickly.", "black": "Pin the c3 knight with ...Bb4."}, [n("exd4", null, [n("Nxd4", null, [n("Bb4", null, [n("Nxc6", null, [n("bxc6", null, [n("Bd3", null, [n("d5", null, [n("exd5", null, [n("cxd5", null, [n("O-O", null, [n("O-O", null, [n("Bg5", null, [n("c6", null, [])])])])])])])])])])])])])]),
    n("Bc4", {"name": "4.Bc4 — Italian Four Knights", "idea": "White develops towards f7 and invites a central fight.", "white": "Develop the bishop and castle quickly.", "black": "Hit e4 with ...Nxe4 and win the centre back with ...d5."}, [n("Nxe4", null, [n("Nxe4", null, [n("d5", null, [n("Bd3", null, [n("dxe4", null, [n("Bxe4", null, [])])])])])])]),
  ],
};
