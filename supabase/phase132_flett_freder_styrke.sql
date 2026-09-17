/* Fase 132: FLETT FREDER STYRKERADER I MODUS B (styrke bolk 6c).              */ 
/*                                                                            */ 
/* I dag parkerer flett_okter alle malets aktivitetsrader unntatt skyting pa   */ 
/* den konsumerte kilden nar klokkas runder byttes inn (modus bytt_ut). En     */ 
/* styrkerad med tolv sett ville da forsvinne fra malet. Fasiten (plan-        */ 
/* klokkesynk-flett.md pkt 9, styrke-prompten 6c): styrkerader fredes pa       */ 
/* linje med skyteradene - de er brukerens sett og reps, ikke runder.          */ 
/*                                                                            */ 
/* ENDRINGEN: en linje i parkerings-UPDATE-en (coalesce(movement_name, '') <>  */ 
/* 'Styrke'). Resten av funksjonen er ordrett fra fase 109. Angringen taler   */ 
/* det (samme mekanisme som skyting: raden star i maal_aktivitet_ids og er    */ 
/* alt hjemme). Returen «maal_rader_parkert» er malt antall og blir riktig.   */ 
/*                                                                            */ 
/* REGEL 41: fase 109 revoke-et bare fra anon - her revoke fra public OG anon  */ 
/* og grant execute til authenticated pa begge flett-RPC-ene.                 */ 
/* REGEL 42: to blokker. Blokk 1 funksjonen, blokk 2 grants + ETTER.          */ 
/* KODEN (flett.ts) teller styrkerader utenfor «rader erstattes» og dialogen  */ 
/* sier at styrke- og skyterader star - kjor denne FOR/samtidig med deploy.   */ 
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 1 - flett_okter med fredning av styrkerader                         */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
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
    -- STYRKE (fase 132, styrke bolk 6c): styrkerader er brukerens sett og 
    -- reps, ikke runder - de fredes pa linje med skyteradene og blir 
    -- staende pa malet med ovelsene sine. Klokkas runder legges ved siden. 
    update public.workout_activities set workout_id = p_kilde 
      where id = any(v_maal_akt) 
        and activity_type not in ( 
          'skyting_liggende', 'skyting_staaende', 'skyting_kombinert', 
          'skyting_innskyting', 'skyting_basis') 
        and coalesce(movement_name, '') <> 'Styrke'; 
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
 
/* ═══════════════════════════════════════════════════════════════════════ */ 
/* BLOKK 2 - grants (regel 41) + ETTER                                       */ 
/* ═══════════════════════════════════════════════════════════════════════ */ 
revoke all on function public.flett_okter(uuid, uuid, text, jsonb) from public, anon; 
revoke all on function public.angre_flett(uuid) from public, anon; 
grant execute on function public.flett_okter(uuid, uuid, text, jsonb) to authenticated; 
grant execute on function public.angre_flett(uuid) to authenticated; 
 
select 'ETTER' as steg, 
  (select count(*) from pg_proc f join pg_namespace n on n.oid = f.pronamespace 
    where n.nspname = 'public' and f.proname = 'flett_okter' 
      and f.prosrc ~ 'Styrke') as freder_styrke;   /* forventet 1 */ 
