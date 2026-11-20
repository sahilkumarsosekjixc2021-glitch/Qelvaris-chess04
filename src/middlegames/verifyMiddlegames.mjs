// Chalao (project mein, asli chess.js ke saath):  cd src/middlegames && node verifyMiddlegames.mjs
// Har lesson ki line + saari chaalein legal hain, aur side-to-move lesson ke `side` se milta hai.
import { Chess } from "chess.js";
import { MIDDLEGAMES } from "./middlegameData.js";

let bad = 0;
for (const mg of MIDDLEGAMES) {
  const chess = new Chess();
  try {
    for (const san of mg.line.split(" ")) chess.move(san);
  } catch (err) {
    bad += 1;
    console.log("ILLEGAL line:", mg.id, String(err.message || err));
    continue;
  }
  const turn = chess.turn() === "w" ? "white" : "black";
  if (turn !== mg.side) { bad += 1; console.log("SIDE MISMATCH:", mg.id, "to move", turn, "lesson side", mg.side); }
  for (const [i, step] of mg.steps.entries()) {
    try { chess.move(step.san); } catch { bad += 1; console.log("ILLEGAL step:", mg.id, i + 1, step.san); break; }
  }
  console.log(mg.id, "checked,", mg.steps.length, "steps");
}
console.log(bad ? `\n${bad} problems` : "\nAll middlegames OK");
process.exit(bad ? 1 : 0);
