import test from "node:test";
import assert from "node:assert/strict";
import en from "../src/i18n/locales/en.js";
import es from "../src/i18n/locales/es.js";
import hi from "../src/i18n/locales/hi.js";

function flat(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flat(v, key, out);
    else out[key] = v;
  }
  return out;
}
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

for (const [name, loc] of [["es", es], ["hi", hi]]) {
  test(`${name} has every English key`, () => {
    const a = flat(en), b = flat(loc);
    const missing = Object.keys(a).filter((k) => !(k in b));
    assert.deepEqual(missing, [], `Missing in ${name}: ${missing.slice(0, 10).join(", ")}`);
  });
  test(`${name} keeps the same {placeholders}`, () => {
    const a = flat(en), b = flat(loc);
    const bad = Object.keys(a).filter((k) => k in b && typeof a[k] === "string" && vars(a[k]) !== vars(b[k]));
    assert.deepEqual(bad, [], `Placeholder mismatch in ${name}: ${bad.slice(0, 10).join(", ")}`);
  });
}
