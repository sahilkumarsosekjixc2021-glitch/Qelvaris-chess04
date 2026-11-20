# 0003 PayPal Subscriptions, USD, webhook is the source of truth
Context: PayPal business accounts in India cannot take domestic INR payments; the audience is global.
Decision: price in USD; the browser never decides plan or user; entitlement comes only from webhook-confirmed state, re-read from the PayPal API; events are verified and idempotent.
Alternatives: Razorpay/Stripe (user chose PayPal); redirect-only success (rejected: forgeable).
Consequences: Founding offer in INR cannot go through PayPal; pending -> active takes seconds (UI polls).
