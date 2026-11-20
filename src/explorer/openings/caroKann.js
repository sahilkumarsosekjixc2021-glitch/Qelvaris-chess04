// Caro-Kann Defence — original explanations. Moves verified by verifyTree.mjs.
import { n } from "./nodeHelper.js";

export const CARO_KANN = {
  id: "opn_caro_kann",
  name: "Caro-Kann Defence",
  side: "Black",
  trunk: "e4 c6",
  overview: {
    name: "Caro-Kann Defence",
    level: "Beginner friendly",
    idea:
      "Black prepares ...d5 with a pawn on c6, so the d5 pawn is protected and the light-squared bishop can leave before the pawn chain closes. A very solid structure.",
    white:
      "Take space with d4 and e4-e5, or open the centre and use the lead in development.",
    black:
      "Play ...d5, develop the c8-bishop outside the pawn chain, then ...e6 and ...Ne7 or ...Nf6.",
    watch:
      "Do not lock the c8-bishop behind ...e6 before it has moved out. Also avoid being passive: look for ...c5 at the right moment.",
    middlegame:
      "Solid pawn structure, long manoeuvring games, and endgames that Black often handles comfortably.",
    structures: "c6-d5 against e4/d4; the Advance leads to a French-like chain but with the bishop outside.",
    mistakes:
      "Closing in the c8-bishop, ignoring White's space advantage, and being too passive in the Advance.",
  },
  tree: [
    n(
      "d4",
      {
        name: "2.d4 — the main move",
        idea: "White takes the full centre. Black immediately challenges it with ...d5.",
        white: "Choose between the Advance (e5), the Classical (Nc3) and the Exchange (exd5).",
        black: "Answer 2.d4 with 2...d5 and be ready for all three.",
      },
      [
        n("d5", null, [
          n(
            "e5",
            {
              name: "Advance Variation",
              level: "Intermediate",
              idea: "White gains space and fixes the centre. Black's c8-bishop is the key piece and must come out first.",
              white: "Support the chain with c3 and Nf3, and attack the queenside later.",
              black: "Play ...Bf5, then ...e6 and the lever ...c5.",
              watch: "A slow ...c5 can leave White's space advantage unchallenged.",
            },
            [
              n("Bf5", null, [
                n("Nf3", null, [n("e6", null, [n("Be2", null, [n("c5")])])]),
              ]),
            ]
          ),
          n(
            "Nc3",
            {
              name: "Classical / Main Line",
              level: "Beginner friendly",
              idea: "White keeps a flexible centre and accepts an exchange of pawns on e4. Black gets a healthy structure.",
              white: "Recapture on e4, develop the knight to g3 or f3 and trade the bishop if it goes to g6.",
              black: "Take on e4 and bring the bishop out to f5 before playing ...e6.",
              watch: "The bishop on f5 needs a safe retreat; keep g6 in mind.",
            },
            [
              n(
                "dxe4",
                null,
                [
                  n(
                    "Nxe4",
                    null,
                    [
                      n("Bf5", null, [
                        n("Ng3", null, [
                          n("Bg6", null, [n("h4", null, [n("h6", null, [n("Nf3", null, [n("Nd7")])])])]),
                        ]),
                      ]),
                    ],
                    {
                      question:
                        "Black to move after 4.Nxe4. Which piece move fits the Caro-Kann idea?",
                      options: [
                        {
                          text: "4...Bf5, developing the bishop before ...e6.",
                          rating: "main",
                          why: "This is the whole point of the Caro-Kann: the bishop comes out first, then the pawn chain closes behind it.",
                        },
                        {
                          text: "4...Nf6, going for a quick trade.",
                          rating: "risky",
                          why: "It is a known idea, but White can recapture in ways that give a small lead; the bishop is still locked in.",
                        },
                        {
                          text: "4...e6, solid but too early.",
                          rating: "bad",
                          why: "The bishop on c8 is now stuck behind its own pawn, which is the problem the Caro-Kann tries to avoid.",
                        },
                      ],
                    }
                  ),
                ]
              ),
            ]
          ),
          n(
            "exd5",
            {
              name: "Exchange Variation",
              level: "Beginner friendly",
              idea: "White trades pawns and gets a simple structure; the position is quiet and equal.",
              white: "Develop with Bd3, c3 and Nf3, keep the structure and play for a small edge.",
              black: "Play ...Nc6 and ...Nf6 and aim for easy development.",
            },
            [
              n("cxd5", null, [
                n("Bd3", null, [n("Nc6", null, [n("c3", null, [n("Nf6")])])]),
                n(
                  "c4",
                  {
                    name: "Panov Attack",
                    level: "Intermediate",
                    idea: "White attacks the d5 pawn at once and gets an active, isolated-pawn type position.",
                    white: "Develop quickly and aim for d5 or Bb5 ideas.",
                    black: "Develop with ...Nf6, ...e6 and keep an eye on the isolated d5 pawn.",
                  },
                  [n("Nf6", null, [n("Nc3", null, [n("e6")])])]
                ),
              ]),
            ]
          ),
        ]),
      ]
    ),
    n(
      "Nc3",
      {
        name: "2.Nc3 — Two Knights",
        idea: "White develops first and keeps d4 for later. Often leads to the same structures.",
        white: "Play Nf3 and d4 after Black commits.",
        black: "Play ...d5 and ...Bg4 to pin the f3 knight when possible.",
      },
      [n("d5", null, [n("Nf3", null, [n("Bg4", null, [n("h3", null, [n("Bxf3", null, [n("Qxf3", null, [n("e6")])])])])])])]
    ),
    n(
      "c4",
      {
        name: "2.c4 — Accelerated lines",
        idea: "White tries a quieter, less common set-up.",
        white: "After ...d5, exchange pawns and play for the centre.",
        black: "Recapture on d5 and look for ...Nf6 to win the pawn back.",
      },
      [n("d5", null, [n("exd5", null, [n("cxd5", null, [n("cxd5", null, [n("Nf6")])])])])]
    ),
  ],
};
