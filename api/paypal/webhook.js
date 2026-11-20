import { createWebhookHandler } from "../_lib/webhookHandler.js";
import { verifyWebhook, getSubscription, getSale, configStatus } from "../_lib/paypal.js";
import { store } from "../_lib/db.js";
import { send, fail, rawBody, log } from "../_lib/http.js";

// We need the exact bytes PayPal sent to verify the signature, so Vercel must not parse the body.
export const config = { api: { bodyParser: false } };

const handle = createWebhookHandler({
  verify: verifyWebhook,
  getSubscription,
  getSale,
  store,
  periodDays: Number(process.env.PAYPAL_PERIOD_DAYS) || 31,
  log,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "method-not-allowed", "Use POST.");
  if (configStatus().missing.length) return fail(res, 503, "not-configured", "Payments are not configured.");
  let text;
  try { text = await rawBody(req); } catch { return fail(res, 413, "too-large", "Body too large."); }
  const out = await handle(text, req.headers);
  return send(res, out.status, out.body);
}
