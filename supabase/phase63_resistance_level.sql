-- Phase 63 — resistance_level int på workout_activities.
-- Brukes for innendørs-maskiner med motstand-skala 1-10:
-- SkiErg, Romaskin, Stairmaster, Ellipsemaskin, Spinning, Indoors/Ergo, Air bike.
-- Tredemølle har ikke motstand (bruker incline_percent som allerede finnes).

alter table public.workout_activities
  add column if not exists resistance_level int
  check (resistance_level is null or (resistance_level >= 1 and resistance_level <= 10));

-- Grants for PostgREST/Supabase API. Eksisterende RLS-policies på tabellen
-- styrer per-bruker-tilgang; grant gir bare PostgREST lov å se kolonnen.
grant select, insert, update, delete on public.workout_activities to authenticated;
grant select, insert, update, delete on public.workout_activities to service_role;

-- Reload PostgREST schema-cache så ny kolonne blir synlig for klienten.
notify pgrst, 'reload schema';
