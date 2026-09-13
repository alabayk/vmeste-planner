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
