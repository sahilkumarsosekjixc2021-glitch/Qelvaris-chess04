import test from "node:test";
import assert from "node:assert/strict";
import { mapSubscription, isEntitled, shouldApply, describeEvent } from "../api/_lib/subscriptionLogic.js";
import { createWebhookHandler } from "../api/_lib/webhookHandler.js";
import BILLING_DICT from "../src/features/billing/strings.dict.js";

const NOW = new Date("2026-06-15T00:00:00Z").getTime();
const sub = (over = {}) => ({ id: "I-SUB1", custom_id: "user-1", status: "ACTIVE", billing_info: { next_billing_time: "2026-07-01T00:00:00Z", last_payment: { time: "2026-06-01T00:00:00Z" } }, ...over });

test("PayPal statuses map to ours", () => {
  assert.equal(mapSubscription(sub()).status, "active");
  assert.equal(mapSubscription(sub({ status: "APPROVAL_PENDING" })).status, "pending");
  assert.equal(mapSubscription(sub({ status: "SUSPENDED" })).status, "suspended");
  assert.equal(mapSubscription(sub({ status: "CANCELLED" })).status, "cancelled");
  assert.equal(mapSubscription(sub({ status: "WHATEVER" })).status, "pending"); // unknown never grants access
  assert.equal(mapSubscription(sub()).user_id, "user-1");
});

test("entitlement: active yes; cancelled only until the paid period ends; everything else no", () => {
  assert.equal(isEntitled({ status: "active" }, NOW), true);
  assert.equal(isEntitled({ status: "cancelled", current_period_end: "2026-06-20T00:00:00Z" }, NOW), true);
  assert.equal(isEntitled({ status: "cancelled", current_period_end: "2026-06-01T00:00:00Z" }, NOW), false);
  for (const s of ["pending", "suspended", "expired", "refunded"]) assert.equal(isEntitled({ status: s, current_period_end: "2099-01-01" }, NOW), false, s);
  assert.equal(isEntitled(null, NOW), false);
  assert.equal(isEntitled(undefined, NOW), false);
});

test("a cancelled subscription keeps access for one paid period after the last payment", () => {
  const row = mapSubscription(sub({ status: "CANCELLED", billing_info: { last_payment: { time: "2026-06-01T00:00:00Z" } } }), 31);
  assert.equal(isEntitled(row, NOW), true);
  assert.equal(isEntitled(row, new Date("2026-07-05T00:00:00Z").getTime()), false);
});

test("late event about an OLD subscription cannot overwrite a newer active one", () => {
  const existing = { paypal_subscription_id: "NEW", status: "active" };
  assert.equal(shouldApply(existing, { paypal_subscription_id: "OLD", status: "cancelled" }), false);
  assert.equal(shouldApply(existing, { paypal_subscription_id: "NEW", status: "cancelled" }), true);
  assert.equal(shouldApply({ paypal_subscription_id: "OLD", status: "cancelled" }, { paypal_subscription_id: "NEW", status: "active" }), true);
  assert.equal(shouldApply(null, { paypal_subscription_id: "X", status: "pending" }), true);
});

test("events are classified", () => {
  assert.deepEqual(describeEvent({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "S" } }), { kind: "subscription", subscriptionId: "S" });
  assert.deepEqual(describeEvent({ event_type: "PAYMENT.SALE.COMPLETED", resource: { billing_agreement_id: "S" } }), { kind: "subscription", subscriptionId: "S" });
  assert.equal(describeEvent({ event_type: "PAYMENT.SALE.COMPLETED", resource: {} }).kind, "ignore"); // one-off payment
  assert.equal(describeEvent({ event_type: "PAYMENT.SALE.REFUNDED", resource: { sale_id: "X" } }).kind, "refund");
  assert.equal(describeEvent({ event_type: "CATALOG.PRODUCT.CREATED", resource: {} }).kind, "ignore");
});

