// Qelvaris Study — curated exercises (pure data, no imports).
// Har exercise ek Italian Game line se banti hai (SAN). App khulte hi chess.js se line verify hoti hai
// aur uska aakhri FEN hi exercise ki starting position banta hai. Galat line skip hoti hai.
// curatorNote / themes meri likhi hui guidance hai (engine nahi). Review karke badal sakte ho.

export const STUDY_CONTENT_VERSION = 1;

export const EVAL_LEVELS = [
  { id: "white_better", label: "White is clearly better" },
  { id: "slight_white", label: "White is slightly better" },
  { id: "equal", label: "Roughly equal" },
  { id: "slight_black", label: "Black is slightly better" },
  { id: "black_better", label: "Black is clearly better" },
];

export const FACTORS = [
  { id: "king_safety", label: "King safety" },
  { id: "material", label: "Material" },
  { id: "piece_activity", label: "Piece activity" },
  { id: "pawn_structure", label: "Pawn structure" },
  { id: "weak_squares", label: "Weak squares" },
  { id: "space", label: "Space" },
  { id: "initiative", label: "Initiative / development lead" },
  { id: "tactics", label: "Tactical threats" },
];

export const PLANS = [
  { id: "worst_piece", label: "Improve the worst-placed piece" },
  { id: "weak_pawn", label: "Attack a weak pawn" },
  { id: "open_file", label: "Control an open file" },
  { id: "pawn_break", label: "Prepare a pawn break" },
  { id: "restrict", label: "Restrict an opponent piece" },
  { id: "king_safety", label: "Improve king safety" },
  { id: "exchange", label: "Create a favourable exchange" },
];

export const STUDY_EXERCISES = [
  {
    id: "stx_it_pianissimo_plan",
    title: "Pianissimo: find a plan",
    difficulty: "Developing",
    openingId: "opn_italian_game",
    type: "strategic_planning",
    line: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7",
    intro:
      "A quiet Italian middlegame. There is no forcing tactic here, so think about piece placement and plans.",
    themes: [
      "The knight on b1 is still undeveloped",
      "The a7-bishop aims at the f2/g1 diagonal",
      "The d4 break needs preparation",
    ],
    suggestedPlans: ["worst_piece", "pawn_break"],
    curatorNote:
      "White's least active piece is the b1-knight, so a typical idea is Nbd2 and then a reroute. Moves like h3 keep Black's pieces from pinning on g4. The d4 break is a longer-term plan and works best once the pieces are ready.",
  },
  {
    id: "stx_it_evans_material",
    title: "Evans Gambit: compensation or not?",
    difficulty: "Intermediate",
    openingId: "opn_italian_game",
    type: "candidate_moves",
    line: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d6 Qb3 Qd7",
    intro:
      "White has sacrificed material for development. Decide whether the compensation is real before choosing a move.",
    themes: [
      "Count material first, then count developed pieces",
      "Pressure on f7 and b7 after Qb3",
      "The pawn on d4 can be taken or ignored",
    ],
    suggestedPlans: ["exchange", "king_safety"],
    curatorNote:
      "In gambit positions, ask what the sacrificed material bought: lead in development, open lines or pressure on weak pawns. Candidate ideas include recapturing in the centre or keeping up the attack on the kingside; compare them concretely before deciding.",
  },
  {
    id: "stx_it_twoknights_e4",
    title: "Two Knights: the f3-knight is attacked",
    difficulty: "Intermediate",
    openingId: "opn_italian_game",
    type: "calculation",
    line: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4",
    intro:
      "White is a pawn up, but Black has just attacked the knight with ...e4. Calculate each reply and the opponent's best answer.",
    themes: [
      "List every square the knight can go to before choosing",
      "Check which of them leave a piece hanging",
      "Think about what the black pieces attack after each reply",
    ],
    suggestedPlans: ["exchange", "king_safety"],
    curatorNote:
      "Start with checks, captures and threats for both sides. A knight retreat is only good if it does not lose time or leave another piece loose, so calculate at least two replies for each candidate.",
  },
  {
    id: "stx_it_d4_tension",
    title: "Central tension after ...d5",
    difficulty: "Developing",
    openingId: "opn_italian_game",
    type: "position_evaluation",
    line: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5",
    intro:
      "Both sides have a pawn centre and the centre is under tension. Evaluate first, then look for candidate moves.",
    themes: [
      "e4 and d4 are both attacked",
      "White has not castled yet",
      "Decide: exchange, advance or support",
    ],
    suggestedPlans: ["pawn_break", "king_safety"],
    curatorNote:
      "When the centre is tense, compare three types of move: capturing, advancing, and supporting. Also check king safety and which side is better developed before choosing.",
  },
];
