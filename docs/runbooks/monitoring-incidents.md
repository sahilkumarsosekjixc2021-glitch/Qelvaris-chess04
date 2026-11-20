# Monitoring and incidents (small-site version)

## What to watch (5 minutes, weekly)
- Vercel -> Analytics / Speed Insights: traffic and slow pages
- Vercel -> Logs: look for red lines from `/api/paypal/*` (structured JSON, no secrets)
- Supabase -> Table editor -> `events`: `select message, count(*) from (select properties->>'message' message from events where name='client_error' and created_at > now() - interval '7 days') t group by 1 order by 2 desc` (adjust to your column names)
- PayPal dashboard -> Webhooks: any non-200 deliveries
- Free uptime check: UptimeRobot on `/` and `/api/health` (alert to your email)

## Alerts that need a human
Site down; webhook failures > a few in a day; a user reports "paid but not Pro".

## "Paid but Pro is off"
1. Supabase `subscriptions` row for the user: status?
2. PayPal -> Subscriptions: is it ACTIVE? Is the webhook delivery red?
3. Resend the webhook from the PayPal dashboard (safe: duplicates are ignored). The row should turn `active`.
4. If PayPal says ACTIVE and the webhook keeps failing, check Vercel logs for `event failed`.

## Incident template
What happened / when / who was affected / what we did / what we change so it does not repeat.
