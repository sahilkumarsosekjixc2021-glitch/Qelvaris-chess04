import { describeEvent, mapSubscription } from "./subscriptionLogic.js";

// All dependencies are injected so the same code can be tested with fakes (see tests/billing.test.mjs).
export function createWebhookHandler({ verify, getSubscription, getSale, store, periodDays = 31, log = () => {} }) {
  async function apply(event) {
    const what = describeEvent(event);
    if (what.kind === "ignore") return;

    if (what.kind === "subscription") {
      // PayPal is the source of truth: fetch the current subscription instead of trusting the event body.
      const sub = await getSubscription(what.subscriptionId);
      const row = mapSubscription(sub, periodDays);
      if (!row.user_id) { log("warn", "subscription without custom_id", { subscription: row.paypal_subscription_id }); return; }
      await store.upsertSubscription(row);
      return;
    }

    if (what.kind === "refund") {
      let subscriptionId = what.subscriptionId;
      if (!subscriptionId && what.saleId) subscriptionId = (await getSale(what.saleId))?.billing_agreement_id || null;
      if (subscriptionId) await store.setStatusBySubscription(subscriptionId, "refunded");
    }
  }

  // returns { status, body }
  return async function handle(rawText, headers) {
    let event;
    try { event = JSON.parse(rawText); } catch { return { status: 400, body: { error: { code: "invalid-json", message: "Body is not valid JSON." } } }; }
    if (!event || typeof event.id !== "string" || typeof event.event_type !== "string") {
      return { status: 400, body: { error: { code: "invalid-event", message: "Not a PayPal event." } } };
    }
    let ok = false;
    try { ok = await verify(rawText, headers); } catch (e) { log("error", "verify failed", { message: e.message }); return { status: 503, body: { error: { code: "verify-unavailable", message: "Could not verify right now." } } }; }
    if (!ok) return { status: 401, body: { error: { code: "bad-signature", message: "Signature check failed." } } };

    const fresh = await store.claimEvent(event);
    if (!fresh) return { status: 200, body: { ok: true, duplicate: true } };
    try {
      await apply(event);
    } catch (e) {
      await store.releaseEvent(event.id); // let PayPal retry later
      log("error", "event failed", { type: event.event_type, message: e.message });
      return { status: 500, body: { error: { code: "processing-failed", message: "Will retry." } } };
    }
    return { status: 200, body: { ok: true } };
  };
}
