// Run in your project folder:  node verifyTree.mjs
// Checks every move of the Italian Game tree with chess.js and prints transpositions.

import { Chess } from "chess.js";
import { ITALIAN_TREE, ITALIAN_TRUNK } from "./openingTree.js";

let ok = 0;
let bad = 0;
const seen = new Map();

function walk(fen, path, defs) {
  for (const def of defs) {
    const chess = new Chess(fen);
    let played = null;
    try {
      played = chess.move(def.san);
    } catch {
      played = null;
    }
    const line = [...path, def.san].join(" ");
    if (!played) {
      bad += 1;
      console.log("ILLEGAL:", line);
      continue;
    }
    ok += 1;
    const key = chess.fen().split(" ").slice(0, 4).join(" ");
    if (seen.has(key)) console.log("TRANSPOSITION:", seen.get(key), "==", line);
    else seen.set(key, line);
    if (def.children?.length) walk(chess.fen(), [...path, played.san], def.children);
  }
}

const start = new Chess();
let fen = start.fen();
const trunk = [];
for (const san of ITALIAN_TRUNK.split(" ")) {
  const c = new Chess(fen);
  c.move(san);
  fen = c.fen();
  trunk.push(san);
}

walk(fen, trunk, ITALIAN_TREE);
console.log(`\nLegal moves: ${ok}, illegal: ${bad}`);
process.exit(bad ? 1 : 0);
