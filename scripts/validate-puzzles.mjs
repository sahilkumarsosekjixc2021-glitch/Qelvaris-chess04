
import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

const inputPath = path.resolve(
  "public/data/qelvaris-puzzles.json"
);

const reportPath = path.resolve(
  "public/data/puzzle-validation-report.json"
);

function validatePuzzle(puzzle) {
  const errors = [];

  if (!puzzle || typeof puzzle !== "object") {
    return { valid: false, errors: ["Invalid puzzle object"] };
  }

  if (!puzzle.id) errors.push("Missing id");
  if (!puzzle.fen) errors.push("Missing FEN");

  if (!Array.isArray(puzzle.moves) || puzzle.moves.length < 2) {
    errors.push("At least 2 UCI moves are required");
  }

  if (!Array.isArray(puzzle.themes)) {
    errors.push("Themes must be an array");
  }

  if (!Number.isFinite(puzzle.rating)) {
    errors.push("Rating must be a number");
  }

  if (errors.length) return { valid: false, errors };

  try {
    const game = new Chess(puzzle.fen);

    for (let i = 0; i < puzzle.moves.length; i++) {
      const uci = puzzle.moves[i];

      if (
        typeof uci !== "string" ||
        !/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(uci)
      ) {
        errors.push(`Move ${i + 1}: invalid UCI format (${uci})`);
        break;
      }

      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci[4]?.toLowerCase();

      const move = game.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });

      if (!move) {
        errors.push(`Move ${i + 1}: illegal move (${uci})`);
        break;
      }
    }
  } catch (error) {
    errors.push(`Invalid FEN or replay error: ${error.message}`);
  }

  return { valid: errors.length === 0, errors };
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Dataset not found: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

  let puzzles;

  try {
    puzzles = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch (error) {
    console.error("JSON parse failed:", error.message);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(puzzles)) {
    console.error("Expected the dataset to be a JSON array.");
    process.exitCode = 1;
    return;
  }

  const seenIds = new Set();
  const duplicates = [];
  const valid = [];
  const invalid = [];

  for (const puzzle of puzzles) {
    const result = validatePuzzle(puzzle);
    const id = puzzle?.id;

    if (id && seenIds.has(id)) {
      duplicates.push({ id, errors: ["Duplicate puzzle ID"] });
      continue;
    }

    if (id) seenIds.add(id);

    if (result.valid) {
      valid.push(puzzle);
    } else {
      invalid.push({
        id: id ?? null,
        errors: result.errors,
      });
    }
  }

  const report = {
    total: puzzles.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    duplicateCount: duplicates.length,
    validPuzzles: valid,
    invalidPuzzles: invalid,
    duplicates,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("Puzzle validation complete");
  console.log(`Total records: ${puzzles.length}`);
  console.log(`Valid puzzles: ${valid.length}`);
  console.log(`Invalid puzzles: ${invalid.length}`);
  console.log(`Duplicate IDs: ${duplicates.length}`);
  console.log(`Report: ${reportPath}`);
}

main();
