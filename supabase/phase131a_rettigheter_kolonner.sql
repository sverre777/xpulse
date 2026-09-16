/* Fase 131a: RETTIGHETENE FLYTTES TIL UTOVEREN - del 1 av 3 (kolonner + kopi). */ 
/* */ 
/* SAKEN (kartlagt 16. sep, Sverre valgte A): */ 
/* De fire rettighetsflaggene (can_edit_plan, can_view_dagbok, */ 
/* can_view_analysis, can_edit_periodization) ligger pa */ 
/* coach_athlete_relations, og treneren har UPDATE der for a styre status */ 
/* («Coach can manage own relations» - MALES i blokk 1, ikke antatt). */ 
/* RLS kan ikke begrense hvilke kolonner en UPDATE rorer (fase 130), sa */ 
/* utoveren slar av, treneren slar pa igjen, og ingen ser det. Det er ikke */ 
/* en rettighetsmodell, det er en knapp med to eiere. */ 
/* */ 
/* LOSNINGEN (A): flaggene flyttes til coach_data_permissions, som er */ 
/* utover-eid fra for (fase 59: «Athlete manages own permissions», */ 
/* «Coach reads own permissions»). Relasjonen sitter igjen med status. */ 
/* */ 
/* TRE DELER, fordi appen leser flaggene fra relasjonen i dag: */ 
/*   131a (denne)  nye kolonner + kopi av dagens verdier. Rent additivt. */ 
/*                 Ingen policy rores, ingen rettighet endres. */ 
/*   kode          resolveTargetUser og utoverens brytere leser/skriver */ 
/*                 coach_data_permissions; trenerens brytere fjernes. */ 
/*   131b          policyene per tabell byttes til den nye tabellen */ 
/*                 (alter policy - en statement, atomisk), sa droppes de */ 
/*                 gamle kolonnene. Kjores ETTER at koden er deployet. */ 
/* Rekkefolgen er vindusfri: hvert steg leser det steget for skrev. */ 
/* */ 
/* NYE REDIGERE-FLAGG starter NEI for alle (Sverre 16. sep): */ 
/*   can_edit_dagbok    gjennomforte okter (fase 129 sporer det) */ 
/*   can_edit_terskler  user_thresholds / user_heart_zones */ 
/*   can_edit_utstyr    inventar (ski, bat, sykkel) */ 
/*   can_edit_tester    skitester OG fysiologiske tester */ 
/* Ingen har hatt dem eksplisitt for, sa ingen mister noe og ingen far noe. */ 
/* */ 
/* Kolonnene er sjekket mot phase59_coach_data_permissions.sql:15-22 */ 
/* (id, coach_athlete_relation_id, can_see_health_data, updated_at) og */ 
/* phase26_coach_panel.sql:10-14 (de fire flaggene pa relasjonen). */ 
/* */ 
/* REGEL 42: nummererte blokker, hver kjorbar alene, ingen temp-tabell */ 
/* pa tvers. Lim inn FOR-tallene fra blokk 1 i rapporten. */ 
 
 
/* ══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 1 - FOR: hva star FAKTISK i prod (regel 5: repo er ikke fasit) */ 
/* ══════════════════════════════════════════════════════════════════════ */ 
 
/* 1a. Policyene pa de to tabellene - navn, kommando, qual, with_check. */ 
select tablename, policyname, cmd, permissive, roles, qual, with_check 
  from pg_policies 
 where schemaname = 'public' 
   and tablename in ('coach_athlete_relations', 'coach_data_permissions') 
 order by tablename, policyname; 
 
/* 1b. ALLE policyer som leser et av de fire flaggene - dette er lista */ 
/*     131b skal bytte, tabell for tabell. */ 
select tablename, policyname, cmd 
  from pg_policies 
 where schemaname = 'public' 
   and (coalesce(qual, '') like '%can_edit_plan%' 
     or coalesce(qual, '') like '%can_view_dagbok%' 
     or coalesce(qual, '') like '%can_view_analysis%' 
     or coalesce(qual, '') like '%can_edit_periodization%' 
     or coalesce(with_check, '') like '%can_edit_plan%' 
     or coalesce(with_check, '') like '%can_edit_periodization%') 
 order by tablename, policyname; 
 
