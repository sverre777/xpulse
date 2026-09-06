'use server'

import { createClient } from '@/lib/supabase/server'
import { besteRullendeSnitt } from '@/lib/rullende-snitt'
import { ALL_ZONE_NAMES } from '@/lib/heart-zones'
import { resolveTargetUser } from '@/lib/target-user'
import { beregnNP } from '@/lib/watt-metrikker'
import { resolveTerskel, dominantBevegelse, type TerskelDbRad } from '@/lib/terskel-oppslag'
import type { Sport } from '@/lib/types'
import { PULS_MAAL } from '@/lib/klokkedata-konst'

// Aggregert klokkedata over en tidsperiode. Bygger på per-økt-aggregater
// (workouts + workout_activities) — samples-arrays er for tunge for å
// hente over måneder/år.
//
// Hver chart-serie er pre-beregnet og lett å rendre uten ekstra logikk.

export interface KlokkedataTrender {
  // Aerob effektivitet: hastighet (m/s) per puls (bpm) per økt. Stigende
  // verdi over tid = bedre form (mer fart for samme puls).
  // Suffer score (Strava) — hvor "hardt" Strava synes økten var.
  sufferScore: TrendPoint[]
  // Snitt-kadens per økt.
  cadence: TrendPoint[]
  // Power curve: beste 1/5/20-min snitt-watt over hele perioden, basert
  // på samples for økter med tilgjengelig data. Tom array hvis ingen
  // watt-samples i perioden.
  powerCurve: { duration_label: string; duration_sec: number; watts: number }[]
  // Tid i sone per uke for stacked-bar. polarized_pct = (I1+I2) andel av total
  // — 80%+ indikerer 80/20-prinsippet er fulgt. Verdier i timer (decimal).
  zonesPerWeek: ZoneWeekPoint[]
  // Antall økter som hadde nok klokkesync-data i perioden.
  workoutsWithKlokkesync: number
  // Total økter i perioden (for proporsjon).
  workoutsTotal: number
  // Minst én av øktene i grunnlaget er Strava-importert → fanen viser
  // Powered by Strava-attribution.
  hasStrava: boolean
  // ── Analyse v2 bolk 7 (rå klokkedata; utvikling bor i Prestasjon, NP/IF og
  //    watt-soner i Terskel — lenket, ikke duplisert) ──
  /** Høydemeter per ISO-uke fra workout_activities.elevation_gain_m (fallback workouts.elevation_meters). */
  hoydemeterPerUke: { week: string; meter: number }[]
  /** Fart (km/t) ved gitt puls per økt — samples innenfor ±3 slag av målet, etter 2 min, minst 60 samples. */
  fartVedPuls: FartVedPulsPunkt[]
  /** Watt/kg per økt: NP (eller snittwatt) delt på kroppsvekt fra health_metrics på datoen. */
  wattPerKg: WattPerKgPunkt[]
  /** Pace-kurve: beste snitt-tempo over perioden (løping/ski) — søsteren til power curve. */
  paceCurve: { duration_label: string; duration_sec: number; sek_per_km: number }[]
  /** Samples hentes for de nyeste SAMPLES_TAK øktene — sann når perioden har flere. */
  samplesCapNaadd: boolean
}

const SAMPLES_TAK = 60

export interface FartVedPulsPunkt {
  date: string
  workout_id: string
  title: string
  sport: Sport
  /** km/t per pulsmål (nøkkel = pulsen som streng); null der økta mangler nok samples ved den pulsen. */
  kmt: Record<string, number | null>
}

export interface WattPerKgPunkt {
  date: string
  workout_id: string
  title: string
  sport: Sport
  np: number | null
  snittwatt: number
  kg: number
  perKg: number
  /** NP / FTP på datoen (resolveTerskel) — null uten FTP. */
  if: number | null
}

