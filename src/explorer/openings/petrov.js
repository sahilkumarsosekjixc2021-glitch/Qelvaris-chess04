// Petrov Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const PETROV = {
  id: "opn_petrov_defence",
  name: "Petrov Defence",
  side: "Black",
  trunk: "e4 e5 Nf3 Nf6",
  overview: {
    name: "Petrov Defence",
    level: "Beginner friendly",
    idea:
      "Instead of defending e5, Black counterattacks e4. The idea is to trade pieces, reach a solid structure and equalise without risk.",
    white:
      "Play Nxe5 or d4, but be careful not to take e5 without a plan. A solid d3 or Nc3 set-up is also possible.",
    black:
      "Meet 3.Nxe5 with ...d6, kick the knight back and then take on e4 once it is safe.",
    watch:
      "Never take on e4 too early. Always kick the knight with ...d6 first, otherwise tactics on the e-file cost material.",
    middlegame:
      "Calm and symmetrical positions with trades, where Black's solid structure and good piece activity make life easy.",
    structures: "e4-d4 vs d5-e6 central pawns with a symmetrical feel.",
    mistakes:
      "Taking on e4 before playing ...d6, and ignoring White's Nxe5 idea.",
  },
  tree: [
    n(
      "Nxe5",
      {
        name: "3.Nxe5 — the main test",
        idea: "White takes the pawn and invites Black to counterattack. Black must not recapture on e4 at once.",
        white: "Do not pretend to be winning a pawn. Play for a normal development.",
        black: "Kick the knight with ...d6 and then recapture on e4.",
        watch: "3...Nxe4? runs into Qe2 and a pin on the e-file.",
      },
      [
        n(
          "d6",
          null,
          chain("Nf3", "Nxe4", "d4", "d5", "Bd3", "Nc6", "O-O", "Be7", "c4", "Nb4", "Be2", "O-O", "Nc3", "Bf5", "a3", "Nxc3", "bxc3", "Nc6")
        ),
      ],
      {
        question:
          "White has just taken on e5. What is Black's best reply?",
        options: [
          {
            text: "d6, kicking the knight away first.",
            rating: "main",
            why: "The knight has to retreat, and only then does Black take on e4 with a healthy position.",
          },
          {
            text: "Nc6, developing and ignoring the knight.",
            rating: "risky",
            why: "White trades on c6 and Black's structure gets worse. It can be played, but it is less comfortable.",
          },
          {
            text: "Nxe4, grabbing the pawn straight away.",
            rating: "bad",
            why: "After Qe2 the knight is pinned. One careless move such as ...Nf6 even loses the queen to Nc6+.",
          },
        ],
      }
    ),
    n(
      "d4",
      {
        name: "3.d4 — central strike",
        idea: "White does not take e5 but opens the centre at once.",
        white: "Develop with Bd3 and castle; trade on e5 when it fits.",
        black: "Take on e4, support with ...d5 and develop the pieces.",
      },
      chain("Nxe4", "Bd3", "d5", "Nxe5", "Nd7", "Nxd7", "Bxd7", "O-O", "Bd6", "c4", "c6")
    ),
    n(
      "Nc3",
      {
        name: "3.Nc3 — Four Knights style",
        idea: "White develops quietly. Black answers with natural moves and avoids early pawn grabs.",
        white: "Pin the knight with Bb5 and aim for a quiet game.",
        black: "Play ...Nc6 and ...Bb4 to trade pieces.",
      },
      chain("Nc6", "Bb5", "Bb4", "O-O", "O-O", "d3", "Bxc3", "bxc3", "d6", "Bg5", "Bg4")
    ),
  ],
};
