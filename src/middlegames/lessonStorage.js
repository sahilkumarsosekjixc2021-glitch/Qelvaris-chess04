// Qelvaris Middlegames — lesson progress (existing getSetting/setSetting par, alag key).
// Record: { [lessonId]: { completedAt, firstTry (null = watch mode), total, best, plays } }

import { getSetting, setSetting } from "../storage";

const KEY = "qelvaris-lesson-progress";

let chain = Promise.resolve();
function serial(task) {
  const job = chain.then(task);
  chain = job.catch(() => {});
  return job;
}

export async function loadProgress() {
  try {
    const value = await getSetting(KEY, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (err) {
    console.error("Could not read lesson progress:", err);
    return {};
  }
}

export function saveLessonResult(lessonId, { firstTry, total }) {
  return serial(async () => {
    const current = await loadProgress();
    const prev = current[lessonId] || {};
    const next = {
      ...current,
      [lessonId]: {
        completedAt: new Date().toISOString(),
        firstTry,
        total,
        best: Math.max(prev.best || 0, firstTry || 0),
        plays: (prev.plays || 0) + 1,
      },
    };
    await setSetting(KEY, next);
    return next;
  });
}

// Saved ("bookmark") lessons — alag key, sirf lesson ids ki list.
const SAVED_KEY = "qelvaris-lesson-saved";

export async function loadSavedLessons() {
  try {
    const value = await getSetting(SAVED_KEY, []);
    return Array.isArray(value) ? value : [];
  } catch (err) {
    console.error("Could not read saved lessons:", err);
    return [];
  }
}

export function toggleSavedLesson(lessonId) {
  return serial(async () => {
    const current = await loadSavedLessons();
    const next = current.includes(lessonId) ? current.filter((id) => id !== lessonId) : [...current, lessonId];
    await setSetting(SAVED_KEY, next);
    return next;
  });
}
