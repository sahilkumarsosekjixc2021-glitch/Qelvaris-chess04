# PayPal setup (sandbox first, live last)

1. developer.paypal.com -> Apps & Credentials -> **Sandbox** -> Create app. Note Client ID and Secret.
2. Products & Plans: create a product "Qelvaris Pro" and a **monthly plan in USD** (note the plan id `P-...`). Sandbox and Live have different ids.
3. Webhooks: add `https://YOUR-DOMAIN/api/paypal/webhook` and tick: BILLING.SUBSCRIPTION.ACTIVATED, .UPDATED, .CANCELLED, .SUSPENDED, .EXPIRED, .RE-ACTIVATED, .PAYMENT.FAILED, PAYMENT.SALE.COMPLETED, PAYMENT.SALE.REFUNDED, PAYMENT.SALE.REVERSED. Copy the Webhook ID.
4. Vercel env (Preview): `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PLAN_ID_PRO`, `PAYPAL_PERIOD_DAYS=31`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, and the browser ones `VITE_PAYPAL_CLIENT_ID`, `VITE_PAYPAL_PLAN_ID`, `VITE_PRO_PRICE_LABEL` (for example `$4.99 / month`, must match the plan).
5. Redeploy. Settings shows the "Qelvaris Pro" card. Pay with a **sandbox buyer** account (Sandbox -> Accounts).
6. Check: card says Pro active; `subscriptions` row is `active`; `paypal_events` has rows; PayPal dashboard -> Webhooks shows 200s.
7. Test cancel (card button), test deleting the account while subscribed (must be blocked until cancelled), re-send a webhook from the PayPal dashboard (nothing duplicates).
8. Go live: create the same app/plan/webhook under **Live**, put live values in **Production** env only, set `PAYPAL_ENV=live`, make one real small payment yourself and refund it.

## India note
PayPal business accounts in India generally cannot receive domestic INR payments. Price in USD for everyone. An INR-only offer needs a different gateway.

## Troubleshooting
- Webhook shows 401 in PayPal: signature check failed. Check `PAYPAL_WEBHOOK_ID` belongs to the same mode (sandbox vs live) as `PAYPAL_ENV`. The function reads the raw request body (`bodyParser: false`); if Vercel ever parses it first, signatures will fail - tell me and I will change that part.
- Webhook shows 503 "not-configured": a server env var is missing; open `/api/health` to see which.
- Button does not appear: ad blocker, or `VITE_PAYPAL_CLIENT_ID` / `VITE_PAYPAL_PLAN_ID` missing (the card is hidden on purpose until both are set).
