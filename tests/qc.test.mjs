import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL, fileURLToPath } from "node:url";
const load = (rel) => import(pathToFileURL(fileURLToPath(new URL(rel, import.meta.url))).href);
const qc = await load("../src/features/qc/qcCore.js");
const sc = await load("../src/features/streak/streakCore.js");

test("QC shop: items have what the Store page reads", () => {
  for (const i of qc.ITEMS) { assert.ok(i.id && i.name && i.glyph && i.blurb && i.price > 0); assert.ok(["freeze", "badge"].includes(i.kind)); }
  assert.equal(qc.badgeGlyph("badge-queen"), "♛");
  assert.equal(qc.badgeGlyph("freeze"), "");
  assert.equal(qc.itemById("nope"), null);
});

test("weekly progress counts only this week's days", () => {
  const week = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
  assert.deepEqual(qc.weekProgress(["2026-11-15", "2026-11-16", "2026-11-18"], ["2026-11-18"], week), { days: 2, perfect: 1 });
});

test("bought freezes save a missed day", () => {
  const now = new Date(2026, 10, 20);
  const days = ["2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20"]; // missed the 18th
  assert.equal(sc.computeStreak(days, now).count, 4);               // starting freeze covers it
  const two = ["2026-11-15", "2026-11-18", "2026-11-20"];           // missed 16,17 and 19
  assert.equal(sc.computeStreak(two, now, 0).count, 2);
  assert.ok(sc.computeStreak(two, now, 3).count >= 3);
});
