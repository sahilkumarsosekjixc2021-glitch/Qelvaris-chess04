// King's Indian Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const KINGS_INDIAN = {
  id: "opn_kings_indian",
  name: "King's Indian Defence",
  side: "Black",
  trunk: "d4 Nf6 c4 g6",
  overview: {
    name: "King's Indian Defence",
    level: "Expert",
    idea:
      "Black lets White build a big pawn centre, then attacks it with pieces and the ...e5 or ...c5 break. The bishop on g7 is the key piece.",
    white:
      "Take space with e4 and d4, develop and decide between the Classical, Sämisch or fianchetto systems.",
    black:
      "Castle early, play ...d6 and ...e5, then use the kingside pawn storm with ...f5 or the queenside counterplay.",
    watch:
      "The kingside attack takes time. If White blocks the centre with d5 first, Black must find the right pawn break.",
    middlegame:
      "Opposite-side plans: White plays on the queenside with c5 and b4, Black attacks the king with ...f5 and ...g5.",
    structures: "Closed centre with d5 against e5 and a kingside pawn storm.",
    mistakes:
      "Playing too slowly while White gets queenside play, and ignoring the central break ...e5.",
  },
  tree: [
    n(
      "Nc3",
      {
        name: "3.Nc3 — main set-up",
        idea: "White develops naturally and prepares e4. The fight is about whether Black can strike back in the centre.",
        white: "Play e4 and Nf3, then castle.",
        black: "Play ...Bg7, ...d6 and castle before breaking.",
      },
      [
        n("Bg7", null, [
          n("e4", null, [
            n("d6", null, [
              n(
                "Nf3",
                {
                  name: "Classical",
                  idea: "White builds with natural moves. Black prepares ...e5.",
                  white: "Castle, then decide between Be2 and Bd3.",
                  black: "Play ...O-O and ...e5 and be ready for d5.",
                },
                chain("O-O", "Be2", "e5", "O-O", "Nc6", "d5", "Ne7", "Ne1", "Nd7", "Be3", "f5", "f3", "f4", "Bf2", "g5")
              ),
              n(
                "f3",
                {
                  name: "Sämisch",
                  idea: "White supports e4 with a pawn and prepares to castle queenside.",
                  white: "Play Be3 and Qd2 and think about attacking on the kingside.",
                  black: "Strike at the centre with ...e5 or ...c5.",
                },
                chain("O-O", "Be3", "e5", "Nge2", "c6", "Qd2", "Nbd7")
              ),
            ]),
          ]),
        ]),
      ]
    ),
    n(
      "Nf3",
      {
        name: "3.Nf3 — fianchetto",
        idea: "White avoids a big centre and uses a bishop on the long diagonal.",
        white: "Play g3, Bg2 and castle, then expand with e4.",
        black: "Develop and prepare ...e5 or ...c5.",
      },
      chain("Bg7", "g3", "O-O", "Bg2", "d6", "O-O", "Nbd7", "Nc3", "e5", "e4", "c6", "h3", "Qb6")
    ),
  ],
};
