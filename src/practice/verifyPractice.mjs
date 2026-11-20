// Run in src/practice:  node verifyPractice.mjs
// Har practice position ki line chess.js se check hoti hai.

import { Chess } from "chess.js";
import { PRACTICE_POSITIONS } from "./practicePositions.js";

let bad = 0;

for (const pos of PRACTICE_POSITIONS) {
  const chess = new Chess();
  let ok = true;

  for (const san of pos.line.split(" ")) {
    try {
      chess.move(san);
    } catch {
      ok = false;
      bad += 1;
      console.log(`ILLEGAL in ${pos.id}: "${san}"`);
      break;
    }
  }

  if (ok) {
    console.log(`OK  ${pos.id}  (${chess.turn() === "w" ? "White" : "Black"} to move)${chess.isGameOver() ? "  WARNING: game over" : ""}`);
  }
}

console.log(`\nPositions: ${PRACTICE_POSITIONS.length}, problems: ${bad}`);
process.exit(bad ? 1 : 0);
