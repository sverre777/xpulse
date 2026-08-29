'use server'

import { createClient } from '@/lib/supabase/server'
import { kanFlislegge, type SegmentRad } from '@/lib/segmenter'

// «Legg til detaljer» (fase 113, bolk 3): pop-upens data + lagring.
//
// Skriver KUN eksisterende felter (regel 11):
//   - vinduer   → workout_activities.window_start_seconds/-duration_seconds
//   - rekkefølge→ workout_activities.sort_order (ren visning, aldri data)
//   - laktat    → workout_lactate_measurements.measured_at_time (TIME —
//                 klokkeslett = øktas time_of_day + sekunder fra start;
//                 mangler time_of_day brukes 00:00 som base, samme
//                 fallback som graf-lesingen i workout-klokkesync)
//   - ernæring  → workout_nutrition_entries.time_offset_minutes
//
// All autorisasjon går via RLS (eier + trener med redigeringsrett — samme
// rader som øvrige økt-skriveflater). 0 oppdaterte rader = ærlig feil.

// MERK: ALDRI type-re-eksport fra en 'use server'-fil (regel 24).

export interface DetaljerRad {
  id: string
  activity_type: string | null
  movement_name: string | null
  duration_seconds: number | null
  sort_order: number | null
  window_start_seconds: number | null
  window_duration_seconds: number | null
  prone_shots: number | null
  prone_hits: number | null
  standing_shots: number | null
  standing_hits: number | null
  /** Sum ført skytetid (workout_shooting_series.time_seconds) — porten. */
  skytetidSek: number | null
}

export interface DetaljerLaktat {
  id: string
  mmol: number
  /** Sekunder fra økt-start, null = ikke tidfestet. */
  sekunder: number | null
}

export interface DetaljerErnaering {
  id: string
  type: string
  carbs_g: number | null
  minutter: number | null
}

export interface LeggTilDetaljerData {
  totalSek: number
  harRunder: boolean
  sport: string | null
  hr: Array<{ t: number; hr: number }>
  /** Fart (pace_samples ?? speed_samples — samme prioritet som økt-grafen). */
  fart: Array<{ t: number; mps: number }>
  watt: Array<{ t: number; w: number }>
  /** Høyde — tegnes som bakgrunnsprofil under valgt kurve. */
  hoyde: Array<{ t: number; alt: number }>
  rader: DetaljerRad[]
  laktat: DetaljerLaktat[]
  ernaering: DetaljerErnaering[]
}

export async function hentLeggTilDetaljer(workoutId: string): Promise<LeggTilDetaljerData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [workoutRes, samplesRes, raderRes, laktatRes, ernaeringRes] = await Promise.all([
    supabase.from('workouts').select('id, time_of_day, sport').eq('id', workoutId).maybeSingle(),
    supabase.from('workout_samples').select('hr_samples, pace_samples, speed_samples, watt_samples, altitude_samples, created_at')
      .eq('workout_id', workoutId).order('created_at', { ascending: false }).limit(1),
    supabase.from('workout_activities')
      .select('id, activity_type, movement_name, duration_seconds, sort_order, window_start_seconds, window_duration_seconds, prone_shots, prone_hits, standing_shots, standing_hits, external_id, strava_lap_index, workout_shooting_series(time_seconds)')
      .eq('workout_id', workoutId).order('sort_order', { ascending: true }),
    supabase.from('workout_lactate_measurements')
      .select('id, mmol, measured_at_time')
      .eq('workout_id', workoutId).order('sort_order', { ascending: true }),
    supabase.from('workout_nutrition_entries')
      .select('id, nutrition_type, carbs_g, time_offset_minutes')
      .eq('workout_id', workoutId),
  ])
  const workout = workoutRes.data
  if (!workout) return null

  const samplesRad = samplesRes.data?.[0]
  const hr = (samplesRad?.hr_samples ?? []) as Array<{ t: number; hr: number }>
  const fart = ((samplesRad?.pace_samples ?? samplesRad?.speed_samples) ?? []) as Array<{ t: number; mps: number }>
  const watt = (samplesRad?.watt_samples ?? []) as Array<{ t: number; w: number }>
  const hoyde = (samplesRad?.altitude_samples ?? []) as Array<{ t: number; alt: number }>
  const totalSek = Math.max(
    hr.length > 0 ? hr[hr.length - 1].t : 0,
    fart.length > 0 ? fart[fart.length - 1].t : 0,
    watt.length > 0 ? watt[watt.length - 1].t : 0,
  )

  const rader: DetaljerRad[] = (raderRes.data ?? []).map(a => {
    const serier = (a.workout_shooting_series ?? []) as Array<{ time_seconds: number | null }>
    const skytetid = serier.reduce((sum, s) => sum + (s.time_seconds ?? 0), 0)
    return {
      id: a.id,
      activity_type: a.activity_type,
      movement_name: a.movement_name,
      duration_seconds: a.duration_seconds,
      sort_order: a.sort_order,
      window_start_seconds: a.window_start_seconds,
      window_duration_seconds: a.window_duration_seconds,
      prone_shots: a.prone_shots,
      prone_hits: a.prone_hits,
      standing_shots: a.standing_shots,
      standing_hits: a.standing_hits,
      skytetidSek: skytetid > 0 ? skytetid : null,
    }
  })

  const harRunder = kanFlislegge(
    (raderRes.data ?? [])
      .filter(a => a.window_start_seconds == null || a.window_duration_seconds == null)
      .map(a => tilSegmentRad(a)),
    totalSek,
  )

  const startSek = klokkeslettTilSek(workout.time_of_day)
  const laktat: DetaljerLaktat[] = (laktatRes.data ?? []).map(l => ({
    id: l.id,
    mmol: Number(l.mmol),
    sekunder: l.measured_at_time != null
      ? Math.max(0, klokkeslettTilSek(l.measured_at_time) - startSek)
      : null,
  }))
  const ernaering: DetaljerErnaering[] = (ernaeringRes.data ?? []).map(n => ({
    id: n.id,
    type: n.nutrition_type ?? 'gel',
    carbs_g: n.carbs_g != null ? Number(n.carbs_g) : null,
    minutter: n.time_offset_minutes != null ? Number(n.time_offset_minutes) : null,
  }))

  return { totalSek, harRunder, sport: (workout.sport as string | null) ?? null, hr, fart, watt, hoyde, rader, laktat, ernaering }
}