// ---- webhook handler with in-memory fakes ----
function world(opts = {}) {
  const w = { events: new Set(), rows: {}, applied: 0, subscriptions: { "I-SUB1": sub() }, failNext: false };
  const store = {
    async claimEvent(e) { if (w.events.has(e.id)) return false; w.events.add(e.id); return true; },
    async releaseEvent(id) { w.events.delete(id); },
    async upsertSubscription(row) { if (w.failNext) { w.failNext = false; throw new Error("db down"); } if (!shouldApply(w.rows[row.user_id], row)) return false; w.rows[row.user_id] = row; w.applied += 1; return true; },
    async setStatusBySubscription(id, status) { for (const r of Object.values(w.rows)) if (r.paypal_subscription_id === id) r.status = status; w.applied += 1; },
  };
  const handle = createWebhookHandler({
    verify: async () => opts.signatureOk !== false,
    getSubscription: async (id) => w.subscriptions[id],
    getSale: async () => ({ billing_agreement_id: "I-SUB1" }),
    store, periodDays: 31,
  });
  return { w, handle };
}
const evt = (id, type, resource) => JSON.stringify({ id, event_type: type, resource });

test("webhook: garbage JSON gets a clean 400 in our error format", async () => {
  const { handle } = world();
  const r = await handle("{not json", {});
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "invalid-json");
  assert.equal((await handle("{}", {})).status, 400);
});

test("webhook: bad signature is refused and changes nothing", async () => {
  const { w, handle } = world({ signatureOk: false });
  const r = await handle(evt("E1", "BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB1" }), {});
  assert.equal(r.status, 401);
  assert.equal(w.applied, 0);
  assert.equal(w.events.size, 0);
});

test("webhook: every handled event type applied twice changes state only once", async () => {
  const cases = [
    ["BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB1" }],
    ["PAYMENT.SALE.COMPLETED", { billing_agreement_id: "I-SUB1" }],
    ["BILLING.SUBSCRIPTION.CANCELLED", { id: "I-SUB1" }],
    ["BILLING.SUBSCRIPTION.SUSPENDED", { id: "I-SUB1" }],
    ["BILLING.SUBSCRIPTION.PAYMENT.FAILED", { id: "I-SUB1" }],
  ];
  for (const [type, resource] of cases) {
    const { w, handle } = world();
    const body = evt("E-" + type, type, resource);
    const a = await handle(body, {});
    const b = await handle(body, {});
    assert.equal(a.status, 200, type);
    assert.equal(b.body.duplicate, true, type);
    assert.equal(w.applied, 1, type + " applied once");
  }
});

test("webhook: activation grants access, refund takes it away", async () => {
  const { w, handle } = world();
  await handle(evt("E1", "BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB1" }), {});
  assert.equal(isEntitled(w.rows["user-1"], NOW), true);
  await handle(evt("E2", "PAYMENT.SALE.REFUNDED", { sale_id: "SALE1" }), {});
  assert.equal(w.rows["user-1"].status, "refunded");
  assert.equal(isEntitled(w.rows["user-1"], NOW), false);
});

test("webhook: a failure releases the event so PayPal's retry can succeed", async () => {
  const { w, handle } = world();
  w.failNext = true;
  const body = evt("E9", "BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB1" });
  assert.equal((await handle(body, {})).status, 500);
  assert.equal((await handle(body, {})).status, 200); // retry works, not treated as duplicate
  assert.equal(w.applied, 1);
});

test("webhook: a subscription without our user id is ignored, never guessed", async () => {
  const { w, handle } = world();
  w.subscriptions["I-SUB1"] = sub({ custom_id: undefined });
  assert.equal((await handle(evt("E5", "BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB1" }), {})).status, 200);
  assert.equal(w.applied, 0);
});

test("billing strings exist in every language with the same keys", () => {
  const en = Object.keys(BILLING_DICT.en).sort();
  for (const l of ["es", "hi"]) assert.deepEqual(Object.keys(BILLING_DICT[l]).sort(), en, l);
});
