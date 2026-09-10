-- Phase 124 — handle_new_user() skriver HELE profilen fra signUp-metadata,
-- og kan ikke felle kontoopprettelsen på søppel-metadata.
--
-- BAKGRUNN (bug 10. sep 2026: «permission denied for table profiles»)
-- Registreringen gjorde to ting: signUp() og deretter en klient-upsert mot
-- public.profiles med de seks feltene. Da «Confirm email» ble slått på
-- (ca. 6. sep), ga signUp() bruker UTEN sesjon - klienten er fortsatt `anon`,
-- og phase39b har med vilje fjernet INSERT/UPDATE/DELETE fra anon. Upserten
-- ble avvist på GRANT-nivå (42501), og brukeren fikk databasefeilen i skjemaet.
--
-- Trigger-en er security definer og kjører uansett sesjon, men skrev bare
-- id, email, full_name og role. Resten kom fra kolonne-defaults:
--   phase23_dual_role.sql: has_athlete_role default true, has_coach_role
--   default false, active_role default 'athlete'
--   komplett_schema.sql:   primary_sport default 'running'
-- Derfor var det ikke bare en stygg feilmelding:
--   · en TRENER fikk role='coach' men has_coach_role=false og
--     active_role='athlete' - en selvmotsigende rad, og switchActiveRole
--     (app/actions/roles.ts) krever has_coach_role=true, så treneren kom
--     aldri inn i trenermodus selv etter kjøp.
--   · ALLE nye brukere fikk primary_sport='running' uansett valg. En
--     skiskytter fikk feil økttyper og ingen skyting, uten feilmelding.
--
-- ETTER DENNE: trigger-en er ENESTE kilde til profil-initialisering
-- (regel 11). app/actions/auth.ts sender de seks feltene i options.data på
-- signUp() og skriver ikke profiles selv.
--
-- HERDING (viktig): raw_user_meta_data er FULLT klientstyrt - hvem som helst
-- kan kalle det offentlige signup-endepunktet med hva som helst i
-- options.data. Trigger-en gater nå ALL kontoopprettelse, så en verdi som
-- kaster eller bryter en CHECK ville rullet tilbake hele auth.users-
-- innsettingen: «Database error saving new user» og ingen konto. Derfor:
--   · ingen ::boolean-cast på metadata (kaster på 'ja')
--   · role/active_role/primary_sport valideres mot lovlige verdier, og
--     ugyldig verdi faller tilbake på defaulten i stedet for å kaste
-- Ingen sti i funksjonen kan reise en exception FRA METADATA. Én ting kan
-- fortsatt felle innsettingen: new.email går rett inn i en not null-kolonne, så
-- en bruker uten e-post (telefon-signup, som ikke er skrudd på her) ville felt
-- kontoopprettelsen. Det er uendret fra før - den gamle trigger-en skrev også
-- email - og er ikke ny risiko fra denne migrasjonen.
--
-- MERK: lista over idretter er nå en ANDRE kopi av `Sport` i lib/types.ts
-- (den første er CHECK-en i komplett_schema.sql:16-17). Endres idrettslista,
-- må BEGGE SQL-stedene og typen endres sammen - se rapporten.
--
-- Ren funksjonsendring: ingen datarader røres, ingen kolonner endres.
-- Idempotent - `create or replace function` beholder samme OID, så trigger-en
-- on_auth_user_created peker videre på den nye kroppen og skal IKKE gjenskapes
-- (en drop/create der ville gitt et vindu der en registrering laget bruker
-- uten profilrad). Kan kjøres flere ganger, også oppå seg selv.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- security definer uten fast search_path er et kjent angrepsmønster: en
-- rolle som kan lage objekter i en tidligere skjema-sti kunne ellers kapre
-- «profiles».
set search_path = public, pg_temp
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := nullif(m->>'full_name', '');
  -- Kun lovlige verdier slipper gjennom; alt annet blir defaulten.
  v_role text := case when m->>'role' in ('athlete', 'coach')
                      then m->>'role' else 'athlete' end;
  -- «in ('true','t','1')» kan ikke kaste slik ::boolean kan. 'false' → false,
  -- søppel → false, fravær → NULL → coalesce gir fallbacken.
  v_athlete boolean := coalesce(nullif(m->>'has_athlete_role', '') in ('true', 't', '1'),
                                v_role <> 'coach');
  v_coach   boolean := coalesce(nullif(m->>'has_coach_role', '') in ('true', 't', '1'),
                                v_role = 'coach');
  v_sport text := case when m->>'primary_sport' in (
                         'running', 'cross_country_skiing', 'biathlon', 'triathlon',
                         'cycling', 'long_distance_skiing', 'endurance')
                       then m->>'primary_sport' else 'running' end;
  v_active text := case when m->>'active_role' in ('athlete', 'coach')
                        then m->>'active_role' else null end;
begin
  -- Metadata er klientstyrt, så flaggene må også være KONSISTENTE, ikke bare
  -- lovlige. Uten dette gir active_role='coach' + has_coach_role=false nøyaktig
  -- den selvmotsigende raden denne migrasjonen finnes for å fjerne, og to false
  -- flagg gir en konto uten rolle i det hele tatt (tilstanden
  -- phase23_dual_role.sql:19-21 ryddet opp i en gang).
  if not v_athlete and not v_coach then
    v_athlete := true;
  end if;
  if v_active = 'coach'   and not v_coach   then v_active := null; end if;
  if v_active = 'athlete' and not v_athlete then v_active := null; end if;

  -- Ingen gyldig active_role igjen: utled den, som registreringen gjør.
  v_active := coalesce(v_active, case when v_athlete then 'athlete' else 'coach' end);

  insert into public.profiles (
    id, email, full_name, role,
    has_athlete_role, has_coach_role, active_role, primary_sport
  )
  values (
    new.id, new.email, v_full_name, v_role,
    v_athlete, v_coach, v_active, v_sport
  )
  on conflict (id) do update set
    -- Raden finnes bare hvis noe annet rakk å lage den først. Da fyller vi ut
    -- hullene, vi tømmer dem ikke.
    -- MERK: coalesce på de fem utledede feltene ville bevart ingenting - de er
    -- aldri null (v_role, v_athlete, v_coach, v_active og v_sport har alltid en
    -- verdi). Testen må derfor være om NØKKELEN fantes i metadata; bare email
    -- og full_name kan faktisk bevares med coalesce. jsonb_exists() i stedet for
    -- «?»-operatoren: noen klienter tolker ? som en parameter-plassholder.
    email            = coalesce(excluded.email,     profiles.email),
    full_name        = coalesce(excluded.full_name, profiles.full_name),
    role             = case when jsonb_exists(m, 'role')             then excluded.role             else profiles.role end,
    has_athlete_role = case when jsonb_exists(m, 'has_athlete_role') then excluded.has_athlete_role else profiles.has_athlete_role end,
    has_coach_role   = case when jsonb_exists(m, 'has_coach_role')   then excluded.has_coach_role   else profiles.has_coach_role end,
    active_role      = case when jsonb_exists(m, 'active_role')      then excluded.active_role      else profiles.active_role end,
    primary_sport    = case when jsonb_exists(m, 'primary_sport')    then excluded.primary_sport    else profiles.primary_sport end;

  return new;
end $$;

-- Eier må være postgres for at security definer skal ha rettighetene.
alter function public.handle_new_user() owner to postgres;

commit;
