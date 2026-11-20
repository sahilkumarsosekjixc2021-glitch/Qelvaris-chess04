// Scandinavian Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const SCANDINAVIAN = {
  id: "opn_scandinavian",
  name: "Scandinavian Defence",
  side: "Black",
  trunk: "e4 d5",
  overview: {
    name: "Scandinavian Defence",
    level: "Beginner friendly",
    idea:
      "Black challenges the e4 pawn immediately. After the exchange Black gets an open position and a clear plan, at the price of a few tempi spent on the queen.",
    white:
      "Gain time against the queen with Nc3 and d4, then develop quickly and aim for a lead in development.",
    black:
      "Bring the queen to a safe square, develop the pieces and castle. Aim for solid structure and counterplay with ...c6 and ...Bf5.",
    watch:
      "The queen can be chased by Nc3 and by developing pieces with tempo. Do not play the queen out again and again.",
    middlegame:
      "Open and active play. If Black survives the opening the structure is healthy and the c8-bishop can be developed outside the pawn chain.",
    structures: "Pawn structure with c6/d5, or an open centre after trading on d5.",
    mistakes:
      "Moving the queen several times, ignoring development and falling for Bf4 or Bd2 tempo gains.",
  },
  tree: [
    n(
      "exd5",
      {
        name: "2.exd5 — main line",
        idea: "White wins a pawn for the moment. Black will regain it by recapturing with the queen or a knight.",
        white: "Develop with tempo against the black queen.",
        black: "Recapture quickly and develop with ...Nf6 and ...Bf5 or ...Bg4.",
      },
      [
        n(
          "Qxd5",
          {
            name: "2...Qxd5 — queen recapture",
            idea: "Black takes back at once and lets White chase the queen. The queen will be safe on a5 or d6.",
            white: "Play Nc3 to gain a tempo and fight for the centre.",
            black: "Move the queen to a5 or d6 and develop with ...Nf6.",
          },
          [
            n(
              "Nc3",
              null,
              [
                n("Qa5", null, chain("d4", "Nf6", "Nf3", "c6", "Bc4", "Bf5", "Bd2", "e6", "Qe2", "Bb4")),
                n("Qd6", null, chain("d4", "Nf6", "Nf3", "a6", "g3", "Bg4")),
              ],
              {
                question:
                  "White has just played Nc3, attacking Black's queen on d5. Where should Black put the queen?",
                options: [
                  {
                    text: "Qa5 (or Qd6): a safe square, so Black can finish development.",
                    rating: "main",
                    why: "The queen keeps an eye on the centre and cannot be hit by much. Both squares are standard.",
                  },
                  {
                    text: "Qe5+, giving check straight away.",
                    rating: "risky",
                    why: "White blocks with a developing move and the queen is hit again soon. Black wastes time.",
                  },
                  {
                    text: "Qxg2, grabbing the pawn.",
                    rating: "bad",
                    why: "The bishop on f1 guards g2, so the queen is simply lost.",
                  },
                ],
              }
            ),
          ]
        ),
        n(
          "Nf6",
          {
            name: "2...Nf6 — knight recapture",
            idea: "Black delays the recapture and keeps the queen at home. White has to decide whether to hold the extra pawn.",
            white: "Play d4 and meet ...Nxd5 with natural development.",
            black: "Regain the pawn with ...Nxd5 and build a solid position.",
          },
          chain("d4", "Nxd5", "Nf3", "g6", "c4", "Nb6", "Nc3", "Bg7", "Be3", "O-O", "Be2")
        ),
      ]
    ),
    n(
      "Nc3",
      {
        name: "2.Nc3 — quieter approach",
        idea: "White develops first and lets Black take on e4. The structure then looks like a Caro-Kann.",
        white: "Recapture on e4 and develop with Nf3 and Bd3.",
        black: "Develop the light-squared bishop before closing the centre.",
      },
      chain("dxe4", "Nxe4", "Bf5", "Ng3", "Bg6", "h4", "h6", "Nf3", "Nd7", "h5", "Bh7", "Bd3", "Bxd3", "cxd3", "e6")
    ),
  ],
};
