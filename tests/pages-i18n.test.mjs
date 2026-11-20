import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { litFor } from "../src/i18n/pages/lit.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

// every src file that uses a page translator: collect its tx("...") keys and check the dict
const users = walk(SRC).filter((f) => /\.jsx$/.test(f)).map((f) => ({ f, text: fs.readFileSync(f, "utf8") }))
  .map((u) => ({ ...u, m: u.text.match(/import \{ tx \} from "[^"]*\/pages\/(\w+)";/) }))
  .filter((u) => u.m);

test("there are translated pages to check", () => {
  assert.ok(users.length >= 8);
});

for (const u of users) {
  test(`${path.relative(SRC, u.f)}: every tx() key has es + hi with the same placeholders`, async () => {
    const dictFile = path.join(SRC, "i18n", "pages", `${u.m[1]}.dict.js`);
    const { D } = await import(pathToFileURL(dictFile).href);
    const keys = new Set([...u.text.matchAll(/\btx\(\s*("(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1])));
    const missing = [];
    for (const k of keys) {
      for (const lang of ["es", "hi"]) {
        const v = D[lang]?.[k];
        if (typeof v !== "string" || !v.trim()) missing.push(`${lang}: ${k}`);
        else if (placeholders(v) !== placeholders(k)) missing.push(`placeholders ${lang}: ${k}`);
      }
    }
    assert.deepEqual(missing, []);
  });
}

test("dictionary keys exist in both languages", async () => {
  const dir = path.join(SRC, "i18n", "pages");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".dict.js") && !["today.dict.js", "data.dict.js", "data2.dict.js", "leaklab.dict.js", "review.dict.js"].includes(n))) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    if (!mod.D) continue;
    assert.deepEqual(Object.keys(mod.D.es).sort(), Object.keys(mod.D.hi).sort(), f);
  }
});

test("Hindi uses Devanagari, not Hinglish, in the new dictionaries", async () => {
  const dir = path.join(SRC, "i18n", "pages");
  const bad = [];
  for (const f of ["dna", "games", "connect", "profile", "openings", "play", "practice", "settings", "app", "auth", "modes", "store", "misc", "explore"]) {
    const p = path.join(dir, `${f}.dict.js`);
    if (!fs.existsSync(p)) continue;
    const { D } = await import(pathToFileURL(p).href);
    for (const [k, v] of Object.entries(D.hi)) {
      if (/[A-Za-z]{4,} [A-Za-z]{4,} [A-Za-z]{4,}/.test(v) && !/[ऀ-ॿ]/.test(v)) bad.push(`${f}: ${k}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("data strings: findings, verdicts, missions and results translate", () => {
  assert.equal(litFor("es", "You leave a piece hanging in 3 of 10 games."), "Dejas una pieza colgada en 3 de 10 partidas.");
  assert.match(litFor("hi", "You were back-rank mated in 2 of 8 games."), /8 में से 2/);
  assert.equal(litFor("es", "Costs an estimated 45 rating points."), "Cuesta unos 45 puntos de rating.");
  assert.equal(litFor("es", "Better in both. Time use is still your weakest skill.").includes("sigue siendo"), true);
  assert.equal(litFor("es", "Safe hands"), "Manos seguras");
  assert.equal(litFor("es", "The game ended by checkmate."), "La partida terminó por jaque mate.");
  assert.equal(litFor("hi", "2 pieces were taken for free. Check every piece before you move."), "2 मोहरे मुफ़्त में गए। चाल चलने से पहले हर मोहरा जाँचें।");
  assert.equal(litFor("en", "Safe hands"), "Safe hands");
  assert.equal(litFor("es", "Something not in any dictionary"), "Something not in any dictionary");
});
