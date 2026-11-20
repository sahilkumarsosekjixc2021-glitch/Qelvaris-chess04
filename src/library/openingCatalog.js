// Qelvaris — saari openings ki list (library page ke liye).
// Nayi opening ready karni ho toh uski entry mein ready: true karo aur
// OpeningLibrary ke onOpen handler mein uska naam handle karo.
// Level / style yahan humare apne tay kiye hue hain, kisi book ya database se nahi liye.
// Win-rate jaan-boojh kar nahi hai (asli database ke bina number jhootha hota).

export const LEVELS = ["Beginner", "Intermediate", "Expert"];
export const FAMILIES = ["1.e4", "1.d4", "Flank"];

// arrows: UCI chaalein, white se shuru (alternate colour). Aakhri 3 dikhte hain.
export const CATALOG = [
  { name: "Italian Game", eco: "C50", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4", fam: "1.e4", side: "White", level: "Beginner", style: "Open game", arrows: "e2e4 e7e5 g1f3 b8c6 f1c4", ready: true },
  { name: "Vienna Game", eco: "C25", moves: "1.e4 e5 2.Nc3", fam: "1.e4", side: "White", level: "Beginner", style: "Open game", arrows: "e2e4 e7e5 b1c3" },
  { name: "Four Knights Game", eco: "C47", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6", fam: "1.e4", side: "White", level: "Beginner", style: "Open game", arrows: "g1f3 b8c6 b1c3 g8f6" },
  { name: "Scotch Game", eco: "C45", moves: "1.e4 e5 2.Nf3 Nc6 3.d4", fam: "1.e4", side: "White", level: "Intermediate", style: "Open game", arrows: "e2e4 e7e5 g1f3 b8c6 d2d4" },
  { name: "Ruy Lopez", eco: "C60", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5", fam: "1.e4", side: "White", level: "Intermediate", style: "Classical", arrows: "e2e4 e7e5 g1f3 b8c6 f1b5" },
  { name: "King's Gambit", eco: "C30", moves: "1.e4 e5 2.f4", fam: "1.e4", side: "White", level: "Expert", style: "Gambit", arrows: "e2e4 e7e5 f2f4" },
  { name: "Petrov Defence", eco: "C42", moves: "1.e4 e5 2.Nf3 Nf6", fam: "1.e4", side: "Black", level: "Beginner", style: "Solid", arrows: "e2e4 e7e5 g1f3 g8f6" },
  { name: "Philidor Defence", eco: "C41", moves: "1.e4 e5 2.Nf3 d6", fam: "1.e4", side: "Black", level: "Beginner", style: "Solid", arrows: "e2e4 e7e5 g1f3 d7d6" },
  { name: "Caro-Kann Defence", eco: "B10", moves: "1.e4 c6", fam: "1.e4", side: "Black", level: "Beginner", style: "Solid", arrows: "e2e4 c7c6" },
  { name: "Scandinavian Defence", eco: "B01", moves: "1.e4 d5", fam: "1.e4", side: "Black", level: "Beginner", style: "Solid", arrows: "e2e4 d7d5" },
  { name: "French Defence", eco: "C00", moves: "1.e4 e6", fam: "1.e4", side: "Black", level: "Intermediate", style: "Solid", arrows: "e2e4 e7e6" },
  { name: "Sicilian Defence", eco: "B20", moves: "1.e4 c5", fam: "1.e4", side: "Black", level: "Intermediate", style: "Sharp", arrows: "e2e4 c7c5" },
  { name: "Modern Defence", eco: "B06", moves: "1.e4 g6", fam: "1.e4", side: "Black", level: "Intermediate", style: "Hypermodern", arrows: "e2e4 g7g6" },
  { name: "Pirc Defence", eco: "B07", moves: "1.e4 d6 2.d4 Nf6", fam: "1.e4", side: "Black", level: "Expert", style: "Hypermodern", arrows: "e2e4 d7d6 d2d4 g8f6" },
  { name: "Alekhine's Defence", eco: "B02", moves: "1.e4 Nf6", fam: "1.e4", side: "Black", level: "Expert", style: "Hypermodern", arrows: "e2e4 g8f6" },
  { name: "London System", eco: "D02", moves: "1.d4 d5 2.Nf3 Nf6 3.Bf4", fam: "1.d4", side: "White", level: "Beginner", style: "Solid", arrows: "d2d4 d7d5 g1f3 g8f6 c1f4" },
  { name: "Stonewall Attack", eco: "D00", moves: "1.d4 d5 2.e3", fam: "1.d4", side: "White", level: "Beginner", style: "Solid", arrows: "d2d4 d7d5 e2e3" },
  { name: "Queen's Gambit", eco: "D06", moves: "1.d4 d5 2.c4", fam: "1.d4", side: "White", level: "Intermediate", style: "Gambit", arrows: "d2d4 d7d5 c2c4" },
  { name: "Catalan Opening", eco: "E00", moves: "1.d4 Nf6 2.c4 e6 3.g3", fam: "1.d4", side: "White", level: "Expert", style: "Solid", arrows: "d2d4 g8f6 c2c4 e7e6 g2g3" },
  { name: "Queen's Gambit Declined", eco: "D30", moves: "1.d4 d5 2.c4 e6", fam: "1.d4", side: "Black", level: "Intermediate", style: "Solid", arrows: "d2d4 d7d5 c2c4 e7e6" },
  { name: "Slav Defence", eco: "D10", moves: "1.d4 d5 2.c4 c6", fam: "1.d4", side: "Black", level: "Intermediate", style: "Solid", arrows: "d2d4 d7d5 c2c4 c7c6" },
  { name: "Dutch Defence", eco: "A80", moves: "1.d4 f5", fam: "1.d4", side: "Black", level: "Intermediate", style: "Sharp", arrows: "d2d4 f7f5" },
  { name: "King's Indian Defence", eco: "E60", moves: "1.d4 Nf6 2.c4 g6", fam: "1.d4", side: "Black", level: "Expert", style: "Hypermodern", arrows: "d2d4 g8f6 c2c4 g7g6" },
  { name: "Nimzo-Indian Defence", eco: "E20", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4", fam: "1.d4", side: "Black", level: "Expert", style: "Hypermodern", arrows: "c2c4 e7e6 b1c3 f8b4" },
  { name: "Grünfeld Defence", eco: "D80", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5", fam: "1.d4", side: "Black", level: "Expert", style: "Hypermodern", arrows: "c2c4 g7g6 b1c3 d7d5" },
  { name: "Benoni Defence", eco: "A60", moves: "1.d4 Nf6 2.c4 c5", fam: "1.d4", side: "Black", level: "Expert", style: "Sharp", arrows: "d2d4 g8f6 c2c4 c7c5" },
  { name: "Benko Gambit", eco: "A57", moves: "1.d4 Nf6 2.c4 c5 3.d5 b5", fam: "1.d4", side: "Black", level: "Expert", style: "Gambit", arrows: "c2c4 c7c5 d4d5 b7b5" },
  { name: "English Opening", eco: "A10", moves: "1.c4", fam: "Flank", side: "White", level: "Intermediate", style: "Hypermodern", arrows: "c2c4" },
  { name: "Réti Opening", eco: "A04", moves: "1.Nf3", fam: "Flank", side: "White", level: "Intermediate", style: "Hypermodern", arrows: "g1f3" },
  { name: "Bird's Opening", eco: "A02", moves: "1.f4", fam: "Flank", side: "White", level: "Intermediate", style: "Sharp", arrows: "f2f4" },
];
