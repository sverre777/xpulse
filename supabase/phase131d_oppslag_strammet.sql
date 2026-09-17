/* Fase 131d: OPPSLAGSFUNKSJONENE STRAMMES (Sverre 17. sep, «ja, sa det       */ 
/* forrige gang ogsa»).                                                       */ 
/*                                                                            */ 
/* MALT (rettighet-grense 17. sep): aktivitet_okt, ovelse_okt, sesong_eier og */ 
/* skitest_eier svarte en FREMMED authenticated med uuid -> uuid (oktas id     */ 
/* for en ovelses-id, eierens id for en sesong-id). Ingen rader, men en       */ 
/* grense. Na: svar bare nar auth.uid() er eieren selv eller en trener med    */ 
/* aktiv relasjon til eieren; ellers null - ogsa for en gyldig uuid.          */ 
/*                                                                            */ 
/* Policyene som kaller dem (131b hastefiks, 131c) er uendret: der er         */ 
/* kalleren alltid en trener med relasjon, sa svaret er det samme som for.    */ 
/* Regel 41 pa grantene (uendret: authenticated, ikke public/anon).           */ 
/* Regel 42: en blokk. rls-tid FOR: tregeste 166 ms (trener workout_          */ 
/* activities). ETTER males av CC nar blokka er kjort.                        */ 
 
create or replace function public.aktivitet_okt(p_aktivitet uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select a.workout_id 
    from public.workout_activities a 
    join public.workouts w on w.id = a.workout_id 
   where a.id = p_aktivitet 
     and (w.user_id = auth.uid() 
          or exists (select 1 from public.coach_athlete_relations r 
                      where r.athlete_id = w.user_id and r.coach_id = auth.uid() and r.status = 'active')) 
$fn$; 
 
create or replace function public.ovelse_okt(p_ovelse uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select a.workout_id 
    from public.workout_activity_exercises e 
    join public.workout_activities a on a.id = e.activity_id 
    join public.workouts w on w.id = a.workout_id 
   where e.id = p_ovelse 
     and (w.user_id = auth.uid() 
          or exists (select 1 from public.coach_athlete_relations r 
                      where r.athlete_id = w.user_id and r.coach_id = auth.uid() and r.status = 'active')) 
$fn$; 
 
create or replace function public.sesong_eier(p_sesong uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select s.user_id 
    from public.seasons s 
   where s.id = p_sesong 
     and (s.user_id = auth.uid() 
          or exists (select 1 from public.coach_athlete_relations r 
                      where r.athlete_id = s.user_id and r.coach_id = auth.uid() and r.status = 'active')) 
$fn$; 
 
create or replace function public.skitest_eier(p_test uuid) 
returns uuid language sql stable security definer 
set search_path = public as $fn$ 
  select t.user_id 
    from public.ski_tests t 
   where t.id = p_test 
     and (t.user_id = auth.uid() 
          or exists (select 1 from public.coach_athlete_relations r 
                      where r.athlete_id = t.user_id and r.coach_id = auth.uid() and r.status = 'active')) 
$fn$; 
 
revoke all on function public.aktivitet_okt(uuid) from public, anon; 
revoke all on function public.ovelse_okt(uuid) from public, anon; 
revoke all on function public.sesong_eier(uuid) from public, anon; 
revoke all on function public.skitest_eier(uuid) from public, anon; 
grant execute on function public.aktivitet_okt(uuid) to authenticated; 
grant execute on function public.ovelse_okt(uuid) to authenticated; 
grant execute on function public.sesong_eier(uuid) to authenticated; 
grant execute on function public.skitest_eier(uuid) to authenticated; 
 
select 'ETTER' as steg, count(*) as strammet 
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
 where n.nspname = 'public' 
   and f.proname in ('aktivitet_okt','ovelse_okt','sesong_eier','skitest_eier') 
   and f.prosrc ~ 'coach_athlete_relations';   /* forventet 4 */ 
 
/* Deretter (CC): TESTBRUKERE=ja npm run rettighet-grense - fremmed far null   */ 
/* pa alle fire (testen er oppdatert til det), og rls-tid ETTER.               */ 
