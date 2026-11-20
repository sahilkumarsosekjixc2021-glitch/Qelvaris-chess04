import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { D, LIT } from "../src/i18n/pages/today.dict.js";
import { litFor } from "../src/i18n/pages/lit.js";

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("Today texts: es and hi have every English key with the same placeholders", () => {
  for (const lang of ["es", "hi"]) {
    const missing = Object.keys(D.en).filter((k) => !(k in D[lang]));
    assert.deepEqual(missing, [], `${lang} missing: ${missing.join(", ")}`);
    const bad = Object.keys(D.en).filter((k) => vars(D.en[k]) !== vars(D[lang][k]));
    assert.deepEqual(bad, [], `${lang} placeholder mismatch: ${bad.join(", ")}`);
  }
});

test("every leak name and mission text in the data files has a translation", () => {
  const leaks = readFileSync(new URL("../src/leaks.js", import.meta.url), "utf8");
  const today = readFileSync(new URL("../src/todayData.js", import.meta.url), "utf8");
  const names = [...leaks.matchAll(/^\s+title: "([^"]+)"/gm)].map((m) => m[1]);
  const missions = [...today.matchAll(/\{ title: "([^"]+)", text: "([^"]+)" \}/g)].flatMap((m) => [m[1], m[2]]);
  assert.ok(names.length >= 5 && missions.length >= 6, "could not read data files");
  for (const lang of ["es", "hi"]) {
    for (const x of [...names, ...missions]) assert.ok(LIT[lang][x], `${lang}: no translation for "${x}"`);
  }
});

test("patterns translate dynamic text and leave unknown text alone", () => {
  assert.equal(litFor("es", "5 positions"), "5 posiciones");
  assert.equal(litFor("es", "1 position"), "1 posición");
  assert.equal(litFor("es", "From your Hanging pieces leak"), "De tu fuga: Piezas colgadas");
  assert.equal(litFor("es", "vs sunil_k · Ruy Lopez"), "contra sunil_k · Ruy Lopez");
  assert.equal(litFor("en", "Fix"), "Fix");
  assert.equal(litFor("hi", "Something new"), "Something new");
});
