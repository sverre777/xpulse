-- Fase 106 (Stridee bolk 2): koblingen Stridee-konto → X-PULSE-bruker.
--
-- HVORFOR TRE UNIKE CONSTRAINTS OG IKKE ÉN:
-- «utøver A får utøver B sine data» skal være UMULIG i skjemaet, ikke bare
-- usannsynlig i koden. Derfor er alle tre retninger unike:
--   · stridee_user_id  — én Stridee-bruker kan aldri peke på to av våre
--   · user_id          — én X-PULSE-bruker har nøyaktig én Stridee-lenke
--   · external_user_id — ingen id kan gjenbrukes ved et uhell
-- En feil i prosesseringen gir da en constraint-feil vi ser, ikke en stille
-- sammenblanding av to menneskers treningsdata.
--
-- external_user_id er VÅR ugjennomsiktige id, ikke Supabase-UUID-en.
-- Supabase-uuid-en er primærnøkkel i hele appen og står i RLS-policyer og
-- URL-er; den skal ikke ut til en tredjepart vi prøver ut. Ved sletting hos
-- dem blir id-en gjenbrukbar med ny stridee_user_id, og da roterer vi vår.
--
-- MODELLEN (deres, verifisert i /docs/connections 26. aug):
--   konto      = personen      → stridee_user_id ↔ vår external_user_id
--   connection = én klokke     → connection_id + provider + status
--   To klokker = to connections under samme konto.
--
-- POLAR ER IKKE MED. Stridee tilbyr polar, men vi har Polar direkte via
-- AccessLink. To veier inn for samme klokke ville gitt doble økter.
--
-- SKJEMA-REGELEN: lest mot PROD 26. aug, ikke mot migreringsfilene.
-- stridee_events har i dag: id, webhook_id, event_type, account_id, payload,
-- received_at, processed_at, process_error, attempts. Ingen av de nye
-- tabellene finnes. account_id beholdes URØRT (pingens historikk).


-- ══ STEG 1 — FØR-TELLING (ren lesing, ingen endring) ═══════════════════
-- Noter tallene. STEG 3 er samme query.

select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='stridee_link') as link_finnes,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='stridee_connections') as conn_finnes,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='stridee_events'
       and column_name='stridee_user_id') as events_har_stridee_user_id,
  (select count(*) from public.stridee_events) as events_rader;


-- ══ STEG 2 — MIGRERINGEN ═══════════════════════════════════════════════

-- ── Lenken: én rad per bruker. Eier identitets-koblingen. ──────────────
create table if not exists public.stridee_link (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- VÅR ugjennomsiktige id. Roteres ved account.deleted.
  external_user_id uuid not null default gen_random_uuid(),
  -- DERES id for personen. Null før første kobling og etter sletting —
  -- da er raden ledig for en ny lenke uten å bryte unikheten.
  stridee_user_id text,
  status text not null default 'pending'
    check (status in ('pending','aktiv','reauth_required','frakoblet','slettet')),
  koblet_at timestamptz,
  oppdatert_at timestamptz not null default now(),
  opprettet_at timestamptz not null default now()
);

-- De tre garantiene. stridee_user_id er unik der den er satt; flere NULL er
-- lov, slik at slettede lenker ikke blokkerer hverandre.
create unique index if not exists stridee_link_user_id_key
  on public.stridee_link (user_id);
create unique index if not exists stridee_link_external_user_id_key
  on public.stridee_link (external_user_id);
create unique index if not exists stridee_link_stridee_user_id_key
  on public.stridee_link (stridee_user_id) where stridee_user_id is not null;

-- ── Connections: én rad per klokke-autorisasjon. ───────────────────────
create table if not exists public.stridee_connections (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.stridee_link(id) on delete cascade,
  -- Deres connection-id. Unik: samme autorisasjon skal aldri ligge to ganger.
  connection_id text not null,
  -- Polar utelatt med vilje — vi har den direkte via AccessLink.
  provider text not null check (provider in ('garmin','coros','wahoo','zepp')),
  status text not null default 'aktiv'
    check (status in ('aktiv','reauth_required','frakoblet')),
  koblet_at timestamptz not null default now(),
  oppdatert_at timestamptz not null default now()
);

create unique index if not exists stridee_connections_connection_id_key
  on public.stridee_connections (connection_id);
create index if not exists stridee_connections_link_idx
  on public.stridee_connections (link_id);
-- Varselet på klokkesynk-sida slår opp på denne.
create index if not exists stridee_connections_reauth_idx
  on public.stridee_connections (link_id) where status = 'reauth_required';

