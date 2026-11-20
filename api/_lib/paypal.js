// Thin PayPal REST client. Secrets come only from server environment variables.
const BASES = { sandbox: "https://api-m.sandbox.paypal.com", live: "https://api-m.paypal.com" };

export function paypalEnv() {
  const env = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox"; // default to the safe test mode
  return { env, base: BASES[env] };
}

export function configStatus() {
  const need = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID", "PAYPAL_PLAN_ID_PRO", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  return { missing: need.filter((k) => !process.env[k]), env: paypalEnv().env };
}

let cached = { token: null, exp: 0 };
async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 30000) return cached.token;
  const { base } = paypalEnv();
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`paypal-auth-${r.status}`);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 300) * 1000 };
  return cached.token;
}

async function call(path, { method = "GET", body, headers = {}, raw } = {}) {
  const { base } = paypalEnv();
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...headers },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!r.ok) throw Object.assign(new Error(`paypal-${r.status}`), { status: r.status, detail: json?.name || json?.error });
  return json;
}

export const getSubscription = (id) => call(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
export const getSale = (id) => call(`/v1/payments/sale/${encodeURIComponent(id)}`);
export const cancelSubscription = (id, reason) =>
  call(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { method: "POST", body: { reason: String(reason || "Cancelled by user").slice(0, 120) } });

export function createSubscription({ planId, userId, requestId, siteUrl }) {
  return call("/v1/billing/subscriptions", {
    method: "POST",
    headers: { "PayPal-Request-Id": requestId, Prefer: "return=representation" },
    body: {
      plan_id: planId,
      custom_id: userId,
      application_context: {
        brand_name: "Qelvaris",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${siteUrl}/?billing=success`,
        cancel_url: `${siteUrl}/?billing=cancelled`,
      },
    },
  });
}

// Ask PayPal to check the webhook signature. rawBody is the exact text PayPal sent.
export async function verifyWebhook(rawBodyText, headers) {
  const h = (k) => headers[k] || "";
  const payload =
    `{"auth_algo":${JSON.stringify(h("paypal-auth-algo"))},"cert_url":${JSON.stringify(h("paypal-cert-url"))},` +
    `"transmission_id":${JSON.stringify(h("paypal-transmission-id"))},"transmission_sig":${JSON.stringify(h("paypal-transmission-sig"))},` +
    `"transmission_time":${JSON.stringify(h("paypal-transmission-time"))},"webhook_id":${JSON.stringify(process.env.PAYPAL_WEBHOOK_ID)},` +
    `"webhook_event":${rawBodyText}}`;
  const out = await call("/v1/notifications/verify-webhook-signature", { method: "POST", raw: payload });
  return out?.verification_status === "SUCCESS";
}
