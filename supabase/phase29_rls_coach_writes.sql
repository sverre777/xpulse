-- Phase 29: RLS-audit — fyll ut manglende coach-read/write-policies.
-- Bakgrunn: server actions ruter treneren via resolveTargetUser() med korrekt
-- can_edit_* flagg, men RLS-laget manglet tilsvarende policies på flere tabeller.
-- Dette gjorde at coach-push, periodiseringsinserts og plan-notater ville blitt
-- blokkert av RLS så snart det faktisk ble testet med strengere oppsett.
--
-- Denne migreringen er idempotent (drop policy if exists → create policy).
-- Følger mønsteret: Own = user_id=auth.uid(); Coach = aktiv relasjon +
-- kreves can_edit_* flagg for writes.
--
-- Ingen eksisterende "Own"-policy endres, og ingen policy slipper athlete
-- til andre athletes data (ingen cross-athlete-lekkasjer).

-- ============================================================
-- period_notes
-- Tidligere: kun "own_period_notes" (user_id=auth.uid()).
-- Legger til:
--   · Coach-read for både plan- og dagbok-notater (trener ser utøverens notater).
--   · Coach-write kun for plan-kontekst og kun med can_edit_plan.
--     Dagbok-notater er utøverens refleksjon — trener skal ikke skrive der.
-- ============================================================
drop policy if exists "Coach reads athlete period notes" on public.period_notes;
create policy "Coach reads athlete period notes"
  on public.period_notes for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = period_notes.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
  ));

drop policy if exists "Coach writes plan period notes" on public.period_notes;
create policy "Coach writes plan period notes"
  on public.period_notes for all
  using (
    context = 'plan'
    and exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = period_notes.user_id
        and r.coach_id   = auth.uid()
        and r.status     = 'active'
        and r.can_edit_plan = true
    )
  )
  with check (
    context = 'plan'
    and exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = period_notes.user_id
        and r.coach_id   = auth.uid()
        and r.status     = 'active'
        and r.can_edit_plan = true
    )
  );

-- ============================================================
-- workouts
-- Coach-read finnes allerede ("Coaches can view athlete workouts").
-- Legger til coach-write med can_edit_plan.
-- ============================================================
drop policy if exists "Coach writes athlete workouts" on public.workouts;
create policy "Coach writes athlete workouts"
  on public.workouts for all
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = workouts.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = workouts.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ));

-- ============================================================
-- workout_activities (subtabell, går via workouts → user_id)
-- Coach-read finnes. Legger til coach-write.
-- ============================================================
drop policy if exists "Coach writes athlete activities" on public.workout_activities;
create policy "Coach writes athlete activities"
  on public.workout_activities for all
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_activities.workout_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_activities.workout_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ));

-- ============================================================
-- workout_movements, workout_zones, workout_tags, workout_exercises,
-- workout_lactate_measurements — subtabeller til workouts
-- Coach-read finnes på movements/zones/lactate; legger til på tags/exercises.
-- Coach-write legges til på alle fem.
-- ============================================================
drop policy if exists "Coach writes athlete movements" on public.workout_movements;
create policy "Coach writes athlete movements"
  on public.workout_movements for all
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_movements.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_movements.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ));

drop policy if exists "Coach writes athlete zones" on public.workout_zones;
create policy "Coach writes athlete zones"
  on public.workout_zones for all
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_zones.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_zones.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ));

drop policy if exists "Coach reads athlete tags" on public.workout_tags;
create policy "Coach reads athlete tags"
  on public.workout_tags for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_tags.workout_id
      and r.coach_id = auth.uid() and r.status = 'active'
  ));

drop policy if exists "Coach writes athlete tags" on public.workout_tags;
create policy "Coach writes athlete tags"
  on public.workout_tags for all
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_tags.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_tags.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ));

drop policy if exists "Coach reads athlete exercises" on public.workout_exercises;
create policy "Coach reads athlete exercises"
  on public.workout_exercises for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_exercises.workout_id
      and r.coach_id = auth.uid() and r.status = 'active'
  ));

drop policy if exists "Coach writes athlete exercises" on public.workout_exercises;
create policy "Coach writes athlete exercises"
  on public.workout_exercises for all
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_exercises.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_exercises.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ));

drop policy if exists "Coach writes athlete lactate" on public.workout_lactate_measurements;
create policy "Coach writes athlete lactate"
  on public.workout_lactate_measurements for all
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_lactate_measurements.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_lactate_measurements.workout_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_plan = true
  ));

-- ============================================================
-- seasons, season_periods, season_key_dates
-- Coach-read finnes. Legger til coach-write med can_edit_periodization.
-- ============================================================
drop policy if exists "Coach writes athlete seasons" on public.seasons;
create policy "Coach writes athlete seasons"
  on public.seasons for all
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = seasons.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_periodization = true
  ))
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = seasons.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_periodization = true
  ));

drop policy if exists "Coach writes athlete periods" on public.season_periods;
create policy "Coach writes athlete periods"
  on public.season_periods for all
  using (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_periods.season_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_periodization = true
  ))
  with check (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_periods.season_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_periodization = true
  ));

drop policy if exists "Coach writes athlete key dates" on public.season_key_dates;
create policy "Coach writes athlete key dates"
  on public.season_key_dates for all
  using (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_key_dates.season_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_periodization = true
  ))
  with check (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_key_dates.season_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_periodization = true
  ));

-- ============================================================
-- day_states
-- Coach-read finnes. Legger til coach-write med can_edit_plan
-- (dag-markeringer er del av planen i coach-push).
-- ============================================================
drop policy if exists "Coach writes athlete day states" on public.day_states;
create policy "Coach writes athlete day states"
  on public.day_states for all
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = day_states.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = day_states.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ));

-- ============================================================
-- focus_points
-- Coach-read finnes. Coach-write kun for plan-kontekst (trener skal ikke
-- skrive dagbok-refleksjon på utøvers vegne).
-- ============================================================
drop policy if exists "Coach writes plan focus points" on public.focus_points;
create policy "Coach writes plan focus points"
  on public.focus_points for all
  using (
    context = 'plan'
    and exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = focus_points.user_id
        and r.coach_id   = auth.uid()
        and r.status     = 'active'
        and r.can_edit_plan = true
    )
  )
  with check (
    context = 'plan'
    and exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = focus_points.user_id
        and r.coach_id   = auth.uid()
        and r.status     = 'active'
        and r.can_edit_plan = true
    )
  );

-- ============================================================
-- recovery_entries, daily_health, weekly_reflections
-- Coach skal ikke skrive her (utøverens egen logging/refleksjon).
-- Eksisterende policies (Own + Coach-read) er allerede riktige.
-- Ingen endringer — dokumentert her for sporbarhet.
-- ============================================================

notify pgrst, 'reload schema';