-- ── stridee_events: subjektet hendelsene FAKTISK bærer. ────────────────
-- /docs/webhooks sier account_id, /docs/events sier user_id. Vi målte den
-- leverte pingen: den har verken — envelopen er id/type/created/webhook_id/
-- nonce/data, og /docs/events er den som stemmer. Ekte hendelser bærer
-- stridee_user_id. account_id beholdes urørt for pingens historikk.
alter table public.stridee_events
  add column if not exists stridee_user_id text;

create index if not exists stridee_events_stridee_user_idx
  on public.stridee_events (stridee_user_id) where stridee_user_id is not null;

-- ── account.deleted i ÉN operasjon. ────────────────────────────────────
-- Halvveis frakoblet er verre enn ikke frakoblet: da tror utøveren at klokka
-- synker mens den ikke gjør det. Funksjonen er atomisk, og roterer vår
-- external_user_id fordi deres side gjør den gjenbrukbar etter sletting.
create or replace function public.stridee_marker_slettet(p_stridee_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
begin
  select id into v_link_id
    from public.stridee_link
   where stridee_user_id = p_stridee_user_id;
  if v_link_id is null then
    return false;                      -- ukjent konto: ingenting å rydde
  end if;

  update public.stridee_connections
     set status = 'frakoblet', oppdatert_at = now()
   where link_id = v_link_id;

  update public.stridee_link
     set status = 'slettet',
         stridee_user_id = null,       -- frigjør unikheten for en ny lenke
         external_user_id = gen_random_uuid(),   -- rotasjon, se toppen
         oppdatert_at = now()
   where id = v_link_id;

  return true;
end;
$$;

revoke all on function public.stridee_marker_slettet(text) from public, anon, authenticated;
grant execute on function public.stridee_marker_slettet(text) to service_role;

-- ── RLS: brukeren ser sin egen lenke, service_role skriver. ────────────
alter table public.stridee_link enable row level security;
alter table public.stridee_connections enable row level security;

drop policy if exists "Egen stridee-lenke leses" on public.stridee_link;
create policy "Egen stridee-lenke leses"
  on public.stridee_link for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Egne stridee-connections leses" on public.stridee_connections;
create policy "Egne stridee-connections leses"
  on public.stridee_connections for select
  to authenticated
  using (exists (
    select 1 from public.stridee_link l
     where l.id = link_id and l.user_id = auth.uid()
  ));

-- Ingen insert/update/delete for authenticated: all skriving går gjennom
-- webhook-prosesseringen med service_role. En bruker skal aldri kunne
-- skrive sin egen kobling — det er nettopp den som avgjør hvem som eier
-- hvilke treningsdata.
grant select on public.stridee_link to authenticated;
grant select on public.stridee_connections to authenticated;
grant select, insert, update, delete on public.stridee_link to service_role;
grant select, insert, update, delete on public.stridee_connections to service_role;


-- ══ ASSERTIONS — feiler høyt hvis noe ikke ble som forutsatt ═══════════
do $$
declare
  v_unike int;
  v_policyer int;
  v_events int;
begin
  select count(*) into v_unike from pg_indexes
   where schemaname='public' and tablename='stridee_link'
     and indexname in ('stridee_link_user_id_key',
                       'stridee_link_external_user_id_key',
                       'stridee_link_stridee_user_id_key');
  if v_unike <> 3 then
    raise exception 'Ventet 3 unike indekser på stridee_link, fant %', v_unike;
  end if;

  select count(*) into v_policyer from pg_policies
   where schemaname='public' and tablename in ('stridee_link','stridee_connections');
  if v_policyer < 2 then
    raise exception 'RLS-policyene mangler (fant %)', v_policyer;
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='stridee_events'
                    and column_name='stridee_user_id') then
    raise exception 'stridee_events.stridee_user_id ble ikke lagt til';
  end if;

  -- account_id skal være URØRT.
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='stridee_events'
                    and column_name='account_id') then
    raise exception 'account_id forsvant — den skulle stå urørt';
  end if;

  select count(*) into v_events from public.stridee_events;
  raise notice 'OK: 3 unike indekser, % policyer, stridee_user_id lagt til, % event-rader urørt.',
    v_policyer, v_events;
end $$;

notify pgrst, 'reload schema';


-- ══ STEG 3 — ETTER-TELLING (samme query som STEG 1) ════════════════════

select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='stridee_link') as link_finnes,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='stridee_connections') as conn_finnes,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='stridee_events'
       and column_name='stridee_user_id') as events_har_stridee_user_id,
  (select count(*) from public.stridee_events) as events_rader;
