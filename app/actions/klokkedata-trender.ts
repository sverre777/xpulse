'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'

// Aggregert klokkedata over en tidsperiode. Bygger på per-økt-aggregater
// (workouts + workout_activities) — samples-arrays er for tunge for å
// hente over måneder/år.
//
// Hver chart-serie er pre-beregnet og lett å rendre uten ekstra logikk.

export interface KlokkedataTrender {
  // Aerob effektivitet: hastighet (m/s) per puls (bpm) per økt. Stigende
  // verdi over tid = bedre form (mer fart for samme puls).
  aerobEfficiency: TrendPoint[]
  // Avg-watt / avg-HR — gir samme idé for sykling/skiing m/power-meter.
  wattPerHr: TrendPoint[]
  // Suffer score (Strava) — hvor "hardt" Strava synes økten var.
  sufferScore: TrendPoint[]
  // Snitt-kadens per økt.
  cadence: TrendPoint[]
  // Power curve: beste 1/5/20-min snitt-watt over hele perioden, basert
  // på samples for økter med tilgjengelig data. Tom array hvis ingen
  // watt-samples i perioden.
  powerCurve: { duration_label: string; duration_sec: number; watts: number }[]
  // Cardiac drift per økt: HR-stigning fra første halvdel til siste.
  // Krever samples — beregnes for opp til 50 nyeste økter for å holde
  // kostnaden lav.
  cardiacDrift: TrendPoint[]
  // Tid i sone per uke for stacked-bar. polarized_pct = (I1+I2) andel av total
  // — 80%+ indikerer 80/20-prinsippet er fulgt. Verdier i timer (decimal).
  zonesPerWeek: ZoneWeekPoint[]
  // Antall økter som hadde nok klokkesync-data i perioden.
  workoutsWithKlokkesync: number
  // Total økter i perioden (for proporsjon).
  workoutsTotal: number
}

export interface ZoneWeekPoint {
  week: string         // YYYY-Www
  I1: number           // timer
  I2: number
  I3: number
  I4: number
  I5: number
  Hurtighet: number
  total: number
  polarized_pct: number  // (I1+I2)/total * 100
}

export interface TrendPoint {
  date: string  // YYYY-MM-DD
  workout_id: string
  title: string
  sport: Sport
  value: number
  // For aerob effektivitet: HR + pace separat så tooltip kan vise begge.
  hr?: number
  // m/s for løping/ski, km/t for sykling.
  speed?: number
}

