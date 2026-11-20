// QC wallet ka storage (IndexedDB settings mein). Backup/restore apne aap kaam karta hai.
// Keys: qc-wallet, qc-claimed, qc-inv
import { getSetting, setSetting } from "../../storage";
import { keyOf, shiftKey } from "../streak/streakCore";
import {
  DAILY_STEPS,
  ITEMS,
  MAX_BOUGHT_FREEZES,
  WEEKLY_MISSIONS,
  itemById,
  weekProgress,
} from "./qcCore";

const LEDGER_MAX = 40;
const CLAIMED_MAX = 500;

const EMPTY_WALLET = { balance: 0, earned: 0, spent: 0, ledger: [] };
const EMPTY_INV = { freezes: 0, badges: [], equipped: null };

// Ek saath do writes na ho, isliye line mein chalate hain
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function readWallet() {
  const w = await getSetting("qc-wallet", null);
  return { ...EMPTY_WALLET, ...(w || {}), ledger: Array.isArray(w?.ledger) ? w.ledger : [] };
}
async function readClaimed() {
  const c = await getSetting("qc-claimed", []);
  return Array.isArray(c) ? c : [];
}
async function readInv() {
  const i = await getSetting("qc-inv", null);
  return {
    ...EMPTY_INV,
    ...(i || {}),
    badges: Array.isArray(i?.badges) ? i.badges : [],
  };
}

function emit(detail) {
  try {
    window.dispatchEvent(new CustomEvent("qelvaris-qc-changed", { detail }));
  } catch {
    /* ignore */
  }
}

export async function loadWallet() {
  const [wallet, inv] = await Promise.all([readWallet(), readInv()]);
  return { ...wallet, inv };
}

// Streak ke liye: store se kharide extra freezes
export async function readBonusFreezes() {
  const inv = await readInv();
  return Math.max(0, Math.min(MAX_BOUGHT_FREEZES, Number(inv.freezes) || 0));
}

/* entries: [{ id, amount, reason }]. Har id sirf ek baar milti hai (dobara tick karne se farming nahi). */
export function awardMany(entries) {
  return awardDetailed(entries).then((r) => r.gained);
}

// QV-CELEBRATE: gained ke saath ye bhi batata hai ki kaun si ids is baar nayi mili (celebration ke liye)
export function awardDetailed(entries) {
  return locked(async () => {
    const [wallet, claimed] = await Promise.all([readWallet(), readClaimed()]);
    const seen = new Set(claimed);
    let gained = 0;
    const granted = [];
    const ledger = [...wallet.ledger];

    for (const e of entries) {
      if (!e || !e.id || !(e.amount > 0) || seen.has(e.id)) continue;
      seen.add(e.id);
      granted.push(e.id);
      gained += e.amount;
      ledger.unshift({ t: Date.now(), amount: e.amount, reason: e.reason || "Reward" });
    }
    if (gained === 0) return { gained: 0, granted };

    const next = {
      balance: wallet.balance + gained,
      earned: wallet.earned + gained,
      spent: wallet.spent,
      ledger: ledger.slice(0, LEDGER_MAX),
    };
    await setSetting("qc-wallet", next);
    await setSetting("qc-claimed", [...seen].slice(-CLAIMED_MAX));
    emit({ balance: next.balance, delta: gained });
    return { gained, granted };
  });
}

export function buyItem(itemId) {
  return locked(async () => {
    const item = itemById(itemId);
    if (!item) return { ok: false, error: "Item not found." };

    const [wallet, inv] = await Promise.all([readWallet(), readInv()]);
    if (item.kind === "freeze" && inv.freezes >= MAX_BOUGHT_FREEZES) {
      return { ok: false, error: `You already own the maximum of ${MAX_BOUGHT_FREEZES} freezes.` };
    }
    if (item.kind === "badge" && inv.badges.includes(item.id)) {
      return { ok: false, error: "You already own this badge." };
    }
    if (wallet.balance < item.price) {
      return { ok: false, error: `You need ${item.price - wallet.balance} more QC.` };
    }

    const nextInv = { ...inv };
    if (item.kind === "freeze") nextInv.freezes = inv.freezes + 1;
    else {
      nextInv.badges = [...inv.badges, item.id];
      if (!nextInv.equipped) nextInv.equipped = item.id;
    }

    const nextWallet = {
      balance: wallet.balance - item.price,
      earned: wallet.earned,
      spent: wallet.spent + item.price,
      ledger: [{ t: Date.now(), amount: -item.price, reason: `Bought ${item.name}` }, ...wallet.ledger].slice(0, LEDGER_MAX),
    };

    await setSetting("qc-inv", nextInv);
    await setSetting("qc-wallet", nextWallet);
    emit({ balance: nextWallet.balance, delta: -item.price });
    return { ok: true, item };
  });
}

export function equipBadge(badgeId) {
  return locked(async () => {
    const inv = await readInv();
    if (badgeId && !inv.badges.includes(badgeId)) return false;
    await setSetting("qc-inv", { ...inv, equipped: badgeId || null });
    emit({ balance: null, delta: 0 });
    return true;
  });
}

/* ---------- Missions ---------- */

function currentWeekDays(now = new Date()) {
  const monday = shiftKey(keyOf(now), -((now.getDay() + 6) % 7));
  return { monday, days: Array.from({ length: 7 }, (_, i) => shiftKey(monday, i)) };
}

export async function loadMissions(now = new Date()) {
  const key = keyOf(now);
  const { monday, days } = currentWeekDays(now);
  const [row, dayKeys, perfectKeys, claimed] = await Promise.all([
    getSetting(`today-${key}`, null),
    getSetting("streak-days", []),
    getSetting("streak-perfect", []),
    readClaimed(),
  ]);
  const doneIds = new Set(Array.isArray(row?.done) ? row.done : []);
  const progress = weekProgress(dayKeys, perfectKeys, days);
  const claimedSet = new Set(claimed);

  return {
    daily: DAILY_STEPS.map((s) => ({ ...s, done: doneIds.has(s.id) })),
    weekly: WEEKLY_MISSIONS.map((m) => {
      const value = m.source === "days" ? progress.days : progress.perfect;
      const claimKey = `wk:${monday}:${m.id}`;
      return {
        ...m,
        value: Math.min(value, m.target),
        ready: value >= m.target && !claimedSet.has(claimKey),
        claimed: claimedSet.has(claimKey),
        claimKey,
      };
    }),
  };
}

export async function claimWeekly(missionId, now = new Date()) {
  const m = WEEKLY_MISSIONS.find((x) => x.id === missionId);
  if (!m) return 0;
  const { weekly } = await loadMissions(now);
  const mission = weekly.find((x) => x.id === missionId);
  if (!mission || !mission.ready) return 0;
  return awardMany([{ id: mission.claimKey, amount: m.reward, reason: `Weekly mission: ${m.title}` }]);
}

export { ITEMS };
