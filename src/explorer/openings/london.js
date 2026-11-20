// London System — original explanations, no book text. Moves verified by verifyTree.mjs.
import { n } from "./nodeHelper.js";

export const LONDON = {
  id: "opn_london_system",
  name: "London System",
  side: "White",
  trunk: "d4 d5 Nf3 Nf6 Bf4",
  overview: {
    name: "London System",
    level: "Beginner friendly",
    idea:
      "White uses one set-up against almost everything: pawns on d4, e3 and c3, bishop outside the pawn chain on f4, knights on f3 and d2. Less theory to memorise, more time to learn the middlegame.",
    white:
      "Develop with e3, Bd3, Nbd2, c3 and castle. Then play for e4 (or a kingside attack) once everything is ready.",
    black:
      "Hit the centre with ...c5 or ...e5, and challenge the f4 bishop with ...Bd6 or ...Qb6 ideas.",
    watch:
      "The bishop on f4 can be hit by ...Bd6, ...Nh5 or ...e5. The b2 pawn is sometimes loose after ...c5 and ...Qb6.",
    middlegame:
      "Typical plans are the e4 break, a kingside pawn storm with h4-h5 when Black castles short, or a slow squeeze on the queenside.",
    structures: "d4-e3-c3 pawn triangle against a d5/e6/c5 set-up.",
    mistakes:
      "Playing the same moves automatically while Black has already attacked the bishop or b2 pawn, and delaying castling.",
  },
  tree: [
    n(
      "e6",
      {
        name: "3...e6 — solid reply",
        idea: "Black closes the c8-bishop in but keeps a firm centre. A calm, strategic game follows.",
        white: "Play e3, Bd3 and Nbd2, then castle.",
        black: "Aim for ...c5 and ...Nc6, or challenge the bishop with ...Bd6.",
        watch: "If Black plays ...Bd6, decide at once: keep the bishop with Bg3 or trade on d6.",
      },
      [
        n("e3", null, [
          n(
            "c5",
            {
              name: "Black hits d4 with ...c5",
              idea: "Black attacks the d4 pawn from the side, a normal plan against a quiet set-up.",
              white: "Support the centre with c3 and develop the queen's knight to d2.",
              black: "Add pressure with ...Nc6 and ...Bd6.",
            },
            [
              n("c3", null, [
                n("Nc6", null, [
                  n("Nbd2", null, [
                    n("Bd6", null, [n("Bg3", null, [n("O-O", null, [n("Bd3")])])]),
                  ]),
                ]),
              ]),
              n("Nbd2", null, [
                n(
                  "Qb6",
                  null,
                  [n("Qc1")],
                  {
                    question:
                      "Black's queen has just gone to b6, attacking the b2 pawn. What is a sensible reply for White?",
                    options: [
                      {
                        text: "Qc1, protecting b2 and keeping the position solid.",
                        rating: "main",
                        why: "The queen protects b2 and White keeps the usual set-up. It is calm and safe.",
                      },
                      {
                        text: "Nc3 or Rb1 type moves, ignoring or half-protecting the pawn.",
                        rating: "risky",
                        why: "It develops a piece but allows tricks around b2. This needs concrete calculation, not just a plan.",
                      },
                      {
                        text: "Bd3, continuing development as if nothing happened.",
                        rating: "bad",
                        why: "Black simply takes b2 and White is a pawn down with only slight compensation.",
                      },
                    ],
                  }
                ),
              ]),
            ]
          ),
          n("Bd6", null, [
            n("Bxd6", null, [n("cxd6", null, [n("Bd3")])]),
            n("Bg3", null, [n("O-O", null, [n("Nbd2", null, [n("c5")])])]),
          ]),
        ]),
      ]
    ),
    n(
      "c5",
      {
        name: "3...c5 — immediate challenge",
        idea: "Black attacks d4 straight away and tries to take the centre before White finishes setting up.",
        white: "Play e3 and Nbd2. Do not take on c5 without a reason.",
        black: "Pressure d4 with ...Nc6 and ...cxd4. Watch the b2 pawn with the queen.",
      },
      [
        n("e3", null, [
          n("Nc6", null, [n("Nbd2", null, [n("cxd4", null, [n("exd4", null, [n("Bf5")])])])]),
        ]),
      ]
    ),
    n(
      "Bf5",
      {
        name: "3...Bf5 — mirror set-up",
        idea: "Black develops the bishop outside the pawn chain too. The play is symmetrical and about small advantages.",
        white: "Play e3, then Bd3 to offer a trade of the good bishops.",
        black: "Keep the bishop active, avoid giving up the bishop pair cheaply.",
      },
      [n("e3", null, [n("e6", null, [n("Bd3", null, [n("Bxd3", null, [n("Qxd3", null, [n("Nbd7")])])])])])]
    ),
    n(
      "g6",
      {
        name: "3...g6 — fianchetto",
        idea: "Black aims the bishop at the long diagonal and keeps the structure flexible.",
        white: "Play e3, Nbd2 and c3; consider h3 and Bh2 to keep the bishop safe.",
        black: "Castle, then break with ...c5.",
      },
      [n("e3", null, [n("Bg7", null, [n("Nbd2", null, [n("O-O", null, [n("c3", null, [n("c5", null, [n("Bd3")])])])])])])]
    ),
  ],
};
