-- KLOKKESYNC-ASSERTIONS (kø #51 bolk 6). REN LESING — endrer ingenting.
-- Trygg å kjøre når som helst, så ofte du vil.
--
-- Hver kolonne skal være 0 (unntatt de tre siste, som er kontekst-tall).
-- Spørringen gjør kode-analysen målbar: i stedet for å tro at importveiene
-- setter riktige felter, teller den hvor mange rader som faktisk mangler dem.
--
-- HVORFOR HVER SJEKK FINNES:
--
--  1. okter_uten_kildemerking
--     Økter som har en imported_activities-rad, men ikke workouts.imported_from.
--     Slike økter er USYNLIGE for både frakoblingen (som sletter på
--     imported_from) og for AI/ML-ekskluderingen i lib/ai-training-data.ts.
--
--  2. strava_okter_uten_merking  ← ALVORLIGST
--     Strava-importer der imported_from ikke er 'strava'. Disse ville sluppet
--     INN i AI-treningsdata (Strava API Agreement § 2.14.4 forbyr det) og
--     overlevd en frakobling (§ 5.4 krever sletting innen 48t).
--     Dette måler eksponeringen fra cron-feilen som ble rettet i 59d43f8.
--
--  3. polar_okter_uten_merking
--     Samme for Polar. Polar-frakoblingen sletter på imported_from='polar'.
--
--  4. strava_samples_uten_utlop
--     Rå Strava-samples uten cache_expires_at. Opprydningsjobben
--     (/api/cron/cleanup-strava-samples) filtrerer på `cache_expires_at < now`,
--     som aldri er sann for NULL — slike rader ville ligget for alltid, i
--     strid med 7-dagers-kravet i § 7. Måler eksponeringen fra samme cron-feil.
--
--  5. polar_okter_uten_tilkobling / 6. polar_samples_uten_tilkobling
--     Polar-data som tilhører brukere UTEN polar_connections-rad = frakobling
--     som ikke ryddet ferdig. Skal alltid være 0 etter en frakobling.
--
--  7. polar_tilkoblinger / 8. polar_tokens / 9. strava_tilkoblinger
--     Kontekst. polar_tokens skal være LIK polar_tilkoblinger: hver rad vi
--     beholder skal ha et token vi faktisk kan revokere ved frakobling.

select
  -- 1
  (select count(*)
     from public.imported_activities ia
     join public.workouts w on w.id = ia.workout_id
    where w.imported_from is null)                                        as okter_uten_kildemerking,
  -- 2
  (select count(*)
     from public.imported_activities ia
     join public.workouts w on w.id = ia.workout_id
    where ia.source = 'strava'
      and w.imported_from is distinct from 'strava')                      as strava_okter_uten_merking,
  -- 3
  (select count(*)
     from public.imported_activities ia
     join public.workouts w on w.id = ia.workout_id
    where ia.source = 'polar'
      and w.imported_from is distinct from 'polar')                       as polar_okter_uten_merking,
  -- 4
  (select count(*)
     from public.workout_samples
    where source = 'strava' and cache_expires_at is null)                 as strava_samples_uten_utlop,
  -- 5
  (select count(*)
     from public.workouts w
    where w.imported_from = 'polar'
      and not exists (select 1 from public.polar_connections p
                       where p.user_id = w.user_id))                      as polar_okter_uten_tilkobling,
  -- 6
  (select count(*)
     from public.workout_samples s
    where s.source = 'polar'
      and not exists (select 1 from public.polar_connections p
                       where p.user_id = s.user_id))                      as polar_samples_uten_tilkobling,
  -- 7-9 (kontekst, ikke feil)
  (select count(*) from public.polar_connections)                         as polar_tilkoblinger,
  (select count(*) from public.polar_connections
    where access_token is not null and length(access_token) > 0)          as polar_tokens,
  (select count(*) from public.strava_connections)                        as strava_tilkoblinger;


-- ── Detaljer, kun hvis noen av tallene over er > 0 ──────────
-- Kjør denne for å se HVILKE økter det gjelder (maks 50 rader).
--
-- select ia.source, ia.external_id, ia.imported_at,
--        w.id as workout_id, w.date, w.title, w.imported_from
--   from public.imported_activities ia
--   join public.workouts w on w.id = ia.workout_id
--  where w.imported_from is null
--     or (ia.source = 'strava' and w.imported_from is distinct from 'strava')
--     or (ia.source = 'polar'  and w.imported_from is distinct from 'polar')
--  order by ia.imported_at desc
--  limit 50;