/* 1c. Tallene. */ 
select 'FOR' as steg, 
       (select count(*) from public.coach_athlete_relations) as relasjoner, 
       (select count(*) from public.coach_athlete_relations where status = 'active') as aktive, 
       (select count(*) from public.coach_data_permissions) as rettighetsrader, 
       (select count(*) from public.coach_data_permissions where can_see_health_data) as med_helsedeling, 
       (select count(*) from public.coach_athlete_relations r 
         where not exists (select 1 from public.coach_data_permissions p 
                            where p.coach_athlete_relation_id = r.id)) as relasjoner_uten_rettighetsrad, 
       (select count(*) from public.coach_athlete_relations where can_edit_plan) as med_edit_plan, 
       (select count(*) from public.coach_athlete_relations where can_view_dagbok) as med_view_dagbok, 
       (select count(*) from public.coach_athlete_relations where can_view_analysis) as med_view_analysis, 
       (select count(*) from public.coach_athlete_relations where can_edit_periodization) as med_edit_periodization; 
 
 
/* ══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 2 - KOLONNENE. Additivt. Standard FALSE overalt: verdiene for */ 
/* eksisterende relasjoner kopieres i blokk 3, og NYE relasjoner far */ 
/* se-flaggene satt av koden ved opprettelse - aldri av en kolonnestandard */ 
/* som ville gitt tilgang for noen hadde valgt den. */ 
/* ══════════════════════════════════════════════════════════════════════ */ 
 
alter table public.coach_data_permissions 
  add column if not exists can_edit_plan          boolean not null default false, 
  add column if not exists can_view_dagbok        boolean not null default false, 
  add column if not exists can_view_analysis      boolean not null default false, 
  add column if not exists can_edit_periodization boolean not null default false, 
  add column if not exists can_edit_dagbok        boolean not null default false, 
  add column if not exists can_edit_terskler      boolean not null default false, 
  add column if not exists can_edit_utstyr        boolean not null default false, 
  add column if not exists can_edit_tester        boolean not null default false; 
 
comment on column public.coach_data_permissions.can_edit_dagbok is 
  'Fase 131: treneren kan redigere GJENNOMFORTE okter. Starter NEI. Kreves av saveWorkout nar okta i basen er is_completed - avgjort av basen, aldri av det klienten sender. Endringer spores (fase 129) og varsles.'; 
comment on column public.coach_data_permissions.can_edit_terskler is 
  'Fase 131: treneren kan endre terskler og pulssoner (user_thresholds, user_heart_zones). Starter NEI. Endring varsles utoveren med gammel og ny verdi.'; 
comment on column public.coach_data_permissions.can_edit_utstyr is 
  'Fase 131: treneren kan redigere inventar (ski, bat, sykkel). Starter NEI.'; 
comment on column public.coach_data_permissions.can_edit_tester is 
  'Fase 131: treneren kan fore skitester og fysiologiske tester. Starter NEI.'; 
 
/* Sjekk blokk 2 for seg: atte kolonner finnes, alle boolean not null. */ 
select 'BLOKK 2' as steg, 
       case when (select count(*) from information_schema.columns 
                   where table_schema = 'public' and table_name = 'coach_data_permissions' 
                     and column_name in ('can_edit_plan','can_view_dagbok','can_view_analysis','can_edit_periodization', 
                                         'can_edit_dagbok','can_edit_terskler','can_edit_utstyr','can_edit_tester') 
                     and data_type = 'boolean' and is_nullable = 'NO') = 8 
         then 'OK' else 'FEIL' end as atte_kolonner; 
 
 
