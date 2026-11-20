import test from "node:test";
import assert from "node:assert/strict";
import { isValidBackup, hashPayload, summarize, decidePush, planRows, planLocalValue, recommendedMode, BACKUP_VERSION } from "../src/features/cloud/backupCore.js";
import CLOUD_DICT from "../src/features/cloud/strings.dict.js";

const mk = (over = {}) => ({ app: "qelvaris", version: BACKUP_VERSION, exportedAt: "2026-01-01", data: { games: [{ id: "a" }, { id: "b" }], reviews: [{ gameId: "a" }], training: [], settings: [{ key: "qc-wallet", value: { balance: 5 } }] }, local: { "qelvaris-game-favourites": ["a"] }, ...over });

test("valid backups pass, broken ones are rejected before anything is written", () => {
  assert.equal(isValidBackup(mk()), true);
  assert.equal(isValidBackup({ app: "qelvaris", data: { games: [{ id: 1 }] } }), true); // old v1 file
  assert.equal(isValidBackup(null), false);
  assert.equal(isValidBackup({ app: "other", data: {} }), false);
  assert.equal(isValidBackup(mk({ data: { games: [{ nope: 1 }] } })), false); // row without its key
  assert.equal(isValidBackup(mk({ data: { games: "x" } })), false);
  assert.equal(isValidBackup(mk({ version: 99 })), false); // from a newer app
});

test("hash ignores export time but notices real changes", () => {
  const a = mk(), b = mk({ exportedAt: "2027-01-01" });
  assert.equal(hashPayload(a), hashPayload(b));
  const c = mk(); c.data.games.push({ id: "z" });
  assert.notEqual(hashPayload(a), hashPayload(c));
  const d = mk({ local: { "qelvaris-game-favourites": ["a", "b"] } }); // favourites change = real change
  assert.notEqual(hashPayload(a), hashPayload(d));
});

test("summary counts every kind of data including favourites", () => {
  assert.deepEqual({ ...summarize(mk()), exportedAt: 0 }, { games: 2, reviews: 1, training: 0, settings: 1, favourites: 1, exportedAt: 0, version: BACKUP_VERSION });
  assert.equal(summarize(null).games, 0);
});

test("push decision: first / ok / conflict", () => {
  assert.equal(decidePush(null, null), "first");
  assert.equal(decidePush(3, 3), "ok");
  assert.equal(decidePush(4, 3), "conflict"); // another device pushed
  assert.equal(decidePush(1, null), "conflict"); // this device never saw the cloud copy
});

test("merge adds only missing rows; replace takes everything", () => {
  const local = [{ id: "a", v: "local" }];
  const cloud = [{ id: "a", v: "cloud" }, { id: "b", v: "cloud" }];
  assert.deepEqual(planRows(local, cloud, "id", "merge"), [{ id: "b", v: "cloud" }]); // local "a" untouched
  assert.deepEqual(planRows(local, cloud, "id", "replace"), cloud);
  assert.deepEqual(planRows([], undefined, "id", "merge"), []);
});

test("merge never lowers local progress (QC wallet / streak stay)", () => {
  const local = [{ key: "qc-wallet", value: { balance: 900 } }];
  const cloud = [{ key: "qc-wallet", value: { balance: 5 } }];
  assert.deepEqual(planRows(local, cloud, "key", "merge"), []);
});

test("favourites merge as a union, replace as the cloud list", () => {
  assert.deepEqual(planLocalValue(["a"], ["b", "a"], "merge"), ["a", "b"]);
  assert.deepEqual(planLocalValue(["a"], ["b"], "replace"), ["b"]);
  assert.deepEqual(planLocalValue(["a"], undefined, "replace"), ["a"]);
});

test("new device (no games) is told to replace; a used device to merge", () => {
  assert.equal(recommendedMode({ games: 0 }), "replace");
  assert.equal(recommendedMode({ games: 12 }), "merge");
});

test("cloud strings exist in every language with the same keys", () => {
  const en = Object.keys(CLOUD_DICT.en).sort();
  for (const l of ["es", "hi"]) assert.deepEqual(Object.keys(CLOUD_DICT[l]).sort(), en, l);
});
