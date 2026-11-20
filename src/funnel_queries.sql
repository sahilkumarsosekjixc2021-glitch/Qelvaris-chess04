-- Ye queries SQL Editor mein chalao. Pichle 7 din.

-- 1) Funnel: kitne log kis step tak pahunche (alag-alag session)
select name, count(distinct session_id) as sessions
from public.events
where created_at > now() - interval '7 days'
  and name in ('landing_view','landing_start','quickscan_done','quickscan_cta','signup_success','connect_started','connect_done','step_done','leak_solved')
group by name
order by array_position(array['landing_view','landing_start','quickscan_done','quickscan_cta','signup_success','connect_started','connect_done','step_done','leak_solved'], name);

-- 2) Errors: sabse zyada aane wale
select props->>'message' as message, props->>'kind' as kind, count(*) as times, max(created_at) as last_seen
from public.events
where name in ('error','crash') and created_at > now() - interval '7 days'
group by 1,2 order by times desc limit 20;

-- 3) Roz kitne log aaye
select date_trunc('day', created_at) as day, count(distinct session_id) as sessions
from public.events where name = 'app_open' group by 1 order by 1 desc limit 14;

-- 4) Connect kahan fail hota hai
select props->>'message' as message, count(*) from public.events
where name = 'connect_error' group by 1 order by 2 desc limit 10;

-- 5) Quick scan: kitne ne share kiya aur kahan fail hua
select name, count(*) from public.events where name in ('quickscan_start','quickscan_done','quickscan_few','quickscan_error','quickscan_cta','quickscan_share') group by 1 order by 2 desc;
