-- ============================================================
-- Fase 109b v2 — Migrering: pekermodellen → flett
--
-- Forutsetter phase109_flett.sql (kjørt OK 28. aug).
-- Målt i prod 28. aug: 2 koblinger, og de er ULIKE i natur:
--   · Par «Oslo Løping — 11 min» (fit_garmin) → «Restitusjon 45 min»
--     — ekte klokkepar: synket kilde, migreres som «legg bak».
--   · Par «Styrke Drømtorp» ⇄ «Drømtorp shake + utegym 💪»
--     — KLOKKELØST (ingen av radene er synket): plan ↔ manuelt ført.
--     Beslutning (Sverre 28. aug, alt. A): den PLANLAGTE er mål og
--     tittelen som overlever; den førte konsumeres som kilde med
--     full angre-backup, modus «bytt ut» (aktiviteten + tallene
--     flyttes inn i mål-økta). merged_source blir null — økta har
--     ingen klokke, så ⌚-badgen skal ikke vises.
--
-- Soner beregnes ikke her (krever pulskurve + brukerens soner —
-- appkode). KJØRES I TRE STEG: FØR (separat) → DO → ETTER (separat).
-- linked_workout_id nulles per par ETTER assertions.
-- ============================================================

-- ── 1) FØR (kjør separat — noter tallene) ────────────────────
select w.id, w.title, w.date, w.imported_from, w.is_planned,
       w.linked_workout_id,
       (select count(*) from public.workout_activities a
         where a.workout_id = w.id) as aktiviteter,
       (select count(*) from public.workout_samples s
         where s.workout_id = w.id) as samples,
       (select count(*) from public.imported_activities ia
         where ia.workout_id = w.id) as proveniens
  from public.workouts w
 where w.linked_workout_id is not null
    or exists (select 1 from public.workouts p
                where p.linked_workout_id = w.id);

-- ── 2) MIGRERING ─────────────────────────────────────────────
do $mig$
declare
  r record;
  v_a public.workouts%rowtype;
  v_bb public.workouts%rowtype;
  v_kilde public.workouts%rowtype;
  v_maal public.workouts%rowtype;
  v_modus text;
  v_backup jsonb;
  v_maal_akt uuid[];
  v_kilde_akt uuid[];
  v_maal_soner jsonb;
  v_kilde_soner uuid[];
  v_samples uuid[];
  v_proveniens uuid[];
  v_rest int;
  v_tall record;
  v_par int := 0;
