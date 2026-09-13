-- One-time migration matching the automatic v36 client migration.
-- Keeps tasks and deadlines unchanged.
update public.planner_events
set space = 'shared', updated_at = now()
where deleted = false
  and space <> 'shared'
  and notes <> '__todo__'
  and notes not like '[[deadline]]%'
  and updated_at <= timestamptz '2026-09-13T18:24:00Z';
