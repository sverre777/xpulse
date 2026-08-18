-- SF-9, STEG 2 + 3: REN LESING. Ingen endringer, ingen migrering.
--
-- KJØR ÉN OG ÉN. Supabase-editoren viser bare siste resultatsett når man
-- kjører flere statements samtidig. Et forsøk på å samle alt i én spørring
-- med CTE-er og union ble avvist av editoren to ganger — hold dem små.
--
-- Spørring 1 er den eneste som blokkerer. Resten er kontekst.


-- ══ 1. DEN AVGJØRENDE: finnes det CHECK-constraints på workouts? ══
-- 0 rader  → ingen CHECK i det hele tatt, kolonnen er fri tekst, klar.
-- rader    → se om noen av dem nevner imported_from. Gjør de det,
--            trengs en migrering før nye 'fit_*'-verdier kan settes inn.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.workouts'::regclass and contype = 'c';


-- ══ 2. Er kolonnen en egen type (enum) i stedet? ══
-- En enum ville stoppe nye verdier like effektivt som en CHECK, men vises
-- ikke i spørring 1. 'text' = fri tekst. 'USER-DEFINED' = egen type.
select data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'workouts'
  and column_name = 'imported_from';


-- ══ 3. Alle verdier som finnes i dag ══
-- Kjørt 2026-08-18: strava 486 · (null) 237. Ingen 'fit'-rader i det hele
-- tatt — ingen .fit-opplasting har noen gang fullført i prod.
select coalesce(imported_from, '(null)') as imported_from,
       count(*) as antall,
       min(date) as eldste,
       max(date) as nyeste
from public.workouts
group by 1
order by antall desc;


-- ══ 4. Kun .fit-radene ══
-- FORVENTNING: 0 rader. Dukker det opp 'fit_garmin' eller 'fit_polar' her,
-- er analysen av at tabellen aldri har fyrt feil, og den må tas på nytt.
select imported_from, count(*) as antall
from public.workouts
where imported_from like 'fit%'
group by 1
order by antall desc;


-- ══ 5. Er produsenten lagret i provenance-tabellen likevel? ══
-- external_id for .fit skal være 'fit_<sha256-prefiks av fila>' — en
-- filhash, ikke et merke. Er den det, er backfill umulig uansett.
select source, count(*) as antall, min(external_id) as eksempel_external_id
from public.imported_activities
where source = 'fit_upload'
group by 1;
