-- ============================================================
-- Fase 57 — Skade som egen state_type (separat fra sykdom)
-- Kjør i Supabase SQL Editor (idempotent — trygt å kjøre på nytt)
-- ============================================================
--
-- Bakgrunn (Fase 3e av økt-føring-refaktor):
-- Tidligere ble skade lagret som sub_type='skade' under state_type='sykdom'.
-- Det skjuler skade-data i sykdom-aggregater og gjør det vanskelig å skille
-- belastnings-skader fra infeksjons-sykdom i analyse. Skade får derfor egen
-- top-level state_type, og sub_type er fri til å beskrive kroppsdel/grad.
--
-- Migrering: alle rader med (state_type='sykdom', sub_type='skade') flyttes til
-- (state_type='skade', sub_type=null). Hvis en bruker har BÅDE en faktisk
-- sykdom-rad og en skade-radert-som-sykdom på samme dato, vil unique-
-- constrainten (user_id, date, state_type) hindre kollision etter migrering
-- (ulike state_types). For sikkerhets skyld dropper vi gamle rader hvis det
-- finnes en sykdom-rad med samme dato MEN annen sub_type — da har brukeren
-- åpenbart logget både sykdom og skade samme dag, og skade-flyttingen er trygg.

-- ── 1) Drop gammel constraint og legg til ny med 'skade' ──
alter table public.day_states
  drop constraint if exists day_states_state_type_check;

alter table public.day_states
  add constraint day_states_state_type_check
  check (state_type in ('hviledag','sykdom','skade'));

-- ── 2) Migrér (sykdom, sub_type='skade') → (skade, sub_type=null) ──
-- Bruker DELETE-and-INSERT-pattern for å unngå unique-constraint-kollisjon
-- hvis brukeren skulle ha lagt til en ny skade-rad manuelt før migrering kjøres
-- (idempotens). Vi tar vare på id, feeling, notes, etc. via en CTE.
with to_promote as (
  select * from public.day_states
  where state_type = 'sykdom' and sub_type = 'skade'
),
inserted as (
  insert into public.day_states (
    id, user_id, date, state_type, is_planned, sub_type, feeling,
    symptoms, notes, expected_days_off, created_at, updated_at
  )
  select
    gen_random_uuid(), p.user_id, p.date, 'skade', p.is_planned, null, p.feeling,
    p.symptoms, p.notes, p.expected_days_off, p.created_at, now()
  from to_promote p
  -- Skip rows hvor en skade-rad allerede finnes for (user_id, date)
  where not exists (
    select 1 from public.day_states existing
    where existing.user_id = p.user_id
      and existing.date = p.date
      and existing.state_type = 'skade'
  )
  returning user_id, date
)
delete from public.day_states
where state_type = 'sykdom' and sub_type = 'skade';

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
