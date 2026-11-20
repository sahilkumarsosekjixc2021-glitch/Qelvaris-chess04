# Batch 30 - sync fix + PayPal + hardening (playbook)

Copy this zip into your project root (same folders). It only contains files that changed or are new; overwrite when asked.
Changed existing files: src/App.jsx, src/Settings.jsx, src/main.jsx, src/storage.js, src/auth/RootApp.jsx, src/lib/supabase.js,
src/features/cloud/{cloud.js,CloudBackup.jsx,strings.js}, src/features/legal/Legal.jsx, .github/workflows/ci.yml.

IMPORTANT before you copy:
- If your project already has a `vercel.json`, do not overwrite blindly: add the `headers` part to yours.
- Open `src/Settings.jsx` diff: only 3 things changed (Billing card, delete-account guard, imports).

## Order to do it
1. Supabase -> SQL editor -> run `sql/user_backups_v2.sql`, then `sql/billing.sql`.
2. `npm run dev` -> Settings -> Cloud backup: test (see docs/runbooks/backups.md).
3. Deploy. Payments stay HIDDEN until you set the PayPal env vars (docs/runbooks/paypal-setup.md).
4. Do the checks in docs/runbooks/launch-security-checks.md and docs/launch-checklist.md.
