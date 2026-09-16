/* Fase 128: STILLESTAND TIL PAUSE - fase E, markørene. */ 
/* To kolonner: */ 
/*   imported_activities.auto_pause_behandlet boolean not null default false */ 
/*   profiles.auto_pause_fra_dato timestamptz null */ 
/* */ 
/* HVORFOR TO OG IKKE ÉN: */ 
/* */ 
/* 1) «HAR AUTO-STEGET KJØRT FOR DENNE ØKTA?» kan ikke utledes av at det */ 
/* finnes auto_pause-rader - det er nettopp dem «angre» fjerner. Uten en */ 
/* egen markør ville neste kjøring laget dem på nytt, og angre vært en */ 
/* knapp som ikke virker. Markøren legges på imported_activities og ikke */ 
/* på workouts, fordi det er DEN raden som betyr «økta er ferdig */ 
/* importert»: den finnes for alle fire importveiene (Strava-action, */ 
/* Strava-cron, .fit/Stridee, Polar), den har unique (user_id, source, */ 
/* external_id), og den skrives sist - etter at økt, rader og samples er */ 
/* på plass. */ 
/* */ 
/* 2) «GJELDER FRAMOVER» (avgjort av Sverre) kan ikke utledes av selve */ 
/* bryteren. Slår utøveren den på i dag, ligger det alt hundrevis av */ 
/* ubehandlede rader i hovedboka, og de skulle blitt tatt med */ 
/* tilbakevirkende kraft. auto_pause_fra_dato settes i det bryteren slås */ 
/* PÅ, og steget ser bare på rader som er importert etter det. Slås */ 
/* bryteren av, står datoen - slås den på igjen, flyttes den fram. */ 
/* */ 
/* Ingen datarader røres. Alle eksisterende ledd i hovedboka får false, */ 
/* altså «ikke behandlet» - og siden ingen har auto_pause_fra_dato, blir */ 
/* ingen av dem plukket opp. Gamle økter står urørt, som bestilt. */ 
/* Kjøres av Sverre i prod. CC kjører ALDRI SQL selv (regel 35). */ 

/* ALT I ÉN TRANSAKSJON: feiler ett steg, rulles ALT tilbake. Uten dette */ 
/* ville de to kolonnene blitt lagt til mens indeksen og alle assertions */ 
/* uteble - en halv migrering som ser ut som en hel. */ 
begin; 

/* ── FØR: kolonner og rader i de to tabellene ───────────────────────────── */ 
select 'FØR' as steg, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'imported_activities') as kol_hovedbok, 
       (select count(*) from public.imported_activities) as rader_hovedbok, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'profiles') as kol_profiles, 
       (select count(*) from public.profiles) as rader_profiles; 

/* ── ENDRINGEN ───────────────────────────────────────────────────────────── */ 
alter table public.imported_activities 
  add column if not exists auto_pause_behandlet boolean not null default false; 

comment on column public.imported_activities.auto_pause_behandlet is 
  'Fase 128: auto-steget «gjør stillestand til pause» har sett på denne importen. Settes ÉN gang, også når steget ikke fant noe. Overlever at utøveren angrer radene - ellers ville de blitt laget på nytt.'; 

alter table public.profiles 
  add column if not exists auto_pause_fra_dato timestamptz; 

comment on column public.profiles.auto_pause_fra_dato is 
  'Fase 128: tidspunktet auto_pause_from_speed sist ble slått PÅ. Auto-steget ser bare på importer etter dette - innstillingen gjelder framover og rører aldri økter som allerede lå der.'; 

/* Steget spør: mine ubehandlede importer etter datoen. Delvis indeks, så */ 
/* den spørringen er billig uten å koste noe på de behandlede radene. */ 
/* KOLONNEN HETER imported_at, ikke created_at - verifisert mot */ 
/* phase50_klokkesync.sql:36-44. (Første utkast brukte created_at og ville */ 
/* dødd på 42703; pglast validerer syntaks, ikke skjema.) */ 
create index if not exists imported_activities_auto_pause_ubehandlet_idx 
  on public.imported_activities (user_id, imported_at) 
  where not auto_pause_behandlet; 

/* ── ETTER: samme tellinger ─────────────────────────────────────────────── */ 
select 'ETTER' as steg, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'imported_activities') as kol_hovedbok, 
       (select count(*) from public.imported_activities) as rader_hovedbok, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'profiles') as kol_profiles, 
       (select count(*) from public.profiles) as rader_profiles; 

/* ── TRE ASSERTIONS OG ÉN AVLESNING ─────────────────────────────────────── */ 
select 'markøren finnes, boolean, not null, default false' as sjekk, 
       case when exists ( 
         select 1 from information_schema.columns 
          where table_schema = 'public' and table_name = 'imported_activities' 
            and column_name = 'auto_pause_behandlet' 
            and data_type = 'boolean' and is_nullable = 'NO' 
            and column_default = 'false') 
         then 'OK' else 'FEIL' end as resultat 
union all 
select 'ingen import er merket behandlet, og ingen profil har fra-dato', 
       case when (select count(*) from public.imported_activities where auto_pause_behandlet) = 0 
             and (select count(*) from public.profiles where auto_pause_fra_dato is not null) = 0 
         then 'OK' else 'FEIL' end 
union all 
select 'den delvise indeksen finnes', 
       case when exists ( 
         select 1 from pg_indexes 
          where schemaname = 'public' and tablename = 'imported_activities' 
            and indexname = 'imported_activities_auto_pause_ubehandlet_idx') 
         then 'OK' else 'FEIL' end 
union all 
select 'AVLESNING: radtall uendret i begge tabeller (FØR = ETTER over)', 
       'SE TALLENE'; 

commit; 
