-- ============================================================
-- Fase 6 — Recovery-logging per dag
-- Kjør i Supabase SQL Editor (idempotent)
-- ============================================================

create table if not exists public.recovery_entries (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  type              text not null,
  start_time        time,
  duration_minutes  integer,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists recovery_entries_user_date_idx
  on public.recovery_entries(user_id, date);

alter table public.recovery_entries enable row level security;

-- Bruker ser/redigerer egne entries
drop policy if exists "Own recovery entries" on public.recovery_entries;
create policy "Own recovery entries"
  on public.recovery_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trener kan lese entries for sine utøvere (aktive relasjoner)
drop policy if exists "Coach reads athlete recovery" on public.recovery_entries;
create policy "Coach reads athlete recovery"
  on public.recovery_entries for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id  = auth.uid()
      and r.status    = 'active'
  ));

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
