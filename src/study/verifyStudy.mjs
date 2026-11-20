// Run in src/study:  node verifyStudy.mjs
// Har exercise ki line chess.js se check hoti hai aur aakhri position ka FEN print hota hai.

import { Chess } from "chess.js";
import { STUDY_EXERCISES } from "./studyPositions.js";

let bad = 0;

for (const ex of STUDY_EXERCISES) {
  const chess = new Chess();
  let ok = true;

  for (const san of ex.line.split(" ")) {
    try {
      chess.move(san);
    } catch {
      ok = false;
      bad += 1;
      console.log(`ILLEGAL in ${ex.id}: "${san}"`);
      break;
    }
  }

  if (ok) {
    console.log(`OK  ${ex.id}  (${chess.turn() === "w" ? "White" : "Black"} to move)`);
    console.log(`    ${chess.fen()}`);
    if (chess.isGameOver()) console.log("    WARNING: game is over in this position");
  }
}

console.log(`\nExercises: ${STUDY_EXERCISES.length}, problems: ${bad}`);
process.exit(bad ? 1 : 0);
