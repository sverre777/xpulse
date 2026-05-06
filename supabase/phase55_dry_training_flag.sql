-- ============================================================
-- Fase 55 — Tørrtrening-flag på skyting + sekundære sporter på profil
-- Kjør i Supabase SQL Editor (idempotent — trygt å kjøre på nytt)
-- ============================================================
--
-- Bakgrunn (Fase 3b av økt-føring-refaktor):
-- 1) Tørrtrening (skyting uten skarp ammunisjon) er ortogonalt til posisjon
--    (liggende/stående/kombinert). Brukeren skal kunne markere en skyte-rad
--    som tørrtrening uavhengig av posisjons-typen.
-- 2) "+ Legg til skyting"-knappen i WorkoutForm skal vises basert på brukerens
--    profil-sporter, ikke på workoutets sport. Vi trenger derfor et felt for
--    sekundær-sporter på profilen (utholdenhets-utøver som ALSO driver med
--    skiskyting, eller motsatt).

-- ── 1) workout_activities.is_dry_training ──────────────────
-- Boolean-flag på selve aktivitets-raden. Kun meningsfullt når
-- activity_type starter med 'skyting_'; default false så
-- eksisterende rader får riktig verdi uten migrering.
alter table public.workout_activities
  add column if not exists is_dry_training boolean not null default false;

comment on column public.workout_activities.is_dry_training is
  'Tørrtrening — skyting uten skarp ammunisjon. Ortogonalt til posisjon (liggende/stående/kombinert). Kun relevant når activity_type starter med skyting_.';

-- ── 2) profiles.secondary_sports ───────────────────────────
-- Liste over ekstra sporter brukeren driver med (i tillegg til primary_sport).
-- Brukes av WorkoutForm til å vise/skjule sport-spesifikke kontroller (f.eks.
-- "+ Legg til skyting"-knapp for skiskyting). Default tom liste.
alter table public.profiles
  add column if not exists secondary_sports text[] not null default '{}'::text[];

comment on column public.profiles.secondary_sports is
  'Ekstra sporter brukeren driver med, i tillegg til primary_sport. Verdier matcher Sport-typen i lib/types.ts.';

-- Valider at innholdet er gyldige Sport-verdier (samme liste som
-- workouts_sport_check fra fase 40).
alter table public.profiles
  drop constraint if exists profiles_secondary_sports_check;

alter table public.profiles
  add constraint profiles_secondary_sports_check
  check (
    secondary_sports <@ array[
      'running','cross_country_skiing','biathlon','triathlon',
      'cycling','long_distance_skiing','endurance'
    ]::text[]
  );

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
