/* Fase 131b: RETTIGHETENE FLYTTES TIL UTOVEREN - del 3 av 3 (policyene).      */ 
/*                                                                            */ 
/* Forutsetter 131a (kjort 17. sep) og koden 43df173 (leser                   */ 
/* coach_data_permissions). Denne fila bytter hver RLS-policy og de to        */ 
/* security definer-funksjonene over til coach_data_permissions, og dropper   */ 
/* SA de fire gamle kolonnene pa coach_athlete_relations.                     */ 
/*                                                                            */ 
/* PROD ER MALT (blokk 0, 74 rader, 17. sep): 19 av 20 ALL-tabeller har en    */ 
/* uavhengig trener-SELECT uten flagg -> ALTER POLICY pa ALL (USING + WITH    */ 
/* CHECK, alle har with_check). user_thresholds har INGEN trener-SELECT ->    */ 
/* deles i ny SELECT + ny I/U/D, «Trener med plan-rett» droppes etterpa.      */ 
/* user_heart_zones: treneren har INGEN skriverett i dag - ny I/U/D under     */ 
/* can_edit_terskler er en UTVIDELSE (standard NEI, utoveren ma sla den pa).  */ 
/* coach_data_permissions: trener-INSERT mangler; den lukker vinduet for nye  */ 
/* relasjoner og kjores FOR tabell-policyene (blokk 3 for blokk 4).           */ 
/*                                                                            */ 
/* FLAGGENE (avgjort 17. sep):                                                */ 
/*   workouts + barnetabeller  planlagt -> can_edit_plan, gjennomfort ->      */ 
/*                             can_edit_dagbok. Avgjort av w.is_completed i   */ 
/*                             BASEN. En trener med bare edit_plan kan derfor */ 
/*                             IKKE sette is_completed = true (WITH CHECK).   */ 
/*                             Onsket: «ingenting fullfort for brukeren       */ 
/*                             markerer det». Koden teller rader tilbake      */ 
/*                             (stille 204 -> regel 22-tekst).                */ 
/*   day_states                is_planned -> edit_plan, ellers edit_dagbok    */ 
/*   period_notes              context plan -> edit_plan, dagbok ->           */ 
/*                             edit_dagbok (for: kun plan)                    */ 
/*   focus_points              edit_plan (deprecated, uendret omfang)         */ 
/*   personal_records          edit_tester (PR er resultat, tests.ts skriver) */ 
/*   workout_test_data         edit_tester (fysiologiske tester)              */ 
/*   ski_tests, ski_test_entries  edit_tester                                 */ 
/*   seasons, season_*         edit_periodization (uendret)                   */ 
/*   user_thresholds           edit_terskler (lesing: terskler|analyse|dagbok)*/ 
/*   user_heart_zones          edit_terskler (NY skriverett)                  */ 
/*   kan_flette_for            edit_dagbok (flett skriver i malet og markerer)*/ 
/*   sett_utvidet_skala        edit_terskler (sone-skalaen)                   */ 
/*   workout_exercises         legacy, 0 rader: skrivepolicyen DROPPES        */ 
/*                             (regel 21), lesepolicyen star                  */ 
/*   seasons                   «Seasons own» er duplikat av «Own seasons»     */ 
/*                             (regel 21) - droppes                           */ 
/*                                                                            */ 
/* REGEL 42: SQL-editoren er ikke en transaksjon. Nummererte blokker, hver    */ 
/* kjorbar alene, i rekkefolge: 1 FOR -> 2 funksjonene -> 3 INSERT-policyen   */ 
/* -> 4 policyene per tabell -> 5 assertions -> 6 drop kolonner -> 7 ETTER.   */ 
/* Ny policy FOR drop av gammel - aldri et vindu uten trenerpolicy.           */ 
/* REGEL 41: revoke fra public OG anon pa hver security definer-funksjon.     */ 
/* Kjores av Sverre. CC kjorer aldri SQL.                                     */ 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 1 - FOR. Kun lesing. Lim inn resultatet.                            */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
select 'FOR' as steg, 
  (select count(*) from pg_policies where schemaname = 'public' 
     and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'r\.can_(edit_plan|view_dagbok|view_analysis|edit_periodization)') as policyer_pa_relasjonsflagg, 
  (select count(*) from pg_policies where schemaname = 'public' 
     and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'coach_data_permissions') as policyer_pa_rettighetstabellen, 
  (select count(*) from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
     where n.nspname = 'public' and f.proname in ('kan_flette_for','sett_utvidet_skala') 
       and f.prosrc ~ 'r\.can_edit_plan') as funksjoner_pa_relasjonsflagg, 
  (select count(*) from information_schema.columns where table_schema = 'public' 
     and table_name = 'coach_athlete_relations' 
     and column_name in ('can_edit_plan','can_view_dagbok','can_view_analysis','can_edit_periodization')) as gamle_kolonner, 
  (select count(*) from public.coach_athlete_relations) as relasjoner, 
  (select count(*) from public.coach_data_permissions) as rettighetsrader, 
  (select count(*) from public.coach_athlete_relations r 
     where not exists (select 1 from public.coach_data_permissions p where p.coach_athlete_relation_id = r.id)) as relasjoner_uten_rad, 
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'seasons') as seasons_policyer, 
  (select count(*) from public.workout_exercises) as workout_exercises_rader; 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 2 - DE TO SECURITY DEFINER-FUNKSJONENE. Ma skrives om FOR kolonnene */ 
