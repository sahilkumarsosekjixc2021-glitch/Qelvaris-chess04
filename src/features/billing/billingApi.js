import { supabase } from "../../lib/supabase";
import { isEntitled } from "../../../api/_lib/subscriptionLogic.js"; // same rules as the server

const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;
const PLAN_ID = import.meta.env.VITE_PAYPAL_PLAN_ID;
// The card stays hidden until BOTH values are set in Vercel, so billing can be built and tested quietly.
export const BILLING_ENABLED = Boolean(CLIENT_ID && PLAN_ID);
export const PRICE_LABEL = import.meta.env.VITE_PRO_PRICE_LABEL || "";

// Features that need Pro. Empty on purpose: add ids here when you decide what is paid,
// then wrap the feature with `await hasFeature("id")`. (Client-side gating is a convenience, not a lock.)
export const PRO_FEATURES = {};

export async function getMySubscription() {
  const { data, error } = await supabase.from("subscriptions").select("status,current_period_end,plan").maybeSingle();
  if (error) throw error;
  return data; // RLS only ever returns this user's own row
}

export async function hasFeature(feature) {
  if (!PRO_FEATURES[feature]) return true;
  try { return isEntitled(await getMySubscription()); } catch { return false; }
}

async function authedPost(path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("not-signed-in");
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.code || `http-${r.status}`), { status: r.status });
  return j;
}

export const startCheckout = () => authedPost("/api/paypal/create-subscription", { plan: "pro" });
export const cancelSubscription = () => authedPost("/api/paypal/cancel", {});
export { isEntitled };

// Account deletion must never leave someone still being billed.
export async function ensureNoActiveSubscription() {
  if (!BILLING_ENABLED) return;
  const sub = await getMySubscription();
  if (sub && (sub.status === "active" || sub.status === "suspended")) {
    await cancelSubscription(); // throws if PayPal could not cancel; the caller then stops the deletion
  }
}

let sdkPromise = null;
export function loadPayPalSdk() {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CLIENT_ID)}&vault=true&intent=subscription&currency=USD`;
      s.async = true;
      s.onload = () => (window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error("paypal-sdk-missing")));
      s.onerror = () => { sdkPromise = null; reject(new Error("paypal-sdk-blocked")); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}
