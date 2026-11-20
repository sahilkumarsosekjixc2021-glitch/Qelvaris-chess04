import test from "node:test";
import assert from "node:assert/strict";
import { COURSES } from "../src/features/coach/lessons.generated.js";
import { DRILLS } from "../src/features/coach/drills.generated.js";
import { TRAIN_MAP } from "../src/features/blindspot/blindspot.js";

const STEP_TYPES = new Set(["teach", "quiz", "do", "tap", "choice", "line", "mate2"]);
const SQ = /^[a-h][1-8]$/;

function kingsOk(fen) {
  const board = fen.split(" ")[0];
  const count = (ch) => [...board].filter((c) => c === ch).length;
  return count("K") === 1 && count("k") === 1;
}
const rows = (fen) => fen.split(" ")[0].split("/");

test("course and lesson ids are unique", () => {
  const cids = COURSES.map((c) => c.id);
  assert.equal(new Set(cids).size, cids.length);
  for (const c of COURSES) {
    const lids = c.lessons.map((l) => l.id);
    assert.equal(new Set(lids).size, lids.length, `duplicate lesson id in ${c.id}`);
    assert.ok(c.lessons.length > 0, `${c.id} has no lessons`);
  }
});

test("every lesson step has a known type and valid content", () => {
  for (const c of COURSES) {
    for (const l of c.lessons) {
      assert.ok(l.steps.length > 0, `${c.id}/${l.id} has no steps`);
      l.steps.forEach((s, i) => {
        const where = `${c.id}/${l.id} step ${i + 1}`;
        assert.ok(STEP_TYPES.has(s.t), `${where}: unknown type ${s.t}`);
        if (s.fen) {
          assert.equal(rows(s.fen).length, 8, `${where}: FEN needs 8 ranks`);
          assert.ok(kingsOk(s.fen), `${where}: FEN needs exactly one king per side`);
        }
        if (s.t === "quiz") {
          assert.ok(Array.isArray(s.options) && s.options.length >= 2, `${where}: quiz needs options`);
          assert.ok(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.options.length, `${where}: quiz answer out of range`);
        }
        if (["do", "tap", "choice"].includes(s.t)) {
          assert.ok(Array.isArray(s.answers) && s.answers.length > 0, `${where}: needs at least one answer`);
        }
        if (s.t === "mate2") assert.ok(s.tree && Object.keys(s.tree).length > 0, `${where}: mate2 needs a tree`);
        for (const m of s.marks || []) assert.match(m.sq, SQ, `${where}: bad mark square`);
      });
    }
  }
});

test("Blind-Spot TRAIN_MAP points to real lessons", () => {
  for (const [leak, [courseId, lessonId]] of Object.entries(TRAIN_MAP)) {
    const course = COURSES.find((c) => c.id === courseId);
    assert.ok(course, `${leak}: missing course ${courseId}`);
    assert.ok(course.lessons.some((l) => l.id === lessonId), `${leak}: missing lesson ${courseId}/${lessonId}`);
  }
});

test("drills are well formed", () => {
  for (const [group, list] of Object.entries(DRILLS)) {
    assert.ok(Array.isArray(list) && list.length > 0, `${group} is empty`);
    const ids = list.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length, `${group}: duplicate drill id`);
    for (const d of list) {
      assert.ok(d.fen && kingsOk(d.fen), `${d.id}: bad FEN`);
      assert.ok(Array.isArray(d.answers) && d.answers.length > 0, `${d.id}: no answers`);
      assert.ok(d.why, `${d.id}: missing explanation`);
    }
  }
});
