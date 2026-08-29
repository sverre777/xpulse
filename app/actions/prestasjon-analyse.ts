'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { beregnEf, beregnFrakobling, EF_OKTTYPER, EF_MIN_SEK } from '@/lib/prestasjon'
import { dominantBevegelse } from '@/lib/terskel-oppslag'

// Analyse › Prestasjon (bolk 3): EF-trend per bevegelsesform +
// frakoblings-utvikling. Alt beregnes ved visning — EF fra økt-
// aggregater (lett), frakobling fra samples (kun kandidater, cap 50).
//
// REGEL 2 (ufravikelig): Strava-importerte økter — også flettede med
// Strava-kilde — holdes UTENFOR trendene. Fail-closed: filteret ligger
// FØR all beregning, og antallet rapporteres så flaten kan si fra at
// den ser en delmengde. Regel 24: ingen type-re-eksport herfra.

export interface EfPunkt {
  date: string
  workout_id: string
  title: string
  verdi: number
  kilde: 'watt' | 'fart'
  hr: number
}

export interface EfSerie {
  bevegelse: string
  punkter: EfPunkt[]
}

export interface FrakoblingsPunkt {
  date: string
  workout_id: string
  title: string
  driftPct: number
  grad: 'god' | 'middels' | 'svak'
  kilde: 'watt' | 'fart'
}

export interface PrestasjonAnalyse {
  efSerier: EfSerie[]
  frakobling: FrakoblingsPunkt[]
  stravaEkskludert: number
  // Kandidat-taket (50 nyeste) ble nådd — eldste økter i perioden er
  // ikke med i frakoblingsgrafen.
  frakoblingCapNaadd: boolean
}

const IKKE_TRENING = new Set([
  'pause', 'aktiv_pause', 'veksling',
  'skyting_liggende', 'skyting_staaende', 'skyting_kombinert',
  'skyting_innskyting', 'skyting_basis',
])
const FRAKOBLING_CAP = 50

export async function getPrestasjonAnalyse(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<PrestasjonAnalyse | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return { error: resolved.error }

  const { data, error } = await supabase
    .from('workouts')
    .select('id, date, title, workout_type, imported_from, merged_source, avg_heart_rate, duration_minutes, workout_activities(activity_type, movement_name, movement_subcategory, duration_seconds, distance_meters, avg_heart_rate, avg_watts)')
    .eq('user_id', resolved.userId)
    .is('merged_into_workout_id', null)
    .eq('is_completed', true)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
  if (error) return { error: error.message }

  type Rad = {
    id: string; date: string; title: string; workout_type: string
    imported_from: string | null; merged_source: string | null
    avg_heart_rate: number | null; duration_minutes: number | null
    workout_activities: {
      activity_type: string | null; movement_name: string | null
      movement_subcategory: string | null; duration_seconds: number | null
      distance_meters: number | null; avg_heart_rate: number | null
      avg_watts: number | null
    }[] | null
  }
  const alle = (data ?? []) as Rad[]

  // Regel 2: Strava ut FØR beregning — også proveniens via flett.
  const erStrava = (w: Rad) =>
    w.imported_from === 'strava' || w.merged_source === 'strava'
  const stravaEkskludert = alle.filter(erStrava).length
  const rows = alle.filter(w => !erStrava(w))

  // ── EF-serien (aggregater) ──
  // EF-gaten (EF_OKTTYPER i lib/prestasjon): kun rolige økttyper — en
  // intervalløkt gir lav EF uten at formen er dårligere (målt i E2E:
  // den la seg som villedende bunnpunkt).
  const serier = new Map<string, EfPunkt[]>()
  for (const w of rows) {
    if (!EF_OKTTYPER.has(w.workout_type)) continue
    const trening = (w.workout_activities ?? [])
      .filter(a => !(a.activity_type && IKKE_TRENING.has(a.activity_type)))
    let sek = 0, meter = 0, hrVekt = 0, hrSek = 0, wattVekt = 0, wattSek = 0
    for (const a of trening) {
      const s = a.duration_seconds ?? 0
      sek += s
      meter += a.distance_meters ?? 0
      if (a.avg_heart_rate && a.avg_heart_rate > 0 && s > 0) {
        hrVekt += a.avg_heart_rate * s; hrSek += s
      }
      if (a.avg_watts && Number(a.avg_watts) > 0 && s > 0) {
        wattVekt += Number(a.avg_watts) * s; wattSek += s
      }
    }
    if (sek < EF_MIN_SEK) continue
    const hr = hrSek > 0 ? hrVekt / hrSek : (w.avg_heart_rate ?? 0)
    // Watt-kilden krever at watt dekker minst halve treningstiden.
    const nettoWatt = wattSek >= sek * 0.5 ? wattVekt / wattSek : null
    const ef = beregnEf(meter, sek, hr, nettoWatt)
    if (!ef) continue
    const dominant = dominantBevegelse(trening)
    if (!dominant.name) continue
    const punkt: EfPunkt = {
      date: w.date, workout_id: w.id, title: w.title,
      verdi: ef.verdi, kilde: ef.kilde, hr: Math.round(hr),
    }
    const arr = serier.get(dominant.name) ?? []
    arr.push(punkt)
    serier.set(dominant.name, arr)
  }
  const efSerier: EfSerie[] = [...serier.entries()]
    .map(([bevegelse, punkter]) => ({ bevegelse, punkter }))
    .sort((a, b) => b.punkter.length - a.punkter.length)

  // ── Frakoblings-serien (samples, kun kandidater) ──
  const kandidater = rows
    .filter(w => (w.duration_minutes ?? 0) >= 40)
    .slice(-FRAKOBLING_CAP)
  const frakoblingCapNaadd =
    rows.filter(w => (w.duration_minutes ?? 0) >= 40).length > FRAKOBLING_CAP
  const frakobling: FrakoblingsPunkt[] = []
  if (kandidater.length > 0) {
    const { data: sampleRows } = await supabase
      .from('workout_samples')
      .select('workout_id, hr_samples, watt_samples, speed_samples')
      .in('workout_id', kandidater.map(k => k.id))
    const byId = new Map((sampleRows ?? []).map(s => [s.workout_id as string, s]))
    for (const w of kandidater) {
      const s = byId.get(w.id)
      if (!s) continue
      const res = beregnFrakobling(
        s.hr_samples as { t: number; hr: number }[] | null,
        s.watt_samples as { t: number; w: number }[] | null,
        s.speed_samples as { t: number; mps: number }[] | null,
      )
      if (!res.kvalifisert) continue
      frakobling.push({
        date: w.date, workout_id: w.id, title: w.title,
        driftPct: res.driftPct, grad: res.grad, kilde: res.kilde,
      })
    }
  }

  return { efSerier, frakobling, stravaEkskludert, frakoblingCapNaadd }
}
