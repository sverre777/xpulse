/* Fase 129: SPORBARHET - «sist endret av trener» på økta. */ 
/* To kolonner på workouts: */ 
/*   sist_endret_av_trener_id uuid   -> auth.users */ 
/*   sist_endret_av_trener_at timestamptz */ 
/* */ 
/* HVORFOR BARE TO KOLONNER, OG IKKE FLERE: */ 
/* */ 
/* Historikken bor i coach_audit_log, som ALLEREDE finnes (fase 26) og */ 
/* allerede har alt som trengs: coach_id, athlete_id, action_type, */ 
/* entity_type, entity_id og en details-jsonb som kan bære gammel og ny */ 
/* verdi. RLS er også på plass - «Athlete reads own logs» gjør at utøveren */ 
/* kan lese sine egne rader, og innsettingen krever en aktiv relasjon. */ 
/* Loggen trenger altså INGEN endring. */ 
/* */ 
/* Det som mangler er hjelpefeltet: uten det måtte hver visning av en økt */ 
/* slå opp i loggen for å svare på «har noen andre rørt denne?». Med to */ 
/* kolonner på raden er svaret der økta er, og loggen leses bare når */ 
/* utøveren faktisk spør «hva ble endret?». */ 
/* */ 
/* workouts har fra før created_by_coach_id (fase 26). Den sier hvem som */ 
/* OPPRETTET økta og er noe annet: en økt utøveren laget selv, men som */ 
/* treneren siden rettet i, har created_by_coach_id NULL og de nye */ 
/* feltene satt. Begge trengs. */ 
/* */ 
/* MASKINFELT: skjemaet setter dem aldri. De skrives server-side når en */ 
/* trener lagrer for en utøver, og må derfor også inn i */ 
/* SkjulteAktivitetsFelter-mønsteret i saveWorkout (som auto_pause i fase */ 
/* 127), ellers nulles de ved neste lagring. */ 
/* */ 
/* Ingen datarader røres: alle eksisterende økter får NULL, altså «ingen */ 
/* trener har rørt denne», som er sant for alt som ligger der i dag. */ 
/* KOLONNENAVN VERIFISERT mot phase2_schema.sql og phase26_coach_panel.sql */ 
/* (workouts.id, workouts.user_id, created_by_coach_id) FØR pglast - */ 
/* pglast validerer syntaks, ikke skjema. */ 
/* Kjøres av Sverre i prod. CC kjører ALDRI SQL selv (regel 35). */ 

/* ALT I ÉN TRANSAKSJON: feiler ett steg, rulles ALT tilbake. */ 
begin; 

/* ── FØR: kolonner og rader ─────────────────────────────────────────────── */ 
select 'FØR' as steg, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'workouts') as antall_kolonner, 
       (select count(*) from public.workouts) as antall_rader, 
       (select count(*) from public.coach_audit_log) as rader_i_loggen; 

/* ── ENDRINGEN ───────────────────────────────────────────────────────────── */ 
alter table public.workouts 
  add column if not exists sist_endret_av_trener_id uuid references auth.users(id) on delete set null; 

alter table public.workouts 
  add column if not exists sist_endret_av_trener_at timestamptz; 

comment on column public.workouts.sist_endret_av_trener_id is 
  'Fase 129: treneren som sist lagret denne økta på vegne av utøveren. Maskinfelt - skjemaet setter den aldri. NULL = ingen trener har rørt økta. Noe ANNET enn created_by_coach_id, som sier hvem som opprettet den. Hva som ble endret står i coach_audit_log.'; 

comment on column public.workouts.sist_endret_av_trener_at is 
  'Fase 129: tidspunktet for den endringen. Sammen med id-en er dette nok til å vise «Erik endret denne 3. mars» uten å slå opp i loggen.'; 

/* Utøverens spørsmål er «hvilke av MINE økter har treneren rørt?». */ 
/* Delvis indeks: koster ingenting på de øktene ingen trener har rørt. */ 
create index if not exists workouts_sist_endret_av_trener_idx 
  on public.workouts (user_id, sist_endret_av_trener_at desc) 
  where sist_endret_av_trener_id is not null; 

/* ── ETTER: samme tellinger ─────────────────────────────────────────────── */ 
select 'ETTER' as steg, 
       (select count(*) from information_schema.columns 
         where table_schema = 'public' and table_name = 'workouts') as antall_kolonner, 
       (select count(*) from public.workouts) as antall_rader, 
       (select count(*) from public.coach_audit_log) as rader_i_loggen; 

/* ── TRE ASSERTIONS OG ÉN AVLESNING ─────────────────────────────────────── */ 
select 'begge kolonnene finnes, med riktig type' as sjekk, 
       case when ( 
         select count(*) from information_schema.columns 
          where table_schema = 'public' and table_name = 'workouts' 
            and ((column_name = 'sist_endret_av_trener_id' and data_type = 'uuid') 
              or (column_name = 'sist_endret_av_trener_at' and data_type = 'timestamp with time zone')) 
       ) = 2 then 'OK' else 'FEIL' end as resultat 
union all 
select 'ingen eksisterende økt er merket endret av trener', 
       case when (select count(*) from public.workouts 
                   where sist_endret_av_trener_id is not null 
                      or sist_endret_av_trener_at is not null) = 0 
         then 'OK' else 'FEIL' end 
union all 
select 'den delvise indeksen finnes', 
       case when exists ( 
         select 1 from pg_indexes 
          where schemaname = 'public' and tablename = 'workouts' 
            and indexname = 'workouts_sist_endret_av_trener_idx') 
         then 'OK' else 'FEIL' end 
union all 
select 'AVLESNING: radtall uendret i workouts OG i loggen (FØR = ETTER over)', 
       'SE TALLENE'; 

commit; 
