import { cancelSubscription, getSubscription, configStatus } from "../_lib/paypal.js";
import { userFromToken, rateLimitOk, getSubscriptionRow, store } from "../_lib/db.js";
import { mapSubscription } from "../_lib/subscriptionLogic.js";
import { send, fail, bearer, log } from "../_lib/http.js";

// A user can only cancel THEIR OWN subscription: the id comes from our database, never from the request.
export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "method-not-allowed", "Use POST.");
  if (configStatus().missing.length) return fail(res, 503, "not-configured", "Payments are not configured.");
  const jwt = bearer(req);
  if (!jwt) return fail(res, 401, "unauthenticated", "Sign in first.");
  let user;
  try { user = await userFromToken(jwt); } catch { return fail(res, 503, "auth-unavailable", "Try again shortly."); }
  if (!user) return fail(res, 401, "unauthenticated", "Sign in first.");

  try {
    if (!(await rateLimitOk(`cancel:${user.id}`, 5, 60))) return fail(res, 429, "rate-limited", "Too many attempts. Wait a minute.");
    const row = await getSubscriptionRow(user.id);
    if (!row) return fail(res, 404, "no-subscription", "No subscription found.");
    if (row.status === "cancelled" || row.status === "expired" || row.status === "refunded") return send(res, 200, { ok: true, already: true });
    try {
      await cancelSubscription(row.paypal_subscription_id, "Cancelled by user in Qelvaris");
    } catch (e) {
      if (e.status !== 422) throw e; // 422 = already cancelled at PayPal; carry on and sync our copy
    }
    const fresh = mapSubscription(await getSubscription(row.paypal_subscription_id), Number(process.env.PAYPAL_PERIOD_DAYS) || 31);
    if (fresh.user_id === user.id) await store.upsertSubscription(fresh);
    log("info", "subscription cancelled", { user: user.id });
    return send(res, 200, { ok: true });
  } catch (e) {
    log("error", "cancel failed", { message: e.message });
    return fail(res, 502, "payment-provider-error", "Could not cancel right now. You can also cancel in your PayPal account.");
  }
}
