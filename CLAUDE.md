# Project: Qelvaris

## What this product does
A chess improvement site. Players connect their Lichess / Chess.com games, Stockfish (in the browser) finds their repeat mistakes
(Leak Lab, Chess DNA, Blind-Spot Map), and a Coach (lessons + drills + spaced repetition), daily Today steps, streaks and
Qelvaris Credits (QC) turn that into a habit. Audience is worldwide (EN / ES / HI).

## Stack (do not change without asking)
- Frontend: React 19 + Vite 8, state-based navigation in `src/App.jsx` (no router), lazy-loaded pages
- User data: IndexedDB per account (`qelvaris-u-<userId>`) via `src/storage.js`; small items in localStorage per account
- Auth + cloud backup + friends: Supabase (Row Level Security on every table)
- Engine: Stockfish WASM in a Web Worker (`public/stockfish/`)
- Hosting: Vercel (static site + `api/` serverless functions)
- Payments: PayPal Subscriptions (USD), server functions in `api/paypal/`, webhook is the source of truth

## Rules
- Never commit secrets. Browser variables start with `VITE_` and are public. Server secrets (PayPal secret, Supabase service role) never get that prefix and are never imported under `src/`.
- Every database change is a file in `sql/`. Every table has RLS on. A user must only be able to read/write their own rows.
- Every API function: method check, auth check, input validation, standard error format `{ error: { code, message } }`, rate limit if it costs money or writes.
- Business rules live in pure files that tests can load (`backupCore.js`, `subscriptionLogic.js`, `streakCore.js`, `qcCore.js`), not inside React components.
- Never edit a test to make it pass: fix the code. Run `node --test "tests/*.test.mjs"` and `npm run build` before saying a task is done.
- Filenames must differ by more than letter case (Windows): `Foo.jsx` and `foo.js` in one folder break builds.
- Ask before adding a dependency. One feature per change.
- All visible text goes through the i18n dictionaries (EN, ES, HI must have the same keys; tests check this).

## Commands
- Dev: `npm run dev`
- Test: `node --test "tests/*.test.mjs"`
- Build: `npm run build`

## Docs
`docs/system-design.md`, `docs/architecture.md`, `docs/threat-model.md`, `docs/decisions/`, `docs/runbooks/`, `docs/launch-checklist.md`
