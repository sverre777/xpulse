-- Fase 20: Dag-tilstander (hviledag og sykdom).
-- Tilstander er markeringer på en dato, ikke økter. Brukeren kan ha BÅDE en
-- hviledag-markering OG en logget økt samme dag. Tilstandene teller ikke i
-- totaltid/km/sonefordeling, men lagres strukturert for senere analyse.

create table if not exists public.day_states (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  state_type        text not null check (state_type in ('hviledag','sykdom')),
  is_planned        boolean not null default false,
  sub_type          text,
  feeling           int check (feeling is null or feeling between 1 and 5),
  symptoms          text,
  notes             text,
  expected_days_off int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, date, state_type)
);

create index if not exists day_states_user_date_idx
  on public.day_states(user_id, date);

alter table public.day_states enable row level security;

drop policy if exists "Own day states" on public.day_states;
create policy "Own day states"
  on public.day_states for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete day states" on public.day_states;
create policy "Coach reads athlete day states"
  on public.day_states for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
