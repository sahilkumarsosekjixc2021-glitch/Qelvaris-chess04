# System design

## Problem
Club-level players play many games but keep repeating the same few mistakes. Qelvaris finds those repeat mistakes in the
player's own games and trains them away, with a daily habit loop.

## Users and roles
Individual players only (no teams, no organisations). One role: signed-in user. The owner/admin works in the Supabase and
Vercel dashboards, not inside the app.

## Tenancy
**One user = one tenant.** All learning data is stored on the user's own device (IndexedDB database named after the user id).
Cloud tables are keyed by `user_id` and protected by Row Level Security (`auth.uid() = user_id`). There is no shared
user data except friends / game invitations (Supabase, RLS) and public Lichess / Chess.com game data that the user asks us to read.

## Core flows
1. Sign up / sign in (Supabase Auth, email + password)
2. Connect Lichess or Chess.com username -> fetch public games -> Stockfish analysis in the browser
3. See leaks (Leak Lab), style (DNA), blind spots, game review
4. Train: Coach lessons, drills, openings gap drill, daily Today steps
5. Habit: streak, freezes, QC rewards, store
6. Keep data safe: export file, optional cloud backup, restore on another device
7. (Optional) Subscribe to Pro with PayPal

## Functional requirements
Analysis works offline once loaded; data never leaves the device unless the user backs it up; backup/restore never silently
destroys data; account deletion removes everything we hold.

## Non-functional requirements
- Performance: first page usable fast on a mid-range phone; heavy pages and Stockfish load only when opened
- Availability: static hosting; Supabase / PayPal outages must not stop the core product (analysis and training are local)
- Security: see `threat-model.md`
- Privacy: GDPR-style export + delete; DPDP-friendly (minimal data, no ads, no selling)
- Accessibility: keyboard play, visible focus, labels, reduced motion

## Out of scope (for now)
Teams / coaches managing students, real-time player-vs-player play, server-side analysis, mobile apps, a native admin panel,
automatic merging of progress between two devices (backup is "restore", not live sync).

## Open questions
- What exactly is Pro? (`PRO_FEATURES` in `src/features/billing/billingApi.js` is empty on purpose)
- Refund policy wording in the Terms
- Who answers support email and how fast
