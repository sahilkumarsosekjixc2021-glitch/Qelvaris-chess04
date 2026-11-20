-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (ek hi baar)

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  session_id text,
  name       text not null check (char_length(name) <= 50),
  path       text check (char_length(path) <= 120),
  props      jsonb check (pg_column_size(props) <= 2000)
);

create index if not exists events_name_time on public.events (name, created_at desc);

alter table public.events enable row level security;

-- Koi bhi (login ke bina bhi) event daal sakta hai, par PADH koi nahi sakta (sirf tum dashboard se).
drop policy if exists "insert events" on public.events;
create policy "insert events" on public.events
  for insert to anon, authenticated
  with check (true);
