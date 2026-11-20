// QV-STREAK: streak ka pura hisaab yahan (pure functions, koi storage/React nahi).
// Input sirf "active days" ki list hai (YYYY-MM-DD, local date) jo todayData.js ki
// `streak-days` setting mein pehle se save hoti hai. Isliye backup/restore/delete
// apne aap kaam karte hain aur purana streak data bhi chalta hai.
//
// Rules:
//  - Ek din tab "active" jab us din koi bhi 1 daily step poora ho.
//  - Freeze: shuru mein 1. Har 7-din ki streak par +1 (max 2). Miss hua din
//    freeze se apne aap bach jata hai (freeze tab kharch hota hai jab user wapas aata hai).
//  - Freeze se bacha din streak count mein add nahi hota, bas streak tootti nahi.

export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
export const START_FREEZES = 1;
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export function keyOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" -> local Date (noon, taaki DST se din na khiske)
export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function shiftKey(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

function diffDays(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

function cleanDays(days) {
  const list = Array.isArray(days) ? days : [];
  return [...new Set(list.filter((k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k)))].sort();
}

export function nextMilestone(count) {
  return MILESTONES.find((m) => m > count) || null;
}

// QV-QC: bonusFreezes = store se kharide extra freeze (shuru mein jud jaate hain)
export function computeStreak(rawDays, now = new Date(), bonusFreezes = 0) {
  const days = cleanDays(rawDays);
  const today = keyOf(now);

  let streak = 0;
  let best = 0;
  const bonus = Math.max(0, Number(bonusFreezes) || 0);
  let freezes = START_FREEZES + bonus;
  let prev = null;
  const frozen = [];

  for (const day of days) {
    if (day > today) continue; // future ki entry ignore
    if (prev === null) {
      streak = 1;
    } else {
      const missed = diffDays(prev, day) - 1;
      if (missed === 0) {
        streak += 1;
      } else if (missed <= freezes) {
        freezes -= missed;
        for (let i = 1; i <= missed; i += 1) frozen.push(shiftKey(prev, i));
        streak += 1;
      } else {
        streak = 1;
      }
    }
    if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES + bonus, freezes + 1);
    if (streak > best) best = streak;
    prev = day;
  }

  const activeToday = prev === today;
  let count = streak;
  let status = "none"; // none | active | at-risk | broken

  if (prev === null) {
    count = 0;
  } else if (activeToday) {
    status = "active";
  } else {
    const missed = diffDays(prev, today) - 1; // aaj ko chhod kar
    if (missed === 0) status = "at-risk"; // kal kiya tha, aaj abhi baaki
    else if (missed <= freezes) status = "at-risk"; // freeze bacha lega
    else {
      status = "broken";
      count = 0;
    }
  }

  const next = nextMilestone(count);
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= count) || 0;

  return {
    count,
    best: Math.max(best, count),
    freezes,
    frozen,
    activeToday,
    status,
    atRisk: status === "at-risk",
    nextMilestone: next,
    toNext: next ? next - count : 0,
    milestoneProgress: next ? (count - prevMilestone) / (next - prevMilestone) : 1,
    // Aaj hi milestone hit hua?
    hitMilestone: activeToday && MILESTONES.includes(count) ? count : null,
  };
}

// Monday se Sunday tak ka hafta
export function weekView(rawDays, now = new Date(), bonusFreezes = 0) {
  const days = new Set(cleanDays(rawDays));
  const { frozen } = computeStreak(rawDays, now, bonusFreezes);
  const frozenSet = new Set(frozen);
  const today = keyOf(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = shiftKey(today, -mondayOffset);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];

  return labels.map((label, i) => {
    const key = shiftKey(monday, i);
    let state = "missed";
    if (key > today) state = "future";
    else if (days.has(key)) state = "done";
    else if (frozenSet.has(key)) state = "frozen";
    else if (key === today) state = "pending";
    return { label, key, state, isToday: key === today };
  });
}

// Ek line ka motivational/status text
export function statusText(info) {
  if (info.status === "none") return "Complete any one task today to start your streak.";
  if (info.status === "broken") return "Streak reset. Complete any one task today to start fresh.";
  if (info.status === "at-risk") {
    return info.count > 0
      ? `Do any one task today to keep your ${info.count}-day streak alive.`
      : "Complete any one task today to start your streak.";
  }
  if (info.hitMilestone) return `${info.hitMilestone}-day streak! Keep going.`;
  if (info.nextMilestone) {
    const n = info.toNext;
    return `${n} more day${n === 1 ? "" : "s"} to your ${info.nextMilestone}-day milestone.`;
  }
  return "Legendary streak. Keep it going.";
}
