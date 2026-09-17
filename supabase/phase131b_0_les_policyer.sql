/* FASE 131b - BLOKK 0 (KUN LESING, ingen endring). Sverre 17. sep 2026, krav 1:   */
/* «ALL-policyene gater også SELECT. Snevrer du USING på en ALL-policy til          */
/* edit-flagg, mister treneren LESING hvis det ikke finnes en egen lesepolicy.»       */
/*                                                                                   */
/* Denne blokka viser per tabell (de 20 ALL-tabellene + user_heart_zones +           */
/* coach_data_permissions) hver policy med cmd, roller og hvilke flagg/relasjons-    */
/* sjekk uttrykket bærer. Repoet sier 19 av 20 har en uavhengig coach-SELECT, og at  */
/* user_thresholds IKKE har det («Trener med plan-rett» er alene). Det er REPO -     */
/* 131b skrives først når PROD-svaret er lest (regel 5).                             */
/*                                                                                   */
/* Kjør blokka alene i SQL-editoren og lim inn hele resultatet.                       */

select
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles,
  case
    when p.qual ~* 'coach_athlete_relations' or p.with_check ~* 'coach_athlete_relations' then 'trener'
    else 'egen'
  end as hvem,
  coalesce(
    nullif(array_to_string(array_remove(array[
      case when coalesce(p.qual,'') || coalesce(p.with_check,'') ~ 'can_edit_plan'          then 'edit_plan' end,
      case when coalesce(p.qual,'') || coalesce(p.with_check,'') ~ 'can_view_dagbok'        then 'view_dagbok' end,
      case when coalesce(p.qual,'') || coalesce(p.with_check,'') ~ 'can_view_analysis'      then 'view_analysis' end,
      case when coalesce(p.qual,'') || coalesce(p.with_check,'') ~ 'can_edit_periodization' then 'edit_periodization' end,
      case when coalesce(p.qual,'') || coalesce(p.with_check,'') ~ 'can_see_health_data'    then 'see_health' end
    ], null), ','), ''),
    '-') as flagg,
  (p.with_check is not null) as har_with_check
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
    'workouts','workout_activities','workout_activity_exercises','workout_activity_exercise_sets',
    'workout_lactate_measurements','workout_movements','workout_shooting_series','workout_tags',
    'workout_zones','workout_test_data','day_states','focus_points','period_notes','personal_records',
    'seasons','season_periods','season_key_dates','season_markings','user_thresholds',
    'workout_exercises','ski_tests','ski_test_entries',
    'user_heart_zones','coach_data_permissions'
  )
order by p.tablename, p.cmd, p.policyname;

/* Tolkning per tabell: finnes det en rad med hvem = 'trener', cmd = 'SELECT' og     */
/* flagg = '-' eller kun view-flagg? Da har treneren lesing uavhengig av ALL-policyen */
/* og ALL kan få nytt uttrykk med ALTER POLICY. Mangler den: ALL må deles i          */
/* SELECT (view-flagg) + INSERT/UPDATE/DELETE (edit-flagg) - nye policyer FØRST,      */
/* DROP av ALL etterpå (regel 42: aldri et vindu uten trenerpolicy).                  */
