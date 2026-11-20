// Scotch Game — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const SCOTCH = {
  id: "opn_scotch_game",
  name: "Scotch Game",
  side: "White",
  trunk: "e4 e5 Nf3 Nc6 d4",
  overview: {
    name: "Scotch Game",
    level: "Intermediate",
    idea:
      "White opens the centre at once with d4. Instead of the slow build-up of the Italian, the pieces get active squares early and the game becomes open and direct.",
    white:
      "Recapture on d4 with the knight, develop quickly and use the open lines. Be ready to trade the central knight if Black attacks it.",
    black:
      "Take on d4, then hit e4 or the d4 knight with ...Nf6, ...Bc5 or ...Qh4, and complete development before White's pieces take over.",
    watch:
      "The knight on d4 is attacked several times. Count attackers and defenders before you play anything else.",
    middlegame:
      "Open files and diagonals, no pawn tension in the centre. Often a fight between White's space and development and Black's solid but cramped pieces.",
    structures: "Open centre after ...exd4 Nxd4; sometimes White gets e4-e5 space, sometimes Black is left with doubled c-pawns.",
    mistakes:
      "Leaving the d4 knight under-protected, moving the queen out early, and forgetting that e4 is attacked after ...Nf6.",
  },
  tree: [
    n(
      "exd4",
      {
        name: "3...exd4 — Black takes the pawn",
        idea: "Black accepts the offer. After White recaptures, the centre is open and both sides develop with tempo.",
        white: "Recapture with the knight (Nxd4) so the pieces face the centre.",
        black: "Attack the knight or e4 while developing a piece.",
      },
      [
        n("Nxd4", null, [
          n(
            "Nf6",
            {
              name: "4...Nf6 — attack e4",
              idea: "Black develops with a threat on the e4 pawn and prepares to trade on c6.",
              white: "Either trade on c6 and push e5, or defend e4 with Nc3.",
              black: "Aim for ...Bb4 or ...Bc5 and quick castling.",
              watch: "Do not ignore the e4 pawn. It must be defended or pushed.",
            },
            [
              n("Nxc6", null, chain("bxc6", "e5", "Qe7", "Qe2", "Nd5", "c4", "Ba6")),
              n("Nc3", null, chain("Bb4", "Nxc6", "bxc6", "Bd3", "d5", "exd5", "cxd5", "O-O", "O-O", "Bg5", "c6")),
            ]
          ),
          n(
            "Bc5",
            {
              name: "4...Bc5 — Classical",
              idea: "The bishop hits the d4 knight. White supports it with a bishop and keeps the centre intact.",
              white: "Play Be3 and c3, then develop with Bc4 and castle.",
              black: "Use the queen and the knights to keep pressure on d4.",
              watch: "A queen on f6 attacks both d4 and f2, so keep the knight protected.",
            },
            chain("Be3", "Qf6", "c3", "Nge7", "Bc4")
          ),
          n(
            "Qh4",
            {
              name: "4...Qh4 — early queen",
              idea: "The queen hits e4 and d4 in one go. White answers with a knight jump that creates its own threats.",
              white: "Play Nb5 and use the threat of Nc7+ to keep Black busy.",
              black: "Do not lose time: develop and keep the queen safe.",
            },
            chain("Nb5", "Bb4+", "c3", "Ba5")
          ),
        ]),
      ]
    ),
  ],
};
