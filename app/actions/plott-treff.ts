'use server'

import { createClient } from '@/lib/supabase/server'
import { serieRadTilDb, seriesToLegacyAggregates, type SerieFormRad } from '@/lib/shooting'
import { beregnSegmenter } from '@/lib/segmenter'

// «Plott treff» (bolk B): lagring av ALLE seriene i økta i én operasjon.
//
// REGEL 11: skriver de SAMME workout_shooting_series-radene som
// skyting-kortene og statistikken leser — mappingen (serieRadTilDb) og
// aggregat-avledningen (seriesToLegacyAggregates) er delt med saveWorkout,
// så «Plott treff» og skjemaet skriver identisk. Rad-aggregatene
// (prone/standing shots/hits) oppdateres i samme operasjon slik at alle
// lesende flater ser samme tall (Kø #47-pariteten).
//
// ROLLBACK: PostgREST gir ikke transaksjon over flere statements. Vi tar
// et fullt snapshot av seriene FØR skriving og gjenoppretter ved feil
// (kompensasjon). Vil man ha alt-eller-ingenting på databasenivå, er det
// en liten SECURITY DEFINER-RPC — foreslått, ikke bygget.
//
// MERK: ALDRI type-re-eksport fra en 'use server'-fil (regel 24).

export interface PlottTreffRadInput {
  activityId: string
  serier: SerieFormRad[]
}

export async function lagrePlottTreff(
  workoutId: string,
  rader: PlottTreffRadInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  // Radene må tilhøre økta og være skyting (RLS gir lese-/skriverett).
  const { data: dbRader, error: radFeil } = await supabase
    .from('workout_activities')
    .select('id, activity_type, shooting_type')
    .eq('workout_id', workoutId)
  if (radFeil) return { ok: false, error: radFeil.message }
  const radKart = new Map((dbRader ?? []).map(r => [r.id, r]))
  for (const r of rader) {
    const db = radKart.get(r.activityId)
    if (!db) return { ok: false, error: 'En av skyting-radene finnes ikke lenger — last økta på nytt' }
    if (!(db.activity_type ?? '').startsWith('skyting')) {
      return { ok: false, error: 'Serier kan bare føres på skyting-rader' }
    }
  }
  const aktivitetsIds = rader.map(r => r.activityId)
  if (aktivitetsIds.length === 0) return { ok: true }

  // Snapshot FØR skriving — grunnlaget for kompensasjon ved feil.
  const [snapSerier, snapAggregat] = await Promise.all([
    supabase.from('workout_shooting_series').select('*').in('activity_id', aktivitetsIds),
    supabase.from('workout_activities')
      .select('id, prone_shots, prone_hits, standing_shots, standing_hits')
      .in('id', aktivitetsIds),
  ])
  if (snapSerier.error) return { ok: false, error: snapSerier.error.message }

  // Bygg de nye serie-radene med den delte mappingen.
  const medPoints = rader.some(r => r.serier.some(s => s.points != null && s.points !== ''))
  const nyeSerier = rader.flatMap(r => {
    if (radKart.get(r.activityId)?.shooting_type === 'torrtrening') return []
    return r.serier
      .map((s, si) => serieRadTilDb(s, r.activityId, si + 1, medPoints))
      .filter((rad): rad is NonNullable<typeof rad> => rad !== null)
  })

  const gjenopprett = async () => {
    await supabase.from('workout_shooting_series').delete().in('activity_id', aktivitetsIds)
    if ((snapSerier.data ?? []).length > 0) {
      await supabase.from('workout_shooting_series').insert(snapSerier.data!)
    }
    for (const agg of (snapAggregat.data ?? [])) {
      await supabase.from('workout_activities').update({
        prone_shots: agg.prone_shots, prone_hits: agg.prone_hits,
        standing_shots: agg.standing_shots, standing_hits: agg.standing_hits,
      }).eq('id', agg.id)
    }
  }

  // Skriv: slett gamle serier for radene, sett inn nye, oppdater aggregatene.
  const { error: slettFeil } = await supabase
    .from('workout_shooting_series').delete().in('activity_id', aktivitetsIds)
  if (slettFeil) return { ok: false, error: `Kunne ikke lagre seriene: ${slettFeil.message}` }

  if (nyeSerier.length > 0) {
    const { error: innFeil } = await supabase.from('workout_shooting_series').insert(nyeSerier)
    if (innFeil) {
      await gjenopprett()
      return { ok: false, error: `Kunne ikke lagre seriene — ingenting er endret (${innFeil.message})` }
    }
  }

  for (const r of rader) {
    const db = radKart.get(r.activityId)!
    // Samme regel som saveWorkout: aggregatene AVLEDES av seriene når
    // serier finnes; tørrtrening beholder sine felter urørt.
    if (db.shooting_type === 'torrtrening') continue
    const harSerier = r.serier.some(s => (parseInt(s.shots) || 0) > 0)
    if (!harSerier) continue
    const agg = seriesToLegacyAggregates(r.serier)
    const { error: aggFeil } = await supabase.from('workout_activities')
      .update(agg).eq('id', r.activityId)
    if (aggFeil) {
      await gjenopprett()
      return { ok: false, error: `Kunne ikke oppdatere treff-summene — ingenting er endret (${aggFeil.message})` }
    }
  }

  return { ok: true }
}

