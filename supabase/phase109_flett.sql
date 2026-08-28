-- ============================================================
-- Fase 109 — KOBLING & FLETT bolk 2: datamodellen (godkjent 28. aug)
--
-- Fire kolonner på workouts + ryddetrigger + to RPC-er + migrering
-- av de 2 eksisterende koblingene (pekermodellen → «legg bak»).
--
-- Semantikk:
--   merged_into_workout_id  — på den KONSUMERTE (synkede) økta,
--                             peker til mål-økta. Satt = skjult i alle
--                             lister/aggregater. ALDRI sletting.
--   merge_mode              — 'legg_bak' | 'bytt_ut' (på den konsumerte)
--   merge_backup            — målets tilstand ved flett-tidspunktet +
--                             id-listene angringen trenger (på den
--                             konsumerte — den er skjult og fredet)
--   merged_source           — på MÅLET: kilde ('strava'/'fit_garmin'/…),
--                             bærer ⌚-badgen uten reverse-oppslag
--
-- Modus B flytter aktivitetsrader (bytter eierskap mål ⇄ kilde) i
-- stedet for å kopiere: alle barnetabeller (styrkesett, laktat,
-- skyteserier, utstyr, samples.activity_id) følger radene sine
-- automatisk, og angre er en ren tilbakeflytting på id-lister.
-- Idempotent. Kjøres i Supabase SQL Editor.
-- ============================================================

alter table public.workouts
  add column if not exists merged_into_workout_id uuid
    references public.workouts(id) on delete set null;

alter table public.workouts
  add column if not exists merge_mode text;

do $mm$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workouts_merge_mode_check'
  ) then
    alter table public.workouts
      add constraint workouts_merge_mode_check
      check (merge_mode is null
             or merge_mode in ('legg_bak', 'bytt_ut'));
  end if;
end $mm$;

alter table public.workouts
  add column if not exists merge_backup jsonb;

alter table public.workouts
  add column if not exists merged_source text;

create index if not exists workouts_merged_into_idx
  on public.workouts(merged_into_workout_id)
  where merged_into_workout_id is not null;

-- ── Krav 4: ryddetrigger ─────────────────────────────────────
-- Slettes mål-økta setter FK-en merged_into_workout_id = null
-- (intern UPDATE → radtriggere fyrer). Da skal merge_mode og
-- merge_backup ryddes samtidig så den gjenoppståtte økta ikke
-- står i halv-tilstand. Fyrer også ved angre (som selv nuller
-- feltene — ufarlig dobbeltrydding).
create or replace function public.rydd_flett_rester()
returns trigger language plpgsql as $fn$
begin
  if old.merged_into_workout_id is not null
     and new.merged_into_workout_id is null then
    new.merge_mode := null;
    new.merge_backup := null;
  end if;
  return new;
end $fn$;

drop trigger if exists workouts_rydd_flett on public.workouts;
create trigger workouts_rydd_flett
  before update of merged_into_workout_id on public.workouts
  for each row execute procedure public.rydd_flett_rester();

-- ── Tilgangssjekk delt av begge RPC-ene ──────────────────────
-- Selv, eller trener med aktiv relasjon og can_edit_plan (samme
-- rettighet som markCompleted/koblingen bruker i dag).
create or replace function public.kan_flette_for(p_bruker uuid)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select p_bruker = auth.uid()
     or exists (
       select 1 from public.coach_athlete_relations r
       where r.coach_id = auth.uid()
         and r.athlete_id = p_bruker
         and r.status = 'active'
         and r.can_edit_plan
     )
$fn$;

