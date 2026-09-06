'use server'

// BOLK 5 (Analyse v2): øktpakkene til Sammenligning — ÉN server-action for
// 2–4 økter: klokkedata som ØktGraf trenger (samme bygger som øktsida og
// Hjem), radene/skyting/laktat/vær fra compareWorkoutsDetailed, terskelen
// på øktas dato (resolveTerskel — aldri user_heart_zones direkte) og
// nøkkeltallene per økt (varighet · TSS · IF · NP · EF · frakobling · laktat
// maks · treff · opplevd). Alt beregnes her fra lib — ingen kopier av
// formlene (regel 11). Strava-økter vises som andre (regel 2: de holdes
// utenfor modeller andre steder, ikke ute av en sammenligning).

import { createClient } from '@/lib/supabase/server'
import { compareWorkoutsDetailed, type DetailedWorkout, type DetailedActivity } from './compare-workouts'
import { getWorkoutKlokkesyncData, type WorkoutKlokkesyncData } from './workout-klokkesync'
import { resolveTerskel, type TerskelDbRad } from '@/lib/terskel-oppslag'
import { beregnEf } from '@/lib/prestasjon'
import { beregnSoneTss } from '@/lib/belastning'
import { parseActivityDuration } from '@/lib/activity-duration'
import type { ExtendedZoneName } from '@/lib/heart-zones'

export interface SammenligningNokkeltall {
  varighetSek: number
  tss: number | null
  np: number | null
  if: number | null
  ef: number | null
  efKilde: 'watt' | 'fart' | null
  frakoblingPct: number | null
  laktatMaks: number | null
  treff: { hits: number; shots: number } | null
  opplevd: number | null
  forventet: number | null
}

export interface SammenligningOkt {
  id: string
  date: string
  title: string
  sport: string
  workoutType: string | null
  isPlanned: boolean
  totalSeconds: number
  totalMeters: number
  avgHeartRate: number | null
  aktiviteter: DetailedActivity[]
  laktat: DetailedWorkout['lactates']
  vaer: DetailedWorkout['weather']
  /** ØktGraf-pakka (samples, segmenter, punkter, soner). null = ingen klokke/rader. */
  klokke: WorkoutKlokkesyncData | null
  /** Terskelen som gjaldt på øktas dato for dominant bev.form. */
  terskel: TerskelDbRad | null
  nokkeltall: SammenligningNokkeltall
}

/** «MM:SS»- eller minutt-strenger per sone → sekunder. */
function soneSek(a: DetailedActivity): Partial<Record<ExtendedZoneName, number>> {
  const ut: Partial<Record<ExtendedZoneName, number>> = {}
  for (const [k, v] of Object.entries(a.zones ?? {})) {
    const s = String(v ?? '').trim()
    if (!s) continue
    const sek = s.includes(':') ? (parseActivityDuration(s) ?? 0) : (Number(s.replace(',', '.')) || 0) * 60
    if (sek > 0) ut[k as ExtendedZoneName] = (ut[k as ExtendedZoneName] ?? 0) + sek
  }
  return ut
}

function dominantBev(aktiviteter: DetailedActivity[]): string {
  const sum = new Map<string, number>()
  for (const a of aktiviteter) {
    const n = (a.movement_name ?? '').trim()
    if (!n) continue
    sum.set(n, (sum.get(n) ?? 0) + (a.duration_seconds ?? 0))
  }
  let beste = '', mest = -1
  for (const [n, s] of sum) if (s > mest) { beste = n; mest = s }
  return beste
}

export async function hentSammenligning(
  ids: string[],
  targetUserId?: string,
): Promise<SammenligningOkt[] | { error: string }> {
  const rene = ids.filter(Boolean).slice(0, 4)
  if (rene.length === 0) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const eier = targetUserId ?? user.id

  const [detaljer, klokker, metaRes, terskelRes] = await Promise.all([
    compareWorkoutsDetailed(rene),
    Promise.all(rene.map(id => getWorkoutKlokkesyncData(id).catch(() => null))),
    supabase.from('workouts').select('id, is_planned, workout_type').in('id', rene),
    supabase.from('user_thresholds')
      .select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from')
      .eq('user_id', eier),
  ])
  if ('error' in detaljer) return { error: detaljer.error }
  const meta = new Map((metaRes.data ?? []).map(m => [m.id as string, m]))
  const terskler = (terskelRes.data ?? []) as TerskelDbRad[]

  const ut: SammenligningOkt[] = []
  for (const id of rene) {
    const d = detaljer.find(x => x.id === id)
    if (!d) continue
    const klokke = klokker[rene.indexOf(id)] ?? null
    const m = meta.get(id)
    const bev = dominantBev(d.activities)
    const sub = d.activities.find(a => (a.movement_name ?? '').trim() === bev)
    const terskel = resolveTerskel(terskler, d.date, bev, '') ?? (sub ? null : null)

    // Nøkkeltall — fra lib, samme formler som Prestasjon/Belastning/øktsida.
    const soner: Partial<Record<ExtendedZoneName, number>> = {}
    for (const a of d.activities) for (const [k, s] of Object.entries(soneSek(a))) soner[k as ExtendedZoneName] = (soner[k as ExtendedZoneName] ?? 0) + (s ?? 0)
    const tssRaw = beregnSoneTss(soner)
    const np = klokke?.wattMetrikker?.np ?? null
    const ftp = terskel?.ftp_watts ?? klokke?.ftp ?? null
    const efRes = beregnEf(d.total_meters, d.total_seconds, d.avg_heart_rate, np)
    let hits = 0, shots = 0, harSkyting = false
    for (const a of d.activities) for (const s of a.shooting_series) { if (s.hits != null) { hits += s.hits; shots += s.shots; harSkyting = true } }
    const laktatMaks = d.lactates.length > 0 ? Math.max(...d.lactates.map(l => l.mmol)) : null

    ut.push({
      id, date: d.date, title: d.title, sport: d.sport,
      workoutType: (m?.workout_type as string | null) ?? null,
      isPlanned: !!m?.is_planned,
      totalSeconds: d.total_seconds, totalMeters: d.total_meters, avgHeartRate: d.avg_heart_rate,
      aktiviteter: d.activities, laktat: d.lactates, vaer: d.weather,
      klokke, terskel,
      nokkeltall: {
        varighetSek: d.total_seconds,
        tss: tssRaw > 0 ? Math.round(tssRaw) : null,
        np,
        if: np != null && ftp ? Math.round((np / ftp) * 100) / 100 : null,
        ef: efRes?.verdi ?? null,
        efKilde: efRes?.kilde ?? null,
        frakoblingPct: klokke?.frakobling?.driftPct ?? null,
        laktatMaks,
        treff: harSkyting ? { hits, shots } : null,
        opplevd: klokke?.rpe ?? null,
        forventet: klokke?.forventet ?? null,
      },
    })
  }
  return ut
}
