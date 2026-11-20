// Qelvaris Practice — starting positions aur AI levels (pure data).
// Har position ek Italian Game line se banti hai; app chess.js se line verify karta hai.
// "objective" meri (curator ki) andaza hai, engine ne verify nahi kiya. Engine milne par
// match ke upar asli starting evaluation dikhti hai, usse tum objective ko check kar sakte ho.

import { MIDDLEGAMES } from "../middlegames/middlegameData.js";

export const PRACTICE_VERSION = 1;

// Ye strength labels abhi CALIBRATED NAHI hain (rating equivalent nahi hain).
// Skill Level Stockfish ka option hai, movetime = engine ko kitna sochne dena hai (ms).
// ids purane hi hain (saved sessions ke liye): ai_easy / ai_medium / ai_hard, naya: ai_max.
export const AI_PROFILES = [
  { id: "ai_easy", name: "Casual", skill: 5, movetime: 200, note: "Plays quickly and makes some mistakes." },
  { id: "ai_medium", name: "Club", skill: 10, movetime: 400, note: "Plays sensible chess and errs now and then." },
  { id: "ai_hard", name: "Strong", skill: 16, movetime: 800, note: "Punishes most mistakes." },
  { id: "ai_max", name: "Maximum", skill: 20, movetime: 1500, note: "Plays its best in the time it is given." },
];
export const DEFAULT_PROFILE_ID = "ai_hard";

export const OBJECTIVES = {
  convert_advantage: {
    label: "Convert the advantage",
    goal: "You are expected to be better. Win, or at least keep the advantage.",
  },
  create_chances: {
    label: "Create winning chances",
    goal: "Roughly equal. Find a plan and create chances without taking unsound risks.",
  },
  defend: {
    label: "Defend the position",
    goal: "You are expected to be worse. Resist, find defensive resources and aim for a draw or counterplay.",
  },
};

export const PRACTICE_POSITIONS = [
  {
    id: "prx_it_pianissimo_h3",
    title: "Pianissimo with h3 and ...h6",
    objective: "create_chances",
    difficulty: "Developing",
    openingId: "opn_italian_game",
    opening: "Italian Game",
    line: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O a6 Bb3 Ba7 Nbd2 O-O h3 h6",
    blurb: "Both sides are fully developed. Think about the d4 break and where your knights belong.",
  },
  {
    id: "prx_it_d4_tension",
    title: "Central tension",
    objective: "create_chances",
    difficulty: "Intermediate",
    openingId: "opn_italian_game",
    opening: "Italian Game",
    line: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5",
    blurb: "Pawns in the centre are under attack. Decide whether to exchange, advance or support.",
  },
  {
    id: "prx_it_twoknights_pawn",
    title: "A pawn up, knight attacked",
    objective: "convert_advantage",
    difficulty: "Intermediate",
    openingId: "opn_italian_game",
    opening: "Italian Game",
    line: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4",
    blurb: "White has an extra pawn but Black is active. Keep pieces safe and turn the pawn into a win.",
  },
  {
    id: "prx_it_evans",
    title: "Evans Gambit: attack for a pawn",
    objective: "create_chances",
    difficulty: "Intermediate",
    openingId: "opn_italian_game",
    opening: "Italian Game",
    line: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d6 Qb3 Qd7",
    blurb: "White is a pawn down for development. Black must now survive the initiative and untangle.",
  },
  {
    id: "prx_it_fried_liver_defence",
    title: "Fried Liver: defend the king",
    objective: "defend",
    difficulty: "Advanced",
    openingId: "opn_italian_game",
    opening: "Italian Game",
    line: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3 Nb4",
    blurb: "Black's king is exposed in the centre. Look for defensive resources and counterplay.",
  },
];

// Har middlegame lesson ki start position Match mein bhi khelne ke liye milti hai.
for (const m of MIDDLEGAMES) {
  PRACTICE_POSITIONS.push({
    id: `prx_${m.id}`,
    title: m.title,
    objective: m.match.objective,
    difficulty: m.level,
    opening: m.opening,
    line: m.line,
    blurb: m.match.blurb,
    lessonId: m.id,
  });
}