/* droppes: leser de r.can_edit_plan etter drop, feiler de «column does not  */ 
/* exist» for ALLE (ogsa utoveren selv) - flett og utvidet skala dor.        */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
create or replace function public.kan_flette_for(p_bruker uuid) 
returns boolean language sql stable security definer 
set search_path = public as $fn$ 
  /* Selv, eller trener med aktiv relasjon og DAGBOK-rett: flett skriver i */ 
  /* malet og markerer den gjennomfort (fase 131: utoverens faktum). */ 
  select p_bruker = auth.uid() 
     or exists ( 
       select 1 from public.coach_athlete_relations r 
       join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
       where r.coach_id = auth.uid() 
         and r.athlete_id = p_bruker 
         and r.status = 'active' 
         and p.can_edit_dagbok 
     ) 
$fn$; 
revoke all on function public.kan_flette_for(uuid) from public, anon; 

create or replace function public.sett_utvidet_skala( 
  p_bruker uuid, 
  p_paa boolean 
) returns jsonb language plpgsql security definer 
set search_path = public as $fn$ 
begin 
  /* Selv, eller trener med TERSKEL-rett (fase 131: sone-skalaen horer til */ 
  /* terskler og soner, ikke til planen). */ 
  if not ( 
    p_bruker = auth.uid() 
    or exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = p_bruker 
        and r.coach_id   = auth.uid() 
        and r.status     = 'active' 
        and p.can_edit_terskler 
    ) 
  ) then 
    return jsonb_build_object('error', 'Mangler tillatelse'); 
  end if; 

  update public.profiles set utvidet_skala = p_paa where id = p_bruker; 
  return jsonb_build_object('ok', true, 'utvidet_skala', p_paa); 
end $fn$; 
revoke all on function public.sett_utvidet_skala(uuid, boolean) from public, anon; 
grant execute on function public.sett_utvidet_skala(uuid, boolean) to authenticated; 

select 'BLOKK 2' as steg, 
  (select count(*) from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
     where n.nspname = 'public' and f.proname in ('kan_flette_for','sett_utvidet_skala') 
       and f.prosrc ~ 'coach_data_permissions') as funksjoner_pa_rettighetstabellen;   /* forventet 2 */ 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 3 - TRENERENS INSERT PA coach_data_permissions. Lukker vinduet for  */ 
/* nye relasjoner (redeem oppretter raden). WITH CHECK krever at relasjonen  */ 
/* er trenerens EGEN, at alle fire redigeringsflaggene er false, og at       */ 
/* helsedeling er false. Se-flaggene og plan/arsplan far treneren sette fra  */ 
/* sine standardvalg, som i dag. Utoveren eier raden etterpa.                */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
drop policy if exists "Coach creates permission row at redeem" on public.coach_data_permissions; 
create policy "Coach creates permission row at redeem" 
  on public.coach_data_permissions for insert 
  with check ( 
    exists ( 
      select 1 from public.coach_athlete_relations r 
      where r.id = coach_athlete_relation_id 
        and r.coach_id = auth.uid() 
    ) 
    and can_edit_dagbok = false 
    and can_edit_terskler = false 
    and can_edit_utstyr = false 
    and can_edit_tester = false 
    and can_see_health_data = false 
  ); 

select 'BLOKK 3' as steg, count(*) as trener_insert_policy 
  from pg_policies where schemaname = 'public' and tablename = 'coach_data_permissions' 
   and policyname = 'Coach creates permission row at redeem';   /* forventet 1 */ 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 4a - user_thresholds: DELES. Ny SELECT og ny I/U/D FORST, sa drop   */ 
/* av «Trener med plan-rett» (ALL). Aldri et vindu uten trenerpolicy.        */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
drop policy if exists "Trener leser terskler" on public.user_thresholds; 
create policy "Trener leser terskler" 
  on public.user_thresholds for select 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_thresholds.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler or p.can_view_analysis or p.can_view_dagbok) 
    )); 