export interface ZoneWeekPoint {
  week: string         // YYYY-Www
  I1: number           // timer
  I2: number
  I3: number
  I4: number
  I5: number
  I6: number
  I7: number
  I8: number
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
  targetUserId?: string,
): Promise<KlokkedataTrender | { error: string }> {
  try {
    const supabase = await createClient()
    // Bolk 7: trenervisning (targetUserId) som resten av analysen.
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    let q = supabase
      .from('workouts')
      .select(`
        id, date, title, sport, suffer_score, imported_from, elevation_meters,
        avg_heart_rate, duration_minutes, distance_km,
        workout_activities(activity_type, movement_name, movement_subcategory, avg_heart_rate, avg_watts, avg_speed_ms, avg_cadence, duration_seconds, elevation_gain_m, zones)
      `)
      .eq('user_id', userId)
      .is('merged_into_workout_id', null)
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
      elevation_meters: number | null
      avg_heart_rate: number | null
      duration_minutes: number | null
      distance_km: number | null
      workout_activities: Array<{
        activity_type: string | null
        movement_name: string | null
        movement_subcategory: string | null
        avg_heart_rate: number | null
        avg_watts: number | null
        avg_speed_ms: number | null
        avg_cadence: number | null
        duration_seconds: number | null
        elevation_gain_m: number | null
        zones: Record<string, number> | null
      }>
    }
    const rows = (data ?? []) as Row[]
    const workoutsTotal = rows.length

    // aerobEfficiency/wattPerHr/cardiacDrift er AVLØST av Analyse ›
    // Prestasjon (bolk 3) og fjernet herfra (regel 11/21).
    const sufferScore: TrendPoint[] = []
    const cadence: TrendPoint[] = []
    // Aggregér zones-sekunder per ISO-uke. zones-jsonb er i SEKUNDER (phase 64+),
    // pause + skyting ekskluderes via activity_type-filter.
    const zonesByWeek = new Map<string, { I1: number; I2: number; I3: number; I4: number; I5: number; I6: number; I7: number; I8: number; Hurtighet: number }>()
    const hoydeByWeek = new Map<string, number>()
    const SHOOTING_TYPES = new Set(['skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting','skyting_basis'])
    const PAUSE_TYPES = new Set(['pause','aktiv_pause','veksling'])

    for (const w of rows) {
      // Aggreger snittet av aktiviteter, vektet på varighet.
      const wactsAgg = aggregateActivities(w.workout_activities)

      const avgCadence = wactsAgg.avgCadence

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
      const bucket = zonesByWeek.get(weekKey) ?? { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0, Hurtighet: 0 }
      for (const a of w.workout_activities ?? []) {
        const at = (a.activity_type ?? '').toLowerCase()
        if (PAUSE_TYPES.has(at) || SHOOTING_TYPES.has(at)) continue
        const z = a.zones
        if (!z) continue
        for (const k of ALL_ZONE_NAMES) {
          const sec = Number(z[k]) || 0
          if (sec > 0) bucket[k] += sec
        }
      }
      zonesByWeek.set(weekKey, bucket)

      // Høydemeter per uke: radene først, økt-feltet som fallback (eldre/enkle økter).
      const radHoyde = (w.workout_activities ?? []).reduce((sum, a) => sum + (Number(a.elevation_gain_m) || 0), 0)
      const hoyde = radHoyde > 0 ? radHoyde : (Number(w.elevation_meters) || 0)
      if (hoyde > 0) hoydeByWeek.set(weekKey, (hoydeByWeek.get(weekKey) ?? 0) + hoyde)
    }
    const hoydemeterPerUke = [...hoydeByWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, meter]) => ({ week, meter: Math.round(meter) }))

    // Konverter zonesByWeek til array sortert kronologisk, sek → timer.
    const zonesPerWeek: ZoneWeekPoint[] = [...zonesByWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, z]) => {
        const total = z.I1 + z.I2 + z.I3 + z.I4 + z.I5 + z.I6 + z.I7 + z.I8 + z.Hurtighet
        const easy = z.I1 + z.I2
        return {
          week,
          I1: round1(z.I1 / 3600),
          I2: round1(z.I2 / 3600),
          I3: round1(z.I3 / 3600),
          I4: round1(z.I4 / 3600),
          I5: round1(z.I5 / 3600),
          I6: round1(z.I6 / 3600),
          I7: round1(z.I7 / 3600),
          I8: round1(z.I8 / 3600),
          Hurtighet: round1(z.Hurtighet / 3600),
          total: round1(total / 3600),
          polarized_pct: total > 0 ? Math.round((easy / total) * 100) : 0,
        }
      })

    // Power curve, pace-kurve, fart ved puls og watt/kg krever samples → ÉN
    // henting for de nyeste SAMPLES_TAK øktene + terskler og vekt i samme runde.
    const recentIds = rows
      .slice(-SAMPLES_TAK)
      .map(r => r.id)
    const samplesCapNaadd = rows.length > SAMPLES_TAK
    let powerCurve: { duration_label: string; duration_sec: number; watts: number }[] = []
    let paceCurve: { duration_label: string; duration_sec: number; sek_per_km: number }[] = []
    const fartVedPuls: FartVedPulsPunkt[] = []
    const wattPerKg: WattPerKgPunkt[] = []
    let workoutsWithKlokkesync = 0

    if (recentIds.length > 0) {
      type SampleRad = {
        workout_id: string
        hr_samples: Array<{ t: number; hr: number }> | null
        watt_samples: Array<{ t: number; w: number }> | null
        speed_samples: Array<{ t: number; mps: number }> | null
        pace_samples: Array<{ t: number; mps: number }> | null
      }
      const [samplesRes, terskelRes, vektRes] = await Promise.all([
        supabase.from('workout_samples').select('workout_id, hr_samples, watt_samples, speed_samples, pace_samples').in('workout_id', recentIds),
        supabase.from('user_thresholds').select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from').eq('user_id', userId),
        supabase.from('health_metrics').select('date, body_weight_kg').eq('user_id', userId).not('body_weight_kg', 'is', null).order('date', { ascending: false }).limit(120),
      ])
      const samplesByWorkout = new Map<string, SampleRad>()
      for (const s of (samplesRes.data ?? []) as SampleRad[]) samplesByWorkout.set(s.workout_id, s)
      workoutsWithKlokkesync = samplesByWorkout.size
      const terskler = (terskelRes.data ?? []) as TerskelDbRad[]
      const vektRader = ((vektRes.data ?? []) as { date: string; body_weight_kg: number | null }[]).filter(r => r.body_weight_kg != null)
      // Vekt på datoen = nyeste måling ≤ datoen; ellers nyeste måling overhodet.
      const vektPaa = (dato: string): number | null => {
        const r = vektRader.find(x => x.date <= dato) ?? vektRader[0]
        return r?.body_weight_kg ?? null
      }

      const paceBests: Record<number, number> = { 60: 0, 300: 0, 1200: 0, 3600: 0 } // beste mps
      const rowById = new Map(rows.map(r => [r.id, r]))
      for (const [wid, s] of samplesByWorkout) {
        const w = rowById.get(wid)
        if (!w) continue
        const fart = s.speed_samples ?? s.pace_samples
        const fartSeq = fart ? fart.filter(p => Number.isFinite(p.mps) && p.mps > 0).map(p => ({ t: p.t, v: p.mps })) : []

        // Pace-kurve (ikke sykling): beste snitt-fart over vinduet → s/km.
        if (w.sport !== 'cycling' && fartSeq.length > 60) {
          for (const dur of [60, 300, 1200, 3600]) {
            const a = besteRullendeSnitt(fartSeq, dur)
            if (a && a > paceBests[dur]) paceBests[dur] = a
          }
        }

        // Fart ved gitt puls: samples der pulsen er innenfor ±3 av målet (etter 2 min), minst 60 samples.
        if (s.hr_samples && s.hr_samples.length > 60 && fartSeq.length > 60) {
          const hr = [...s.hr_samples].sort((a, b) => a.t - b.t)
          const sum: Record<number, number> = {}, n: Record<number, number> = {}
          for (const m of PULS_MAAL) { sum[m] = 0; n[m] = 0 }
          let j = 0
          for (const pnt of fartSeq) {
            if (pnt.t < 120) continue
            while (j < hr.length - 1 && hr[j + 1].t <= pnt.t) j++
            const h = hr[j]
            if (!h || Math.abs(h.t - pnt.t) > 5) continue
            for (const m of PULS_MAAL) if (Math.abs(h.hr - m) <= 3) { sum[m] += pnt.v; n[m]++ }
          }
          const kmt: Record<string, number | null> = {}
          let noen = false
          for (const m of PULS_MAAL) { kmt[String(m)] = n[m] >= 60 ? Math.round((sum[m] / n[m]) * 3.6 * 10) / 10 : null; if (kmt[String(m)] != null) noen = true }
          if (noen) fartVedPuls.push({ date: w.date, workout_id: w.id, title: w.title, sport: w.sport, kmt })
        }

        // Watt/kg: NP (≥ 5 min dekning) eller snittwatt, delt på vekt på datoen.
        if (s.watt_samples && s.watt_samples.length > 60) {
          const kg = vektPaa(w.date)
          if (kg && kg > 0) {
            const np = beregnNP(s.watt_samples)
            const agg = aggregateActivities(w.workout_activities)
            const snitt = agg.avgWatts ?? (s.watt_samples.reduce((a, p) => a + p.w, 0) / s.watt_samples.length)
            const dom = dominantBevegelse(w.workout_activities)
            const tersk = resolveTerskel(terskler, w.date, dom.name, dom.sub)
            const ftp = tersk?.ftp_watts ?? null
            const grunnlag = np ?? snitt
            if (grunnlag > 0) wattPerKg.push({
              date: w.date, workout_id: w.id, title: w.title, sport: w.sport,
              np: np != null ? Math.round(np) : null, snittwatt: Math.round(snitt), kg: Math.round(kg * 10) / 10,
              perKg: Math.round((grunnlag / kg) * 100) / 100,
              if: np != null && ftp ? Math.round((np / ftp) * 100) / 100 : null,
            })
          }
        }
      }
      fartVedPuls.sort((a, b) => a.date.localeCompare(b.date))
      wattPerKg.sort((a, b) => a.date.localeCompare(b.date))
      const paceLabels: Array<[number, string]> = [[60, '1 min'], [300, '5 min'], [1200, '20 min'], [3600, '60 min']]
      paceCurve = paceLabels
        .filter(([sec]) => paceBests[sec] > 0)
        .map(([sec, label]) => ({ duration_label: label, duration_sec: sec, sek_per_km: Math.round(1000 / paceBests[sec]) }))

      // Power curve over hele perioden — Concept2/Strava-standard varigheter.
      const bests: Record<number, number> = { 5: 0, 60: 0, 300: 0, 1200: 0, 3600: 0 }
      for (const s of samplesByWorkout.values()) {
        const w = s.watt_samples
        if (!w || w.length < 5) continue
        const seq = w.map(p => ({ t: p.t, v: p.w }))
        for (const dur of [5, 60, 300, 1200, 3600]) {
          const a = besteRullendeSnitt(seq, dur)
          if (a && Math.round(a) > bests[dur]) bests[dur] = Math.round(a)
        }
      }
      const powerLabels: Array<[number, string]> = [
        [5, '5 sek'], [60, '1 min'], [300, '5 min'], [1200, '20 min'], [3600, '60 min'],
      ]
      powerCurve = powerLabels
        .map(([sec, label]) => ({ duration_label: label, duration_sec: sec, watts: bests[sec] }))
        .filter(p => p.watts > 0)

    }

    return {
      sufferScore,
      cadence,
      powerCurve,
      zonesPerWeek,
      workoutsWithKlokkesync,
      workoutsTotal,
      hasStrava: ((data ?? []) as { imported_from?: string | null }[])
        .some(w => w.imported_from === 'strava'),
      hoydemeterPerUke,
      fartVedPuls,
      wattPerKg,
      paceCurve,
      samplesCapNaadd,
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


