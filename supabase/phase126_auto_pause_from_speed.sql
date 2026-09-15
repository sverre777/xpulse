-- Fase 126: STILLESTAND TIL PAUSE (Sverre 15. sep 2026) - fase A.
-- Én ny kolonne på profiles, samme mønster som notify_email_* (fase 34):
--   auto_pause_from_speed boolean not null default false
-- PÅ = hver NY klokkesynket økt med fartsdata får pause-rader ved import.
-- AV (standard) = ingenting skjer av seg selv; knappen på økta er eneste vei.
--
-- Idempotent (add column if not exists). Ingen datarader røres: alle
-- eksisterende profiler får false via default - innstillingen gjelder framover.
-- Kjøres av Sverre i prod. CC kjører ALDRI SQL selv (regel 35).

-- ── FØR: antall kolonner og antall rader i profiles ───────────────────────
select 'FØR' as steg,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles') as antall_kolonner,
       (select count(*) from public.profiles) as antall_rader,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = 'auto_pause_from_speed') as kolonnen_finnes;

-- ── ENDRINGEN ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists auto_pause_from_speed boolean not null default false;

comment on column public.profiles.auto_pause_from_speed is
  'Fase 126: gjør stillestand (fart < terskel, klokka går) om til pause-rader automatisk ved import av klokkesynkede økter med fartsdata. Gjelder framover; rører aldri eksisterende økter.';

-- ── ETTER: samme tellinger ─────────────────────────────────────────────────
select 'ETTER' as steg,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles') as antall_kolonner,
       (select count(*) from public.profiles) as antall_rader,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = 'auto_pause_from_speed') as kolonnen_finnes;

-- ── ASSERTIONS (som SELECT - alle skal gi OK) ──────────────────────────────
select 'kolonnen finnes, boolean, not null, default false' as sjekk,
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'auto_pause_from_speed'
            and data_type = 'boolean' and is_nullable = 'NO'
            and column_default = 'false')
         then 'OK' else 'FEIL' end as resultat
union all
select 'alle eksisterende profiler står med false (ingen rader rørt)',
       case when (select count(*) from public.profiles where auto_pause_from_speed) = 0
         then 'OK' else 'FEIL' end
union all
select 'antall rader uendret (FØR = ETTER, sammenlign selv over)',
       'SE TALLENE';
