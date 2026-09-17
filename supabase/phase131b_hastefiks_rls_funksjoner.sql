/* Fase 131b HASTEFIKS: RLS-KJEDENE MOT coach_data_permissions ER FOR TREGE.   */ 
/*                                                                            */ 
/* MALT 17. sep etter 131b (PostgREST, supabase-js, cc-rett-testbrukere):     */ 
/*   trener: workout_activity_exercise_sets  31 302 ms -> statement timeout   */ 
/*   trener: full okt-select                 15 028 ms -> timeout             */ 
/*   UTOVER SELV: getWorkoutById select 2    40 472 ms -> timeout, sa 6 966   */ 
/*   utover: sets alene (3 rader)             8 269 ms, deretter Cloudflare   */ 
/*   521/525 fra API-et i noen sekunder - basen var presset.                  */ 
/*   Til sammenligning for 131b: hele apnings-sporringen ~250-400 ms.         */ 
/*                                                                            */ 
/* ARSAK: policyene fra 131b joiner coach_athlete_relations -> coach_data_    */ 
/* permissions inne i policy-uttrykket. Begge tabellene har egne RLS-policyer */ 
/* med EXISTS tilbake til relasjonen, og Postgres evaluerer dem NESTET for    */ 
/* hver rad i hvert ledd av kjeden sett -> ovelse -> aktivitet -> okt -> r -> */ 
/* p. Utoverens egne «Own …»-policyer rammes ogsa: alle policyer pa tabellen  */ 
/* OR-es, sa trener-policyens kjede kjores selv nar det er utoveren som leser.*/ 
/*                                                                            */ 
/* FIKSEN: sma SECURITY DEFINER-funksjoner (STABLE) som slar opp rettigheten  */ 
/* med en indeksert sporring UTEN nestet RLS, og policyene kaller dem.        */ 
/* Semantikken er uendret fra 131b - bare evalueringen.                       */ 
/*   trener_har_rett(utover, flagg)   ett flagg fra coach_data_permissions    */ 
/*   trener_kan_skrive_okt(okt)       planlagt -> edit_plan, gjennomfort ->   */ 
/*                                    edit_dagbok, lest av basen              */ 
/*   aktivitet_okt / ovelse_okt / sesong_eier / skitest_eier  oppslag oppover  */ 
/* REGEL 41: revoke fra public og anon; grant execute til authenticated -     */ 
/* policyene kjorer som den innloggede rollen.                                */ 
/* REGEL 42: to blokker, hver kjorbar alene. Blokk 1 for blokk 2.             */ 
/* 131c (se-flaggene inn i de 20 trener-SELECT-ene) bruker de samme           */ 
/* funksjonene og skrives nar denne er inne.                                  */ 
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 1 - FUNKSJONENE                                                     */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
create or replace function public.trener_har_rett(p_utover uuid, p_flagg text) 
returns boolean language sql stable security definer 
set search_path = public as $fn$ 
  select exists ( 
    select 1 
      from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
     where r.athlete_id = p_utover 
       and r.coach_id = auth.uid() 
       and r.status = 'active' 
       and case p_flagg 
             when 'edit_plan'          then p.can_edit_plan 
             when 'view_dagbok'        then p.can_view_dagbok 
             when 'view_analysis'      then p.can_view_analysis 
             when 'edit_periodization' then p.can_edit_periodization 
             when 'edit_dagbok'        then p.can_edit_dagbok 
             when 'edit_terskler'      then p.can_edit_terskler 
             when 'edit_utstyr'        then p.can_edit_utstyr 
             when 'edit_tester'        then p.can_edit_tester 
             when 'see_health'         then p.can_see_health_data 
             else false 
           end 
  ) 
$fn$; 
 
create or replace function public.trener_kan_skrive_okt(p_okt uuid) 
returns boolean language sql stable security definer 
set search_path = public as $fn$ 
  select exists ( 
    select 1 
      from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
     where w.id = p_okt 
       and r.coach_id = auth.uid() 
       and r.status = 'active' 
       and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
  ) 
$fn$; 
 
