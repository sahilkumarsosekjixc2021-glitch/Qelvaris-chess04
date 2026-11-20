# Threat model (short, honest)

## Assets
Accounts (email, password hash held by Supabase), users' chess data (device + optional backup row), subscription state, PayPal secrets, Supabase service-role key.

## Entry points
Sign-up/login forms, Supabase REST (anon key is public), `/api/paypal/create-subscription`, `/api/paypal/cancel`, `/api/paypal/webhook`, file import in Settings, feedback form link, query string `?page=`.

| Threat (OWASP) | Where | Mitigation in place | Gap / to do |
|---|---|---|---|
| Broken access control / IDOR | `user_backups`, `subscriptions`, friends | RLS `auth.uid() = user_id`; subscription writes only by service role; cancel uses the id from OUR table | Run the RLS checks in `runbooks/launch-security-checks.md` with two real accounts |
| Fake payment / self-granted plan | webhook | PayPal signature verified server-side; state read back from PayPal API; user id set by server (`custom_id`), not by browser | Test in PayPal sandbox before live |
| Replay / duplicate webhook | webhook | event id stored once; tests replay every event twice | - |
| Double charge | create-subscription | refuses if already subscribed; PayPal-Request-Id per user per minute; 5 requests/min limit | - |
| XSS | React escapes by default; one `dangerouslySetInnerHTML` (static SVG defs in BitBoard) | CSP in report-only mode | Enforce CSP after a clean week; paste `<script>alert(1)</script>` in every text field |
| Secrets in browser | `VITE_*` | test fails the build if a server secret name appears under `src/`; `lib/supabase.js` refuses a service_role key | Rotate any key that was ever shared in chat |
| Malicious backup file | import | `isValidBackup` checks shape before any write; per-store atomic writes | - |
| Brute-force login | Supabase Auth | Supabase built-in rate limits | Turn on CAPTCHA in Supabase Auth if signup spam appears |
| Email enumeration | AuthPage | same message for wrong password / unknown user (Supabase default) | Verify once by hand |
| Clickjacking / sniffing | headers | `vercel.json`: X-Frame-Options, nosniff, HSTS, Referrer-Policy | - |
| Vulnerable dependencies | npm | Dependabot weekly; `npm audit` in CI (non-blocking) | Make blocking once clean |
| Sensitive data in logs | errors, telemetry | `errorReport.js` redacts e-mail, tokens, passwords; server `log()` redacts | - |

AI/automated review is not a substitute for a professional audit once real money or many users are involved.
