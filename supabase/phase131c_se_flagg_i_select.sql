/* Fase 131c: SE-FLAGGENE INN I TRENERENS SELECT-POLICYER.                     */ 
/*                                                                            */ 
/* MALT (blokk 0, 17. sep): alle trener-SELECT-ene pa okt-, plan-, sesong-,   */ 
/* test- og sonetabellene har flagg «-» - de krever bare en aktiv relasjon.   */ 
/* view_dagbok og view_analysis har til na bare levd i koden                  */ 
/* (resolveTargetUser). Etter denne fila gjelder de ogsa i RLS: en trener     */ 
/* uten se-flagg far 0 rader gjennom PostgREST, uansett hva klienten spor om. */ 
/*                                                                            */ 
/* REGEL 46: policyene kaller security definer-funksjonene fra hastefiksen    */ 
/* (trener_har_rett, aktivitet_okt, ovelse_okt, sesong_eier, skitest_eier) -  */ 
/* ingen join mot RLS-tabeller. En ny lesefunksjon kommer her:                */ 
/*   trener_kan_lese_okt(okt): planlagt -> edit_plan (planen har ikke eget    */ 
/*   se-flagg, og en trener med plan-rett ma kunne lese planen han skriver i) */ 
/*   ELLER view_dagbok ELLER view_analysis (analysen leser gjennomforte okter,*/ 
/*   og ren analysetilgang finnes).                                           */ 
/*                                                                            */ 
/* FLAGG PER TABELL (forslag lagt fram 17. sep, ikke motsagt):                */ 
/*   okter + barn (10 tabeller, inkl. legacy workout_exercises-lesing)        */ 
/*       trener_kan_lese_okt                                                  */ 
/*   day_states       is_planned -> edit_plan, ellers view_dagbok; eller      */ 
/*                    view_analysis                                           */ 
/*   period_notes, focus_points   context plan -> edit_plan, dagbok ->        */ 
/*                    view_dagbok                                             */ 
/*   personal_records, workout_test_data, ski_tests, ski_test_entries         */ 
/*                    view_analysis eller edit_tester                         */ 
/*   seasons, season_periods, season_key_dates, season_markings               */ 
/*                    edit_periodization eller edit_plan eller view_analysis  */ 
/*                    eller view_dagbok (som «minst ett flagg» i seasons.ts)  */ 
/*   user_heart_zones edit_terskler eller view_analysis eller view_dagbok     */ 
/*   user_thresholds  alt gjort i 131b (4a)                                   */ 
/*   standard_session_series, workout_nutrition_entries, workout_weather      */ 
/*                    alt gjort i 131b (4c) + hastefiksen                     */ 
/* 22 ALTER POLICY: de 20 tabellene fra blokk 0 (minus user_thresholds som    */ 
/* ikke hadde noen) pluss user_heart_zones og legacy-lesingen pa              */ 
/* workout_exercises. En statement per policy, ingen drop.                    */ 
/*                                                                            */ 
/* REGEL 41 pa funksjonen. REGEL 42: tre blokker, hver kjorbar alene.         */ 
/* GRENSETEST: TESTBRUKERE=ja npm run se-flagg-grense - ROD for denne er      */ 
/* kjort (trener uten se-flagg ser radene), GRONN etter. Det er beviset.      */ 
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 1 - FOR (lesing) + lesefunksjonen                                   */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
select 'FOR' as steg, 
  (select count(*) from pg_policies 
     where schemaname = 'public' and cmd = 'SELECT' 
       and tablename in ('workouts','workout_activities','workout_activity_exercises','workout_activity_exercise_sets','workout_lactate_measurements','workout_movements','workout_shooting_series','workout_tags','workout_zones','workout_exercises','workout_test_data','personal_records','ski_tests','ski_test_entries','day_states','period_notes','focus_points','seasons','season_periods','season_key_dates','season_markings','user_heart_zones') 
       and policyname like 'Coach%') as trener_select_policyer,   /* forventet 22 */ 
  (select count(distinct pol.oid) from pg_policy pol 
     join pg_depend d on d.objid = pol.oid and d.classid = 'pg_policy'::regclass 
     join pg_proc f on f.oid = d.refobjid and d.refclassid = 'pg_proc'::regclass 
    where f.proname in ('trener_har_rett','trener_kan_lese_okt') 
      and pol.polcmd = 'r') as select_policyer_pa_funksjonene;   /* forventet 3 for (4c), 25 etter */ 
 