drop policy if exists "Trener med terskel-rett skriver" on public.user_thresholds; 
create policy "Trener med terskel-rett skriver" 
  on public.user_thresholds for insert 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_thresholds.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )); 
drop policy if exists "Trener med terskel-rett oppdaterer" on public.user_thresholds; 
create policy "Trener med terskel-rett oppdaterer" 
  on public.user_thresholds for update 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_thresholds.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_thresholds.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )); 
drop policy if exists "Trener med terskel-rett sletter" on public.user_thresholds; 
create policy "Trener med terskel-rett sletter" 
  on public.user_thresholds for delete 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_thresholds.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )); 

drop policy if exists "Trener med plan-rett" on public.user_thresholds; 

select 'BLOKK 4a' as steg, policyname, cmd from pg_policies 
 where schemaname = 'public' and tablename = 'user_thresholds' order by cmd, policyname; 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 4b - user_heart_zones: NY skriverett (UTVIDELSE). Treneren har i    */ 
/* dag bare «Coach reads athlete heart zones». Standard NEI - utoveren ma    */ 
/* sla pa «Terskler og soner (endre)».                                       */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
drop policy if exists "Trener med terskel-rett skriver soner" on public.user_heart_zones; 
create policy "Trener med terskel-rett skriver soner" 
  on public.user_heart_zones for insert 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_heart_zones.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )); 
drop policy if exists "Trener med terskel-rett oppdaterer soner" on public.user_heart_zones; 
create policy "Trener med terskel-rett oppdaterer soner" 
  on public.user_heart_zones for update 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_heart_zones.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_heart_zones.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )); 
drop policy if exists "Trener med terskel-rett sletter soner" on public.user_heart_zones; 
create policy "Trener med terskel-rett sletter soner" 
  on public.user_heart_zones for delete 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = user_heart_zones.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_terskler) 
    )); 

select 'BLOKK 4b' as steg, policyname, cmd from pg_policies 
 where schemaname = 'public' and tablename = 'user_heart_zones' order by cmd, policyname; 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 4c - ALTER POLICY pa de 18 ALL-policyene med uavhengig trener-      */ 
