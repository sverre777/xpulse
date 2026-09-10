-- Phase 125 — invitasjonskoder: oppslag og merking flyttes til RPC,
-- trener-policyene på tabellen fjernes.
--
-- HULLET (eldre enn tidssone- og registreringsfiksene):
-- phase39_rls_audit_patches.sql:58 «Coach looks up code» er en SELECT-policy
-- UTEN filter på koden - den er kun gatet på has_coach_role = true. Appen
-- filtrerer riktignok alltid på .eq('code', ...), men RLS er det som gjelder:
-- et rått PostgREST-kall
--     GET /rest/v1/coach_invite_codes?select=*
-- gir enhver innlogget bruker med has_coach_role hele lista over ubrukte,
-- ikke-utløpte koder. has_coach_role velges selv ved registrering og krever
-- ingen tier - i prod har 11 profiler flagget, bare 5 har aktivt
-- trener-abonnement.
--
-- UPDATE-policyen er like åpen på papiret (ingen kodefilter), men i praksis
-- avvises ENHVER trener-UPDATE i prod med «new row violates row-level security
-- policy» (42501) - også når begge feltene settes og used_by_coach_id
-- beviselig er lik auth.uid(). Målt 10. sep, med aktivt trener-abonnement:
--   bare used_at            → 42501, raden urørt
--   bare used_by_coach_id   → 42501, raden urørt
--   begge feltene           → 42501, raden urørt
--   begge + .select()       → 42501, raden urørt
-- Utelukket: `authenticated` HAR UPDATE-grant (eieren oppdaterer sin egen kode
-- uten problem, inkludert nøyaktig de to kolonnene), kolonnen finnes, og
-- auth.uid() er riktig (samme sesjon leser koden gjennom SELECT-policyen).
-- Feilteksten var RLS-varianten, ikke GRANT-varianten:
--   «new row violates row-level security policy for table "coach_invite_codes"»
--   (ikke «permission denied for table coach_invite_codes»)
-- error.details og error.hint var tomme. Alle tre policyene var PERMISSIVE
-- (pg_policies), så semantikken er OR - trenerens with check alene skulle holde.
-- ÅRSAKEN BLE ALDRI FASTSLÅTT, og kan ikke undersøkes mer: policyene er borte
-- med denne migrasjonen. Etter at den er kjørt oppfører en direkte UPDATE fra en
-- trener seg som tiltenkt - 0 rader treffes, HTTP 204, raden urørt (målt 10. sep,
-- rett etter kjøring). Markeringen skjer nå gjennom merk_invitasjonskode_brukt.
-- Ingen bør bruke mer tid på det gamle mysteriet; det er lukket, ikke løst.
-- Konsekvensen i dag: redeemInviteCode svelger feilen (await uten sjekk), så en
-- innløst kode blir liggende ÅPEN til den utløper - alle som har fått den kan
-- bruke den om igjen i sju dager. Av sju koder i basen er bare ÉN merket brukt,
-- den eneste fra før phase39 (22. april). Målt gjennom det ekte UI-et med en
-- betalende trener: relasjonen ble opprettet, koden ble ikke merket.
--
-- Koden er 8 tegn fra et 32-tegns alfabet (~40 bit) og lever i 7 dager - som
-- hemmelighet er den grei nok, men bare så lenge den ikke kan listes ut.
--
-- FIKSEN: begge trener-policyene droppes (SELECT-en fordi den lekker, UPDATE-en
-- fordi den uansett ikke virker). Oppslag og merking går gjennom
-- security definer-funksjoner som TAR KODEN SOM ARGUMENT og krever aktivt
-- trener-abonnement. Da kan ingen liste koder, og ingen merke en kode de ikke
-- allerede kjenner. Utøverens egen policy («Athlete manages own codes») står
-- urørt - utøveren skal fortsatt se og slette sine egne koder.
--
-- ═══ PROD-ORDLYDEN SOM DROPPES (pg_policies, lest 10. sep 2026) ═══
-- Identisk med phase39-fila - prod var IKKE strengere enn repoet.
--
--   Athlete manages own codes        (BEHOLDES, røres ikke)
--     cmd: ALL
--     USING:      (athlete_id = auth.uid())
--     WITH CHECK: (athlete_id = auth.uid())
--
--   Coach looks up code              (DROPPES)
--     cmd: SELECT
--     USING:      ((used_at IS NULL) AND (expires_at > now()) AND (EXISTS ( SELECT 1
--                  FROM profiles
--                 WHERE ((profiles.id = auth.uid()) AND (profiles.has_coach_role = true)))))
--     WITH CHECK: -
--
--   Coach marks code used            (DROPPES)
--     cmd: UPDATE
--     USING:      ((used_at IS NULL) AND (expires_at > now()) AND (EXISTS ( SELECT 1
--                  FROM profiles
--                 WHERE ((profiles.id = auth.uid()) AND (profiles.has_coach_role = true)))))
--     WITH CHECK: ((used_by_coach_id = auth.uid()) AND (used_at IS NOT NULL))
--
-- ═══ MERK: er_aktiv_trener ER EN ANDRE KOPI ═══
-- Funksjonen speiler hasActiveAccess() + hasCoachTier() i lib/subscriptions.ts.
-- Samme situasjon som idrettslista i phase124: endres tier-logikken - nye
-- statuser, ny tier, ny fail-closed-regel - må BEGGE endres sammen, ellers
-- svarer databasen og appen ulikt på hvem som er trener.
--
-- Ingen datarader røres. Idempotent.