create or replace function public.trener_kan_lese_okt(p_okt uuid) 
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
       and ((not w.is_completed and p.can_edit_plan) or p.can_view_dagbok or p.can_view_analysis) 
  ) 
$fn$; 
revoke all on function public.trener_kan_lese_okt(uuid) from public, anon; 
grant execute on function public.trener_kan_lese_okt(uuid) to authenticated; 
 
select 'BLOKK 1' as steg, count(*) as lesefunksjon 
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
 where n.nspname = 'public' and f.proname = 'trener_kan_lese_okt' and f.prosecdef;   /* forventet 1 */ 
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 2 - 22 ALTER POLICY                                                 */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
alter policy "Coaches can view athlete workouts" on public.workouts 
  using (public.trener_kan_lese_okt(workouts.id)); 
 
alter policy "Coach reads athlete activities" on public.workout_activities 
  using (public.trener_kan_lese_okt(workout_activities.workout_id)); 
 
alter policy "Coach reads athlete activity exercises" on public.workout_activity_exercises 
  using (public.trener_kan_lese_okt(public.aktivitet_okt(workout_activity_exercises.activity_id))); 
 
alter policy "Coach reads athlete exercise sets" on public.workout_activity_exercise_sets 
  using (public.trener_kan_lese_okt(public.ovelse_okt(workout_activity_exercise_sets.exercise_id))); 
 
alter policy "Coach reads athlete lactate" on public.workout_lactate_measurements 
  using (public.trener_kan_lese_okt(workout_lactate_measurements.workout_id)); 
 
alter policy "Coach reads athlete movements" on public.workout_movements 
  using (public.trener_kan_lese_okt(workout_movements.workout_id)); 
 
alter policy "Coach reads athlete shooting series" on public.workout_shooting_series 
  using (public.trener_kan_lese_okt(public.aktivitet_okt(workout_shooting_series.activity_id))); 
 
alter policy "Coach reads athlete tags" on public.workout_tags 
  using (public.trener_kan_lese_okt(workout_tags.workout_id)); 
 
alter policy "Coach reads athlete zones" on public.workout_zones 
  using (public.trener_kan_lese_okt(workout_zones.workout_id)); 
 
alter policy "Coach reads athlete exercises" on public.workout_exercises 
  using (public.trener_kan_lese_okt(workout_exercises.workout_id)); 
 
alter policy "Coach reads athlete workout test data" on public.workout_test_data 
  using (public.trener_har_rett(workout_test_data.user_id, 'view_analysis') or public.trener_har_rett(workout_test_data.user_id, 'edit_tester')); 
 
alter policy "Coach reads athlete personal records" on public.personal_records 
  using (public.trener_har_rett(personal_records.user_id, 'view_analysis') or public.trener_har_rett(personal_records.user_id, 'edit_tester')); 
 
alter policy "Coach reads ski tests" on public.ski_tests 
  using (public.trener_har_rett(ski_tests.user_id, 'view_analysis') or public.trener_har_rett(ski_tests.user_id, 'edit_tester')); 
 
alter policy "Coach reads ski test entries" on public.ski_test_entries 
  using (public.trener_har_rett(public.skitest_eier(ski_test_entries.test_id), 'view_analysis') or public.trener_har_rett(public.skitest_eier(ski_test_entries.test_id), 'edit_tester')); 
 
alter policy "Coach reads athlete day states" on public.day_states 
  using (public.trener_har_rett(day_states.user_id, case when day_states.is_planned then 'edit_plan' else 'view_dagbok' end) or public.trener_har_rett(day_states.user_id, 'view_analysis')); 
 
