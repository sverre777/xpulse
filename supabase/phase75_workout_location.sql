-- Fase 75: fritekst-sted på økter ("Sted")
-- Nivå 1: ren fritekst, ingen geo/autocomplete. Vises rett under tittel/dato i
-- økt-skjemaet (plan + dagbok, alle aktivitetstyper) og følger med i øktmaler
-- via template_data (jsonb) — derfor ingen kolonne på workout_templates.
-- Samlinger/nøkkeldatoer (season_key_dates.location) har allerede sted-felt.

alter table public.workouts
  add column if not exists location text;

-- Eksisterende grants på workouts dekker den nye kolonnen (kolonne-grants i
-- Postgres gjelder hele raden når de er gitt på tabellnivå). Tar med eksplisitt
-- for å være trygg dersom kolonne-nivå-grants er i bruk.
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workouts to service_role;

notify pgrst, 'reload schema';
