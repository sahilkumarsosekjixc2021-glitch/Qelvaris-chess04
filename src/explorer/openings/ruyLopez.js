// Ruy Lopez — original explanations. Moves verified by verifyTree.mjs.
import { n, chain } from "./nodeHelper.js";

export const RUY_LOPEZ = {
  id: "opn_ruy_lopez",
  name: "Ruy Lopez",
  side: "White",
  trunk: "e4 e5 Nf3 Nc6 Bb5",
  overview: {
    name: "Ruy Lopez",
    level: "Intermediate",
    idea:
      "White pins (or threatens) the knight that protects e5, aiming for long-term pressure on the centre and a slow, strategic fight.",
    white:
      "Castle, support the centre with c3 and d4, and keep the bishop on the a4-e8 diagonal.",
    black:
      "Kick the bishop with ...a6 and ...b5, or choose a solid set-up such as the Berlin or ...d6.",
    watch:
      "The e5 pawn is a target, and some Black set-ups (Berlin) lead to quick endgames that are hard to win with.",
    middlegame:
      "Lots of manoeuvring: knight routes (Nbd2-f1-g3), pawn breaks c3-d4 and d4-d5, and queenside play for Black.",
    structures: "Closed centre (d3 or d4 with e5 closed) or open centre after exchanges.",
    mistakes:
      "Taking on c6 without a plan, losing time with the bishop, or rushing d4 before being prepared.",
  },
  tree: [
    n(
      "a6",
      {
        name: "Morphy Defence (3...a6)",
        idea: "Black asks the bishop what it wants to do. The main line of the Ruy Lopez.",
        white: "Retreat with Ba4 and keep the pin idea alive, or trade on c6 for structure.",
        black: "Follow with ...Nf6 and ...b5, or play solidly with ...d6.",
      },
      [
        n("Ba4", null, [
          n("Nf6", null, [
            n(
              "O-O",
              {
                name: "5.O-O — main moves",
                idea: "White castles and lets Black take e4: the e5 pawn will become a target if Black grabs it.",
                white: "Support e4 with Re1 and prepare c3 and d4.",
                black: "Choose between the solid ...Be7 and the sharper ...Nxe4.",
                watch: "Taking e4 is playable but requires knowing the following moves.",
              },
              [
                n("Be7", null, chain("Re1", "b5", "Bb3", "d6", "c3", "O-O")),
                n(
                  "Nxe4",
                  {
                    name: "Open Variation",
                    level: "Intermediate",
                    idea: "Black grabs the pawn but gives up some development; the game opens at once.",
                    white: "Open the centre with d4 and use the bishop on b3.",
                    black: "Hit the bishop with ...b5 and break the centre with ...d5.",
                  },
                  chain("d4", "b5", "Bb3", "d5", "dxe5", "Be6")
                ),
              ]
            ),
          ]),
        ]),
        n(
          "Bxc6",
          {
            name: "Exchange Variation",
            level: "Beginner friendly",
            idea: "White damages Black's pawn structure and aims for a good endgame with a healthy majority.",
            white: "Castle and play d4. The structure gives long-term chances even when queens leave.",
            black: "Use the bishop pair and open lines to compensate for the doubled pawns.",
          },
          chain("dxc6", "O-O", "f6", "d4", "exd4", "Nxd4", "c5", "Nb3", "Qxd1", "Rxd1")
        ),
      ]
    ),
    n(
      "Nf6",
      {
        name: "Berlin Defence",
        level: "Expert",
        idea: "Black counter-attacks at once. After the queens come off, the position is solid but very drawish.",
        white: "Play for the better endgame structure and a small, long edge.",
        black: "Be ready for an early endgame; the king is safe but the position is passive.",
      },
      chain("O-O", "Nxe4", "d4", "Nd6", "Bxc6", "dxc6", "dxe5", "Nf5", "Qxd8+", "Kxd8")
    ),
    n(
      "Bc5",
      {
        name: "Classical Defence (3...Bc5)",
        idea: "Black develops actively and aims at f2. A sound, older move.",
        white: "Play c3 and d4, gaining space in the centre.",
        black: "Castle and be ready for the bishop to retreat to b6.",
      },
      chain("c3", "Nf6", "O-O", "O-O", "d4", "Bb6")
    ),
    n(
      "d6",
      {
        name: "Steinitz Defence (3...d6)",
        idea: "Black protects e5 and keeps a solid, if slightly passive, centre.",
        white: "Play d4 and gain space.",
        black: "Develop with ...Bd7 and ...Nf6, castle and hold the centre.",
      },
      chain("d4", "Bd7", "Nc3", "Nf6", "O-O", "Be7")
    ),
  ],
};
