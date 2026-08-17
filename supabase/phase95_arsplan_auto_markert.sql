-- Fase 95 (SF-2, datafiksen): nullstiller de to årsplan-øktene som ble
-- auto-markert som gjennomført uten at noe ble ført.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Ingen temp-tabeller.
--
-- Erstatter phase93, som var skrevet for fremtidige rader. STEG 1 der viste at
-- det ikke finnes noen: alle tre feilmarkerte ligger i fortiden. phase93-fila
-- er slettet så ingen kjører den ved en feil.
--
-- ══ HVER ENKELT RAD, FORKLART ══════════════════════════════
--
-- Årsaken (kartlagt i SF-2): workouts.is_completed hadde default TRUE, og
-- årsplanen satte aldri feltet. Koden er rettet, og fase 94 snudde defaulten.
-- Disse tre er restene fra før.
--
--  51a7e86d-…24b4d  15.08.2026  Tanumsløpet DNF   → RØRES IKKE
--      2 aktiviteter og 1 konkurranseresultat er ført. Økta er faktisk
--      gjennomført (DNF er noe man registrerer ETTER et løp), og skal
--      beholde statusen sin.
--
--  ed3221cb-…8b876  06.05.2026  testløp test      → NULLSTILLES
--      Ingen varighet, ingen aktiviteter, ingen konkurransedata. Tomt skall.
--
--  9871092b-…13f70  01.05.2026  NM fellesstart    → NULLSTILLES
--      Ingen varighet, ingen aktiviteter, ingen konkurransedata. Tomt skall.
--
-- Nullstilling betyr is_completed = false og completed_at = null — samme
-- tilstand som «marker som ikke gjennomført» i appen gir. Ingenting slettes;
-- øktene ligger fortsatt i planen og kan markeres når som helst.


-- ══ STEG 1 — FØR-TILSTAND (ren lesing) ═════════════════════
select
  (select count(*) from public.workouts where is_completed)                  as gjennomfort_totalt,
  (select count(*) from public.workouts
    where id in ('ed3221cb-0fd9-4568-8bb1-05c47768b876',
                 '9871092b-7bfd-4e50-9607-1d07f6713f70')
      and is_completed)                                                      as maal_markert_na,
  (select is_completed from public.workouts
    where id = '51a7e86d-da3e-430f-a773-2333bec24b4d')                       as tanumslopet_uendret;


-- ══ STEG 2 — RETTINGEN (ett statement, én transaksjon) ═════
do $$
declare
  b_total    bigint;
  b_maal     bigint;
  a_total    bigint;
  a_maal     bigint;
  n_endret   bigint;
  tanum_for  boolean;
  tanum_etter boolean;
begin
  select count(*) into b_total from public.workouts where is_completed;
  select count(*) into b_maal from public.workouts
   where id in ('ed3221cb-0fd9-4568-8bb1-05c47768b876',
                '9871092b-7bfd-4e50-9607-1d07f6713f70')
     and is_completed;
  select is_completed into tanum_for from public.workouts
   where id = '51a7e86d-da3e-430f-a773-2333bec24b4d';

  raise notice 'FØR: % gjennomførte totalt · % av målgruppa markert · Tanumsløpet=%',
    b_total, b_maal, tanum_for;

  update public.workouts
  set is_completed = false,
      completed_at = null,
      updated_at = now()
  where id in ('ed3221cb-0fd9-4568-8bb1-05c47768b876',
               '9871092b-7bfd-4e50-9607-1d07f6713f70')
    and is_completed;

  get diagnostics n_endret = row_count;

  select count(*) into a_total from public.workouts where is_completed;
  select count(*) into a_maal from public.workouts
   where id in ('ed3221cb-0fd9-4568-8bb1-05c47768b876',
                '9871092b-7bfd-4e50-9607-1d07f6713f70')
     and is_completed;
  select is_completed into tanum_etter from public.workouts
   where id = '51a7e86d-da3e-430f-a773-2333bec24b4d';

  raise notice 'ETTER: % gjennomførte totalt · % igjen i målgruppa · Tanumsløpet=% · % rader endret',
    a_total, a_maal, tanum_etter, n_endret;

  -- 1. Begge målradene er nullstilt.
  if a_maal <> 0 then
    raise exception 'Verifisering feilet: % av målradene står fortsatt som gjennomført', a_maal;
  end if;

  -- 2. Differansen er NØYAKTIG de to — ingenting annet ble av-markert.
  if b_total - a_total <> b_maal then
    raise exception 'Verifisering feilet: totalen falt med %, forventet %', b_total - a_total, b_maal;
  end if;
  if n_endret <> b_maal then
    raise exception 'Verifisering feilet: % rader endret, forventet %', n_endret, b_maal;
  end if;

  -- 3. Tanumsløpet er urørt — den ble faktisk gjennomført.
  if tanum_etter is distinct from tanum_for then
    raise exception 'Verifisering feilet: Tanumsløpet endret status (%→%)', tanum_for, tanum_etter;
  end if;

  raise notice 'OK: % tomme årsplan-økter nullstilt. Tanumsløpet og alt annet urørt.', n_endret;
  perform pg_notify('pgrst', 'reload schema');
end $$;


-- ══ STEG 3 — ETTER-TILSTAND (samme query som STEG 1) ═══════
-- Forventet: maal_markert_na = 0 · gjennomfort_totalt redusert med 2 ·
-- tanumslopet_uendret = true.
select
  (select count(*) from public.workouts where is_completed)                  as gjennomfort_totalt,
  (select count(*) from public.workouts
    where id in ('ed3221cb-0fd9-4568-8bb1-05c47768b876',
                 '9871092b-7bfd-4e50-9607-1d07f6713f70')
      and is_completed)                                                      as maal_markert_na,
  (select is_completed from public.workouts
    where id = '51a7e86d-da3e-430f-a773-2333bec24b4d')                       as tanumslopet_uendret;


-- ── TILBAKERULLING ─────────────────────────────────────────
--   update public.workouts set is_completed = true, updated_at = now()
--    where id in ('ed3221cb-0fd9-4568-8bb1-05c47768b876',
--                 '9871092b-7bfd-4e50-9607-1d07f6713f70');
-- completed_at var backfilt av fase 67b og kan ikke gjenopprettes eksakt —
-- men den var uansett ikke satt av deg.