-- ── RPC: flett_okter ─────────────────────────────────────────
-- ÉN transaksjon. Backup bygges og skrives FØR noe muteres
-- (krav 2 — i modus B er den eneste fasiten for målets rader).
-- p_soner: [{zone_name, minutes, sort_order}] beregnet i appen
-- fra kildens pulskurve (kun modus 'legg_bak').
create or replace function public.flett_okter(
  p_maal uuid,
  p_kilde uuid,
  p_modus text,
  p_soner jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer
set search_path = public as $fn$
declare
  v_maal public.workouts%rowtype;
  v_kilde public.workouts%rowtype;
  v_backup jsonb;
  v_maal_akt uuid[];
  v_kilde_akt uuid[];
  v_maal_soner jsonb;
  v_kilde_soner uuid[];
  v_samples uuid[];
  v_proveniens uuid[];
  v_n_samples int;
  v_n_prov int;
  v_n_park int := 0;
begin
  if p_modus not in ('legg_bak', 'bytt_ut') then
    return jsonb_build_object('error', 'Ukjent modus');
  end if;
  if p_maal = p_kilde then
    return jsonb_build_object('error', 'Kan ikke flette økta med seg selv');
  end if;

  select * into v_maal from public.workouts
    where id = p_maal for update;
  select * into v_kilde from public.workouts
    where id = p_kilde for update;
  if v_maal.id is null or v_kilde.id is null then
    return jsonb_build_object('error', 'Fant ikke begge økter');
  end if;
  if v_maal.user_id <> v_kilde.user_id then
    return jsonb_build_object('error', 'Øktene tilhører ikke samme bruker');
  end if;
  if not public.kan_flette_for(v_maal.user_id) then
    return jsonb_build_object('error', 'Mangler tillatelse');
  end if;
  if v_kilde.imported_from is null then
    return jsonb_build_object('error', 'Kilden er ikke en synket økt');
  end if;
  if v_kilde.merged_into_workout_id is not null
     or v_maal.merged_into_workout_id is not null then
    return jsonb_build_object('error', 'En av øktene er allerede konsumert av en flett');
  end if;
  if exists (select 1 from public.workouts
             where merged_into_workout_id = p_maal) then
    return jsonb_build_object('error', 'Økta er allerede flettet med en synket økt');
  end if;

  -- KRAV 2: backup som FØRSTE steg, før noe endres.
  select coalesce(array_agg(id), '{}') into v_maal_akt
    from public.workout_activities where workout_id = p_maal;
  select coalesce(array_agg(id), '{}') into v_kilde_akt
    from public.workout_activities where workout_id = p_kilde;
  select coalesce(jsonb_agg(jsonb_build_object(
      'zone_name', zone_name, 'minutes', minutes,
      'sort_order', sort_order)), '[]'::jsonb)
    into v_maal_soner
    from public.workout_zones where workout_id = p_maal;
  select coalesce(array_agg(id), '{}') into v_kilde_soner
    from public.workout_zones where workout_id = p_kilde;
  select coalesce(array_agg(id), '{}') into v_samples
    from public.workout_samples where workout_id = p_kilde;
  select coalesce(array_agg(id), '{}') into v_proveniens
    from public.imported_activities where workout_id = p_kilde;

  v_backup := jsonb_build_object(
    'flettet_at', now(),
    'maal_updated_at', v_maal.updated_at,
    'maal_felter', jsonb_build_object(
      'is_completed', v_maal.is_completed,
      'completed_at', v_maal.completed_at,
      'duration_minutes', v_maal.duration_minutes,
      'distance_km', v_maal.distance_km,
      'avg_heart_rate', v_maal.avg_heart_rate,
      'max_heart_rate', v_maal.max_heart_rate,
      'elevation_meters', v_maal.elevation_meters),
    'maal_soner', v_maal_soner,
    'maal_aktivitet_ids', to_jsonb(v_maal_akt),
    'kilde_aktivitet_ids', to_jsonb(v_kilde_akt),
    'kilde_sone_ids', to_jsonb(v_kilde_soner),
    'samples_ids', to_jsonb(v_samples),
    'proveniens_ids', to_jsonb(v_proveniens));

  update public.workouts set merge_backup = v_backup
    where id = p_kilde;

  -- Modus-spesifikt.
  if p_modus = 'legg_bak' then
    -- Økta di er sjefen: radene urørt. Inn: puls, totaltid
    -- (klokka VINNER), soner på øktnivå.
    update public.workouts set
      avg_heart_rate = v_kilde.avg_heart_rate,
      max_heart_rate = v_kilde.max_heart_rate,
      duration_minutes = v_kilde.duration_minutes,
      is_completed = true,
      completed_at = coalesce(completed_at, now()),
      merged_source = v_kilde.imported_from
      where id = p_maal;
    delete from public.workout_zones where workout_id = p_maal;
    insert into public.workout_zones
      (workout_id, zone_name, minutes, sort_order)
    select p_maal, s->>'zone_name',
           coalesce((s->>'minutes')::int, 0),
           coalesce((s->>'sort_order')::int, 0)
      from jsonb_array_elements(coalesce(p_soner, '[]'::jsonb)) s;
  else
    -- Bytt ut: klokkas rader ERSTATTER målets — ved eierbytte.
    -- Målets originalrader PARKERES på den konsumerte (skjulte)
    -- kilden med alle barn intakt; klokkas rader flyttes inn.
    -- Tags, skjema-data, økttype, tittel, notater røres ALDRI
    -- (de henger på workout_id = p_maal og flyttes ikke).
    -- SKYTING-rader er skjema-data, ikke runder (fasit: «Notater,
    -- følelse, skyting og tags står») — de fredes og blir stående
    -- på målet med seriene sine. Angringen tåler det: radene står
    -- i maal_aktivitet_ids og er allerede hjemme.
    update public.workout_activities set workout_id = p_kilde
      where id = any(v_maal_akt)
        and activity_type not in (
          'skyting_liggende', 'skyting_staaende', 'skyting_kombinert',
          'skyting_innskyting', 'skyting_basis');
    -- Målt antall, ikke listelengde: skyting-radene over parkeres
    -- ikke, og returen skal si det som faktisk skjedde (én sannhet).
    get diagnostics v_n_park = row_count;
    update public.workout_activities set workout_id = p_maal
      where id = any(v_kilde_akt);
    update public.workout_zones set workout_id = p_kilde
      where workout_id = p_maal;
    update public.workout_zones set workout_id = p_maal
      where id = any(v_kilde_soner);
    update public.workouts set
      avg_heart_rate = v_kilde.avg_heart_rate,
      max_heart_rate = v_kilde.max_heart_rate,
      duration_minutes = v_kilde.duration_minutes,
      distance_km = v_kilde.distance_km,
      elevation_meters = v_kilde.elevation_meters,
      is_completed = true,
      completed_at = coalesce(completed_at, now()),
      merged_source = v_kilde.imported_from
      where id = p_maal;
  end if;

  -- Begge moduser: pulskurve/samples og PROVENIENS følger målet.
  -- Strava-merkingen i imported_activities flytter MED (regel 2:
  -- AI/ML-filteret ser den på målet).
  update public.workout_samples set workout_id = p_maal
    where workout_id = p_kilde;
  get diagnostics v_n_samples = row_count;
  update public.imported_activities set workout_id = p_maal
    where workout_id = p_kilde;
  get diagnostics v_n_prov = row_count;

  -- Kilden konsumeres: skjult, aldri slettet.
  update public.workouts set
    merged_into_workout_id = p_maal,
    merge_mode = p_modus,
    linked_workout_id = null
    where id = p_kilde;

  return jsonb_build_object(
    'ok', true,
    'modus', p_modus,
    'maal_rader_parkert', v_n_park,
    'kilde_rader_inn',
      case when p_modus = 'bytt_ut'
           then coalesce(array_length(v_kilde_akt, 1), 0) else 0 end,
    'samples_flyttet', v_n_samples,
    'proveniens_flyttet', v_n_prov);
end $fn$;

-- ── RPC: angre_flett ─────────────────────────────────────────
-- Uten frist. Gjenoppretter BEGGE økter til flett-tidspunktet:
-- rader lagt til på målet ETTER fletten slettes (krav 3 —
-- dialogen i appen varsler når maal.updated_at er nyere enn
-- backupens maal_updated_at, den gjenoppretter aldri stille).
create or replace function public.angre_flett(p_maal uuid)
returns jsonb language plpgsql security definer
set search_path = public as $fn$
declare
  v_maal public.workouts%rowtype;
  v_kilde public.workouts%rowtype;
  v_b jsonb;
  v_maal_akt uuid[];
  v_kilde_akt uuid[];
  v_kilde_soner uuid[];
  v_samples uuid[];
  v_proveniens uuid[];
  v_slettet int := 0;
begin
  select * into v_maal from public.workouts
    where id = p_maal for update;
  if v_maal.id is null then
    return jsonb_build_object('error', 'Fant ikke økta');
  end if;
  select * into v_kilde from public.workouts
    where merged_into_workout_id = p_maal for update;
  if v_kilde.id is null then
    return jsonb_build_object('error', 'Ingen flett å angre');
  end if;
  if not public.kan_flette_for(v_maal.user_id) then
    return jsonb_build_object('error', 'Mangler tillatelse');
  end if;

  v_b := v_kilde.merge_backup;
  if v_b is null then
    return jsonb_build_object('error', 'Fletten mangler backup og kan ikke angres');
  end if;

  select coalesce(array_agg(x::uuid), '{}') into v_maal_akt
    from jsonb_array_elements_text(v_b->'maal_aktivitet_ids') x;
  select coalesce(array_agg(x::uuid), '{}') into v_kilde_akt
    from jsonb_array_elements_text(v_b->'kilde_aktivitet_ids') x;
  select coalesce(array_agg(x::uuid), '{}') into v_kilde_soner
    from jsonb_array_elements_text(v_b->'kilde_sone_ids') x;
  select coalesce(array_agg(x::uuid), '{}') into v_samples
    from jsonb_array_elements_text(v_b->'samples_ids') x;
  select coalesce(array_agg(x::uuid), '{}') into v_proveniens
    from jsonb_array_elements_text(v_b->'proveniens_ids') x;

  -- Aktivitetsrader: klokkas hjem til kilden, målets parkerte
  -- hjem til målet, og rader skapt på målet etter fletten vekk.
  update public.workout_activities set workout_id = v_kilde.id
    where id = any(v_kilde_akt);
  update public.workout_activities set workout_id = p_maal
    where id = any(v_maal_akt);
  delete from public.workout_activities
    where workout_id = p_maal and not (id = any(v_maal_akt));
  get diagnostics v_slettet = row_count;

  -- Soner: kildens rader hjem, målets gjenskapes fra backup.
  update public.workout_zones set workout_id = v_kilde.id
    where id = any(v_kilde_soner);
  delete from public.workout_zones where workout_id = p_maal;
  insert into public.workout_zones
    (workout_id, zone_name, minutes, sort_order)
  select p_maal, s->>'zone_name',
         coalesce((s->>'minutes')::int, 0),
         coalesce((s->>'sort_order')::int, 0)
    from jsonb_array_elements(coalesce(v_b->'maal_soner', '[]'::jsonb)) s;

  -- Samples og proveniens hjem til kilden.
  update public.workout_samples set workout_id = v_kilde.id
    where id = any(v_samples);
  update public.imported_activities set workout_id = v_kilde.id
    where id = any(v_proveniens);

  -- Målets felter tilbake til flett-tidspunktet.
  update public.workouts set
    is_completed = coalesce(
      (v_b->'maal_felter'->>'is_completed')::boolean, false),
    completed_at = (v_b->'maal_felter'->>'completed_at')::timestamptz,
    duration_minutes = (v_b->'maal_felter'->>'duration_minutes')::int,
    distance_km = (v_b->'maal_felter'->>'distance_km')::numeric,
    avg_heart_rate = (v_b->'maal_felter'->>'avg_heart_rate')::int,
    max_heart_rate = (v_b->'maal_felter'->>'max_heart_rate')::int,
    elevation_meters = (v_b->'maal_felter'->>'elevation_meters')::int,
    merged_source = null
    where id = p_maal;

  -- Kilden gjenoppstår (triggeren rydder mode/backup i tillegg).
  update public.workouts set
    merged_into_workout_id = null,
    merge_mode = null,
    merge_backup = null
    where id = v_kilde.id;

  return jsonb_build_object(
    'ok', true,
    'kilde_id', v_kilde.id,
    'rader_slettet_etter_flett', v_slettet,
    'samples_tilbake', coalesce(array_length(v_samples, 1), 0),
    'proveniens_tilbake', coalesce(array_length(v_proveniens, 1), 0));
end $fn$;

revoke all on function public.flett_okter(uuid, uuid, text, jsonb) from anon;
revoke all on function public.angre_flett(uuid) from anon;

notify pgrst, 'reload schema';
