# Deploy, environments, rollback (Vercel)

## First deploy / env vars
Vercel -> Project -> Settings -> Environment Variables. Use `.env.example` as the list. Browser values start with `VITE_`.
Server secrets (PayPal secret, `SUPABASE_SERVICE_ROLE_KEY`) must NOT start with `VITE_`.
Use **different values for Preview and Production**: PayPal sandbox keys on Preview, live keys on Production only. Ideally a second Supabase project for Preview.

## SQL
Run once in Supabase SQL editor, in this order: `sql/user_backups.sql`, `sql/user_backups_v2.sql`, `sql/billing.sql` (this also replaces `delete_my_account`), your events SQL.

## Every deploy
Pull request -> CI must be green -> Vercel preview URL -> click through Today, Review, Settings -> merge to main.

## Rollback
Vercel -> Deployments -> pick the last good one -> "..." -> Promote to Production (takes seconds). SQL changes in this repo are additive, so rolling back the site does not need a database rollback.

## Config check
Open `/api/health`: shows whether payments are configured (names only, never values).
Remove `VITE_SUPABASE_URL` in a preview: the site must show "Qelvaris is not configured", not a blank page.