export async function getKlokkedataTrender(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
): Promise<KlokkedataTrender | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    let q = supabase
      .from('workouts')
      .select(`
        id, date, title, sport, suffer_score,
        avg_heart_rate, duration_minutes, distance_km,
        workout_activities(activity_type, avg_heart_rate, avg_watts, avg_speed_ms, avg_cadence, duration_seconds, zones)
      `)
      .eq('user_id', user.id)
      .or('is_completed.eq.true,is_planned.eq.false')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) q = q.eq('sport', sportFilter)

    const { data, error } = await q
    if (error) return { error: error.message }

    type Row = {
      id: string
      date: string
      title: string
      sport: Sport
      suffer_score: number | null
      avg_heart_rate: number | null
      duration_minutes: number | null
      distance_km: number | null
      workout_activities: Array<{
        activity_type: string | null
        avg_heart_rate: number | null
        avg_watts: number | null
        avg_speed_ms: number | null
        avg_cadence: number | null
        duration_seconds: number | null
        zones: Record<string, number> | null
      }>
    }
    const rows = (data ?? []) as Row[]
    const workoutsTotal = rows.length

    const aerobEfficiency: TrendPoint[] = []
    const wattPerHr: TrendPoint[] = []
    const sufferScore: TrendPoint[] = []
    const cadence: TrendPoint[] = []
    // Aggregér zones-sekunder per ISO-uke. zones-jsonb er i SEKUNDER (phase 64+),
    // pause + skyting ekskluderes via activity_type-filter.
    const zonesByWeek = new Map<string, { I1: number; I2: number; I3: number; I4: number; I5: number; Hurtighet: number }>()
    const SHOOTING_TYPES = new Set(['skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting','skyting_basis'])
    const PAUSE_TYPES = new Set(['pause','aktiv_pause'])

    for (const w of rows) {
      // Aggreger snittet av aktiviteter, vektet på varighet.
      const wactsAgg = aggregateActivities(w.workout_activities)

      const avgHr = w.avg_heart_rate ?? wactsAgg.avgHr
      const avgSpeed = wactsAgg.avgSpeedMs
      const avgWatts = wactsAgg.avgWatts
      const avgCadence = wactsAgg.avgCadence

      // Aerob effektivitet: speed/hr. Bare gyldig om begge er > 0.
      if (avgHr && avgHr > 0 && avgSpeed && avgSpeed > 0.5) {
        const speedKmh = avgSpeed * 3.6
        // Vis verdi som m/min per slag (intuitivt) → speed/hr * 60.
        const efficiency = (avgSpeed / avgHr) * 60
        aerobEfficiency.push({
          date: w.date, workout_id: w.id, title: w.title, sport: w.sport,
          value: Math.round(efficiency * 1000) / 1000,
          hr: avgHr, speed: speedKmh,
        })
      }

      // Watt/HR — bra for sykling/ski.
      if (avgHr && avgHr > 0 && avgWatts && avgWatts > 0) {
        wattPerHr.push({
          date: w.date, workout_id: w.id, title: w.title, sport: w.sport,
          value: Math.round((avgWatts / avgHr) * 100) / 100,
          hr: avgHr, speed: avgWatts,
        })
      }

      // Suffer score direkte fra Strava.
      if (w.suffer_score != null) {
        sufferScore.push({
          date: w.date, workout_id: w.id, title: w.title, sport: w.sport,
          value: w.suffer_score,
        })
      }

      // Snitt-kadens.
      if (avgCadence != null && avgCadence > 0) {
        cadence.push({
          date: w.date, workout_id: w.id, title: w.title, sport: w.sport,
          value: Math.round(avgCadence),
        })
      }

      // Sone-tid per uke fra workout_activities.zones (sekunder fra phase 64).
      // Ekskluderer pauser + skyting per activity_type.
      const weekKey = isoWeekKey(w.date)
      const bucket = zonesByWeek.get(weekKey) ?? { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
      for (const a of w.workout_activities ?? []) {
        const at = (a.activity_type ?? '').toLowerCase()
        if (PAUSE_TYPES.has(at) || SHOOTING_TYPES.has(at)) continue
        const z = a.zones
        if (!z) continue
        for (const k of ['I1','I2','I3','I4','I5','Hurtighet'] as const) {
          const sec = Number(z[k]) || 0
          if (sec > 0) bucket[k] += sec
        }
      }
      zonesByWeek.set(weekKey, bucket)
    }

    // Konverter zonesByWeek til array sortert kronologisk, sek → timer.
    const zonesPerWeek: ZoneWeekPoint[] = [...zonesByWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, z]) => {
        const total = z.I1 + z.I2 + z.I3 + z.I4 + z.I5 + z.Hurtighet
        const easy = z.I1 + z.I2
        return {
          week,
          I1: round1(z.I1 / 3600),
          I2: round1(z.I2 / 3600),
          I3: round1(z.I3 / 3600),
          I4: round1(z.I4 / 3600),
          I5: round1(z.I5 / 3600),
          Hurtighet: round1(z.Hurtighet / 3600),
          total: round1(total / 3600),
          polarized_pct: total > 0 ? Math.round((easy / total) * 100) : 0,
        }
      })

    // Power curve + cardiac drift krever samples → hent dem for nyeste 50
    // workouts som hadde wattaggregat (cycling/triathlon).
    const recentIds = rows
      .slice(-50)
      .map(r => r.id)
    let powerCurve: { duration_label: string; duration_sec: number; watts: number }[] = []
    let cardiacDrift: TrendPoint[] = []
    let workoutsWithKlokkesync = 0

    if (recentIds.length > 0) {
      const { data: samplesData } = await supabase
        .from('workout_samples')
        .select('workout_id, hr_samples, watt_samples')
        .in('workout_id', recentIds)

      const samplesByWorkout = new Map<string, {
        hr_samples: Array<{ t: number; hr: number }> | null
        watt_samples: Array<{ t: number; w: number }> | null
      }>()
      for (const s of samplesData ?? []) {
        samplesByWorkout.set(s.workout_id, {
          hr_samples: s.hr_samples,
          watt_samples: s.watt_samples,
        })
      }
      workoutsWithKlokkesync = samplesByWorkout.size

      // Power curve over hele perioden — Concept2/Strava-standard varigheter.
      const bests: Record<number, number> = { 5: 0, 60: 0, 300: 0, 1200: 0, 3600: 0 }
      for (const s of samplesByWorkout.values()) {
        const w = s.watt_samples
        if (!w || w.length < 5) continue
        const seq = w.map(p => ({ t: p.t, v: p.w }))
        for (const dur of [5, 60, 300, 1200, 3600]) {
          const a = bestRollingAvg(seq, dur)
          if (a && a > bests[dur]) bests[dur] = a
        }
      }
      const powerLabels: Array<[number, string]> = [
        [5, '5 sek'], [60, '1 min'], [300, '5 min'], [1200, '20 min'], [3600, '60 min'],
      ]
      powerCurve = powerLabels
        .map(([sec, label]) => ({ duration_label: label, duration_sec: sec, watts: bests[sec] }))
        .filter(p => p.watts > 0)

      // Cardiac drift per workout som har hr_samples.
      const workoutById = new Map(rows.map(r => [r.id, r]))
      for (const [wid, s] of samplesByWorkout) {
        const hr = s.hr_samples
        if (!hr || hr.length < 60) continue
        const wRow = workoutById.get(wid)
        if (!wRow) continue
        const drift = computeDriftPct(hr)
        if (drift == null) continue
        cardiacDrift.push({
          date: wRow.date,
          workout_id: wRow.id,
          title: wRow.title,
          sport: wRow.sport,
          value: Math.round(drift * 10) / 10,
        })
      }
      // Sortér på dato.
      cardiacDrift = cardiacDrift.sort((a, b) => a.date.localeCompare(b.date))
    }

    return {
      aerobEfficiency,
      wattPerHr,
      sufferScore,
      cadence,
      powerCurve,
      cardiacDrift,
      zonesPerWeek,
      workoutsWithKlokkesync,
      workoutsTotal,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[klokkedata-trender] failed:', msg, e)
    return { error: msg }
  }
}

