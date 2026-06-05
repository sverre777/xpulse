-- ============================================================
-- Fase 73 — Sletting-audit: sikre DELETE-grant + RLS for alle
-- bruker-slettbare tabeller. Kjør i Supabase SQL Editor.
-- Idempotent — trygt å kjøre flere ganger.
-- ============================================================
--
-- Bakgrunn: "sletting feiler" (f.eks. skade på en dag) når server-handleren,
-- RLS-policyen og handler-koden alle ser korrekte ut, skyldes nesten alltid en
-- MANGLENDE TABELL-GRANT for `authenticated`. RLS og GRANT er to uavhengige lag:
-- RLS bestemmer HVILKE rader, GRANT bestemmer OM rollen i det hele tatt får
-- utføre DELETE. Supabase auto-granter normalt DELETE til authenticated ved
-- tabell-opprettelse, men en tabell kan ha mistet/aldri fått granten.
--
-- Denne migreringen re-granter DELETE eksplisitt (no-op hvis allerede satt) og
-- verifiserer at hver tabell har en eier-RLS-policy som dekker DELETE.

-- ── 1) DELETE-grant til authenticated for alle slette-relevante tabeller ──
grant delete on public.day_states                          to authenticated;
grant delete on public.recovery_entries                    to authenticated;
grant delete on public.workouts                            to authenticated;
grant delete on public.workout_activities                  to authenticated;
grant delete on public.workout_activity_exercises          to authenticated;
grant delete on public.workout_activity_exercise_sets      to authenticated;
grant delete on public.workout_activity_lactate_measurements to authenticated;
grant delete on public.workout_competition_data            to authenticated;
grant delete on public.workout_lactate_measurements        to authenticated;
grant delete on public.workout_movements                   to authenticated;
grant delete on public.workout_shooting_blocks             to authenticated;
grant delete on public.workout_tags                        to authenticated;
grant delete on public.workout_test_data                   to authenticated;
grant delete on public.workout_zones                       to authenticated;
grant delete on public.workout_nutrition_entries           to authenticated;
grant delete on public.workout_equipment                   to authenticated;
grant delete on public.workout_samples                     to authenticated;
grant delete on public.personal_records                    to authenticated;
grant delete on public.ski_tests                           to authenticated;
grant delete on public.ski_test_entries                    to authenticated;
grant delete on public.test_templates                      to authenticated;
grant delete on public.user_exercises                      to authenticated;

-- ── 2) Sikre eier-DELETE-policy på day_states (den rapporterte buggen) ──
-- "Own day states" (fase 20) er `for all` og dekker DELETE allerede. Vi
-- gjenoppretter den eksplisitt for sikkerhets skyld (idempotent).
alter table public.day_states enable row level security;
drop policy if exists "Own day states" on public.day_states;
create policy "Own day states"
  on public.day_states for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 3) Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
