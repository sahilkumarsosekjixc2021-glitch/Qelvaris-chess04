# Pre-launch checklist

Status key: [x] done in code, [ ] you do it

- [x] Per-user data isolation (IndexedDB per account, RLS on cloud tables)
- [x] Auth through Supabase (no custom password code)
- [x] Server endpoints validate input, check auth, return one error format
- [x] Payments via verified, idempotent webhooks (tests replay every event twice)
- [x] Security headers; CSP in report-only mode
- [x] Errors reported with secrets/e-mails removed; friendly crash screens
- [x] Backup conflict protection and safe restore (tests)
- [x] Privacy policy matches what the app really does (cloud backup, PayPal)
- [x] Config missing -> clear screen instead of white page
- [ ] Run the SQL files (see runbooks/deploy.md)
- [ ] Two-account RLS check (runbooks/launch-security-checks.md)
- [ ] Restore test once (runbooks/backups.md)
- [ ] PayPal sandbox end-to-end (runbooks/paypal-setup.md) before any live key
- [ ] Decide what Pro includes; fill `PRO_FEATURES`; write refund wording in Terms
- [ ] Supabase backups plan (paid plan or manual export) and billing alerts on Vercel, Supabase, PayPal
- [ ] Replace `qelvaris.vercel.app` placeholders (index.html, robots, sitemap) with the real domain; set Supabase Site URL and redirect URLs
- [ ] Enforce CSP after a clean week
- [ ] Native-speaker read of ES and HI text
- [ ] Load check: open the site on a real phone on mobile data; run Lighthouse on Today and Settings
