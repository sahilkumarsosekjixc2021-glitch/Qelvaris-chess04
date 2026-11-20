-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run again).
-- PayPal subscriptions. Browsers can only READ their own row; only the server (service role) writes.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paypal_subscription_id text not null unique,
  plan text not null default 'pro',
  status text not null check (status in ('pending','active','suspended','cancelled','expired','refunded')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "own subscription select" on public.subscriptions;
create policy "own subscription select" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
-- no insert/update/delete policies on purpose: a user must never be able to grant themselves a plan.

-- Every PayPal event id we have handled, so a re-delivered webhook is applied only once.
create table if not exists public.paypal_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  summary jsonb
);
alter table public.paypal_events enable row level security; -- no policies: only the server can touch it

-- Small shared rate limiter that works across all serverless instances.
create table if not exists public.api_rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h integer;
begin
  insert into public.api_rate_limits(key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.api_rate_limits.hits + 1
  returning hits into h;
  delete from public.api_rate_limits where window_start < now() - interval '1 day';
  return h <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Account deletion must not leave someone being billed: block it while a subscription is live.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  if exists (select 1 from public.subscriptions where user_id = uid and status in ('active','suspended')) then
    raise exception 'cancel-subscription-first';
  end if;

  begin delete from public.events where user_id = uid; exception when undefined_table or undefined_column then null; end;
  begin delete from public.profiles where id = uid; exception when undefined_table or undefined_column then null; end;
  begin delete from public.friend_requests where sender_id = uid or receiver_id = uid; exception when undefined_table or undefined_column then null; end;
  begin delete from public.friendships where user_id = uid or friend_id = uid; exception when undefined_table or undefined_column then null; end;
  begin delete from public.game_invitations where sender_id = uid or receiver_id = uid; exception when undefined_table or undefined_column then null; end;

  delete from auth.users where id = uid; -- subscriptions and user_backups go with it (on delete cascade)
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
