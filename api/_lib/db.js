// Server-side database access with the service-role key (bypasses RLS). Never import this in the browser.
import { createClient } from "@supabase/supabase-js";
import { shouldApply } from "./subscriptionLogic.js";

let admin = null;
export function db() {
  if (!admin) admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export async function userFromToken(jwt) {
  const { data, error } = await db().auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}

export async function rateLimitOk(key, max, windowSeconds) {
  const { data, error } = await db().rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) throw error;
  return data === true;
}

export async function getSubscriptionRow(userId) {
  const { data, error } = await db().from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Store used by the webhook handler (tests replace it with an in-memory fake).
export const store = {
  // true if this PayPal event id is new; false if we already handled it (duplicate delivery)
  async claimEvent(event) {
    const { error } = await db().from("paypal_events").insert({ id: event.id, event_type: event.event_type, summary: { resource_id: event.resource?.id || null } });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw error;
  },
  async releaseEvent(id) {
    await db().from("paypal_events").delete().eq("id", id);
  },
  async upsertSubscription(row) {
    const existing = await getSubscriptionRow(row.user_id);
    if (!shouldApply(existing, row)) return false;
    const { error } = await db().from("subscriptions").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return true;
  },
  async setStatusBySubscription(subscriptionId, status) {
    const { error } = await db().from("subscriptions").update({ status, updated_at: new Date().toISOString() }).eq("paypal_subscription_id", subscriptionId);
    if (error) throw error;
  },
};
