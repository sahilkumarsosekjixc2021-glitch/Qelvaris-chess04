import test from "node:test";
import assert from "node:assert/strict";
import { computeHeat, toViewSquare } from "../src/features/blindspot/blindspot.js";

const rec = (id, userColor, moves) => ({ id, userColor, userMoves: moves.map((m) => ({ userColor, ...m })) });
const err = (to, winLoss, leak = "hanging") => ({ isError: true, leak, to, winLoss, san: "x", label: "l" });

test("black games are rotated to your side of the board", () => {
  assert.equal(toViewSquare("e4", "b"), "d5");
  assert.equal(toViewSquare("a1", "b"), "h8");
  assert.equal(toViewSquare("e4", "w"), "e4");
  assert.equal(toViewSquare("z9", "w"), null);
});

test("heat adds up per square and normalises to 0..1", () => {
  const h = computeHeat([rec(1, "w", [err("f7", 30), err("f7", 10), err("a3", 10)])]);
  assert.equal(h.moves, 3);
  assert.equal(h.cells.f7.count, 2);
  assert.equal(h.cells.f7.level, 1);
  assert.ok(h.cells.a3.level < 1 && h.cells.a3.level > 0);
  assert.equal(h.top[0], "f7");
});

test("non-errors and unknown leaks are ignored, filter by leak works", () => {
  const records = [rec(1, "w", [{ isError: false, leak: null, to: "e4" }, err("e5", 20, "missed-tactics"), err("d4", 20, "hanging")])];
  assert.equal(computeHeat(records).moves, 2);
  const only = computeHeat(records, "hanging");
  assert.equal(only.moves, 1);
  assert.ok(only.cells.d4 && !only.cells.e5);
});

test("empty input is safe", () => {
  const h = computeHeat([]);
  assert.equal(h.moves, 0);
  assert.deepEqual(h.top, []);
});
