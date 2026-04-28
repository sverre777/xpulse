-- Fase 49 — Trener kan legge til ski-tester på vegne av utøver.
--
-- Skipark-lesing fungerer allerede (phase36/37/38 har coach SELECT-policies).
-- Mangler bare insert/update på ski_tests og ski_test_entries så langrenn-
-- trener kan logge lag-test på en konkurransedag.
--
-- Permission-gate: can_edit_plan (matcher "kan handle på vegne av utøver"-
-- semantikken som workouts og periodisering bruker). Krever aktiv relasjon.
--
-- Idempotent.

drop policy if exists "Coach inserts ski tests" on public.ski_tests;
create policy "Coach inserts ski tests"
  on public.ski_tests for insert
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = ski_tests.user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
      and r.can_edit_plan = true
  ));

drop policy if exists "Coach updates ski tests" on public.ski_tests;
create policy "Coach updates ski tests"
  on public.ski_tests for update
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = ski_tests.user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
      and r.can_edit_plan = true
  ));

drop policy if exists "Coach deletes ski tests" on public.ski_tests;
create policy "Coach deletes ski tests"
  on public.ski_tests for delete
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = ski_tests.user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
      and r.can_edit_plan = true
  ));

drop policy if exists "Coach inserts ski test entries" on public.ski_test_entries;
create policy "Coach inserts ski test entries"
  on public.ski_test_entries for insert
  with check (exists (
    select 1 from public.ski_tests t
    join public.coach_athlete_relations r on r.athlete_id = t.user_id
    where t.id = ski_test_entries.test_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
      and r.can_edit_plan = true
  ));

drop policy if exists "Coach updates ski test entries" on public.ski_test_entries;
create policy "Coach updates ski test entries"
  on public.ski_test_entries for update
  using (exists (
    select 1 from public.ski_tests t
    join public.coach_athlete_relations r on r.athlete_id = t.user_id
    where t.id = ski_test_entries.test_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
      and r.can_edit_plan = true
  ));

drop policy if exists "Coach deletes ski test entries" on public.ski_test_entries;
create policy "Coach deletes ski test entries"
  on public.ski_test_entries for delete
  using (exists (
    select 1 from public.ski_tests t
    join public.coach_athlete_relations r on r.athlete_id = t.user_id
    where t.id = ski_test_entries.test_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
      and r.can_edit_plan = true
  ));

notify pgrst, 'reload schema';
