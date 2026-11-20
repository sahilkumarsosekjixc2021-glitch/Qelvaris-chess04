-- Run in Supabase SQL editor. Read-only.
-- errors last 24h, grouped (adjust column names if your events table differs: name / props / created_at)
select props->>'message' as message, count(*) as times, max(created_at) as last_seen
from events
where name = 'client_error' and created_at > now() - interval '24 hours'
group by 1 order by times desc limit 20;
