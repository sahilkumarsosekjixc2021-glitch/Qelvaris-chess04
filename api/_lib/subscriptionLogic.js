// Pure rules for subscriptions. Used by the server functions AND by the browser (same file, one truth).

export const STATUSES = ["pending", "active", "suspended", "cancelled", "expired", "refunded"];

const DAY = 24 * 3600 * 1000;

// PayPal subscription resource -> our row. periodDays is the plan length (31 monthly, 366 yearly).
export function mapSubscription(sub, periodDays = 31) {
  const map = { ACTIVE: "active", APPROVAL_PENDING: "pending", APPROVED: "pending", SUSPENDED: "suspended", CANCELLED: "cancelled", EXPIRED: "expired" };
  const status = map[String(sub?.status || "").toUpperCase()] || "pending";
  let end = sub?.billing_info?.next_billing_time || null;
  if (!end && sub?.billing_info?.last_payment?.time) {
    // cancelled/suspended: the customer paid for one period from the last payment
    end = new Date(new Date(sub.billing_info.last_payment.time).getTime() + periodDays * DAY).toISOString();
  }
  return {
    user_id: sub?.custom_id || null,
    paypal_subscription_id: sub?.id,
    plan: "pro",
    status,
    current_period_end: end,
  };
}

// Does this row give access to paid features right now?
export function isEntitled(row, now = Date.now()) {
  if (!row) return false;
  if (row.status === "active") return true;
  if (row.status === "cancelled" && row.current_period_end) return new Date(row.current_period_end).getTime() > now; // paid until the period ends
  return false;
}

// A late event about an OLD subscription must not overwrite a newer, working one.
export function shouldApply(existing, incoming) {
  if (!existing) return true;
  if (existing.paypal_subscription_id === incoming.paypal_subscription_id) return true;
  return !(existing.status === "active" || existing.status === "suspended") || incoming.status === "active";
}

// Which events we act on, and what they point at.
export function describeEvent(event) {
  const type = String(event?.event_type || "");
  const r = event?.resource || {};
  if (type.startsWith("BILLING.SUBSCRIPTION.")) return { kind: "subscription", subscriptionId: r.id };
  if (type === "PAYMENT.SALE.COMPLETED") return r.billing_agreement_id ? { kind: "subscription", subscriptionId: r.billing_agreement_id } : { kind: "ignore" };
  if (type === "PAYMENT.SALE.REFUNDED") return { kind: "refund", subscriptionId: r.billing_agreement_id || null, saleId: r.sale_id || null };
  if (type === "PAYMENT.SALE.REVERSED") return { kind: "refund", subscriptionId: r.billing_agreement_id || null, saleId: r.id || null };
  return { kind: "ignore" };
}
