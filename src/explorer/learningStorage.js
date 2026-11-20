// Qelvaris learning storage adapter.
// Existing getSetting/setSetting use karta hai. Purana "qelvaris-opening-repertoire" ko CHHUATA NAHI.
// Naye records alag key mein jaate hain, taaki purana repertoire format safe rahe.

import { getSetting, setSetting } from "../storage";

const VARIATIONS_KEY = "qelvaris-learning-saved-variations";

// Record: { id: "e4 e5 Nf3 ...", openingId, label, savedAt }
export async function loadSavedVariations() {
  try {
    const value = await getSetting(VARIATIONS_KEY, []);
    return Array.isArray(value) ? value : [];
  } catch (err) {
    console.error("Could not read saved variations:", err);
    return [];
  }
}

export async function toggleSavedVariation(record) {
  const current = await loadSavedVariations();
  const exists = current.some(
    (item) => item.id === record.id && item.openingId === record.openingId
  );
  const next = exists
    ? current.filter(
        (item) => !(item.id === record.id && item.openingId === record.openingId)
      )
    : [...current, { ...record, savedAt: new Date().toISOString() }];

  await setSetting(VARIATIONS_KEY, next);
  return next;
}
