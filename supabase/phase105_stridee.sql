-- Fase 105 (Stridee-klokkesynk, bolk 1): rå hendelseslager for webhooken.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent.
--
-- KORTE SETNINGER MED VILJE. Supabase SQL-editoren mangler lange innlimte
-- do-blokker (tegn faller ut midt i ord), så vernet ligger i FØR/ETTER-
-- tellingen du sammenligner manuelt — ikke i assertions som ikke kommer
-- gjennom editoren. Lim inn ett STEG om gangen.
--
-- ÉN ENDRING, ADDITIV: ny tabell public.stridee_events. Ingenting annet
-- røres. Ingen eksisterende tabell, kolonne eller policy endres.
--
-- HVORFOR ET RÅ HENDELSESLAGER:
-- Stridee gir 10 sekunder på HELE responsen. Handleren skal derfor kun
-- verifisere, dekryptere, LAGRE og ekko nonce. FIT-nedlasting og import
-- skjer etterpå, asynkront, fra denne tabellen. Det gir også gratis
-- robusthet: feiler nedlastingen, har vi fortsatt hendelsen og kan prøve
-- igjen uten å be Stridee sende på nytt.
--
-- DATAMODELL-VALG (rapporteres):
--  · webhook_id (text, UNIQUE, not null) = id-en fra det SIGNERTE headeret,
--    ikke HTTP-kopien. Unik fordi den er dedupe-nøkkelen og er stabil på
--    tvers av Stridee sine retries. Konflikt her er IKKE en feil — det er en
--    retry, og handleren skal fortsatt ekko nonce.
--  · payload (jsonb, not null) = den DEKRYPTERTE hendelsen. Vi lagrer aldri
--    ciphertext: den er verdiløs uten nøkkelen, og nøkkelen roteres.
--  · account_id (text, NULLABLE) = Stridees konto-id. Nullable fordi den
--    ligger inne i ciphertext, og en hendelsestype vi ikke kjenner kan
--    mangle den. Koblingen account_id → user_id kommer i bolk 2.
--  · event_type (text, NULLABLE) = `type` fra klarteksten. ALLE
--    hendelsestyper treffer samme endepunkt, så vi lagrer alt og filtrerer
--    ved prosessering. Ikke anta at alt er aktiviteter.
--  · processed_at / process_error / attempts: for bolk 4. Tatt med NÅ så vi
--    slipper en ny migrering på en tabell som ennå er tom.
--  · Ingen user_id-kolonne. Hendelsen ankommer FØR vi vet hvem den gjelder;
--    oppslaget skjer ved prosessering. En FK her ville blokkert lagringen av
--    hendelser for kontoer vi ikke har koblet ennå — og det er nettopp de vi
--    trenger å se når noe er galt.
--
-- SIKKERHET: kun service_role. Webhooken har ingen bruker-session, og ingen
-- utøver skal lese rå leveranser. RLS er PÅ med null policyer for
-- authenticated — det gir deny-by-default.
--
-- SLETTING: Stridee beholder hendelsene i 30 dager. Vi speiler det i bolk 4
-- med en opprydding; ingen jobb settes opp her.


-- ══ STEG 1 — FØR-TELLING (ren lesing, ingen endring) ═══════════════════
-- Noter tallene. STEG 3 er samme query.

select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'stridee_events') as tabell_finnes,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'stridee_events') as antall_kolonner,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'stridee_events') as antall_policyer;


-- ══ STEG 2 — MIGRERINGEN (ett statement om gangen) ═════════════════════

create table if not exists public.stridee_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null,
  event_type text,
  account_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  process_error text,
  attempts integer not null default 0
);

create unique index if not exists stridee_events_webhook_id_key
  on public.stridee_events (webhook_id);

create index if not exists stridee_events_ubehandlet_idx
  on public.stridee_events (received_at)
  where processed_at is null;

create index if not exists stridee_events_account_idx
  on public.stridee_events (account_id);

alter table public.stridee_events enable row level security;

-- Kun service_role. Ingen policy for authenticated = deny by default.
drop policy if exists stridee_events_service on public.stridee_events;

create policy stridee_events_service on public.stridee_events
  for all to service_role using (true) with check (true);


-- ══ STEG 3 — ETTER-TELLING (samme query som STEG 1) ════════════════════
-- Ventet: tabell_finnes 0 → 1, antall_kolonner 0 → 9, antall_policyer 0 → 1.

select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'stridee_events') as tabell_finnes,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'stridee_events') as antall_kolonner,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'stridee_events') as antall_policyer;


-- ══ FAKTISK KJØRING ════════════════════════════════════════════════════
-- KJØRT I PROD 2026-08-26 av Sverre. Alle tre steg gikk gjennom.
--
--   STEG 1:  tabell_finnes 0  antall_kolonner 0  antall_policyer 0
--   STEG 2:  success
--   STEG 3:  tabell_finnes 1  antall_kolonner 9  antall_policyer 1
--
-- Tallene er nøyaktig de ventede. Tabellen finnes, har alle ni kolonnene, og
-- har én policy (service_role). Ingen policy for authenticated = deny by
-- default, som tiltenkt.
