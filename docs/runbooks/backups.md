# Backups and restore

## What exists
1. **User export file** (Settings -> Export backup): JSON, version 2, contains games, reviews, training, all progress settings, favourites.
2. **User cloud backup** (Settings -> Cloud backup): same payload in `user_backups` (one row per user, max 8 MB, revision counter).
3. **Supabase project backups**: check your plan in the Supabase dashboard: as far as I know the free tier gives no restorable backups and paid plans give daily ones. Decide before launch: upgrade, or run a manual export.

## Restore a user's cloud backup (support case)
Users do it themselves: Settings -> Cloud backup -> Restore from cloud -> pick "Make this device match" (new device) or "Add only what is missing".

## Test the restore (do this once before launch)
1. Account A, device 1: connect games, back up.
2. Device 2 (or a private window): sign in as A, restore with "match", reload. Check games, streak, QC, favourites are identical.
3. Back up from device 2, then try to back up from device 1 without restoring: you must see the conflict warning.
4. Import a broken file (rename a .txt to .json): you must see a clear error and no data change.

## Supabase dashboard
Database -> Backups (paid) ; for the free tier, export `user_backups` with SQL `select * from user_backups` via the dashboard.
