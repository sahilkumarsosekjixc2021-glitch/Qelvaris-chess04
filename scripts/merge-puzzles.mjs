
import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

const DATA = path.resolve("public/data/qelvaris-puzzles.json");
const BATCH = path.resolve("public/data/puzzle-batch-02.json");
const OUTPUT = path.resolve("public/data/qelvaris-puzzles-merged.json");
const REPORT = path.resolve("public/data/puzzle-merge-report.json");

function validate(p) {
  const errors = [];

  if (!p || typeof p !== "object" || Array.isArray(p)) {
    return ["Invalid puzzle object"];
  }

  if (p.id == null || String(p.id).trim() === "") errors.push("Missing ID");
  if (typeof p.fen !== "string" || !p.fen.trim()) errors.push("Missing FEN");
  if (!Array.isArray(p.moves) || p.moves.length < 2) {
    errors.push("At least 2 moves required");
  }
  if (!Array.isArray(p.themes)) errors.push("Themes must be an array");
  if (!Number.isFinite(p.rating)) errors.push("Invalid rating");

  if (errors.length) return errors;

  try {
    const game = new Chess(p.fen);

    for (let i = 0; i < p.moves.length; i++) {
      const uci = p.moves[i];

      if (
        typeof uci !== "string" ||
        !/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci)
      ) {
        errors.push(`Move ${i + 1}: invalid UCI format`);
        break;
      }

      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci[4] ? { promotion: uci[4].toLowerCase() } : {})
      });

      if (!move) {
        errors.push(`Move ${i + 1}: illegal move ${uci}`);
        break;
      }
    }
  } catch (error) {
    errors.push(`Invalid FEN or replay: ${error.message}`);
  }

  return errors;
}

function readJson(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  if (!Array.isArray(data)) {
    throw new Error(`${path.basename(file)} must contain a JSON array`);
  }

  return data;
}

function main() {
  const existing = readJson(DATA);
  const batch = readJson(BATCH);

  // Preserve the original dataset. Only append validated new records.
  const merged = [...existing];
  const ids = new Set(existing.map(p => String(p.id)));
  const report = {
    existingCount: existing.length,
    batchCount: batch.length,
    added: [],
    rejected: [],
    duplicates: [],
    targetCount: 200
  };

  // Check original data too; never silently discard existing records.
  const invalidExisting = existing
    .map((p, index) => ({ p, index, errors: validate(p) }))
    .filter(item => item.errors.length)
    .map(item => ({
      index: item.index,
      id: item.p?.id ?? null,
      errors: item.errors
    }));

  for (let i = 0; i < batch.length; i++) {
    const puzzle = batch[i];
    const id = puzzle?.id == null ? "" : String(puzzle.id);

    if (!id) {
      report.rejected.push({ index: i, id: null, errors: ["Missing ID"] });
      continue;
    }

    if (ids.has(id)) {
      report.duplicates.push({ index: i, id });
      continue;
    }

    const errors = validate(puzzle);

    if (errors.length) {
      report.rejected.push({ index: i, id, errors });
      continue;
    }

    merged.push(puzzle);
    ids.add(id);
    report.added.push(id);
  }

  report.invalidExisting = invalidExisting;
  report.finalCount = merged.length;
  report.targetReached = merged.length >= report.targetCount;

  // Write a separate output; never overwrite the original automatically.
  fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2) + "\n");
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n");

  console.log("\nPuzzle merge complete");
  console.log(`Existing puzzles: ${existing.length}`);
  console.log(`New batch records: ${batch.length}`);
  console.log(`Added: ${report.added.length}`);
  console.log(`Duplicates skipped: ${report.duplicates.length}`);
  console.log(`Invalid new puzzles skipped: ${report.rejected.length}`);
  console.log(`Invalid existing puzzles: ${invalidExisting.length}`);
  console.log(`Final count: ${merged.length}`);
  console.log(`Target of 200 reached: ${report.targetReached}`);
  console.log(`Merged dataset: ${OUTPUT}`);
  console.log(`Report: ${REPORT}`);
}

try {
  main();
} catch (error) {
  console.error("\nMerge failed:", error.message);
  process.exitCode = 1;
}