begin
  for r in
    select id, linked_workout_id from public.workouts
     where linked_workout_id is not null
  loop
    select * into v_a from public.workouts
     where id = r.id for update;
    select * into v_bb from public.workouts
     where id = r.linked_workout_id for update;
    if v_a.id is null or v_bb.id is null then
      raise exception 'Par (%, %): fant ikke begge rader',
        r.id, r.linked_workout_id;
    end if;
    if v_a.user_id <> v_bb.user_id then
      raise exception 'Par (%, %): ulik bruker', v_a.id, v_bb.id;
    end if;

    -- Retning + modus:
    if (v_a.imported_from is not null)
       and (v_bb.imported_from is null) then
      v_kilde := v_a; v_maal := v_bb; v_modus := 'legg_bak';
    elsif (v_bb.imported_from is not null)
       and (v_a.imported_from is null) then
      v_kilde := v_bb; v_maal := v_a; v_modus := 'legg_bak';
    elsif v_a.imported_from is null
       and v_bb.imported_from is null then
      -- Klokkeløst par (alt. A): planlagt = mål, ført = kilde.
      if v_a.is_planned = v_bb.is_planned then
        raise exception 'Par (%, %): klokkeløst og ikke entydig plan/ført',
          v_a.id, v_bb.id;
      end if;
      if v_a.is_planned then
        v_maal := v_a; v_kilde := v_bb;
      else
        v_maal := v_bb; v_kilde := v_a;
      end if;
      v_modus := 'bytt_ut';
    else
      raise exception 'Par (%, %): begge radene er synket — uventet',
        v_a.id, v_bb.id;
    end if;

    -- Idempotens: allerede migrert → hopp over.
    if v_kilde.merged_into_workout_id is not null then
      continue;
    end if;

    -- Backup FØRST (samme form som flett_okter).
    select coalesce(array_agg(id), '{}') into v_maal_akt
      from public.workout_activities where workout_id = v_maal.id;
    select coalesce(array_agg(id), '{}') into v_kilde_akt
      from public.workout_activities where workout_id = v_kilde.id;
    select coalesce(jsonb_agg(jsonb_build_object(
        'zone_name', zone_name, 'minutes', minutes,
        'sort_order', sort_order)), '[]'::jsonb)
      into v_maal_soner
      from public.workout_zones where workout_id = v_maal.id;
    select coalesce(array_agg(id), '{}') into v_kilde_soner
      from public.workout_zones where workout_id = v_kilde.id;
    select coalesce(array_agg(id), '{}') into v_samples
      from public.workout_samples where workout_id = v_kilde.id;
    select coalesce(array_agg(id), '{}') into v_proveniens
      from public.imported_activities where workout_id = v_kilde.id;

    v_backup := jsonb_build_object(
      'flettet_at', now(),
      'migrert_fra_pekermodellen', true,
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
      where id = v_kilde.id;

    if v_modus = 'legg_bak' then
      -- Klokkepar: puls + totaltid fra klokka, radene urørt.
      update public.workouts set
        avg_heart_rate = v_kilde.avg_heart_rate,
        max_heart_rate = v_kilde.max_heart_rate,
        duration_minutes = v_kilde.duration_minutes,
        is_completed = true,
        completed_at = coalesce(completed_at, now()),
        merged_source = v_kilde.imported_from
        where id = v_maal.id;
    else
      -- Klokkeløst par, «bytt ut»: kildens rader inn i målet,
      -- målets parkeres på kilden (alle barn følger radene).
      -- Tittel/tags/notater/økttype på målet røres ikke.
      update public.workout_activities set workout_id = v_kilde.id
        where id = any(v_maal_akt);
      update public.workout_activities set workout_id = v_maal.id
        where id = any(v_kilde_akt);
      update public.workout_zones set workout_id = v_kilde.id
        where workout_id = v_maal.id;
      update public.workout_zones set workout_id = v_maal.id
        where id = any(v_kilde_soner);
      update public.workouts set
        avg_heart_rate = v_kilde.avg_heart_rate,
        max_heart_rate = v_kilde.max_heart_rate,
        duration_minutes = v_kilde.duration_minutes,
        distance_km = v_kilde.distance_km,
        elevation_meters = v_kilde.elevation_meters,
        is_completed = true,
        completed_at = coalesce(completed_at, now()),
        merged_source = v_kilde.imported_from  -- null: ingen klokke
        where id = v_maal.id;
    end if;

    -- Samples + proveniens til målet (0 rader for klokkeløst par).
    update public.workout_samples set workout_id = v_maal.id
      where workout_id = v_kilde.id;
    update public.imported_activities set workout_id = v_maal.id
      where workout_id = v_kilde.id;

    -- Konsumer kilden.
    update public.workouts set
      merged_into_workout_id = v_maal.id,
      merge_mode = v_modus
      where id = v_kilde.id;

    -- ── ASSERTIONS per par, FØR pekeren pensjoneres ──
    select count(*) into v_rest from public.workout_samples
      where workout_id = v_kilde.id;
    if v_rest <> 0 then
      raise exception 'Par (% → %): % samples igjen på kilden',
        v_kilde.id, v_maal.id, v_rest;
    end if;
    select count(*) into v_rest from public.imported_activities
      where workout_id = v_kilde.id;
    if v_rest <> 0 then
      raise exception 'Par (% → %): % proveniensrader igjen på kilden',
        v_kilde.id, v_maal.id, v_rest;
    end if;
    if coalesce(array_length(v_samples, 1), 0) > 0 then
      select count(*) into v_rest from public.workout_samples
        where workout_id = v_maal.id and id = any(v_samples);
      if v_rest <> coalesce(array_length(v_samples, 1), 0) then
        raise exception 'Par (% → %): samples nådde ikke målet',
          v_kilde.id, v_maal.id;
      end if;
    end if;

    if v_modus = 'bytt_ut' then
      -- Par 1-kravene: mål-økta bærer den førtes varighet/puls,
      -- og radene har byttet eier fullt ut.
      select duration_minutes, avg_heart_rate, max_heart_rate
        into v_tall from public.workouts where id = v_maal.id;
      if v_tall.duration_minutes is distinct from v_kilde.duration_minutes
         or v_tall.avg_heart_rate is distinct from v_kilde.avg_heart_rate
         or v_tall.max_heart_rate is distinct from v_kilde.max_heart_rate then
        raise exception 'Par (% → %): målets varighet/puls matcher ikke den førte økta',
          v_kilde.id, v_maal.id;
      end if;
      select count(*) into v_rest from public.workout_activities
        where workout_id = v_maal.id;
      if v_rest <> coalesce(array_length(v_kilde_akt, 1), 0) then
        raise exception 'Par (% → %): målet har % rader, ventet % (kildens)',
          v_kilde.id, v_maal.id, v_rest,
          coalesce(array_length(v_kilde_akt, 1), 0);
      end if;
      select count(*) into v_rest from public.workout_activities
        where workout_id = v_kilde.id;
      if v_rest <> coalesce(array_length(v_maal_akt, 1), 0) then
        raise exception 'Par (% → %): kilden har % parkerte rader, ventet %',
          v_kilde.id, v_maal.id, v_rest,
          coalesce(array_length(v_maal_akt, 1), 0);
      end if;
    end if;

    -- Ingen dublett: kun ÉN synlig rad igjen av paret.
    select count(*) into v_rest from public.workouts
      where id in (v_kilde.id, v_maal.id)
        and merged_into_workout_id is null;
    if v_rest <> 1 then
      raise exception 'Par (% → %): % synlige rader i paret, ventet 1',
        v_kilde.id, v_maal.id, v_rest;
    end if;

    -- Pensjoner pekeren på BEGGE rader i paret.
    update public.workouts set linked_workout_id = null
      where id in (v_kilde.id, v_maal.id)
        and linked_workout_id is not null;

    v_par := v_par + 1;
  end loop;

  -- Slutt-assertion: ingen peker igjen i hele tabellen.
  select count(*) into v_rest from public.workouts
    where linked_workout_id is not null;
  if v_rest <> 0 then
    raise exception '% rader har fortsatt linked_workout_id', v_rest;
  end if;

  raise notice 'Migrert % par, ingen pekere igjen', v_par;
end $mig$;

-- ── 3) ETTER (kjør separat — verifiser mot FØR) ──────────────
-- Forventet: 2 rader.
--   · Klokkeparet: merge_mode='legg_bak', merged_source='fit_garmin',
--     kilde_samples/kilde_proveniens=0 og samme sum på målet.
--   · Drømtorp-paret: merge_mode='bytt_ut', merged_source=null
--     (ingen klokke), maal_varighet/maal_snittpuls = den førtes tall,
--     maal_rader = 1 (den førtes rad), kilde_rader = 1 (parkert).
--   · synlige_paa_datoen teller brukerens synlige økter den datoen —
--     paret bidrar med ÉN (andre, urelaterte økter samme dag telles
--     også, så tallet kan være høyere enn 1 av legitime grunner).
--   · pekere_igjen = 0.
select k.id as kilde_id, k.title as kilde, k.merge_mode,
       m.id as maal_id, m.title as maal,
       m.merged_source, m.is_completed,
       m.duration_minutes as maal_varighet,
       m.avg_heart_rate as maal_snittpuls,
       (select count(*) from public.workout_activities a
         where a.workout_id = k.id) as kilde_rader,
       (select count(*) from public.workout_activities a
         where a.workout_id = m.id) as maal_rader,
       (select count(*) from public.workout_samples s
         where s.workout_id = k.id) as kilde_samples,
       (select count(*) from public.workout_samples s
         where s.workout_id = m.id) as maal_samples,
       (select count(*) from public.imported_activities ia
         where ia.workout_id = k.id) as kilde_proveniens,
       (select count(*) from public.imported_activities ia
         where ia.workout_id = m.id) as maal_proveniens,
       (select count(*) from public.workouts v
         where v.user_id = m.user_id and v.date = m.date
           and v.merged_into_workout_id is null) as synlige_paa_datoen,
       (select count(*) from public.workouts
         where linked_workout_id is not null) as pekere_igjen
  from public.workouts k
  join public.workouts m on m.id = k.merged_into_workout_id
 where k.merged_into_workout_id is not null
 order by m.date;
