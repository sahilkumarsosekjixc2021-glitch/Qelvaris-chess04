import { configStatus } from "./_lib/paypal.js";
import { send } from "./_lib/http.js";

// /api/health : the server is up. "payments" says whether PayPal is configured (only names, never values).
export default function handler(req, res) {
  const c = configStatus();
  send(res, 200, { ok: true, payments: c.missing.length === 0 ? "configured" : "not-configured", paypalEnv: c.env, missing: c.missing, time: new Date().toISOString() });
}
