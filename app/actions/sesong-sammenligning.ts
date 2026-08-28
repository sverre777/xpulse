'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { beregnEf, EF_OKTTYPER, EF_MIN_SEK } from '@/lib/prestasjon'

// Sesong mot sesong (prestasjonsmodellen bolk 4). Én henting per
// sesong gir ALLE metrikkene per kalendermåned — metrikk-byttet i
// komponenten er dermed rent klient-side og svarer i samme tick
// (regel 20).
//
// Strava-avgjørelsen (Sverre 28. aug): timer/km/økter er RÅ VOLUM og
// teller Strava-økter — regel 2 gjelder estimater/beregnede mål, og
// volum er ingen av delene. EF er et beregnet kvalitetsmål → Strava
// holdes utenfor der (fail-closed), og antallet rapporteres så flaten
// kan si fra. Regel 24: ingen type-re-eksport.

export interface SesongMaaned {
  mnd: string        // 'YYYY-MM'
  label: string      // 'mai'
  timer: number      // treningstimer (desimal)
  km: number
  okter: number
  // Snitt økt-EF for EF-kvalifiserte økter i måneden (rolige typer,
  // ≥ 20 min, ikke-Strava). null = ingen kvalifiserte økter.
  ef: number | null
}

export interface SesongData {
  sesongId: string
  maaneder: SesongMaaned[]
  // Strava-økter som teller i volum men er holdt utenfor EF.
  stravaUtenforEf: number
}

const IKKE_TRENING = new Set([
  'pause', 'aktiv_pause',
  'skyting_liggende', 'skyting_staaende', 'skyting_kombinert',
  'skyting_innskyting', 'skyting_basis',
])

const MND_LABELS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export async function getSesongData(
  sesongId: string,
  targetUserId?: string,
): Promise<SesongData | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return { error: resolved.error }

  const { data: sesong } = await supabase
    .from('seasons')
    .select('id, start_date, end_date')
    .eq('id', sesongId)
    .eq('user_id', resolved.userId)
    .maybeSingle()
  if (!sesong) return { error: 'Fant ikke sesongen' }

  const { data, error } = await supabase
    .from('workouts')
    .select('id, date, workout_type, imported_from, merged_source, avg_heart_rate, duration_minutes, distance_km, workout_activities(activity_type, duration_seconds, distance_meters, avg_heart_rate)')
    .eq('user_id', resolved.userId)
    .is('merged_into_workout_id', null)
    .eq('is_completed', true)
    .gte('date', sesong.start_date)
    .lte('date', sesong.end_date)
  if (error) return { error: error.message }

  type Rad = {
    id: string; date: string; workout_type: string
    imported_from: string | null; merged_source: string | null
    avg_heart_rate: number | null; duration_minutes: number | null
    distance_km: number | null
    workout_activities: {
      activity_type: string | null; duration_seconds: number | null
      distance_meters: number | null; avg_heart_rate: number | null
    }[] | null
  }
  const rows = (data ?? []) as Rad[]

  // Alle kalendermåneder i sesongvinduet — tomme måneder skal STÅ i
  // grafen som tomme, ikke forsvinne.
  const maaneder: SesongMaaned[] = []
  const perMnd = new Map<string, { sek: number; meter: number; okter: number; efSum: number; efN: number }>()
  {
    const start = new Date(`${sesong.start_date}T00:00:00`)
    const slutt = new Date(`${sesong.end_date}T00:00:00`)
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= slutt) {
      const mnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      maaneder.push({ mnd, label: MND_LABELS[d.getMonth()], timer: 0, km: 0, okter: 0, ef: null })
      perMnd.set(mnd, { sek: 0, meter: 0, okter: 0, efSum: 0, efN: 0 })
      d.setMonth(d.getMonth() + 1)
    }
  }

  let stravaUtenforEf = 0
  for (const w of rows) {
    const mnd = w.date.slice(0, 7)
    const m = perMnd.get(mnd)
    if (!m) continue
    const trening = (w.workout_activities ?? [])
      .filter(a => !(a.activity_type && IKKE_TRENING.has(a.activity_type)))
    let sek = 0, meter = 0, hrVekt = 0, hrSek = 0
    for (const a of trening) {
      const s = a.duration_seconds ?? 0
      sek += s
      meter += a.distance_meters ?? 0
      if (a.avg_heart_rate && a.avg_heart_rate > 0 && s > 0) {
        hrVekt += a.avg_heart_rate * s; hrSek += s
      }
    }
    // Fallback for økter uten rader (eldre manuelle): øktnivå-feltene.
    if (sek === 0 && w.duration_minutes) sek = w.duration_minutes * 60
    if (meter === 0 && w.distance_km) meter = w.distance_km * 1000

    m.okter += 1
    m.sek += sek
    m.meter += meter

    // EF: samme gate som Prestasjon-fanen (regel 11) + Strava utenfor.
    const erStrava = w.imported_from === 'strava' || w.merged_source === 'strava'
    if (EF_OKTTYPER.has(w.workout_type) && sek >= EF_MIN_SEK) {
      if (erStrava) { stravaUtenforEf++; continue }
      const hr = hrSek > 0 ? hrVekt / hrSek : (w.avg_heart_rate ?? 0)
      const ef = beregnEf(meter, sek, hr)
      if (ef) { m.efSum += ef.verdi; m.efN += 1 }
    }
  }

  for (const rad of maaneder) {
    const m = perMnd.get(rad.mnd)!
    rad.timer = Math.round((m.sek / 3600) * 10) / 10
    rad.km = Math.round((m.meter / 1000) * 10) / 10
    rad.okter = m.okter
    rad.ef = m.efN > 0 ? Math.round((m.efSum / m.efN) * 10000) / 10000 : null
  }

  return { sesongId, maaneder, stravaUtenforEf }
}