begin;

-- Aktivt trener-abonnement. Speiler hasActiveAccess + isCoachTier i
-- lib/subscriptions.ts: status active/trialing, og fristen ikke passert.
create or replace function public.er_aktiv_trener(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = p_uid
      and p.has_coach_role = true
      and s.tier in ('trener_basic', 'trener_pro')
      and s.status in ('active', 'trialing')
      and case
            when s.status = 'trialing' then s.trial_end is null or s.trial_end > now()
            else s.current_period_end is null or s.current_period_end > now()
          end
      -- Fail-closed for tildelte plasser uten frist, som i koden.
      and (s.granted_by_subscription_id is null or s.current_period_end is not null)
  );
$$;

-- Oppslag: returnerer ÉN rad, og bare hvis kaller kjenner koden.
create or replace function public.slaa_opp_invitasjonskode(p_kode text)
returns table (id uuid, athlete_id uuid, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.er_aktiv_trener(auth.uid()) then
    return;
  end if;
  return query
    select c.id, c.athlete_id, c.expires_at
    from public.coach_invite_codes c
    where c.code = upper(btrim(p_kode))
      and c.used_at is null
      and c.expires_at > now()
      and c.athlete_id <> auth.uid();
end $$;

-- Merking: erstatter UPDATE-policyen. Treffer kun den ene koden kalleren
-- oppgir, og bare hvis den fortsatt er åpen. Returnerer null ellers.
create or replace function public.merk_invitasjonskode_brukt(p_kode text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.er_aktiv_trener(auth.uid()) then
    return null;
  end if;
  update public.coach_invite_codes c
     set used_at = now(), used_by_coach_id = auth.uid()
   where c.code = upper(btrim(p_kode))
     and c.used_at is null
     and c.expires_at > now()
     and c.athlete_id <> auth.uid()
  returning c.id into v_id;
  return v_id;
end $$;

alter function public.er_aktiv_trener(uuid) owner to postgres;
alter function public.slaa_opp_invitasjonskode(text) owner to postgres;
alter function public.merk_invitasjonskode_brukt(text) owner to postgres;

revoke all on function public.er_aktiv_trener(uuid) from public, anon;
revoke all on function public.slaa_opp_invitasjonskode(text) from public, anon;
revoke all on function public.merk_invitasjonskode_brukt(text) from public, anon;
grant execute on function public.slaa_opp_invitasjonskode(text) to authenticated;
grant execute on function public.merk_invitasjonskode_brukt(text) to authenticated;

-- Hullene lukkes. Utøverens egen policy står igjen som eneste vei inn i
-- tabellen fra en klient.
drop policy if exists "Coach looks up code" on public.coach_invite_codes;
drop policy if exists "Coach marks code used" on public.coach_invite_codes;

notify pgrst, 'reload schema';

commit;
