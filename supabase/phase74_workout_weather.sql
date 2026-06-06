-- ============================================================
-- Fase 74 — Vær og føre per økt (manuell innføring, Nivå 1).
-- Kjør i Supabase SQL Editor. Idempotent — trygt å kjøre på nytt.
-- ============================================================
--
-- Utøvere registrerer ytre forhold (temperatur, værtype, vind, føre) for å
-- kunne skille forhold fra form i analysen (f.eks. treg rulleski-økt pga våt
-- asfalt, ikke dårlig form). Gjelder ALLE aktivitetstyper.
--
-- 1:1 med workouts (én rad per økt, workout_id som PK) — samme mønster som
-- workout_competition_data / workout_test_data. Lagres i samme save-flyt som
-- økten (upsert per workout_id). Føre er MULTI-VALUE (snøen kan være flere ting
-- på én økt) → surface_conditions er text[].
--
-- Nivå 2 (auto-værhenting via yr.no/Frost) kommer senere — ikke her.

create table if not exists public.workout_weather (
  workout_id          uuid primary key references public.workouts(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  -- Celsius, kan være negativ. numeric(4,1): -99.9 .. 99.9.
  temperature         numeric(4,1),
  weather_type        text
    check (weather_type is null or weather_type in
      ('sol','delvis_skyet','skyet','yr','regn','kraftig_regn','sno','sludd')),
  wind_strength       text
    check (wind_strength is null or wind_strength in
      ('vindstille','lett_bris','frisk_bris','sterk_vind','storm')),
  -- Føre — multi-select (flere samtidig). Sommer: tort/fuktig/vatt.
  -- Vinter: finkornet/grovkornet/omdannet/vat_sno/kram/nysno/hardpakket/kunstsno.
  surface_conditions  text[] not null default '{}',
  -- Hvilken føre-gruppe som er relevant (styrer UI-valg). sommer/vinter.
  season_context      text
    check (season_context is null or season_context in ('sommer','vinter')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists workout_weather_user_idx
  on public.workout_weather(user_id);

-- ── RLS: eier full tilgang, aktiv trener m/ can_view_dagbok kan lese ──
alter table public.workout_weather enable row level security;

drop policy if exists "Owner full access" on public.workout_weather;
create policy "Owner full access"
  on public.workout_weather for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach read access" on public.workout_weather;
create policy "Coach read access"
  on public.workout_weather for select
  using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid()
        and athlete_id = workout_weather.user_id
        and status = 'active'
        and can_view_dagbok = true
    )
  );

-- ── Grants ──────────────────────────────────────────────────
grant select, insert, update, delete on public.workout_weather to authenticated;
grant select, insert, update, delete on public.workout_weather to service_role;

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
