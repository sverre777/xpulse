-- ═══════════════════════════════════════════════════════════════════
-- FASE 117: GRUPPE-ID FOR KORTINTERVALLER (Øktbyggeren bolk 2)
-- Kjøres av Sverre i prod ETTER godkjenning.
--
-- «8 × 40/20» skal tegnes som ÉN klamme på båndet, men repetisjonene
-- må være EKTE RADER: «én flyt» krever at den som aldri åpner byggeren
-- ser og kan redigere nøyaktig de samme radene. Derfor bærer hver
-- repetisjon samme gruppe_id, og etiketten AVLEDES av gruppens rader
-- (antall + på/av) — ingen tekst å holde i synk.
--
-- Endres én repetisjon, faller etiketten tilbake til ærlig tekst
-- («7 × 40/20 + 1 avvikende») — aldri en klamme som lyver.
-- Rekkefølgen innad i gruppen er sort_order, som ellers.
--
-- Én valgfri kolonne, ingen backfill.
-- FØR  (målt 29. aug): 2 585 rader · 0 med gruppe_id
-- ETTER (forventet):   2 585 rader · 0 med gruppe_id
-- ═══════════════════════════════════════════════════════════════════

alter table public.workout_activities
  add column if not exists gruppe_id uuid;

create index if not exists workout_activities_gruppe_idx
  on public.workout_activities(gruppe_id)
  where gruppe_id is not null;

notify pgrst, 'reload schema';

-- Kontroll (lim inn resultatet i svaret):
select
  count(*)                                        as rader_totalt,
  count(*) filter (where gruppe_id is not null)   as med_gruppe
from public.workout_activities;
