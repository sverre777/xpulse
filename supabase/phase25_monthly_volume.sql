-- Phase 25: Monthly planned volume per user/season
create table if not exists public.monthly_volume_plans (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  season_id         uuid references public.seasons(id) on delete set null,
  year              int not null,
  month             int not null check (month between 1 and 12),
  planned_hours     numeric(5,2),
  planned_km        numeric(7,2),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, year, month)
);

create index if not exists monthly_volume_plans_user_idx
  on public.monthly_volume_plans(user_id, year, month);

alter table public.monthly_volume_plans enable row level security;

drop policy if exists "Own volume plans" on public.monthly_volume_plans;
create policy "Own volume plans"
  on public.monthly_volume_plans for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete volume plans" on public.monthly_volume_plans;
create policy "Coach reads athlete volume plans"
  on public.monthly_volume_plans for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
