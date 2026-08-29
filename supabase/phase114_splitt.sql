-- ═══════════════════════════════════════════════════════════════════
-- FASE 114: SPLITT AV RUNDE/PAUSE («Legg til detaljer» bolk 4)
-- Kjøres av Sverre i prod ETTER godkjenning, FØR bolk 4-koden deployes.
--
-- Mekanikk (godkjent 29. aug): plasseres et skytevindu INNI en
-- eksisterende runde/pause, splittes raden i data — originalen beholdes
-- og kortes til delen før skytingen; skyting + rest (pause/aktiv pause)
-- opprettes som nye rader. split_backup skrives på originalen FØR noen
-- endring (fase 109-mønsteret), og angre gjenoppretter originalen FULLT
-- (alle felter, også de splitten ikke rørte) + sletter barna på id.
--
-- To valgfrie kolonner:
--   split_parent_id — barna peker på originalen. on delete set null:
--     slettes originalen manuelt, består barna som vanlige rader, men
--     angre-muligheten faller bort (backupen bodde på originalen).
--   split_backup    — originalens fulle rad-felter, skrevet FØR endring.
--     Ikke-null = raden er en splittet original (angre mulig).
--
-- Splitt av en allerede-splittet rad (original m/ split_backup ELLER et
-- splitt-barn) AVVISES med ærlig melding i appen (regel 22) — angre
-- først, splitt så på nytt. Ingen nestede backuper.
--
-- FØR (målt 29. aug): 2 569 rader i workout_activities.
-- ETTER forventet:    2 569 rader · 0 med split_parent_id · 0 med
--                     split_backup (ingen backfill — kolonnene er tomme
--                     til første splitt gjøres i appen).
-- ═══════════════════════════════════════════════════════════════════

alter table public.workout_activities
  add column if not exists split_parent_id uuid
    references public.workout_activities(id) on delete set null;

alter table public.workout_activities
  add column if not exists split_backup jsonb;

create index if not exists workout_activities_split_parent_idx
  on public.workout_activities(split_parent_id)
  where split_parent_id is not null;

notify pgrst, 'reload schema';

-- Kontroll (lim inn resultatene i svaret):
select
  count(*)                                        as rader_totalt,
  count(*) filter (where split_parent_id is not null) as med_parent,
  count(*) filter (where split_backup is not null)    as med_backup
from public.workout_activities;
