'use server'

// BOLK 6 (Analyse v2 + tillegg 6. sep): STANDARDØKTER — alt over tid + side om
// side. ÉN action per serie: alle gjennomføringene som rader med ALLE
// variablene (tid per drag og totalt, puls snitt/maks, laktat, tempo, watt/
// NP, kadens, treff/skytetid, opplevd, EF, frakobling, % av terskel den
// dagen, vær/føre) + ØktGraf-pakkene for de valgte (samme bygger som
// Sammenligning). Formlene fra lib — ingen kopier. Estimater skrives aldri.

import { createClient } from '@/lib/supabase/server'
import { compareWorkoutsDetailed, type DetailedActivity } from './compare-workouts'
import { hentSammenligning, type SammenligningOkt } from './sammenligning'
import { beregnEf } from '@/lib/prestasjon'
import { resolveTerskel, type TerskelDbRad } from '@/lib/terskel-oppslag'
import { segmentTypeFor } from '@/lib/segmenter'

export interface SerieDrag {
  idx: number
  sek: number | null
  meter: number | null
  snittpuls: number | null
  makspuls: number | null
  watt: number | null
  tempoSekPerKm: number | null
  treff: { hits: number; shots: number } | null
}

export interface SerieRad {
  workout_id: string
  date: string
  title: string
  workout_type: string | null
  erKonkurranse: boolean
  totalSek: number
  meter: number
  snittpuls: number | null
  makspuls: number | null
  laktatMaks: number | null
  laktat: number[]
  tempoSekPerKm: number | null
  snittwatt: number | null
  np: number | null
  kadens: number | null
  treffPct: number | null
  skytetidSnitt: number | null
  opplevd: number | null
  ef: number | null
  frakoblingPct: number | null
  /** Snittpuls i prosent av terskelpulsen som gjaldt på datoen (resolveTerskel). */
  pctAvTerskel: number | null
  terskelHr: number | null
  vaer: { temperatur: number | null; type: string | null; fore: string[] } | null
  drag: SerieDrag[]
}

export interface SerieAnalyse {
  rader: SerieRad[]
  /** ØktGraf-pakkene for de valgte gjennomføringene (≤ 6). */
  pakker: SammenligningOkt[]
}

