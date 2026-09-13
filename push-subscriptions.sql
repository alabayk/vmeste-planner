create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push subscriptions belong to user" on public.push_subscriptions;
create policy "push subscriptions belong to user"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.get_other_push_subscriptions()
returns table(endpoint text, subscription jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select p.endpoint, p.subscription
  from public.push_subscriptions p
  where auth.uid() is not null and p.user_id <> auth.uid();
$$;

revoke all on function public.get_other_push_subscriptions() from public, anon;
grant execute on function public.get_other_push_subscriptions() to authenticated;

create table if not exists public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  target_user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.push_jobs add column if not exists event_id uuid;
alter table public.push_jobs add column if not exists audience text not null default 'other';
alter table public.push_jobs add column if not exists kind text not null default 'shared';
alter table public.push_jobs add column if not exists deliver_at timestamptz not null default now();
create unique index if not exists push_jobs_event_audience_idx on public.push_jobs(event_id, audience);
alter table public.push_jobs enable row level security;
revoke all on public.push_jobs from anon;
grant select, insert, update, delete on public.push_jobs to authenticated;
drop policy if exists "users create push jobs" on public.push_jobs;
create policy "users create push jobs" on public.push_jobs
for all to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());
