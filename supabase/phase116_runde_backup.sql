-- ═══════════════════════════════════════════════════════════════════
-- FASE 116: RUNDE_BACKUP (Øktbyggeren bolk 4)
-- Kjøres av Sverre i prod ETTER godkjenning.
--
-- Bolk 4 lar deg BEHOLDE PLANENS RUNDER på klokkas kurve: planens
-- struktur legges på kurven, og snittpuls/maks/tid per runde LESES fra
-- samples i rundens vindu. Klokkas egne runder må da vike — og de skal
-- kunne komme tilbake NÅR SOM HELST, uten frist.
--
-- runde_backup holder klokkerundene ORDRETT (hele radinnholdet, ikke
-- id-lister) fordi radene faktisk fjernes fra økta når planens runder
-- tar plassen. Det er forskjellen fra merge_backup (fase 109), som
-- kunne nøye seg med id-er siden fletten bare flytter eierskap.
--
-- Skyting-rader er skjema-data, ikke runder — de fredes, tas aldri med
-- i backupen og fjernes aldri (samme regel som fletten følger).
--
-- RE-SYNK: kolonnen ryddes ALDRI av en re-synk. Ligger det en backup
-- der samtidig som økta igjen har klokkerunder, betyr det at klokka har
-- skrevet på nytt — appen varsler synlig i stedet for å overskrive
-- stille. Ingen trigger her: det avledes ved lesing, så synk-motoren
-- ikke må røres.
--
-- Én valgfri kolonne, ingen backfill, ingen endring av eksisterende data.
-- FØR  (målt 29. aug 2026): 899 økter · kolonnen finnes ikke
-- ETTER (forventet):        899 økter · 0 med runde_backup
-- ═══════════════════════════════════════════════════════════════════

alter table public.workouts
  add column if not exists runde_backup jsonb;

notify pgrst, 'reload schema';

-- Kontroll (lim inn resultatet i svaret):
select
  count(*)                                          as okter_totalt,
  count(*) filter (where runde_backup is not null)  as med_runde_backup
from public.workouts;