alter policy "Coach reads athlete period notes" on public.period_notes 
  using (public.trener_har_rett(period_notes.user_id, case when period_notes.context = 'plan' then 'edit_plan' else 'view_dagbok' end)); 
 
alter policy "Coach reads athlete focus points" on public.focus_points 
  using (public.trener_har_rett(focus_points.user_id, case when focus_points.context = 'plan' then 'edit_plan' else 'view_dagbok' end)); 
 
alter policy "Coach reads athlete seasons" on public.seasons 
  using (public.trener_har_rett(seasons.user_id, 'edit_periodization') or public.trener_har_rett(seasons.user_id, 'edit_plan') or public.trener_har_rett(seasons.user_id, 'view_analysis') or public.trener_har_rett(seasons.user_id, 'view_dagbok')); 
 
alter policy "Coach reads athlete periods" on public.season_periods 
  using (public.trener_har_rett(public.sesong_eier(season_periods.season_id), 'edit_periodization') or public.trener_har_rett(public.sesong_eier(season_periods.season_id), 'edit_plan') or public.trener_har_rett(public.sesong_eier(season_periods.season_id), 'view_analysis') or public.trener_har_rett(public.sesong_eier(season_periods.season_id), 'view_dagbok')); 
 
alter policy "Coach reads athlete key dates" on public.season_key_dates 
  using (public.trener_har_rett(public.sesong_eier(season_key_dates.season_id), 'edit_periodization') or public.trener_har_rett(public.sesong_eier(season_key_dates.season_id), 'edit_plan') or public.trener_har_rett(public.sesong_eier(season_key_dates.season_id), 'view_analysis') or public.trener_har_rett(public.sesong_eier(season_key_dates.season_id), 'view_dagbok')); 
 
alter policy "Coach reads athlete markings" on public.season_markings 
  using (public.trener_har_rett(public.sesong_eier(season_markings.season_id), 'edit_periodization') or public.trener_har_rett(public.sesong_eier(season_markings.season_id), 'edit_plan') or public.trener_har_rett(public.sesong_eier(season_markings.season_id), 'view_analysis') or public.trener_har_rett(public.sesong_eier(season_markings.season_id), 'view_dagbok')); 
 
alter policy "Coach reads athlete heart zones" on public.user_heart_zones 
  using (public.trener_har_rett(user_heart_zones.user_id, 'edit_terskler') or public.trener_har_rett(user_heart_zones.user_id, 'view_analysis') or public.trener_har_rett(user_heart_zones.user_id, 'view_dagbok')); 
 
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 3 - ETTER                                                           */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
select 'ETTER' as steg, 
  (select count(distinct pol.oid) from pg_policy pol 
     join pg_depend d on d.objid = pol.oid and d.classid = 'pg_policy'::regclass 
     join pg_proc f on f.oid = d.refobjid and d.refclassid = 'pg_proc'::regclass 
    where f.proname in ('trener_har_rett','trener_kan_lese_okt') 
      and pol.polcmd = 'r') as select_policyer_pa_funksjonene,   /* forventet 25 = 22 + de 3 fra 4c */ 
  (select count(*) from pg_policies 
     where schemaname = 'public' and cmd = 'SELECT' and policyname like 'Coach%' 
       and tablename in ('workouts','workout_activities','workout_activity_exercises','workout_activity_exercise_sets','workout_lactate_measurements','workout_movements','workout_shooting_series','workout_tags','workout_zones','workout_exercises','workout_test_data','personal_records','ski_tests','ski_test_entries','day_states','period_notes','focus_points','seasons','season_periods','season_key_dates','season_markings','user_heart_zones') 
       and (coalesce(qual,'') !~ 'trener_')) as trener_select_uten_funksjon;   /* forventet 0 */ 
 
/* Deretter (CC): TESTBRUKERE=ja npm run se-flagg-grense -> gronn, og         */ 
/* npx tsx scratchpad/rls-tid.ts -> fortsatt under 300 ms per sporring.       */ 
