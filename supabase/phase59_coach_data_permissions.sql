-- ============================================================
-- Fase 59 — Trener-tilgang til utøvers analyse + opt-out på helsedata
-- Kjør i Supabase SQL Editor (idempotent — trygt å kjøre på nytt)
-- ============================================================
--
-- Bakgrunn (Trener-multifix Fase D):
-- Trener får ALL analyse på sine utøvere som default (lesemodus). Helsedata
-- (HRV, søvn, vekt, hvilepuls + andre klokkesync-helsemålinger) er privat —
-- utøveren må EKSPLISITT opt'e inn for å dele med en spesifikk trener.
--
-- Per-relasjon-tabell: én rad per (coach_athlete_relation). Default AV ved at
-- raden ikke finnes; vi tolker fravær = false. Utøveren oppretter raden ved
-- første aktivering og toggler can_see_health_data der.

create table if not exists public.coach_data_permissions (
  id                          uuid primary key default gen_random_uuid(),
  coach_athlete_relation_id   uuid not null
    references public.coach_athlete_relations(id) on delete cascade,
  can_see_health_data         boolean not null default false,
  updated_at                  timestamptz not null default now(),
  unique (coach_athlete_relation_id)
);

create index if not exists coach_data_permissions_relation_idx
  on public.coach_data_permissions(coach_athlete_relation_id);

alter table public.coach_data_permissions enable row level security;

-- Utøveren skriver/leser permissions for sine egne relasjoner.
drop policy if exists "Athlete manages own permissions" on public.coach_data_permissions;
create policy "Athlete manages own permissions"
  on public.coach_data_permissions for all
  using (
    exists (
      select 1 from public.coach_athlete_relations r
      where r.id = coach_athlete_relation_id
        and r.athlete_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.coach_athlete_relations r
      where r.id = coach_athlete_relation_id
        and r.athlete_id = auth.uid()
    )
  );

-- Treneren leser kun permission-rader for sine relasjoner. Ingen INSERT/
-- UPDATE/DELETE — utøveren eier permission-tilstanden.
drop policy if exists "Coach reads own permissions" on public.coach_data_permissions;
create policy "Coach reads own permissions"
  on public.coach_data_permissions for select
  using (
    exists (
      select 1 from public.coach_athlete_relations r
      where r.id = coach_athlete_relation_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
    )
  );

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
