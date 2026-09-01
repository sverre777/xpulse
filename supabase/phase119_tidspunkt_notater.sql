-- ═══════════════════════════════════════════════════════════════════
-- FASE 119: NOTAT-PUNKTER PÅ TIDSLINJA (Øktbyggeren bolk 5)
-- Kjøres av Sverre i prod ETTER godkjenning.
--
-- Byggeren kan i dag sette LAKTAT og ERNÆRING på et tidspunkt. Bolk 5
-- legger til et fritt NOTAT-punkt: «her sprakk det», «byttet ski»,
-- «kramper i høyre lår» — knyttet til ett sekund på tidslinja.
--
-- HVORFOR EN EGEN KOLONNE, IKKE lap_notes: lap_notes er SEGMENTETS NAVN
-- (målt: tom i alle rader) og hører til en runde med start og slutt. Et
-- notat-punkt har ingen varighet og hører ikke til noen runde — det er
-- festet til et TIDSPUNKT i økta. Å presse det inn i en rad ville tvunget
-- fram en rad som ikke representerer trening, og den ville dukket opp i
-- radlista, i sonefordelingen og i tidsregnskapet.
--
-- Formen speiler laktat/ernæring slik de allerede leses av byggeren:
--   [{ "id": "<uuid>", "sek": 1830, "tekst": "byttet ski" }, …]
-- id-en er klientgenerert og stabil gjennom redigering, slik at et punkt
-- kan flyttes og slettes uten å måtte matche på tekst.
--
-- Én valgfri kolonne, ingen backfill, ingen endring av eksisterende data.
-- FØR  (målt 1. sep 2026): 936 økter · kolonnen finnes ikke
-- ETTER (forventet):       936 økter · 0 med tidspunkt_notater
-- ═══════════════════════════════════════════════════════════════════

alter table public.workouts
  add column if not exists tidspunkt_notater jsonb;

notify pgrst, 'reload schema';

-- Kontroll (lim inn resultatet i svaret):
select
  count(*)                                               as okter_totalt,
  count(*) filter (where tidspunkt_notater is not null)  as med_notater
from public.workouts;
