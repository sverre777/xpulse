-- Phase 21: Focus points for Plan (intent) and Dagbok (reflection) at day/week/month level.

create table if not exists public.focus_points (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  scope        text not null check (scope in ('day','week','month')),
  period_key   text not null,
  context      text not null check (context in ('plan','dagbok')),
  content      text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists focus_points_user_scope_idx
  on public.focus_points(user_id, scope, period_key, context);

alter table public.focus_points enable row level security;

drop policy if exists "Own focus points" on public.focus_points;
create policy "Own focus points"
  on public.focus_points for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete focus points" on public.focus_points;
create policy "Coach reads athlete focus points"
  on public.focus_points for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
