import test from "node:test";
import assert from "node:assert/strict";
import { D } from "../src/i18n/pages/review.dict.js";
import { LIT } from "../src/i18n/pages/data.dict.js";

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("Review texts: es and hi have every key with the same placeholders", () => {
  for (const lang of ["es", "hi"]) {
    const missing = Object.keys(D.en).filter((k) => !(k in D[lang]));
    assert.deepEqual(missing, [], `${lang} missing: ${missing.join(", ")}`);
    const bad = Object.keys(D.en).filter((k) => vars(D.en[k]) !== vars(D[lang][k]));
    assert.deepEqual(bad, [], `${lang} placeholder mismatch: ${bad.join(", ")}`);
  }
});

test("every move category and Review error has a translation", () => {
  const cats = ["Brilliant", "Great", "Best", "Excellent", "Good", "Book", "Inaccuracy", "Mistake", "Blunder", "Miss", "Pending"];
  for (const lang of ["es", "hi"]) {
    for (const c of [...cats, "Game", "This game has no saved review yet.", "Could not open this game."]) {
      assert.ok(LIT[lang][c], `${lang}: no translation for "${c}"`);
    }
  }
});

test("the real category list in chessUtils.js is fully covered", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/chessUtils.js", import.meta.url), "utf8");
  const m = src.match(/CATEGORY_ORDER\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, "CATEGORY_ORDER not found");
  const cats = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(cats.length >= 8);
  for (const lang of ["es", "hi"]) for (const c of cats) assert.ok(LIT[lang][c], `${lang}: category "${c}" has no translation`);
});
