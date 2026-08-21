-- Fase 102: SETEMODELLEN bolk 1 — datamodell for trenerlisenser
--
-- 1. subscriptions.granted_by_subscription_id (nullable, FK → subscriptions.id,
--    on delete set null): utøver på plass = vanlig athlete_pro-rad m/ status
--    active, stripe_subscription_id null og granted_by → trenerens abonnement.
-- 2. subscriptions.seat_quantity (int, default 0): speil av Stripe-quantity på
--    trenerens «Utøverplass»-linje. Skrives KUN av webhook/service-kode —
--    teller-regnestykket (inkluderte + kjøpte − i bruk) trenger tallet uten
--    å måtte spørre Stripe på hver sidelast.
-- 3. coach_seat_invites: trenerens ENE invitasjonslenke (unguessable token).
--    Regenerering = gammel rad deaktiveres, ny opprettes (gammel lenke dør).
--    RLS: KUN treneren ser sine egne rader. Token-oppslag fra lenka skjer
--    alltid via service-role i server-kode — ingen anon-policy, tokenet kan
--    aldri listes ut av en klient.
--
-- Prod-verifisert før skriving: subscriptions finnes m/ expired_at +
-- data_deletion_scheduled_at (fase 72 kjørt); granted_by_subscription_id og
-- seat_quantity mangler (400); coach_seat_invites finnes ikke (404).
-- Dagens trener-utøver-kobling (coach_invite_codes/coach_athlete_relations)
-- RØRES IKKE — kobling og plass er to separate spor.

-- ── STEG 1 — LESING (kjør først, se på resultatet) ──────────────────────────
select status, count(*) as antall
from public.subscriptions
group by status
order by status;

select count(*) as rader_totalt,
       count(stripe_subscription_id) as med_stripe_sub,
       count(*) filter (where tier = 'athlete_pro') as athlete_pro,
       count(*) filter (where tier in ('trener_basic','trener_pro')) as trener
from public.subscriptions;

-- Unike constraints/indekser på subscriptions (forventer unik user_id +
-- unik stripe_customer_id + unik stripe_subscription_id):
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'subscriptions';

-- ── STEG 2 — ENDRING (én blokk, kjøres i sin helhet) ────────────────────────
do $$
declare
  v_for int;
  v_etter int;
  v_granted int;
begin
  select count(*) into v_for from public.subscriptions;

  -- 1) Tildelt-kobling: hvem sitt trenerabonnement plassen kommer fra.
  --    on delete set null: slettes trener-raden fysisk, mister utøver-raden
  --    bare koblingen — selve tilgangsdøden styres av webhook-kaskaden +
  --    fail-closed current_period_end (bolk 2), aldri av en FK-sletting.
  alter table public.subscriptions add column if not exists granted_by_subscription_id uuid
    references public.subscriptions(id) on delete set null;
  create index if not exists subscriptions_granted_by_idx
    on public.subscriptions(granted_by_subscription_id)
    where granted_by_subscription_id is not null;

  -- 2) Speil av Stripe-quantity for «Utøverplass»-linjen (kjøpte ekstra plasser).
  alter table public.subscriptions add column if not exists seat_quantity integer not null default 0;

  -- 3) Trenerens invitasjonslenke.
  create table if not exists public.coach_seat_invites (
    id         uuid primary key default gen_random_uuid(),
    coach_id   uuid not null references auth.users(id) on delete cascade,
    token      text not null unique,
    active     boolean not null default true,
    created_at timestamptz not null default now()
  );
  -- Én AKTIV lenke per trener — regenerering deaktiverer den gamle først.
  create unique index if not exists coach_seat_invites_one_active
    on public.coach_seat_invites(coach_id)
    where active;

  alter table public.coach_seat_invites enable row level security;

  -- Treneren ser og administrerer KUN sine egne lenker. Ingen anon/andre-
  -- policy: utøver-siden av lenka resolves alltid via service-role.
  drop policy if exists "Own seat invites" on public.coach_seat_invites;
  create policy "Own seat invites"
    on public.coach_seat_invites for all
    using (coach_id = auth.uid())
    with check (coach_id = auth.uid());

  drop policy if exists "Service manages seat invites" on public.coach_seat_invites;
  create policy "Service manages seat invites"
    on public.coach_seat_invites for all
    to service_role
    using (true)
    with check (true);

  -- Grants (samme mønster som subscriptions: authenticated leser via RLS,
  -- service_role har full skriving).
  grant select, insert, update on public.coach_seat_invites to authenticated;
  grant select, insert, update, delete on public.coach_seat_invites to service_role;

  -- Assertions: migreringen endrer INGEN eksisterende rader.
  select count(*) into v_etter from public.subscriptions;
  if v_for <> v_etter then
    raise exception 'Radantall endret seg (% -> %) — skal ikke skje', v_for, v_etter;
  end if;
  select count(*) into v_granted from public.subscriptions where granted_by_subscription_id is not null;
  if v_granted <> 0 then
    raise exception '% rader fikk granted_by satt av migreringen — skal være 0', v_granted;
  end if;

  raise notice 'OK: % subscription-rader urørt, 0 granted, seat_quantity=0 overalt.', v_etter;
end $$;

notify pgrst, 'reload schema';

-- ── STEG 3 — LESING (kjør til slutt, lim inn resultatet) ────────────────────
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions'
      and column_name in ('granted_by_subscription_id','seat_quantity')) as nye_kolonner_av_2,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'coach_seat_invites') as invitetabell_finnes,
  (select count(*) from public.subscriptions) as rader_totalt,
  (select count(*) from public.subscriptions where granted_by_subscription_id is not null) as granted_rader,
  (select count(*) from public.subscriptions where seat_quantity <> 0) as med_seats;
