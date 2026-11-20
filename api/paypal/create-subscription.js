import { createSubscription, configStatus } from "../_lib/paypal.js";
import { db, userFromToken, rateLimitOk, getSubscriptionRow } from "../_lib/db.js";
import { isEntitled } from "../_lib/subscriptionLogic.js";
import { send, fail, bearer, log } from "../_lib/http.js";

// Only plans we define on the server can be bought. The browser never sends a plan id or a user id.
const PLANS = { pro: () => process.env.PAYPAL_PLAN_ID_PRO };

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "method-not-allowed", "Use POST.");
  if (configStatus().missing.length) return fail(res, 503, "not-configured", "Payments are not configured.");

  const jwt = bearer(req);
  if (!jwt) return fail(res, 401, "unauthenticated", "Sign in first.");
  let user;
  try { user = await userFromToken(jwt); } catch { return fail(res, 503, "auth-unavailable", "Try again shortly."); }
  if (!user) return fail(res, 401, "unauthenticated", "Sign in first.");

  const plan = (req.body && typeof req.body === "object" ? req.body.plan : null) || "pro";
  if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) return fail(res, 400, "invalid-plan", "Unknown plan.");

  try {
    if (!(await rateLimitOk(`sub:${user.id}`, 5, 60))) return fail(res, 429, "rate-limited", "Too many attempts. Wait a minute.");

    // Never create a second subscription for someone who already pays: that would charge them twice.
    const existing = await getSubscriptionRow(user.id);
    if (existing && (isEntitled(existing) || existing.status === "suspended")) return fail(res, 409, "already-subscribed", "You already have a subscription.");

    const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
    const requestId = `${user.id}:${plan}:${Math.floor(Date.now() / 60000)}`; // double-click within a minute = same subscription
    const sub = await createSubscription({ planId: PLANS[plan](), userId: user.id, requestId, siteUrl });

    // Not entitled yet: the webhook turns "pending" into "active" after PayPal confirms the payment.
    const { error } = await db().from("subscriptions").upsert(
      { user_id: user.id, paypal_subscription_id: sub.id, plan, status: "pending", current_period_end: null, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    log("info", "subscription created", { user: user.id, subscription: sub.id });
    return send(res, 200, { ok: true, id: sub.id });
  } catch (e) {
    log("error", "create-subscription failed", { message: e.message, detail: e.detail });
    return fail(res, 502, "payment-provider-error", "Could not start checkout. Try again.");
  }
}
