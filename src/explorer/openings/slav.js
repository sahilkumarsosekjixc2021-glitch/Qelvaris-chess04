// Slav Defence — original explanations, no book text. Moves verified by verifyOpenings.mjs.
import { n, chain } from "./nodeHelper.js";

export const SLAV = {
  id: "opn_slav_defence",
  name: "Slav Defence",
  side: "Black",
  trunk: "d4 d5 c4 c6",
  overview: {
    name: "Slav Defence",
    level: "Intermediate",
    idea:
      "Black defends d5 with a pawn from c6 and keeps the c8-bishop free to develop outside the chain. A rock-solid system against the Queen's Gambit.",
    white:
      "Develop with Nf3 and Nc3, and decide whether to open the centre with cxd5 or play for e4.",
    black:
      "Take on c4 when it is useful, develop the bishop to f5 or g4 and then play ...e6.",
    watch:
      "Do not shut the c8-bishop in. If it has not come out, delay ...e6 until it has.",
    middlegame:
      "Solid positions where Black can fight for equality, then counterattack with ...c5 or ...e5.",
    structures: "c6/d5 pawn structure with a free c8-bishop.",
    mistakes:
      "Playing ...e6 too early, and falling behind in development while holding the pawn on c4.",
  },
  tree: [
    n(
      "Nf3",
      {
        name: "3.Nf3 — main move",
        idea: "White develops and keeps a flexible pawn structure.",
        white: "Play Nc3 next and consider e3 or e4.",
        black: "Develop ...Nf6 and decide whether to take on c4.",
      },
      [
        n("Nf6", null, [
          n("Nc3", null, [
            n("dxc4", null, chain("a4", "Bf5", "e3", "e6", "Bxc4", "Bb4", "O-O", "Nbd7")),
            n("e6", null, chain("e3", "Nbd7", "Bd3", "dxc4", "Bxc4", "b5", "Bd3", "a6", "e4", "c5")),
          ]),
        ]),
      ]
    ),
    n(
      "cxd5",
      {
        name: "3.cxd5 — Exchange",
        idea: "White opens the position and tries to use the extra development. Black must be careful to remain active.",
        white: "Develop quickly with Nc3 and Bf4.",
        black: "Play natural moves and bring the bishop out to f5.",
      },
      chain("cxd5", "Nc3", "Nf6", "Bf4", "Nc6", "e3", "Bf5", "Nf3", "e6")
    ),
    n(
      "e3",
      {
        name: "3.e3 — quiet approach",
        idea: "White supports d4 and keeps a solid structure. Often leads to Semi-Slav positions.",
        white: "Develop with Nf3, Nc3 and Bd3, and play e4 at the right moment.",
        black: "Develop ...Nf6 and ...e6 and prepare ...Bd6.",
      },
      chain("Nf6", "Nc3", "e6", "Nf3", "Nbd7", "Bd3", "Bd6", "O-O", "O-O", "e4", "dxe4", "Nxe4", "Nxe4", "Bxe4")
    ),
  ],
};