export interface LagreDetaljerInput {
  /** Full fasit for plasserte vinduer: rad-id → vindu eller null (fjern). */
  vinduer: Array<{ activityId: string; startSek: number | null; varighetSek: number | null }>
  /** Rad-id-er i ønsket visningsrekkefølge, eller null = urørt. */
  rekkefolge: string[] | null
  laktat: Array<{ id: string; sekunder: number | null }>
  ernaering: Array<{ id: string; minutter: number | null }>
}

export async function lagreLeggTilDetaljer(
  workoutId: string,
  input: LagreDetaljerInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: workout } = await supabase.from('workouts')
    .select('id, time_of_day').eq('id', workoutId).maybeSingle()
  if (!workout) return { ok: false, error: 'Fant ikke økta' }

  // Vindus-skriving valideres mot gjeldende tilstand i basen — ikke bare
  // mot det pop-upen tror (to faner, trener + utøver samtidig).
  if (input.vinduer.length > 0) {
    const [raderRes, samplesRes] = await Promise.all([
      supabase.from('workout_activities')
        .select('id, activity_type, movement_name, duration_seconds, window_start_seconds, window_duration_seconds, prone_shots, prone_hits, standing_shots, standing_hits, external_id, strava_lap_index')
        .eq('workout_id', workoutId),
      supabase.from('workout_samples').select('hr_samples, created_at')
        .eq('workout_id', workoutId).order('created_at', { ascending: false }).limit(1),
    ])
    const rader = raderRes.data ?? []
    const hr = (samplesRes.data?.[0]?.hr_samples ?? []) as Array<{ t: number }>
    const totalSek = hr.length > 0 ? hr[hr.length - 1].t : 0

    // Økter MED runder får aldri manuelt plasserte vinduer — runden har
    // alt (fasit-avgrensningen). Sjekkes her så ikke en gammel fane kan
    // skrive vinduer etter at en klokkesynk ga økta runder.
    const harRunder = kanFlislegge(
      rader.filter(a => a.window_start_seconds == null || a.window_duration_seconds == null)
        .map(a => tilSegmentRad(a)),
      totalSek,
    )
    const nyeVinduer = input.vinduer.filter(v => v.startSek != null && v.varighetSek != null)
    if (harRunder && nyeVinduer.length > 0) {
      return { ok: false, error: 'Økta har runder fra klokka — omdøp runden i stedet, den har tid og puls' }
    }

    // Gjeldende vinduer etter endringen: basens vinduer, overstyrt av input.
    const vindusKart = new Map<string, { start: number; slutt: number } | null>()
    for (const r of rader) {
      if (r.window_start_seconds != null && r.window_duration_seconds != null) {
        vindusKart.set(r.id, { start: r.window_start_seconds, slutt: r.window_start_seconds + r.window_duration_seconds })
      }
    }
    for (const v of input.vinduer) {
      if (!rader.some(r => r.id === v.activityId)) {
        return { ok: false, error: 'En av radene finnes ikke lenger — last økta på nytt' }
      }
      vindusKart.set(v.activityId, v.startSek != null && v.varighetSek != null
        ? { start: v.startSek, slutt: v.startSek + v.varighetSek } : null)
    }
    const alle = [...vindusKart.entries()].filter((e): e is [string, { start: number; slutt: number }] => e[1] != null)
    for (const [, v] of alle) {
      if (v.start < 0 || v.slutt <= v.start) return { ok: false, error: 'Ugyldig vindu' }
      if (totalSek > 0 && v.start >= totalSek) return { ok: false, error: 'Vinduet starter etter at kurven slutter' }
    }
    for (let i = 0; i < alle.length; i++) {
      for (let j = i + 1; j < alle.length; j++) {
        if (alle[i][1].start < alle[j][1].slutt && alle[j][1].start < alle[i][1].slutt) {
          return { ok: false, error: 'To vinduer overlapper — flytt eller kort inn det ene' }
        }
      }
    }

    for (const v of input.vinduer) {
      const { error, count } = await supabase.from('workout_activities')
        .update({
          window_start_seconds: v.startSek != null ? Math.round(v.startSek) : null,
          window_duration_seconds: v.varighetSek != null ? Math.round(v.varighetSek) : null,
        }, { count: 'exact' })
        .eq('id', v.activityId).eq('workout_id', workoutId)
      if (error) return { ok: false, error: `Kunne ikke lagre vinduet: ${error.message}` }
      if (!count) return { ok: false, error: 'Vinduet ble ikke lagret — mangler du redigeringsrett?' }
    }
  }

  if (input.rekkefolge && input.rekkefolge.length > 0) {
    for (let i = 0; i < input.rekkefolge.length; i++) {
      const { error, count } = await supabase.from('workout_activities')
        .update({ sort_order: i }, { count: 'exact' })
        .eq('id', input.rekkefolge[i]).eq('workout_id', workoutId)
      if (error) return { ok: false, error: `Kunne ikke lagre rekkefølgen: ${error.message}` }
      if (!count) return { ok: false, error: 'Rekkefølgen ble ikke lagret — mangler du redigeringsrett?' }
    }
  }

  const startSek = klokkeslettTilSek(workout.time_of_day)
  for (const l of input.laktat) {
    const { error, count } = await supabase.from('workout_lactate_measurements')
      .update({
        measured_at_time: l.sekunder != null ? sekTilKlokkeslett(startSek + l.sekunder) : null,
      }, { count: 'exact' })
      .eq('id', l.id).eq('workout_id', workoutId)
    if (error) return { ok: false, error: `Kunne ikke tidfeste laktat: ${error.message}` }
    if (!count) return { ok: false, error: 'Laktatmålingen ble ikke lagret — mangler du redigeringsrett?' }
  }
  for (const n of input.ernaering) {
    const { error, count } = await supabase.from('workout_nutrition_entries')
      .update({
        time_offset_minutes: n.minutter != null ? Math.round(n.minutter) : null,
      }, { count: 'exact' })
      .eq('id', n.id).eq('workout_id', workoutId)
    if (error) return { ok: false, error: `Kunne ikke tidfeste ernæring: ${error.message}` }
    if (!count) return { ok: false, error: 'Ernæringen ble ikke lagret — mangler du redigeringsrett?' }
  }

  return { ok: true }
}

// ── Hjelpere ─────────────────────────────────────────────────

function tilSegmentRad(a: {
  id: string
  activity_type: string | null
  movement_name: string | null
  duration_seconds: number | null
  window_start_seconds: number | null
  window_duration_seconds: number | null
  prone_shots: number | null
  prone_hits: number | null
  standing_shots: number | null
  standing_hits: number | null
  external_id?: string | null
  strava_lap_index?: number | null
}): SegmentRad {
  return {
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
  }
}

/** 'HH:MM' eller 'HH:MM:SS' → sekunder fra midnatt (null/ugyldig → 0). */
function klokkeslettTilSek(hhmm: string | null): number {
  if (!hhmm) return 0
  const deler = hhmm.split(':').map(Number)
  if (deler.some(Number.isNaN)) return 0
  return (deler[0] ?? 0) * 3600 + (deler[1] ?? 0) * 60 + (deler[2] ?? 0)
}

function sekTilKlokkeslett(sek: number): string {
  const s = ((Math.round(sek) % 86400) + 86400) % 86400
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