// Vektet snitt av per-aktivitet-felter på varighet. Returnerer 0/null
// hvis ingen aktiviteter har data.
function aggregateActivities(
  acts: Array<{
    avg_heart_rate: number | null
    avg_watts: number | null
    avg_speed_ms: number | null
    avg_cadence: number | null
    duration_seconds: number | null
  }>,
): { avgHr: number | null; avgWatts: number | null; avgSpeedMs: number | null; avgCadence: number | null } {
  let hrSum = 0, hrW = 0
  let wtSum = 0, wtW = 0
  let spSum = 0, spW = 0
  let cdSum = 0, cdW = 0
  for (const a of acts) {
    const dur = a.duration_seconds ?? 0
    if (dur <= 0) continue
    if (a.avg_heart_rate != null) { hrSum += a.avg_heart_rate * dur; hrW += dur }
    if (a.avg_watts != null) { wtSum += Number(a.avg_watts) * dur; wtW += dur }
    if (a.avg_speed_ms != null) { spSum += Number(a.avg_speed_ms) * dur; spW += dur }
    if (a.avg_cadence != null) { cdSum += Number(a.avg_cadence) * dur; cdW += dur }
  }
  return {
    avgHr: hrW > 0 ? hrSum / hrW : null,
    avgWatts: wtW > 0 ? wtSum / wtW : null,
    avgSpeedMs: spW > 0 ? spSum / spW : null,
    avgCadence: cdW > 0 ? cdSum / cdW : null,
  }
}

function bestRollingAvg(
  data: Array<{ t: number; v: number }>,
  windowSec: number,
): number | null {
  if (data.length < 2) return null
  const totalSec = data[data.length - 1].t - data[0].t
  if (totalSec < windowSec) return null
  let best = -Infinity
  let i = 0, j = 0, sum = 0, count = 0
  while (j < data.length) {
    sum += data[j].v
    count++
    while (data[j].t - data[i].t > windowSec && i < j) {
      sum -= data[i].v
      count--
      i++
    }
    if (data[j].t - data[i].t >= windowSec - 1) {
      const a = sum / count
      if (a > best) best = a
    }
    j++
  }
  return best === -Infinity ? null : Math.round(best)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ISO-uke "YYYY-Www" fra dato-streng. Mandag = uke-start.
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  // ISO-uke: torsdagens år; ukestart mandag.
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(
    ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  )
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function computeDriftPct(hr: Array<{ t: number; hr: number }>): number | null {
  if (hr.length < 30) return null
  const mid = Math.floor(hr.length / 2)
  const first = hr.slice(0, mid)
  const second = hr.slice(mid)
  const avg = (arr: typeof hr) => arr.reduce((a, b) => a + b.hr, 0) / arr.length
  const a1 = avg(first)
  const a2 = avg(second)
  if (a1 <= 0) return null
  return ((a2 - a1) / a1) * 100
}
