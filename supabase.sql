create table if not exists public.planner_events (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 600),
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 1440),
  space text not null check (space in ('vanya', 'ksusha', 'shared')),
  created_by text not null check (created_by in ('vanya', 'ksusha')),
  done boolean not null default false,
  deleted boolean not null default false,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.planner_events enable row level security;
grant select, insert, update on public.planner_events to anon;

create policy "planner_read" on public.planner_events for select to anon using (true);
create policy "planner_add" on public.planner_events for insert to anon with check (true);
create policy "planner_change" on public.planner_events for update to anon using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.planner_events;
exception when duplicate_object then null;
end $$;
