import test from "node:test";
import assert from "node:assert/strict";
import { COURSES } from "../src/features/coach/lessons.generated.js";
import { LEVELS, GOALS, firstStep } from "../src/features/onboarding/flow.js";
import { D as OT_DICT } from "../src/features/onboarding/dict.js";

test("every level and goal leads to a real lesson or the Play page", () => {
  for (const level of [...LEVELS, null]) {
    for (const goal of [...GOALS, null]) {
      const f = firstStep(level, goal);
      if (f.type === "lesson") {
        const c = COURSES.find((x) => x.id === f.course);
        assert.ok(c && c.lessons.some((l) => l.id === f.lesson), `${level}/${goal}: missing ${f.course}/${f.lesson}`);
      } else {
        assert.equal(f.page, "Play");
      }
    }
  }
});

test("beginners always start with Foundations", () => {
  for (const g of GOALS) assert.deepEqual(firstStep("beginner", g), { type: "lesson", course: "basics", lesson: "values" });
});

test("onboarding texts exist in every language with the same keys", () => {
  const en = Object.keys(OT_DICT.en);
  for (const lang of ["es", "hi"]) {
    const missing = en.filter((k) => !(k in OT_DICT[lang]));
    assert.deepEqual(missing, [], `${lang} missing: ${missing.join(", ")}`);
  }
});