/* SELECT (malt i blokk 0), pluss de seks skitest-policyene. En statement    */ 
/* per policy, atomisk - ingen drop.                                         */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
alter policy "Coach writes athlete workouts" on public.workouts 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = workouts.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not workouts.is_completed and p.can_edit_plan) or (workouts.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = workouts.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not workouts.is_completed and p.can_edit_plan) or (workouts.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete activities" on public.workout_activities 
  using (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_activities.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_activities.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete activity exercises" on public.workout_activity_exercises 
  using (exists ( 
      select 1 from public.workout_activities a 
      join public.workouts w on w.id = a.workout_id 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where a.id = workout_activity_exercises.activity_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workout_activities a 
      join public.workouts w on w.id = a.workout_id 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where a.id = workout_activity_exercises.activity_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete exercise sets" on public.workout_activity_exercise_sets 
  using (exists ( 
      select 1 from public.workout_activity_exercises e 
      join public.workout_activities a on a.id = e.activity_id 
      join public.workouts w on w.id = a.workout_id 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where e.id = workout_activity_exercise_sets.exercise_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workout_activity_exercises e 
      join public.workout_activities a on a.id = e.activity_id 
      join public.workouts w on w.id = a.workout_id 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where e.id = workout_activity_exercise_sets.exercise_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete lactate" on public.workout_lactate_measurements 
  using (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_lactate_measurements.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_lactate_measurements.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete movements" on public.workout_movements 
  using (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_movements.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_movements.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete shooting series" on public.workout_shooting_series 
  using (exists ( 
      select 1 from public.workout_activities a 
      join public.workouts w on w.id = a.workout_id 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where a.id = workout_shooting_series.activity_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workout_activities a 
      join public.workouts w on w.id = a.workout_id 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where a.id = workout_shooting_series.activity_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete tags" on public.workout_tags 
  using (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_tags.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_tags.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete zones" on public.workout_zones 
  using (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_zones.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.workouts w 
      join public.coach_athlete_relations r on r.athlete_id = w.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where w.id = workout_zones.workout_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((not w.is_completed and p.can_edit_plan) or (w.is_completed and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete workout test data" on public.workout_test_data 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = workout_test_data.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = workout_test_data.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )); 

alter policy "Coach writes athlete day states" on public.day_states 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = day_states.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((day_states.is_planned and p.can_edit_plan) or (not day_states.is_planned and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = day_states.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((day_states.is_planned and p.can_edit_plan) or (not day_states.is_planned and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes plan focus points" on public.focus_points 
  using (focus_points.context = 'plan' and exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = focus_points.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_plan) 
    )) 
  with check (focus_points.context = 'plan' and exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = focus_points.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_plan) 
    )); 

alter policy "Coach writes plan period notes" on public.period_notes 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = period_notes.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((period_notes.context = 'plan' and p.can_edit_plan) or (period_notes.context = 'dagbok' and p.can_edit_dagbok)) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = period_notes.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and ((period_notes.context = 'plan' and p.can_edit_plan) or (period_notes.context = 'dagbok' and p.can_edit_dagbok)) 
    )); 

alter policy "Coach writes athlete personal records" on public.personal_records 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = personal_records.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = personal_records.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )); 

alter policy "Coach writes athlete seasons" on public.seasons 
  using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = seasons.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_periodization) 
    )) 
  with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = seasons.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_periodization) 
    )); 

alter policy "Coach writes athlete periods" on public.season_periods 
  using (exists ( 
      select 1 from public.seasons s 
      join public.coach_athlete_relations r on r.athlete_id = s.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where s.id = season_periods.season_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_periodization 
    )) 
  with check (exists ( 
      select 1 from public.seasons s 
      join public.coach_athlete_relations r on r.athlete_id = s.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where s.id = season_periods.season_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_periodization 
    )); 

alter policy "Coach writes athlete key dates" on public.season_key_dates 
  using (exists ( 
      select 1 from public.seasons s 
      join public.coach_athlete_relations r on r.athlete_id = s.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where s.id = season_key_dates.season_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_periodization 
    )) 
  with check (exists ( 
      select 1 from public.seasons s 
      join public.coach_athlete_relations r on r.athlete_id = s.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where s.id = season_key_dates.season_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_periodization 
    )); 

alter policy "Coach writes athlete markings" on public.season_markings 
  using (exists ( 
      select 1 from public.seasons s 
      join public.coach_athlete_relations r on r.athlete_id = s.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where s.id = season_markings.season_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_periodization 
    )) 
  with check (exists ( 
      select 1 from public.seasons s 
      join public.coach_athlete_relations r on r.athlete_id = s.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where s.id = season_markings.season_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_periodization 
    )); 

/* ski_tests + ski_test_entries: seks separate policyer (fase 49), seks ALTER. */ 
alter policy "Coach inserts ski tests" on public.ski_tests with check (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = ski_tests.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )); 
alter policy "Coach updates ski tests" on public.ski_tests using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = ski_tests.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )); 
alter policy "Coach deletes ski tests" on public.ski_tests using (exists ( 
      select 1 from public.coach_athlete_relations r 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where r.athlete_id = ski_tests.user_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and (p.can_edit_tester) 
    )); 
alter policy "Coach inserts ski test entries" on public.ski_test_entries with check (exists ( 
      select 1 from public.ski_tests t 
      join public.coach_athlete_relations r on r.athlete_id = t.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where t.id = ski_test_entries.test_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_tester 
    )); 
alter policy "Coach updates ski test entries" on public.ski_test_entries using (exists ( 
      select 1 from public.ski_tests t 
      join public.coach_athlete_relations r on r.athlete_id = t.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where t.id = ski_test_entries.test_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_tester 
    )); 
alter policy "Coach deletes ski test entries" on public.ski_test_entries using (exists ( 
      select 1 from public.ski_tests t 
      join public.coach_athlete_relations r on r.athlete_id = t.user_id 
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
      where t.id = ski_test_entries.test_id 
        and r.coach_id = auth.uid() and r.status = 'active' 
        and p.can_edit_tester 
    )); 

select 'BLOKK 4c' as steg, 
  (select count(*) from pg_policies where schemaname = 'public' 
     and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'r\.can_(edit_plan|view_dagbok|view_analysis|edit_periodization)') as igjen_pa_relasjonsflagg; 
  /* forventet 1: «Coach writes athlete exercises» (droppes i 4d) */ 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 4d - drop (regel 21): legacy-skrivepolicy pa workout_exercises      */ 
/* (0 rader, ingen kode skriver dit; «Coach reads athlete exercises» star),  */ 
/* og duplikatet «Seasons own» (komplett_schema) - «Own seasons» (fase 10)   */ 
/* har samme USING pluss WITH CHECK og blir staende.                         */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
drop policy if exists "Coach writes athlete exercises" on public.workout_exercises; 
drop policy if exists "Seasons own" on public.seasons; 

select 'BLOKK 4d' as steg, 
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'workout_exercises') as workout_exercises_policyer, 
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'seasons' and policyname = 'Own seasons') as own_seasons; 
  /* forventet: workout_exercises uten «Coach writes …», own_seasons = 1 */ 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 5 - ASSERTIONS FOR DROP. Stopper med feil hvis noe fortsatt leser   */ 
