import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { D } from "../src/i18n/pages/leaklab.dict.js";
import { LIT } from "../src/i18n/pages/data.dict.js";
import { litFor } from "../src/i18n/pages/lit.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("Leak Lab / Streak texts: es and hi have every key with the same placeholders", () => {
  for (const lang of ["es", "hi"]) {
    const missing = Object.keys(D.en).filter((k) => !(k in D[lang]));
    assert.deepEqual(missing, [], `${lang} missing: ${missing.join(", ")}`);
    const bad = Object.keys(D.en).filter((k) => vars(D.en[k]) !== vars(D[lang][k]));
    assert.deepEqual(bad, [], `${lang} placeholder mismatch: ${bad.join(", ")}`);
  }
  for (const lang of ["es", "hi"]) {
    assert.equal(D[lang].weekLetters.split(",").length, 7, `${lang} weekLetters must have 7 letters`);
  }
});

test("every leak skill / text / tip and schedule label has a translation", () => {
  const leaks = read("../src/leaks.js");
  const lab = read("../src/lab.js");
  const strings = [
    ...[...leaks.matchAll(/^\s+(?:skill|text|ask): "([^"]+)"/gm)].map((m) => m[1]),
    ...[...lab.matchAll(/label: "([^"]+)", count: 0/g)].map((m) => m[1]),
    ...[...lab.matchAll(/OTHER_LEAK = \{ id: "other", title: "([^"]+)", text: "([^"]+)"/g)].flatMap((m) => [m[1], m[2]]),
  ];
  assert.ok(strings.length >= 20, "could not read data files");
  for (const lang of ["es", "hi"]) {
    for (const s of strings) assert.ok(LIT[lang][s], `${lang}: no translation for "${s}"`);
  }
});

test("dynamic sentences (prompts, proof, streak) are translated, with no leftovers", () => {
  const samples = [
    "White to move. Which move keeps every piece protected?",
    "Black to move. A capture or a forced mate is on the board. Find it.",
    "White to move with little time. Find the safe, strong move.",
    "Black to move in the opening. Find the best move.",
    "White to move in a winning endgame. Convert it.",
    "Black to move. Watch your first rank.",
    "White to move. Find the strongest move.",
    "Needs 3 more reviewed games before we can judge this habit.",
    "2 more clean games in a row and this habit is marked Fixed.",
    "1 more clean game in a row and this habit is marked Fixed.",
    "Do any one task today to keep your 4-day streak alive.",
    "7-day streak! Keep going.",
    "3 more days to your 7-day milestone.",
    "1 more day to your 7-day milestone.",
    "vs magnus_c, move 14",
    "vs Opponent, move 3",
  ];
  for (const lang of ["es", "hi"]) {
    for (const s of samples) {
      const out = litFor(lang, s);
      assert.notEqual(out, s, `${lang}: not translated: "${s}"`);
      assert.ok(!/\$\d|undefined/.test(out), `${lang}: bad output "${out}"`);
    }
  }
  assert.equal(litFor("es", "White to move. Watch your first rank."), "Juegan Blancas. Cuida tu primera fila.");
  assert.equal(litFor("es", "vs magnus_c, move 14"), "contra magnus_c, jugada 14");
  assert.equal(litFor("en", "vs magnus_c, move 14"), "vs magnus_c, move 14");
});
