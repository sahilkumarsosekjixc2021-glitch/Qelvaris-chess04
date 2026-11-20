import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url)); // works on Windows and Linux

// Error reports must never carry secrets or e-mail addresses. errorReport imports telemetry (browser only),
// so we test the same redaction rules by loading the module text through a tiny stub.
const src = readFileSync(here("../src/lib/errorReport.js"), "utf8").replace(/import .*track.*\n/, "const track = ()=>{};\n").replace(/import .*staleVersion.*\n/, "const isStaleVersionError = ()=>false, reloadOnceForNewVersion = ()=>{};\n");
const mod = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

test("redact hides passwords, tokens, e-mails and long keys", () => {
  const out = mod.redact({ password: "hunter2", user: { email: "a@b.com", token: "x" }, note: "mail me at bob@example.com", jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuv" });
  assert.equal(out.password, "[redacted]");
  assert.equal(out.user.email, "[redacted]");
  assert.equal(out.user.token, "[redacted]");
  assert.ok(!out.note.includes("bob@example.com"));
  assert.equal(out.jwt, "[redacted]");
  assert.ok(!mod.redactText("key=" + "A".repeat(40)).includes("A".repeat(40)));
});

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

test("no server secret names or service-role key appear in browser code", () => {
  const root = here("../src");
  const bad = /SERVICE_ROLE|PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_ID/;
  for (const f of walk(root).filter((p) => /\.(js|jsx)$/.test(p))) {
    const text = readFileSync(f, "utf8");
    // lib/supabase.js only *detects* a service_role key by its lower-case role name
    assert.ok(!bad.test(text), `${f} mentions a server secret`);
  }
});

test("no VITE_ variable holds a secret", () => {
  const env = readFileSync(here("../.env.example"), "utf8");
  for (const line of env.split("\n")) {
    const name = line.split("=")[0];
    if (name.startsWith("VITE_")) assert.ok(!/SECRET|SERVICE|PRIVATE/i.test(name), name);
  }
});

test("security headers are configured", () => {
  const v = JSON.parse(readFileSync(here("../vercel.json"), "utf8"));
  const all = v.headers.find((h) => h.source === "/(.*)").headers.map((h) => h.key);
  for (const k of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Content-Security-Policy-Report-Only"]) assert.ok(all.includes(k), k);
});

test("tests are not being skipped", () => {
  const root = here("../tests");
  for (const f of readdirSync(root).filter((x) => x.endsWith(".test.mjs") && x !== "security.test.mjs")) {
    assert.ok(!/\b(test|it|describe)\.skip\b|\bxit\b/.test(readFileSync(join(root, f), "utf8")), f + " has a skipped test");
  }
});

test("technical errors are hidden from players, readable ones are kept", async () => {
  const fm = await import("../src/lib/friendlyMessage.js");
  assert.equal(fm.friendlyMessage(new Error("JWT expired"), "Could not load."), "Could not load.");
  assert.equal(fm.friendlyMessage(new Error('new row violates row-level security policy for table "x"'), "Could not save."), "Could not save.");
  assert.equal(fm.friendlyMessage(new Error("Failed to fetch"), "x"), fm.OFFLINE_TEXT);
  assert.equal(fm.friendlyMessage(new Error("Username already taken"), "x"), "Username already taken");
  assert.equal(fm.friendlyMessage(null, "Fallback"), "Fallback");
});

// ---------- support kit ----------
const load = (rel) => import(pathToFileURL(here(rel)).href);
const dict = (await load("../src/features/support/support.dict.js")).default;
const core = await load("../src/features/support/supportCore.js");
const stale = await load("../src/lib/staleVersion.js");

test("support text: en/es/hi have the same fields and same number of FAQ items", () => {
  for (const l of ["es", "hi"]) {
    assert.deepEqual(Object.keys(dict[l]).sort(), Object.keys(dict.en).sort());
    assert.equal(dict[l].faq.length, dict.en.faq.length);
    for (const f of dict[l].faq) assert.ok(f.q && f.a);
  }
});

test("diagnostics report has no e-mail and stays short", () => {
  const r = core.buildReport({ version: "x", time: "t", page: "settings", signedIn: true, shortId: "abcdef1234567", language: "en", online: true, userAgent: "UA", screen: "1x1", storage: "ok", counts: "games 3", errors: ["a", "b", "c", "d", "e", "f", "g"] });
  assert.ok(!/@/.test(r));
  assert.ok(r.includes("id abcdef12") && !r.includes("abcdef123"));
  assert.equal(r.split("\n").filter((l) => l.startsWith("- ")).length, 5);
  assert.ok(core.mailtoLink("a@b.c", "s", r).length < 2600);
});

test("stale-deploy errors are recognised and reload only once a minute", () => {
  assert.ok(stale.isStaleVersionError(new Error("Failed to fetch dynamically imported module: https://x/assets/a.js")));
  assert.ok(!stale.isStaleVersionError(new Error("undefined is not a function")));
  const mem = { v: null, getItem() { return this.v; }, setItem(_k, x) { this.v = x; } };
  let n = 0;
  assert.equal(stale.reloadOnceForNewVersion(mem, 100000, () => n++), true);
  assert.equal(stale.reloadOnceForNewVersion(mem, 130000, () => n++), false);
  assert.equal(stale.reloadOnceForNewVersion(mem, 170000, () => n++), true);
  assert.equal(n, 2);
});

// ---------- Coach: "My mistakes" ----------
const mcore = await load("../src/features/coach/mistakesCore.js");
const mdict = (await load("../src/features/coach/mistakes.dict.js")).default;

const mv = (o) => ({ isError: true, cat: "Blunder", best: "e2e4", uci: "a2a3", fenBefore: "f", winLoss: 30, index: 4, userColor: "w", san: "a3", bestSan: "e4", ...o });

test("mistake drills: only clear, serious, user mistakes with a different best move", () => {
  const rec = { id: "g1", time: 5, userMoves: [mv({}), mv({ index: 6, cat: "Inaccuracy" }), mv({ index: 8, winLoss: 5 }), mv({ index: 10, best: "a2a3" }), mv({ index: 12, isError: false }), mv({ index: 14, userColor: "b" })] };
  const d = mcore.buildMistakeDrills([rec]);
  assert.deepEqual(d.map((x) => x.id), ["g1:4", "g1:14"]);
  assert.equal(d[1].flip, true);
  assert.deepEqual(mcore.buildMistakeDrills(null), []);
});

test("mistake session: due first, biggest new next, max 3 per game", () => {
  const mk = (id, gameId, loss, time = 1) => ({ id, gameId, loss, time });
  const drills = [mk("a:1", "a", 20), mk("a:2", "a", 25), mk("a:3", "a", 30), mk("a:4", "a", 99), mk("b:1", "b", 15), mk("c:1", "c", 12)];
  const state = { "c:1": { box: 1, due: "2026-11-10" } };
  const s = mcore.pickSession(drills, state, "2026-11-16", 6).map((d) => d.id);
  assert.equal(s[0], "c:1");
  assert.equal(s.filter((x) => x.startsWith("a:")).length, 3);
  assert.ok(!s.includes("a:1")); // smallest of game a was dropped by the per-game cap
});

test("mistake spaced repetition: right climbs, wrong resets, dates are exact", () => {
  assert.equal(mcore.addDays("2026-02-27", 3), "2026-03-02");
  let st = mcore.nextState(undefined, true, "2026-11-16");
  assert.deepEqual([st.box, st.due], [1, "2026-11-17"]);
  st = mcore.nextState(st, true, "2026-11-17");
  assert.deepEqual([st.box, st.due], [2, "2026-11-20"]);
  st = mcore.nextState(st, false, "2026-11-20");
  assert.deepEqual([st.box, st.due, st.misses], [0, "2026-11-20", 1]);
  assert.ok(mcore.isBestMove("e7e8q", "e7", "e8"));
  assert.ok(!mcore.isBestMove("e2e4", "e2", "e3"));
});

test("my-mistakes text: en/es/hi same keys", () => {
  for (const l of ["es", "hi"]) {
    assert.deepEqual(Object.keys(mdict[l]).sort(), Object.keys(mdict.en).sort());
    assert.deepEqual(Object.keys(mdict[l].cats), Object.keys(mdict.en.cats));
  }
});