// ── Laster ──────────────────────────────────────────────────

export interface PlottTreffSerie {
  id: string
  db_id: string
  position: 'L' | 'S'
  shots: string
  hits: string
  time_seconds: string
  avg_heart_rate: string
  max_heart_rate: string
  note: string
  shot_plot: ({ x: number; y: number } | null)[] | null
  points: string
  vind_retning: 'V' | 'H' | null
  vind_styrke: number | null
  sikt: string | null
}

export interface PlottTreffGruppe {
  activityId: string
  activityType: string
  shootingType: string | null
  erTest: boolean
  testRef: string | null
  sortOrder: number
  /** Plassering i tid — null når skytingen ikke er plassert. */
  startSek: number | null
  sluttSek: number | null
  serier: PlottTreffSerie[]
}

export interface PlottTreffData {
  harPulskurve: boolean
  hr: Array<{ t: number; hr: number }>
  grupper: PlottTreffGruppe[]
}

export async function hentPlottTreff(workoutId: string): Promise<PlottTreffData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [raderRes, samplesRes] = await Promise.all([
    supabase.from('workout_activities')
      .select('id, activity_type, movement_name, shooting_type, shooting_is_test, shooting_test_ref, duration_seconds, sort_order, window_start_seconds, window_duration_seconds, prone_shots, prone_hits, standing_shots, standing_hits, external_id, strava_lap_index, workout_shooting_series(*)')
      .eq('workout_id', workoutId).order('sort_order', { ascending: true }),
    supabase.from('workout_samples').select('hr_samples, created_at')
      .eq('workout_id', workoutId).order('created_at', { ascending: false }).limit(1),
  ])
  if (raderRes.error) return null
  const rader = raderRes.data ?? []
  const hr = (samplesRes.data?.[0]?.hr_samples ?? []) as Array<{ t: number; hr: number }>
  const totalSek = hr.length > 0 ? hr[hr.length - 1].t : 0

  // Plassering i tid via SAMME kjerne som segmentbåndet (lib/segmenter):
  // runder flislegger, manuelt plasserte vinduer flyter. Ingen egen
  // tidsberegning her (regel 11).
  const segmenter = totalSek > 0 ? beregnSegmenter(rader.map(a => ({
    id: a.id,
    activity_type: a.activity_type,
    movement_name: a.movement_name,
    duration_seconds: a.duration_seconds,
    window_start_seconds: a.window_start_seconds,
    window_duration_seconds: a.window_duration_seconds,
    prone_shots: a.prone_shots,
    prone_hits: a.prone_hits,
    standing_shots: a.standing_shots,
    standing_hits: a.standing_hits,
    harKlokkeProveniens: !!a.external_id || a.strava_lap_index != null,
  })), totalSek) : []
  const plassering = new Map(segmenter.map(sg => [sg.aktivitetId, sg]))

  const grupper: PlottTreffGruppe[] = rader
    .filter(a => (a.activity_type ?? '').startsWith('skyting'))
    .map(a => {
      const sg = plassering.get(a.id)
      const serier = ((a.workout_shooting_series ?? []) as Array<Record<string, unknown>>)
        .slice()
        .sort((x, y) => Number(x.series_no ?? 0) - Number(y.series_no ?? 0))
        .map(s => ({
          id: crypto.randomUUID(),
          db_id: String(s.id),
          position: (s.position === 'S' ? 'S' : 'L') as 'L' | 'S',
          shots: s.shots != null ? String(s.shots) : '',
          hits: s.hits != null ? String(s.hits) : '',
          time_seconds: s.time_seconds != null ? String(s.time_seconds) : '',
          avg_heart_rate: s.avg_heart_rate != null ? String(s.avg_heart_rate) : '',
          max_heart_rate: s.max_heart_rate != null ? String(s.max_heart_rate) : '',
          note: s.note != null ? String(s.note) : '',
          shot_plot: (s.shot_plot ?? null) as ({ x: number; y: number } | null)[] | null,
          points: s.points != null ? String(s.points) : '',
          vind_retning: (s.vind_retning ?? null) as 'V' | 'H' | null,
          vind_styrke: s.vind_styrke != null ? Number(s.vind_styrke) : null,
          sikt: (s.sikt ?? null) as string | null,
        }))
      return {
        activityId: a.id,
        activityType: a.activity_type ?? '',
        shootingType: a.shooting_type,
        erTest: a.shooting_is_test === true,
        testRef: a.shooting_test_ref,
        sortOrder: a.sort_order ?? 0,
        startSek: sg?.startSek ?? null,
        sluttSek: sg?.sluttSek ?? null,
        serier,
      }
    })
    // Fasit-rekkefølgen: tidsplasserte først i tidsrekkefølge, deretter
    // uplasserte i radenes egen rekkefølge.
    .sort((a, b) => {
      if (a.startSek != null && b.startSek != null) return a.startSek - b.startSek
      if (a.startSek != null) return -1
      if (b.startSek != null) return 1
      return a.sortOrder - b.sortOrder
    })

  return { harPulskurve: hr.length > 0, hr, grupper }
}
