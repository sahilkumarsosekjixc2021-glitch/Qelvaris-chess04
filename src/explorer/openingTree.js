// Qelvaris Explore — Italian Game variation data (pure data, no imports).
// Moves SAN mein hain. Har move app mein chess.js se verify hoti hai (openingTreeBuild.js).
// Explanations original hain (kisi book se copy nahi). Win-rate abhi nahi: real database chahiye (baad mein).
// Children ki list mein pehla child = main line.

export const ITALIAN_ID = "opn_italian_game";
export const ITALIAN_TRUNK = "e4 e5 Nf3 Nc6 Bc4";

export const ITALIAN_OVERVIEW = {
  name: "Italian Game",
  level: "Beginner friendly",
  idea:
    "White develops fast, points the bishop at f7 (Black's weakest square early on) and prepares to take the centre with c3 and d4.",
  white:
    "Finish development, castle, then fight for the centre with c3 + d4. Keep the bishop on the a2-g8 diagonal.",
  black:
    "Block the diagonal and fight for the centre too: ...Bc5 (symmetry), ...Nf6 (counter-attack on e4) or ...Be7 (solid).",
  watch:
    "Early Ng5 ideas against f7, and moving the same piece twice while the centre is still closed. Do not grab pawns instead of developing.",
  middlegame:
    "Typical structures: a slow manoeuvring game (pawns on c3/d3) or an open game after d4 breaks the centre. Kingside castling for both sides is common, so watch the f7/f2 squares and the e-file.",
  structures: "e4 vs e5 centre, c3-d4 break, or open centre after exchanges on d4.",
  mistakes:
    "Playing Ng5 too early without support, forgetting to castle, trading the bishop for the knight for no reason.",
};

const n = (san, info = null, children = [], critical = null) => ({
  san,
  info,
  critical,
  children,
});