/* de gamle kolonnene. Kjor denne ALENE og les at den gikk gjennom.          */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
do $$ 
declare 
  n_pol int; n_fn int; n_ins int; n_uten int; 
begin 
  select count(*) into n_pol from pg_policies 
   where schemaname = 'public' 
     and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'r\.can_(edit_plan|view_dagbok|view_analysis|edit_periodization)'; 
  if n_pol <> 0 then 
    raise exception 'ASSERTION 1 FEILET: % policy(er) leser fortsatt flagg fra coach_athlete_relations', n_pol; 
  end if; 

  select count(*) into n_fn from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
   where n.nspname = 'public' and f.prosrc ~ 'r\.can_(edit_plan|view_dagbok|view_analysis|edit_periodization)'; 
  if n_fn <> 0 then 
    raise exception 'ASSERTION 2 FEILET: % funksjon(er) leser fortsatt flagg fra coach_athlete_relations', n_fn; 
  end if; 

  select count(*) into n_ins from pg_policies 
   where schemaname = 'public' and tablename = 'coach_data_permissions' 
     and policyname = 'Coach creates permission row at redeem'; 
  if n_ins <> 1 then 
    raise exception 'ASSERTION 3 FEILET: trenerens INSERT-policy mangler (blokk 3)'; 
  end if; 

  select count(*) into n_uten from public.coach_athlete_relations r 
   where not exists (select 1 from public.coach_data_permissions p where p.coach_athlete_relation_id = r.id); 
  if n_uten <> 0 then 
    raise exception 'ASSERTION 4 FEILET: % relasjon(er) uten rettighetsrad - kjor 131a blokk 3 pa nytt for drop', n_uten; 
  end if; 

  raise notice 'ASSERTIONS OK: 0 policyer og 0 funksjoner pa relasjonsflagg, INSERT-policy finnes, alle relasjoner har rad'; 
end $$; 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 6 - DROP DE FIRE GAMLE KOLONNENE. Kun etter at blokk 5 gikk         */ 
/* gjennom. Verdiene ligger i coach_data_permissions siden 131a.             */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
alter table public.coach_athlete_relations 
  drop column if exists can_edit_plan, 
  drop column if exists can_view_dagbok, 
  drop column if exists can_view_analysis, 
  drop column if exists can_edit_periodization; 

/* coach_default_permissions (fase 41) beholder sine fire kolonner: det er */ 
/* TRENERENS standardvalg for nye relasjoner, ikke en rettighet.            */ 

/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 7 - ETTER. Lim inn resultatet.                                      */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
select 'ETTER' as steg, 
  (select count(*) from information_schema.columns where table_schema = 'public' 
     and table_name = 'coach_athlete_relations' 
     and column_name in ('can_edit_plan','can_view_dagbok','can_view_analysis','can_edit_periodization')) as gamle_kolonner,   /* 0 */ 
  (select count(*) from information_schema.columns where table_schema = 'public' 
     and table_name = 'coach_data_permissions' 
     and column_name in ('can_edit_plan','can_view_dagbok','can_view_analysis','can_edit_periodization', 
                         'can_edit_dagbok','can_edit_terskler','can_edit_utstyr','can_edit_tester')) as nye_kolonner,   /* 8 */ 
  (select count(*) from pg_policies where schemaname = 'public' 
     and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'coach_data_permissions') as policyer_pa_rettighetstabellen,   /* 33: 18 + 6 + 4 + 3 + 1 + fase 59-ene (2) - les tallet */ 
  (select count(*) from public.coach_athlete_relations) as relasjoner, 
  (select count(*) from public.coach_data_permissions) as rettighetsrader, 
  (select count(*) from public.coach_data_permissions where can_edit_dagbok or can_edit_terskler or can_edit_utstyr or can_edit_tester) as med_nye_redigeringsflagg;   /* 0 for noen har slatt pa */ 

/* Ettersjekk fra appen (ikke SQL): trener-rettigheter-e2e (11 OK for 131b) */ 
/* skal fortsatt vaere gronn, og flett + utvidet skala skal virke for        */ 
/* utoveren selv. 131c (se-flaggene inn i de 20 trener-SELECT-ene) skrives   */ 
/* som egen fil etter at denne er kjort.                                     */ 
