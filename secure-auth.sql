-- Run once after creating vanya@planer.app and ksusha@planer.app in Supabase Auth.
drop policy if exists planner_read on public.planner_events;
drop policy if exists planner_add on public.planner_events;
drop policy if exists planner_change on public.planner_events;

revoke all on public.planner_events from anon;
grant select, insert, update on public.planner_events to authenticated;

create policy planner_read_private on public.planner_events
for select to authenticated
using (
  space = 'shared'
  or space = case auth.jwt() ->> 'email'
    when 'vanya@planer.app' then 'vanya'
    when 'ksusha@planer.app' then 'ksusha'
  end
);

create policy planner_add_private on public.planner_events
for insert to authenticated
with check (
  space = 'shared'
  or (
    space = case auth.jwt() ->> 'email'
      when 'vanya@planer.app' then 'vanya'
      when 'ksusha@planer.app' then 'ksusha'
    end
    and created_by = space
  )
);

create policy planner_change_private on public.planner_events
for update to authenticated
using (
  space = 'shared'
  or space = case auth.jwt() ->> 'email'
    when 'vanya@planer.app' then 'vanya'
    when 'ksusha@planer.app' then 'ksusha'
  end
)
with check (
  space = 'shared'
  or (
    space = case auth.jwt() ->> 'email'
      when 'vanya@planer.app' then 'vanya'
      when 'ksusha@planer.app' then 'ksusha'
    end
    and created_by = space
  )
);
