-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (once, safe to run again).
-- Adds a revision counter so two devices cannot silently overwrite each other's cloud backup.
alter table public.user_backups add column if not exists rev integer not null default 1;
