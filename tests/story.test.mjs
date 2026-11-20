import test from "node:test";
import assert from "node:assert/strict";
import { buildExplanation } from "../src/storyText.js";
const explainMoment = (m) => buildExplanation({ ...m, before: 60, after: 20, ask: m.leak ? "Before every move, list the checks, captures and threats for both sides." : null });

const base = { san: "Nf3", color: "w", evalBefore: 50, evalAfter: -150, ply: 10, moveNumber: 5 };
const cases = [
  { cat: "Brilliant" }, { cat: "Great" },
  { cat: "Blunder", leak: "hanging" }, { cat: "Blunder", leak: "time-trouble", clock: 22 }, { cat: "Mistake", leak: "time-trouble" },
  { cat: "Blunder", leak: "missed-tactics", evalBefore: 95 }, { cat: "Mistake", leak: "missed-tactics" },
  { cat: "Mistake", leak: "opening-gaps" }, { cat: "Blunder" }, { cat: "Mistake" }, { cat: "Miss" }, { cat: "Inaccuracy" },
];

test("every explanation exists in English, Spanish and Hindi with no leftovers", () => {
  for (const c of cases) {
    const e = explainMoment({ ...base, ...c });
    for (const k of ["en", "es", "hi", "askEn", "askEs", "askHi"]) {
      assert.ok(typeof e[k] === "string" && e[k].length > 10, `${JSON.stringify(c)}: ${k} missing`);
      assert.ok(!/undefined|NaN|\$\{/.test(e[k]), `${JSON.stringify(c)}: ${k} has leftovers: ${e[k]}`);
    }
    assert.ok(e.es.includes("Nf3") && e.hi.includes("Nf3"), "move name must appear in every language");
  }
});

test("no romanised Hindi (Hinglish) is left in explanations", () => {
  const hinglish = /\b(aapne|chali|galti|chaal|jeetne|nuksaan|poochiye|dhyan|chaalon)\b/i;
  for (const c of cases) {
    const e = explainMoment({ ...base, ...c });
    for (const k of ["hi", "askHi"]) assert.ok(!hinglish.test(e[k]), `${k} contains Hinglish: ${e[k]}`);
    assert.ok(/[ऀ-ॿ]/.test(e.hi), "Hindi text must use Devanagari");
  }
});

test("known leak tips come out translated (not left in English)", () => {
  const e = explainMoment({ ...base, cat: "Blunder", leak: "hanging" });
  assert.notEqual(e.askEs, e.askEn);
  assert.notEqual(e.askHi, e.askEn);
});