export const ITALIAN_TREE = [
  // ---------------- 3...Bc5 Giuoco Piano ----------------
  n(
    "Bc5",
    {
      name: "Giuoco Piano",
      level: "Beginner friendly",
      idea:
        "Both sides mirror each other: bishops aim at the f2/f7 squares and the fight is about who controls the centre first.",
      white:
        "Prepare c3 and d4 to build a big centre, or play slowly with d3 and keep everything protected.",
      black:
        "Keep the position balanced: develop ...Nf6, castle, and be ready to answer d4 with ...exd4 and ...Bb4+.",
      watch:
        "Both bishops eye a weak f-pawn. A quick Ng5 or ...Ng4 tactic can work if the f-pawn is not protected.",
      middlegame:
        "Either a calm manoeuvring game or an open fight in the centre, depending on whether White plays d4.",
    },
    [
      n(
        "c3",
        {
          name: "4.c3 — preparing d4",
          idea:
            "White wants pawns on c3 and d4 together, to get a strong centre and a place for the bishop to retreat (b3).",
          white: "Follow with d4 (sharp) or d3 (slow and solid).",
          black: "Hit the centre at once with ...Nf6 and be ready for d4.",
          watch: "After c3, the d4 break is the main threat, so react to it on time.",
        },
        [
          n("Nf6", null, [
            n(
              "d3",
              {
                name: "Giuoco Pianissimo",
                level: "Beginner friendly",
                idea:
                  "The 'very quiet' Italian. White keeps the centre closed, finishes development and prepares a slow plan.",
                white:
                  "Castle, play Re1, Nbd2-f1-g3 (knight reroute), and a4/Bb3 to keep the bishop safe. Later think about the d4 break.",
                black:
                  "Castle, play ...a6 and ...Ba7 to keep the bishop safe, and prepare ...d5 or ...Ne7-g6 ideas.",
                watch:
                  "Do not play d4 too early if your pieces are not ready. The pin on f3 (Bg5) is a common idea for both sides.",
                middlegame:
                  "A slow, strategic game. Plans matter more than tactics: improve your worst piece and wait for the right pawn break.",
              },
              [
                n("d6", null, [
                  n("O-O", null, [
                    n("O-O", null, [
                      n(
                        "Re1",
                        {
                          name: "Main Pianissimo set-up",
                        },
                        [
                          n("a6", null, [
                            n("Bb3", null, [n("Ba7")]),
                          ]),
                        ],
                        {
                          question:
                            "Both sides have castled. What is White's most useful plan here?",
                          options: [
                            {
                              text: "Reroute the knight with Nbd2-f1-g3 and keep the bishop safe with a4/Bb3.",
                              rating: "main",
                              why: "This is the standard plan: the b1-knight is stuck behind the d-pawn, so it travels to the kingside while the bishop avoids ...a6 and ...b5.",
                            },
                            {
                              text: "Push h4 and g4 immediately to attack the king.",
                              rating: "bad",
                              why: "Pawn storms need the centre to be open or favourable. Here the centre is closed, so this only weakens your own king.",
                            },
                            {
                              text: "Trade the light-squared bishop for the knight on c6 right away.",
                              rating: "risky",
                              why: "It gives up your most active piece without gaining anything concrete. Keep the bishop unless there is a clear reason.",
                            },
                          ],
                        }
                      ),
                    ]),
                  ]),
                ]),
              ]
            ),
            n(
              "d4",
              {
                name: "Central break 5.d4",
                level: "Intermediate",
                idea:
                  "White opens the centre at once. Black takes on d4 and gives a check with the bishop, forcing White to decide how to block it.",
                white:
                  "After ...Bb4+, either block with Bd2 (solid) or Nc3 (sharp, pawn sacrifice).",
                black:
                  "Take on d4, check on b4, and be ready to return a pawn if needed to finish development.",
                watch:
                  "In the sharp line the e4-pawn is attacked by the knight — count attackers and defenders every move.",
                middlegame:
                  "Open lines, active pieces and a lead in development matter more than extra pawns.",
              },
              [
                n("exd4", null, [
                  n("cxd4", null, [
                    n("Bb4+", null, [
                      n(
                        "Bd2",
                        {
                          name: "7.Bd2 (solid)",
                          idea: "White blocks with the bishop and offers a trade.",
                          white: "Recapture with the knight and fight for the centre with a big pawn pair.",
                          black: "Take the bishop pair away, then challenge the centre with ...d5.",
                          watch: "After the trade, ...d5 is the key freeing move for Black.",
                        },
                        [
                          n("Bxd2+", null, [
                            n("Nbxd2", null, [n("d5")]),
                          ]),
                        ]
                      ),
                      n(
                        "Nc3",
                        {
                          name: "7.Nc3 (sharp)",
                          idea: "White offers the e4-pawn for quick development and an attack.",
                          white: "Castle quickly and use open lines against the black king.",
                          black: "Accept the pawn but be careful: your king is still in the centre.",
                          watch: "Opening lines in the centre with the king still uncastled is risky for both sides.",
                        },
                        [
                          n("Nxe4", null, [
                            n("O-O", null, [
                              n("Bxc3", null, [n("bxc3", null, [n("d5")])]),
                            ]),
                          ]),
                        ]
                      ),
                    ]),
                  ]),
                ]),
              ]
            ),
          ]),
        ]
      ),
      n(
        "d3",
        {
          name: "4.d3 — quiet move order",
          idea: "White keeps things protected and delays c3. Often transposes into the Pianissimo.",
          white: "Develop calmly: ...Nf6, c3, O-O is a common order.",
          black: "Develop normally and keep ...d6 in mind.",
        },
        [
          n("Nf6", null, [
            n("c3", null, [n("d6", null, [n("O-O")])]),
          ]),
        ]
      ),
      n(
        "b4",
        {
          name: "Evans Gambit",
          level: "Intermediate",
          idea:
            "White sacrifices a pawn on move 4 to get a big centre and quick attacking chances against Black's bishop and king.",
          white:
            "After c3 and d4, open the centre and bring pieces out quickly. The pawn is a price for activity.",
          black:
            "Accept the pawn but return it at the right moment, or decline and keep the position solid.",
          watch:
            "If Black holds the extra pawn too long, White's attack on the centre and king can become dangerous. Count tempi.",
          middlegame:
            "Open, tactical and attacking for White. Black's task is to survive the first attack and keep the material or return it safely.",
        },
        [
          n("Bxb4", { name: "Evans Gambit Accepted" }, [
            n("c3", null, [
              n("Ba5", null, [
                n(
                  "d4",
                  null,
                  [
                    n("exd4", null, [
                      n("O-O", null, [
                        n("d6", null, [n("Qb3", null, [n("Qd7")])]),
                      ]),
                    ]),
                  ],
                  {
                    question:
                      "White has sacrificed a pawn. What is the idea of 6.d4?",
                    options: [
                      {
                        text: "Open the centre quickly so that development lead becomes an attack.",
                        rating: "main",
                        why: "The pawn is given for time. d4 attacks e5 and opens lines before Black's pieces are ready.",
                      },
                      {
                        text: "Win back the b-pawn immediately.",
                        rating: "bad",
                        why: "The b-pawn is not directly regained. The point of the gambit is activity, not material.",
                      },
                      {
                        text: "Offer a queen trade to reach a calm endgame.",
                        rating: "bad",
                        why: "White wants complications and open lines, not a quiet endgame a pawn down.",
                      },
                    ],
                  }
                ),
              ]),
            ]),
          ]),
          n("Bb6", { name: "Evans Gambit Declined", idea: "Black keeps the bishop safe and refuses the pawn.",
            white: "Reply with a4 to threaten the bishop and gain time.",
            black: "Play ...a6 to keep the bishop on b6, then develop calmly." }, [
            n("a4", null, [
              n("a6", null, [n("Nc3", null, [n("Nf6", null, [n("d3")])])]),
            ]),
          ]),
        ]
      ),
    ]
  ),

  // ---------------- 3...Nf6 Two Knights ----------------
  n(
    "Nf6",
    {
      name: "Two Knights Defense",
      level: "Intermediate",
      idea:
        "Black ignores the bishop and attacks e4 at once. It leads to sharper play than the Giuoco Piano.",
      white:
        "Choose between the quiet d3 or the sharp Ng5, attacking f7.",
      black:
        "Counter-attack in the centre with ...d5 if White plays Ng5 — do not just defend.",
      watch:
        "After Ng5 d5 exd5 you must choose a recapture carefully; one of them leads to a dangerous attack.",
      middlegame:
        "Sharp tactical play if Ng5 is played, otherwise it often transposes to the Giuoco Pianissimo.",
    },
    [
      n(
        "Ng5",
        {
          name: "4.Ng5 — attack on f7",
          idea: "White threatens Nxf7 and wants Black to react to it.",
          white: "Follow with exd5 after ...d5 and try to keep the initiative.",
          black: "Hit back at once with ...d5.",
          watch: "Do not play ...Nxe4 or ...Bc5 here — they lose time or material.",
        },
        [
          n("d5", null, [
            n(
              "exd5",
              null,
              [
                n(
                  "Na5",
                  {
                    name: "Main line 5...Na5",
                    idea: "Black avoids the Fried Liver and kicks the bishop away. The pawn on d5 will be won back later.",
                    white: "Play Bb5+ and c6 dxc6 to gain a tempo, then keep the extra pawn and avoid tricks.",
                    black: "Win back the pawn with ...bxc6 and active play with ...h6, ...e4.",
                    watch: "White is a pawn up but Black has good piece play, so avoid greedy moves.",
                  },
                  [
                    n("Bb5+", null, [
                      n("c6", null, [
                        n("dxc6", null, [
                          n("bxc6", null, [
                            n("Be2", null, [
                              n("h6", null, [n("Nf3", null, [n("e4")])]),
                            ]),
                          ]),
                        ]),
                      ]),
                    ]),
                  ]
                ),
                n(
                  "Nxd5",
                  {
                    name: "Fried Liver set-up",
                    level: "Intermediate",
                    idea:
                      "Black recaptures at once. White can answer with a famous knight sacrifice on f7.",
                    white: "Play Nxf7 and then Qf3+ — the black king is pulled into the open.",
                    black: "Be very careful: the king on e6 is exposed. Prefer the Na5 line unless you know the theory.",
                    watch: "The f7 pawn is only protected by the king. Count attackers before recapturing.",
                  },
                  [
                    n("Nxf7", null, [
                      n("Kxf7", null, [
                        n("Qf3+", null, [n("Ke6", null, [n("Nc3", null, [n("Nb4")])])]),
                      ]),
                    ]),
                  ]
                ),
              ],
              {
                question:
                  "Black to move after 5.exd5. Which recapture is the usual practical choice?",
                options: [
                  {
                    text: "5...Na5, moving the knight and keeping the king safe.",
                    rating: "main",
                    why: "This is the main theoretical reply. Black gives up a pawn temporarily but avoids the dangerous knight sacrifice on f7.",
                  },
                  {
                    text: "5...Nxd5, recapturing immediately.",
                    rating: "risky",
                    why: "It regains the pawn but allows Nxf7 and a strong attack on the king. Playable only if you know the theory.",
                  },
                  {
                    text: "5...b5, a gambit idea to attack the bishop.",
                    rating: "risky",
                    why: "It is a known sharp idea, but it needs precise preparation and gives White an extra pawn.",
                  },
                ],
              }
            ),
          ]),
        ]
      ),
      n(
        "d3",
        {
          name: "4.d3 — quiet set-up",
          idea: "White refuses the sharp lines and plays like in the Pianissimo.",
          white: "Follow with c3, castle and a slow build-up.",
          black: "Develop with ...Bc5 or ...Be7 and castle.",
        },
        [
          n("Bc5", null, [n("c3", null, [n("d6", null, [n("O-O")])])]),
        ]
      ),
    ]
  ),

  // ---------------- 3...Be7 Hungarian ----------------
  n(
    "Be7",
    {
      name: "Hungarian Defense",
      level: "Beginner friendly",
      idea: "A solid but passive reply. Black keeps the position safe but gives White more space.",
      white: "Take space with d4 and develop with ease.",
      black: "Stay solid and look for chances to break with ...d5 later.",
      watch: "Passive play can let White build a big centre — do not fall behind in development.",
    },
    [n("d4", null, [n("d6")])]
  ),
];
