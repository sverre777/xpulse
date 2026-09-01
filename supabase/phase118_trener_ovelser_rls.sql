-- ═══════════════════════════════════════════════════════════════════
-- FASE 118: TRENER FÅR SKRIVE ØVELSER OG SETT (FEIL-4)
-- Kjøres av Sverre i prod ETTER godkjenning.
--
-- FEILEN, ordrett fra bruk: en trener som planlegger en styrkeøkt for
-- utøveren sin får «new row violates row-level security policy for table
-- "workout_activity_exercises"» og øktas øvelser skrives aldri.
--
-- ÅRSAKEN (målt i migreringshistorikken, ikke antatt):
-- fase 7.1 ga workout_activity_exercises og
-- workout_activity_exercise_sets to policyer hver:
--   «Own …»                 FOR ALL    — kun w.user_id = auth.uid()
--   «Coach reads athlete …» FOR SELECT — trener kan LESE, aldri skrive
-- Fase 29 la trener-skriv på hele subtabell-familien, men traff
-- workout_exercises — en LEGACY-tabell med 0 rader — og ikke de to
-- tabellene appen faktisk bruker (126 øvelser og 338 sett i dag).
-- Derfor får treneren skrive økta og aktivitetsraden, men ikke barna.
--
-- Utøverne er IKKE rammet: «Own …» dekker dem, og 7 utøvere har ført
-- øvelser. Feilen er trener-spesifikk og rammer alle 4 aktive relasjoner
-- (alle har can_edit_plan = true).
--
-- FIKSEN er en policy-endring, ikke en omgåelse i appen: samme mønster
-- som «Coach writes athlete activities» (fase 29) — coach_athlete_relations
-- med status = 'active' OG can_edit_plan = true. En trener uten
-- plan-rett avvises fortsatt.
--
-- Lese-policyene røres IKKE: de gjelder uten can_edit_plan, og en trener
-- uten skriverett skal fortsatt kunne se øktene.
--
-- Alt i ÉN transaksjon (stående regel): feiler create, rulles drop tilbake
-- og tabellen står aldri uten policy.
--
-- FØR  (målt 1. sep 2026): trener med can_edit_plan får
--        «new row violates row-level security policy» ved insert
-- ETTER (forventet): trener med can_edit_plan kan skrive · trener uten
--        plan-rett avvises fortsatt · utøver uendret
-- ═══════════════════════════════════════════════════════════════════

begin;

drop policy if exists "Coach writes athlete activity exercises"
  on public.workout_activity_exercises;
create policy "Coach writes athlete activity exercises"
  on public.workout_activity_exercises for all
  using (exists (
    select 1
      from public.workout_activities a
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where a.id = workout_activity_exercises.activity_id
       and r.coach_id      = auth.uid()
       and r.status        = 'active'
       and r.can_edit_plan = true
  ))
  with check (exists (
    select 1
      from public.workout_activities a
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where a.id = workout_activity_exercises.activity_id
       and r.coach_id      = auth.uid()
       and r.status        = 'active'
       and r.can_edit_plan = true
  ));

drop policy if exists "Coach writes athlete exercise sets"
  on public.workout_activity_exercise_sets;
create policy "Coach writes athlete exercise sets"
  on public.workout_activity_exercise_sets for all
  using (exists (
    select 1
      from public.workout_activity_exercises e
      join public.workout_activities a on a.id = e.activity_id
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where e.id = workout_activity_exercise_sets.exercise_id
       and r.coach_id      = auth.uid()
       and r.status        = 'active'
       and r.can_edit_plan = true
  ))
  with check (exists (
    select 1
      from public.workout_activity_exercises e
      join public.workout_activities a on a.id = e.activity_id
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where e.id = workout_activity_exercise_sets.exercise_id
       and r.coach_id      = auth.uid()
       and r.status        = 'active'
       and r.can_edit_plan = true
  ));

commit;

notify pgrst, 'reload schema';

-- Kontroll (lim inn resultatet i svaret): fire policyer skal stå igjen
-- per tabell-par — «Own …», «Coach reads …» og den nye «Coach writes …».
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('workout_activity_exercises', 'workout_activity_exercise_sets')
 order by tablename, policyname;