export async function hentSerieAnalyse(
  alleIds: string[],
  valgteIds: string[],
  targetUserId?: string,
): Promise<SerieAnalyse | { error: string }> {
  const ids = [...new Set(alleIds.filter(Boolean))].slice(0, 60)
  if (ids.length === 0) return { rader: [], pakker: [] }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const eier = targetUserId ?? user.id

  const valgte = valgteIds.filter(id => ids.includes(id)).slice(0, 6)
  const [detaljer, metaRes, terskelRes, pakker] = await Promise.all([
    compareWorkoutsDetailed(ids),
    supabase.from('workouts').select('id, workout_type, rpe').in('id', ids),
    supabase.from('user_thresholds').select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from').eq('user_id', eier),
    valgte.length > 0 ? hentSammenligning(valgte, targetUserId, 6) : Promise.resolve([] as SammenligningOkt[]),
  ])
  if ('error' in detaljer) return { error: detaljer.error }
  if ('error' in pakker) return { error: pakker.error }
  const meta = new Map((metaRes.data ?? []).map(m => [m.id as string, m as { workout_type: string | null; rpe: number | null }]))
  const terskler = (terskelRes.data ?? []) as TerskelDbRad[]
  const pakkeBy = new Map(pakker.map(p => [p.id, p]))

  const erDrag = (a: DetailedActivity) => segmentTypeFor(a.activity_type ?? 'aktivitet', a.movement_name ?? '') === 'drag'
  const rader: SerieRad[] = []
  for (const w of detaljer) {
    const m = meta.get(w.id)
    const akt = w.activities
    const trening = akt.filter(a => { const t = segmentTypeFor(a.activity_type ?? 'aktivitet', a.movement_name ?? ''); return t !== 'pause' && !t.startsWith('skyting') })
    let sek = 0, meter = 0, hrV = 0, hrS = 0, maks: number | null = null, wV = 0, wS = 0, kadV = 0, kadS = 0
    for (const a of trening) {
      const d = a.duration_seconds ?? 0; sek += d; meter += a.distance_meters ?? 0
      if (a.avg_heart_rate && d > 0) { hrV += a.avg_heart_rate * d; hrS += d }
      if (a.max_heart_rate) maks = Math.max(maks ?? 0, a.max_heart_rate)
      if (a.avg_watts && d > 0) { wV += a.avg_watts * d; wS += d }
      const kad = a.avg_cadence
      if (kad && d > 0) { kadV += kad * d; kadS += d }
    }
    let hits = 0, shots = 0, harSkyting = false, tidSum = 0, tidN = 0
    for (const a of akt) {
      if (a.shooting_series.length === 0) {
        // Rader uten serier (eldre/enkle): aggregatene på raden — samme fallback som skyteanalysen.
        if (a.prone_hits != null) { hits += a.prone_hits; shots += a.prone_shots ?? 0; harSkyting = true }
        if (a.standing_hits != null) { hits += a.standing_hits; shots += a.standing_shots ?? 0; harSkyting = true }
        continue
      }
      for (const s of a.shooting_series) { if (s.hits != null) { hits += s.hits; shots += s.shots; harSkyting = true } if (s.time_seconds != null) { tidSum += s.time_seconds; tidN++ } }
    }
    const laktat = w.lactates.map(l => l.mmol)
    const snittpuls = hrS > 0 ? Math.round(hrV / hrS) : w.avg_heart_rate
    const dominant = (() => { const s2 = new Map<string, number>(); for (const a of trening) { const n = (a.movement_name ?? '').trim(); if (n) s2.set(n, (s2.get(n) ?? 0) + (a.duration_seconds ?? 0)) } let b = '', mest = -1; for (const [n, v] of s2) if (v > mest) { b = n; mest = v } return b })()
    const tersk = resolveTerskel(terskler, w.date, dominant, '')
    const pakke = pakkeBy.get(w.id)
    const ef = pakke?.nokkeltall.ef ?? beregnEf(meter, sek, snittpuls, wS >= sek * 0.5 ? wV / wS : null)?.verdi ?? null
    const drag: SerieDrag[] = akt.filter(erDrag).map((a, i) => {
      let h = 0, s2 = 0, har = false
      for (const x of a.shooting_series) if (x.hits != null) { h += x.hits; s2 += x.shots; har = true }
      return {
        idx: i + 1, sek: a.duration_seconds, meter: a.distance_meters, snittpuls: a.avg_heart_rate, makspuls: a.max_heart_rate, watt: a.avg_watts,
        tempoSekPerKm: a.avg_pace_seconds_per_km ?? (a.distance_meters && a.duration_seconds && a.distance_meters > 0 ? Math.round(a.duration_seconds / (a.distance_meters / 1000)) : null),
        treff: har ? { hits: h, shots: s2 } : null,
      }
    })
    rader.push({
      workout_id: w.id, date: w.date, title: w.title, workout_type: m?.workout_type ?? null,
      erKonkurranse: m?.workout_type === 'competition' || m?.workout_type === 'testlop',
      totalSek: sek || w.total_seconds, meter: meter || w.total_meters,
      snittpuls, makspuls: maks, laktatMaks: laktat.length ? Math.max(...laktat) : null, laktat,
      tempoSekPerKm: meter > 0 && sek > 0 ? Math.round(sek / (meter / 1000)) : null,
      snittwatt: wS > 0 ? Math.round(wV / wS) : null, np: pakke?.nokkeltall.np ?? null,
      kadens: kadS > 0 ? Math.round(kadV / kadS) : null,
      treffPct: harSkyting && shots > 0 ? Math.round((hits / shots) * 1000) / 10 : null,
      skytetidSnitt: tidN > 0 ? Math.round((tidSum / tidN) * 10) / 10 : null,
      opplevd: m?.rpe ?? pakke?.nokkeltall.opplevd ?? null,
      ef, frakoblingPct: pakke?.nokkeltall.frakoblingPct ?? null,
      pctAvTerskel: tersk && snittpuls ? Math.round((snittpuls / tersk.threshold_hr) * 100) : null,
      terskelHr: tersk?.threshold_hr ?? null,
      vaer: w.weather ? { temperatur: w.weather.temperature, type: w.weather.weather_type, fore: w.weather.surface_conditions ?? [] } : null,
      drag,
    })
  }
  rader.sort((a, b) => a.date.localeCompare(b.date))
  return { rader, pakker }
}
