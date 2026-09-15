/* Fase 127: STILLESTAND TIL PAUSE (Sverre 15. sep 2026) - fase C2. */ 
/* Én ny kolonne på workout_activities: */ 
/*   auto_pause boolean not null default false */ 
/* */ 
/* HVORFOR: fase C merket de maskinskapte pause-radene med lap_notes = */ 
/* 'Stillestand'. lap_notes er SEGMENTETS NAVN og redigeres fritt av brukeren */ 
/* (Oktbygger NavnFelt), så nøkkelen kunne forsvinne - eller treffe en rad */ 
/* brukeren selv hadde døpt «Stillestand». En maskinskapt rad kan ikke */ 
/* identifiseres med et felt brukeren skriver i. */ 
/* */ 
/* Etter denne: gjorStillestandTilPause setter auto_pause = true, og angre */ 
/* sletter på auto_pause = true. lap_notes = 'Stillestand' beholdes som */ 
/* synlig, ærlig tekst for utøveren - men er ikke lenger nøkkelen. */ 
/* */ 
/* Idempotent (add column if not exists). Ingen datarader røres: alle */ 
/* eksisterende rader får false via default, så ingen rad blir plutselig */ 
/* regnet som maskinskapt. */ 
/* Kjøres av Sverre i prod. CC kjører ALDRI SQL selv (regel 35). */ 

/* ── FØR: antall kolonner og antall rader i workout_activities ──────────── */ 
select 'FØR' as steg, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'workout_activities') as antall_kolonner, 
       (select count(*) from public.workout_activities) as antall_rader, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'workout_activities' 
           and column_name = 'auto_pause') as kolonnen_finnes; 

/* ── ENDRINGEN ───────────────────────────────────────────────────────────── */ 
alter table public.workout_activities 
  add column if not exists auto_pause boolean not null default false; 

comment on column public.workout_activities.auto_pause is 
  'Fase 127: raden er laget av «gjør stillestand til pause» (klokka gikk, farten lå under terskelen). Angre sletter nøyaktig disse. Aldri satt for hånd; lap_notes er brukerens tekst og kan ikke brukes som nøkkel.'; 

/* Angre-spørringen går på workout_id + auto_pause - en delvis indeks holder */ 
/* den billig uten å koste noe på de vanlige radene. */ 
create index if not exists workout_activities_auto_pause_idx 
  on public.workout_activities (workout_id) 
  where auto_pause; 

/* ── ETTER: samme tellinger ─────────────────────────────────────────────── */ 
select 'ETTER' as steg, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'workout_activities') as antall_kolonner, 
       (select count(*) from public.workout_activities) as antall_rader, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'workout_activities' 
           and column_name = 'auto_pause') as kolonnen_finnes; 

/* ── ASSERTIONS (som SELECT - alle skal gi OK) ──────────────────────────── */ 
select 'kolonnen finnes, boolean, not null, default false' as sjekk, 
       case when exists ( 
         select 1 from information_schema.columns 
          where table_schema = 'public' and table_name = 'workout_activities' 
            and column_name = 'auto_pause' 
            and data_type = 'boolean' and is_nullable = 'NO' 
            and column_default = 'false') 
         then 'OK' else 'FEIL' end as resultat 
union all 
select 'ingen eksisterende rad er merket som maskinskapt', 
       case when (select count(*) from public.workout_activities where auto_pause) = 0 
         then 'OK' else 'FEIL' end 
union all 
select 'den delvise indeksen finnes', 
       case when exists ( 
         select 1 from pg_indexes 
          where schemaname = 'public' and tablename = 'workout_activities' 
            and indexname = 'workout_activities_auto_pause_idx') 
         then 'OK' else 'FEIL' end 
union all 
select 'antall rader uendret (FØR = ETTER, sammenlign selv over)', 
       'SE TALLENE'; 