/* ══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 3 - KOPIEN. Hver relasjon (alle statuser - en inaktiv som */ 
/* reaktiveres skal ikke miste valgene sine) far en rettighetsrad, og de */ 
/* fire gamle flaggene kopieres inn. can_see_health_data rores IKKE. */ 
/* ══════════════════════════════════════════════════════════════════════ */ 
 
insert into public.coach_data_permissions (coach_athlete_relation_id) 
select r.id 
  from public.coach_athlete_relations r 
 where not exists (select 1 from public.coach_data_permissions p 
                    where p.coach_athlete_relation_id = r.id); 
 
update public.coach_data_permissions p 
   set can_edit_plan          = r.can_edit_plan, 
       can_view_dagbok        = r.can_view_dagbok, 
       can_view_analysis      = r.can_view_analysis, 
       can_edit_periodization = r.can_edit_periodization 
  from public.coach_athlete_relations r 
 where r.id = p.coach_athlete_relation_id; 
 
/* ETTER: samme tall som i 1c, pluss de nye kolonnene. */ 
select 'ETTER' as steg, 
       (select count(*) from public.coach_athlete_relations) as relasjoner, 
       (select count(*) from public.coach_athlete_relations where status = 'active') as aktive, 
       (select count(*) from public.coach_data_permissions) as rettighetsrader, 
       (select count(*) from public.coach_data_permissions where can_see_health_data) as med_helsedeling, 
       (select count(*) from public.coach_athlete_relations r 
         where not exists (select 1 from public.coach_data_permissions p 
                            where p.coach_athlete_relation_id = r.id)) as relasjoner_uten_rettighetsrad, 
       (select count(*) from public.coach_data_permissions where can_edit_plan) as med_edit_plan, 
       (select count(*) from public.coach_data_permissions where can_view_dagbok) as med_view_dagbok, 
       (select count(*) from public.coach_data_permissions where can_view_analysis) as med_view_analysis, 
       (select count(*) from public.coach_data_permissions where can_edit_periodization) as med_edit_periodization; 
 
/* FIRE ASSERTIONS OG TO AVLESNINGER. */ 
select 'hver relasjon har noyaktig en rettighetsrad' as sjekk, 
       case when (select count(*) from public.coach_athlete_relations) 
               = (select count(*) from public.coach_data_permissions) 
             and (select count(*) from public.coach_athlete_relations r 
                   where not exists (select 1 from public.coach_data_permissions p 
                                      where p.coach_athlete_relation_id = r.id)) = 0 
         then 'OK' else 'FEIL' end as resultat 
union all 
select 'de fire flaggene er like pa relasjon og rettighetsrad - INGEN relasjon avviker', 
       case when (select count(*) 
                    from public.coach_athlete_relations r 
                    join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id 
                   where p.can_edit_plan          is distinct from r.can_edit_plan 
                      or p.can_view_dagbok        is distinct from r.can_view_dagbok 
                      or p.can_view_analysis      is distinct from r.can_view_analysis 
                      or p.can_edit_periodization is distinct from r.can_edit_periodization) = 0 
         then 'OK' else 'FEIL' end 
union all 
select 'ingen redigere-flagg er satt - alle fire nye starter NEI', 
       case when (select count(*) from public.coach_data_permissions 
                   where can_edit_dagbok or can_edit_terskler or can_edit_utstyr or can_edit_tester) = 0 
         then 'OK' else 'FEIL' end 
union all 
select 'ingen policy er rort i denne fasen (1b-lista skal vaere identisk etterpa)', 
       case when (select count(*) from pg_policies 
                   where schemaname = 'public' 
                     and tablename in ('coach_athlete_relations', 'coach_data_permissions')) > 0 
         then 'SE 1a PA NYTT' else 'FEIL' end 
union all 
select 'AVLESNING: med_helsedeling FOR = ETTER (can_see_health_data urort)', 'SE TALLENE' 
union all 
select 'AVLESNING: med_edit_plan/view_dagbok/view_analysis/edit_periodization FOR = ETTER', 'SE TALLENE'; 