create or replace function public.aktivitet_okt(p_aktivitet uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select a.workout_id from public.workout_activities a where a.id = p_aktivitet 
$fn$; 
 
create or replace function public.ovelse_okt(p_ovelse uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select a.workout_id 
    from public.workout_activity_exercises e 
    join public.workout_activities a on a.id = e.activity_id 
   where e.id = p_ovelse 
$fn$; 
 
create or replace function public.sesong_eier(p_sesong uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select s.user_id from public.seasons s where s.id = p_sesong 
$fn$; 
 
create or replace function public.skitest_eier(p_test uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select t.user_id from public.ski_tests t where t.id = p_test 
$fn$; 
 
revoke all on function public.trener_har_rett(uuid, text) from public, anon; 
revoke all on function public.trener_kan_skrive_okt(uuid) from public, anon; 
revoke all on function public.aktivitet_okt(uuid) from public, anon; 
revoke all on function public.ovelse_okt(uuid) from public, anon; 
revoke all on function public.sesong_eier(uuid) from public, anon; 
revoke all on function public.skitest_eier(uuid) from public, anon; 
grant execute on function public.trener_har_rett(uuid, text) to authenticated; 
grant execute on function public.trener_kan_skrive_okt(uuid) to authenticated; 
grant execute on function public.aktivitet_okt(uuid) to authenticated; 
grant execute on function public.ovelse_okt(uuid) to authenticated; 
grant execute on function public.sesong_eier(uuid) to authenticated; 
grant execute on function public.skitest_eier(uuid) to authenticated; 
 
select 'BLOKK 1' as steg, count(*) as funksjoner 
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
 where n.nspname = 'public' 
   and f.proname in ('trener_har_rett','trener_kan_skrive_okt','aktivitet_okt','ovelse_okt','sesong_eier','skitest_eier') 
   and f.prosecdef;   /* forventet 6 */ 
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 2 - POLICYENE FRA 131b KALLER FUNKSJONENE. 34 ALTER POLICY, en per  */ 
/* policy, atomisk. Ingen drop, ingen ny policy.                             */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
alter policy "Coach writes athlete workouts" on public.workouts 
  using (public.trener_kan_skrive_okt(workouts.id)) 
  with check (public.trener_kan_skrive_okt(workouts.id)); 
 
alter policy "Coach writes athlete activities" on public.workout_activities 
  using (public.trener_kan_skrive_okt(workout_activities.workout_id)) 
  with check (public.trener_kan_skrive_okt(workout_activities.workout_id)); 
 
alter policy "Coach writes athlete activity exercises" on public.workout_activity_exercises 
  using (public.trener_kan_skrive_okt(public.aktivitet_okt(workout_activity_exercises.activity_id))) 
  with check (public.trener_kan_skrive_okt(public.aktivitet_okt(workout_activity_exercises.activity_id))); 
 
alter policy "Coach writes athlete exercise sets" on public.workout_activity_exercise_sets 
  using (public.trener_kan_skrive_okt(public.ovelse_okt(workout_activity_exercise_sets.exercise_id))) 
  with check (public.trener_kan_skrive_okt(public.ovelse_okt(workout_activity_exercise_sets.exercise_id))); 
 
alter policy "Coach writes athlete lactate" on public.workout_lactate_measurements 
  using (public.trener_kan_skrive_okt(workout_lactate_measurements.workout_id)) 
  with check (public.trener_kan_skrive_okt(workout_lactate_measurements.workout_id)); 
 
alter policy "Coach writes athlete movements" on public.workout_movements 
  using (public.trener_kan_skrive_okt(workout_movements.workout_id)) 
  with check (public.trener_kan_skrive_okt(workout_movements.workout_id)); 
 
alter policy "Coach writes athlete shooting series" on public.workout_shooting_series 
  using (public.trener_kan_skrive_okt(public.aktivitet_okt(workout_shooting_series.activity_id))) 
  with check (public.trener_kan_skrive_okt(public.aktivitet_okt(workout_shooting_series.activity_id))); 
 
alter policy "Coach writes athlete tags" on public.workout_tags 
  using (public.trener_kan_skrive_okt(workout_tags.workout_id)) 
  with check (public.trener_kan_skrive_okt(workout_tags.workout_id)); 
 
alter policy "Coach writes athlete zones" on public.workout_zones 
  using (public.trener_kan_skrive_okt(workout_zones.workout_id)) 
  with check (public.trener_kan_skrive_okt(workout_zones.workout_id)); 
 
alter policy "Coach writes athlete workout test data" on public.workout_test_data 
  using (public.trener_har_rett(workout_test_data.user_id, 'edit_tester')) 
  with check (public.trener_har_rett(workout_test_data.user_id, 'edit_tester')); 
 
alter policy "Coach writes athlete day states" on public.day_states 
  using (public.trener_har_rett(day_states.user_id, case when day_states.is_planned then 'edit_plan' else 'edit_dagbok' end)) 
  with check (public.trener_har_rett(day_states.user_id, case when day_states.is_planned then 'edit_plan' else 'edit_dagbok' end)); 
 
alter policy "Coach writes plan focus points" on public.focus_points 
  using (focus_points.context = 'plan' and public.trener_har_rett(focus_points.user_id, 'edit_plan')) 
  with check (focus_points.context = 'plan' and public.trener_har_rett(focus_points.user_id, 'edit_plan')); 
 
alter policy "Coach writes plan period notes" on public.period_notes 
  using (public.trener_har_rett(period_notes.user_id, case when period_notes.context = 'plan' then 'edit_plan' else 'edit_dagbok' end)) 
  with check (public.trener_har_rett(period_notes.user_id, case when period_notes.context = 'plan' then 'edit_plan' else 'edit_dagbok' end)); 
 
alter policy "Coach writes athlete personal records" on public.personal_records 
  using (public.trener_har_rett(personal_records.user_id, 'edit_tester')) 
  with check (public.trener_har_rett(personal_records.user_id, 'edit_tester')); 
 
alter policy "Coach writes athlete seasons" on public.seasons 
  using (public.trener_har_rett(seasons.user_id, 'edit_periodization')) 
  with check (public.trener_har_rett(seasons.user_id, 'edit_periodization')); 
 
alter policy "Coach writes athlete periods" on public.season_periods 
  using (public.trener_har_rett(public.sesong_eier(season_periods.season_id), 'edit_periodization')) 
  with check (public.trener_har_rett(public.sesong_eier(season_periods.season_id), 'edit_periodization')); 
 
alter policy "Coach writes athlete key dates" on public.season_key_dates 
  using (public.trener_har_rett(public.sesong_eier(season_key_dates.season_id), 'edit_periodization')) 
  with check (public.trener_har_rett(public.sesong_eier(season_key_dates.season_id), 'edit_periodization')); 
 
alter policy "Coach writes athlete markings" on public.season_markings 
  using (public.trener_har_rett(public.sesong_eier(season_markings.season_id), 'edit_periodization')) 
  with check (public.trener_har_rett(public.sesong_eier(season_markings.season_id), 'edit_periodization')); 
 
alter policy "Coach inserts ski tests" on public.ski_tests with check (public.trener_har_rett(ski_tests.user_id, 'edit_tester')); 
alter policy "Coach updates ski tests" on public.ski_tests using (public.trener_har_rett(ski_tests.user_id, 'edit_tester')); 
alter policy "Coach deletes ski tests" on public.ski_tests using (public.trener_har_rett(ski_tests.user_id, 'edit_tester')); 
alter policy "Coach inserts ski test entries" on public.ski_test_entries with check (public.trener_har_rett(public.skitest_eier(ski_test_entries.test_id), 'edit_tester')); 
alter policy "Coach updates ski test entries" on public.ski_test_entries using (public.trener_har_rett(public.skitest_eier(ski_test_entries.test_id), 'edit_tester')); 
alter policy "Coach deletes ski test entries" on public.ski_test_entries using (public.trener_har_rett(public.skitest_eier(ski_test_entries.test_id), 'edit_tester')); 
 
alter policy "Trener leser terskler" on public.user_thresholds using (public.trener_har_rett(user_thresholds.user_id, 'edit_terskler') or public.trener_har_rett(user_thresholds.user_id, 'view_analysis') or public.trener_har_rett(user_thresholds.user_id, 'view_dagbok')); 
alter policy "Trener med terskel-rett skriver" on public.user_thresholds with check (public.trener_har_rett(user_thresholds.user_id, 'edit_terskler')); 
alter policy "Trener med terskel-rett oppdaterer" on public.user_thresholds using (public.trener_har_rett(user_thresholds.user_id, 'edit_terskler')) with check (public.trener_har_rett(user_thresholds.user_id, 'edit_terskler')); 
alter policy "Trener med terskel-rett sletter" on public.user_thresholds using (public.trener_har_rett(user_thresholds.user_id, 'edit_terskler')); 
alter policy "Trener med terskel-rett skriver soner" on public.user_heart_zones with check (public.trener_har_rett(user_heart_zones.user_id, 'edit_terskler')); 
alter policy "Trener med terskel-rett oppdaterer soner" on public.user_heart_zones using (public.trener_har_rett(user_heart_zones.user_id, 'edit_terskler')) with check (public.trener_har_rett(user_heart_zones.user_id, 'edit_terskler')); 
alter policy "Trener med terskel-rett sletter soner" on public.user_heart_zones using (public.trener_har_rett(user_heart_zones.user_id, 'edit_terskler')); 
 
alter policy "Coach reads athlete standard session series" on public.standard_session_series using (public.trener_har_rett(standard_session_series.user_id, 'view_analysis')); 
alter policy "Coach read access" on public.workout_nutrition_entries using (public.trener_har_rett(workout_nutrition_entries.user_id, 'view_dagbok')); 
alter policy "Coach read access" on public.workout_weather using (public.trener_har_rett(workout_weather.user_id, 'view_dagbok')); 
 
select 'BLOKK 2' as steg, 
  (select count(distinct pol.oid) from pg_policy pol 
     join pg_depend d on d.objid = pol.oid and d.classid = 'pg_policy'::regclass 
     join pg_proc f on f.oid = d.refobjid and d.refclassid = 'pg_proc'::regclass 
    where f.proname in ('trener_har_rett','trener_kan_skrive_okt')) as policyer_pa_funksjonene,   /* forventet 34 */ 
  (select count(distinct pol.oid) from pg_policy pol 
     join pg_depend d on d.objid = pol.oid and d.classid = 'pg_policy'::regclass 
     join pg_class c on c.oid = d.refobjid and d.refclassid = 'pg_class'::regclass 
    where c.relname = 'coach_data_permissions' 
      and pol.polrelid <> 'public.coach_data_permissions'::regclass) as policyer_som_joiner_tabellen_direkte;   /* forventet 4: de fire helse-policyene fra fase 92 */ 
 
/* ETTERSJEKK FRA APPEN (CC kjorer, ingen SQL): TESTBRUKERE=ja npx tsx        */ 
/* scratchpad/rls-tid.ts - sets og full okt-select skal ned til under ett    */ 
/* sekund for bade trener og utover. Deretter trener-rettigheter-e2e (11 OK). */ 
