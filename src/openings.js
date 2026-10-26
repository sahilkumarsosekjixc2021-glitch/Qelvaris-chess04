// Chhoti opening list. Format: [naam, "SAN moves bina number ke"].
// Review (Book label + opening naam) aur baad mein Openings page isi ko use karte hain.

const LINES = [
  ["King's Pawn Game", "e4"],
  ["Queen's Pawn Game", "d4"],
  ["English Opening", "c4"],
  ["Zukertort Opening", "Nf3"],
  ["Bird's Opening", "f4"],
  ["Larsen's Opening", "b3"],

  ["Open Game", "e4 e5"],
  ["Italian Game", "e4 e5 Nf3 Nc6 Bc4"],
  ["Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5"],
  ["Giuoco Pianissimo", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3"],
  ["Evans Gambit", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4"],
  ["Two Knights Defense", "e4 e5 Nf3 Nc6 Bc4 Nf6"],
  ["Fried Liver Attack", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7"],
  ["Ruy Lopez", "e4 e5 Nf3 Nc6 Bb5"],
  ["Ruy Lopez: Morphy Defense", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O"],
  ["Ruy Lopez: Exchange", "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6"],
  ["Ruy Lopez: Berlin Defense", "e4 e5 Nf3 Nc6 Bb5 Nf6"],
  ["Scotch Game", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4"],
  ["Four Knights Game", "e4 e5 Nf3 Nc6 Nc3 Nf6"],
  ["Petrov's Defense", "e4 e5 Nf3 Nf6"],
  ["Philidor Defense", "e4 e5 Nf3 d6"],
  ["Latvian Gambit", "e4 e5 Nf3 f5"],
  ["King's Gambit", "e4 e5 f4"],
  ["Vienna Game", "e4 e5 Nc3"],
  ["Bishop's Opening", "e4 e5 Bc4"],
  ["Center Game", "e4 e5 d4 exd4 Qxd4"],
  ["Danish Gambit", "e4 e5 d4 exd4 c3"],

  ["Sicilian Defense", "e4 c5"],
  ["Sicilian Defense: Najdorf", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"],
  ["Sicilian Defense: Dragon", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6"],
  ["Sicilian Defense: Sveshnikov", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5"],
  ["Sicilian Defense: Rossolimo", "e4 c5 Nf3 Nc6 Bb5"],
  ["Sicilian Defense: Kan", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6"],
  ["Sicilian Defense: Alapin", "e4 c5 c3"],
  ["French Defense", "e4 e6"],
  ["French Defense: Advance", "e4 e6 d4 d5 e5"],
  ["French Defense: Winawer", "e4 e6 d4 d5 Nc3 Bb4"],
  ["French Defense: Tarrasch", "e4 e6 d4 d5 Nd2"],
  ["Caro-Kann Defense", "e4 c6"],
  ["Caro-Kann Defense: Advance", "e4 c6 d4 d5 e5"],
  ["Caro-Kann Defense: Classical", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5"],
  ["Scandinavian Defense", "e4 d5"],
  ["Pirc Defense", "e4 d6 d4 Nf6 Nc3 g6"],
  ["Alekhine's Defense", "e4 Nf6"],
  ["Nimzowitsch Defense", "e4 Nc6"],

  ["Queen's Gambit", "d4 d5 c4"],
  ["Queen's Gambit Accepted", "d4 d5 c4 dxc4"],
  ["Queen's Gambit Declined", "d4 d5 c4 e6"],
  ["Slav Defense", "d4 d5 c4 c6"],
  ["London System", "d4 d5 Bf4"],
  ["London System", "d4 d5 Nf3 Nf6 Bf4"],
  ["Colle System", "d4 d5 Nf3 Nf6 e3"],
  ["King's Indian Defense", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6"],
  ["Grünfeld Defense", "d4 Nf6 c4 g6 Nc3 d5"],
  ["Nimzo-Indian Defense", "d4 Nf6 c4 e6 Nc3 Bb4"],
  ["Queen's Indian Defense", "d4 Nf6 c4 e6 Nf3 b6"],
  ["Catalan Opening", "d4 Nf6 c4 e6 g3"],
  ["Dutch Defense", "d4 f5"],
  ["Réti Opening", "Nf3 d5 c4"],
  ["King's Indian Attack", "Nf3 d5 g3"],
];

const strip = (san) => san.replace(/[+#]/g, "");

export const OPENING_LINES = LINES.map(([name, moves]) => ({ name, moves }));

const PREFIXES = new Set();
for (const [, moves] of LINES) {
  const parts = moves.split(" ");
  for (let i = 1; i <= parts.length; i += 1) {
    PREFIXES.add(parts.slice(0, i).join(" "));
  }
}

// sans = poore game ki SAN list. plyIndex = 0 se shuru.
export function isBookMove(sans, plyIndex) {
  if (plyIndex >= 24) return false;
  return PREFIXES.has(sans.slice(0, plyIndex + 1).map(strip).join(" "));
}

export function findOpening(sans) {
  const game = sans.map(strip).join(" ");
  let best = null;

  for (const line of OPENING_LINES) {
    const match = game === line.moves || game.startsWith(`${line.moves} `);
    if (match && (!best || line.moves.length > best.moves.length)) best = line;
  }

  return best ? best.name : "";
}