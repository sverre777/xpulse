'use server'

import { createClient } from '@/lib/supabase/server'
import { forsteEmbed } from '@/lib/embed'
import { resolveTargetUser } from '@/lib/target-user'
import { beregnEf, beregnFrakobling, gapFart, stigningPctForVindu, EF_OKTTYPER, EF_MIN_SEK } from '@/lib/prestasjon'
import { dominantBevegelse, resolveTerskel, type TerskelDbRad } from '@/lib/terskel-oppslag'
import { besteRullendeSnitt } from '@/lib/rullende-snitt'
import { getBelastningAnalysis } from './analysis'

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

// ── Bolk 3 (Analyse v2) ──
export interface GapPunkt {
  date: string; workout_id: string; title: string; workout_type: string
  /** Stigningsjustert tempo (gapFart) og flatt tempo, sek/km, snitt over kurven. */
  gapSekPerKm: number; flatSekPerKm: number; stigningPct: number
}
export interface TerskelFartPunkt {
  date: string; workout_id: string; title: string; bevegelse: string
  kilde: 'fart' | 'watt'
  /** sek/km (fart) eller W (watt) ved terskelpuls ±3 bpm. */
  verdi: number; terskelHr: number; n: number
}
export interface KurveOverTidPunkt {
  date: string; workout_id: string; title: string
  /** Beste snitt over varigheten: W (watt) eller sek/km (tempo). */
  varighetSek: number; verdi: number
}
export interface KadensPunkt {
  date: string; workout_id: string; title: string; bevegelse: string
  kadens: number; mps: number
}
export interface KonkurransePunkt {
  date: string; workout_id: string; title: string; sport: string
  posisjon: number | null; deltakere: number | null
  /** Plassering i prosent av feltet (1 = vinner → 0 %). null uten deltakertall. */
  plassPct: number | null
  tsb: number | null; ef: number | null; treffPct: number | null; varighetSek: number
}

export interface PrestasjonAnalyse {
  efSerier: EfSerie[]
  frakobling: FrakoblingsPunkt[]
  stravaEkskludert: number
  // Kandidat-taket (50 nyeste) ble nådd — eldste økter i perioden er
  // ikke med i frakoblingsgrafen.
  frakoblingCapNaadd: boolean
  // Bolk 3
  gap: GapPunkt[]
  fartVedTerskel: TerskelFartPunkt[]
  wattKurve: KurveOverTidPunkt[]
  paceKurve: KurveOverTidPunkt[]
  kadens: KadensPunkt[]
  konkurranser: KonkurransePunkt[]
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
    .select('id, date, title, sport, workout_type, imported_from, merged_source, avg_heart_rate, duration_minutes, workout_activities(activity_type, movement_name, movement_subcategory, duration_seconds, distance_meters, avg_heart_rate, avg_watts, avg_cadence, avg_speed_ms, prone_shots, prone_hits, standing_shots, standing_hits), workout_competition_data(position_overall, participant_count)')
    .eq('user_id', resolved.userId)
    .is('merged_into_workout_id', null)
    .eq('is_completed', true)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
  if (error) return { error: error.message }

  type Rad = {
    id: string; date: string; title: string; sport: string; workout_type: string
    imported_from: string | null; merged_source: string | null
    avg_heart_rate: number | null; duration_minutes: number | null
    workout_activities: {
      activity_type: string | null; movement_name: string | null
      movement_subcategory: string | null; duration_seconds: number | null
      distance_meters: number | null; avg_heart_rate: number | null
      avg_watts: number | null; avg_cadence: number | null; avg_speed_ms: number | null
      prone_shots: number | null; prone_hits: number | null; standing_shots: number | null; standing_hits: number | null
    }[] | null
    workout_competition_data: { position_overall: number | null; participant_count: number | null } | { position_overall: number | null; participant_count: number | null }[] | null
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
  // Bolk 3: ÉN samples-henting for nyeste 80 økter (dekker frakoblings-
  // kandidatene) + terskler og belastning (TSB) i samme action.
  const sampleIds = [...new Set([...rows.slice(-80).map(r => r.id), ...kandidater.map(k => k.id)])]
  type SampleRad = { workout_id: string; hr_samples: { t: number; hr: number }[] | null; watt_samples: { t: number; w: number }[] | null; speed_samples: { t: number; mps: number }[] | null; pace_samples: { t: number; mps: number }[] | null; altitude_samples: { t: number; alt: number }[] | null }
  const [sampleRes, terskelRes, belastning] = await Promise.all([
    sampleIds.length > 0 ? supabase.from('workout_samples').select('workout_id, hr_samples, watt_samples, speed_samples, pace_samples, altitude_samples').in('workout_id', sampleIds) : Promise.resolve({ data: [] as SampleRad[] }),
    supabase.from('user_thresholds').select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from').eq('user_id', resolved.userId),
    getBelastningAnalysis(fromDate, toDate, null, targetUserId),
  ])
  const byId = new Map(((sampleRes.data ?? []) as SampleRad[]).map(s => [s.workout_id, s]))
  const terskler = (terskelRes.data ?? []) as TerskelDbRad[]
  const tsbBy = new Map<string, number>('error' in belastning ? [] : belastning.daily.map(d => [d.date, d.tsb]))
  if (kandidater.length > 0) {
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

  // ── Bolk 3 ──
  const gap: GapPunkt[] = []
  const fartVedTerskel: TerskelFartPunkt[] = []
  const wattKurve: KurveOverTidPunkt[] = []
  const paceKurve: KurveOverTidPunkt[] = []
  const kadens: KadensPunkt[] = []
  const konkurranser: KonkurransePunkt[] = []
  const erLop = (w: Rad, bev: string) => w.sport === 'running' || w.sport === 'triathlon' || bev === 'Løping'
  for (const w of rows) {
    const trening = (w.workout_activities ?? []).filter(a => !(a.activity_type && IKKE_TRENING.has(a.activity_type)))
    const dominant = dominantBevegelse(trening)
    const bev = dominant.name || (w.sport === 'cycling' ? 'Sykling' : w.sport === 'running' ? 'Løping' : '')
    const s = byId.get(w.id)
    const fart = s?.speed_samples ?? s?.pace_samples ?? null
    // Kadens vs fart (aggregater — ingen samples nødvendig).
    let sek = 0, meter = 0, kadVekt = 0, kadSek = 0, hrVekt = 0, hrSek = 0, wattVekt = 0, wattSek = 0, skudd = 0, treff = 0
    for (const a of trening) {
      const d = a.duration_seconds ?? 0
      sek += d; meter += a.distance_meters ?? 0
      if (a.avg_cadence && a.avg_cadence > 0 && d > 0) { kadVekt += a.avg_cadence * d; kadSek += d }
      if (a.avg_heart_rate && a.avg_heart_rate > 0 && d > 0) { hrVekt += a.avg_heart_rate * d; hrSek += d }
      if (a.avg_watts && Number(a.avg_watts) > 0 && d > 0) { wattVekt += Number(a.avg_watts) * d; wattSek += d }
    }
    for (const a of w.workout_activities ?? []) {
      for (const [sk, tr] of [[a.prone_shots, a.prone_hits], [a.standing_shots, a.standing_hits]] as const) { if (sk && tr != null) { skudd += sk; treff += tr } }
    }
    if (kadSek > 0 && sek > 0 && meter > 0 && bev) kadens.push({ date: w.date, workout_id: w.id, title: w.title, bevegelse: bev, kadens: Math.round(kadVekt / kadSek), mps: Math.round((meter / sek) * 100) / 100 })
    // Konkurranse vs form.
    if (w.workout_type === 'competition' || w.workout_type === 'testlop') {
      const c = forsteEmbed(w.workout_competition_data)
      const hr = hrSek > 0 ? hrVekt / hrSek : (w.avg_heart_rate ?? 0)
      const ef = beregnEf(meter, sek, hr, wattSek >= sek * 0.5 ? wattVekt / wattSek : null)
      konkurranser.push({
        date: w.date, workout_id: w.id, title: w.title, sport: w.sport,
        posisjon: c?.position_overall ?? null, deltakere: c?.participant_count ?? null,
        plassPct: c?.position_overall && c.participant_count && c.participant_count > 1 ? Math.round(((c.position_overall - 1) / (c.participant_count - 1)) * 1000) / 10 : null,
        tsb: tsbBy.get(w.date) ?? null, ef: ef?.verdi ?? null, treffPct: skudd > 0 ? Math.round((treff / skudd) * 1000) / 10 : null, varighetSek: sek,
      })
    }
    if (!s) continue
    // Power-/tempokurve over tid: beste snitt per varighet per økt.
    if (s.watt_samples && s.watt_samples.length > 10) {
      const seq = s.watt_samples.filter(p => Number.isFinite(p.t) && Number.isFinite(p.w)).map(p => ({ t: p.t, v: p.w }))
      for (const v of [5, 60, 300, 1200, 3600]) { const b = besteRullendeSnitt(seq, v); if (b != null && b > 0) wattKurve.push({ date: w.date, workout_id: w.id, title: w.title, varighetSek: v, verdi: Math.round(b) }) }
    }
    if (fart && fart.length > 10 && erLop(w, bev)) {
      const seq = fart.filter(p => Number.isFinite(p.t) && Number.isFinite(p.mps) && p.mps > 0.5).map(p => ({ t: p.t, v: p.mps }))
      for (const v of [60, 300, 1200, 3600]) { const b = besteRullendeSnitt(seq, v); if (b != null && b > 0.5) paceKurve.push({ date: w.date, workout_id: w.id, title: w.title, varighetSek: v, verdi: Math.round(1000 / b) }) }
      // GAP-tempo: stigning fra høydekurven i ±15 s, tempo × gapFaktor.
      if (s.altitude_samples && s.altitude_samples.length > 10) {
        const alt = [...s.altitude_samples].filter(a => Number.isFinite(a.alt)).sort((a, b) => a.t - b.t)
        let j = 0, sumGap = 0, sumFlat = 0, n = 0
        for (const p of seq) {
          while (j < alt.length - 1 && alt[j + 1].t <= p.t - 15) j++
          let k = j; while (k < alt.length - 1 && alt[k + 1].t <= p.t + 15) k++
          const a0 = alt[j], a1 = alt[k]
          const dist = p.v * Math.max(1, a1.t - a0.t)
          const stig = dist > 20 && a1.t > a0.t ? ((a1.alt - a0.alt) / dist) * 100 : null
          sumGap += stig == null ? p.v : (gapFart(p.v, stig) ?? p.v); sumFlat += p.v; n++
        }
        if (n > 60) {
          const stigningPct = stigningPctForVindu(alt, seq[0].t, seq[seq.length - 1].t, meter) ?? 0
          gap.push({ date: w.date, workout_id: w.id, title: w.title, workout_type: w.workout_type, gapSekPerKm: Math.round(1000 / (sumGap / n)), flatSekPerKm: Math.round(1000 / (sumFlat / n)), stigningPct: Math.round(stigningPct * 10) / 10 })
        }
      }
    }
    // Fart/watt ved terskelpuls: samples der pulsen er innenfor ±3 av terskelen (etter 2 min).
    const tersk = resolveTerskel(terskler, w.date, dominant.name, dominant.sub)
    if (tersk && s.hr_samples && s.hr_samples.length > 60 && bev) {
      const brukWatt = !!(s.watt_samples && s.watt_samples.length > 60 && !erLop(w, bev))
      const ut = brukWatt ? s.watt_samples!.map(p => ({ t: p.t, v: p.w })) : (fart ?? []).map(p => ({ t: p.t, v: p.mps }))
      if (ut.length > 60) {
        const hr = [...s.hr_samples].sort((a, b) => a.t - b.t)
        let j = 0, sum = 0, n = 0
        for (const p of ut) {
          if (p.t < 120 || !Number.isFinite(p.v) || p.v <= 0) continue
          while (j < hr.length - 1 && hr[j + 1].t <= p.t) j++
          const h = hr[j]
          if (h && Math.abs(h.t - p.t) <= 5 && Math.abs(h.hr - tersk.threshold_hr) <= 3) { sum += p.v; n++ }
        }
        if (n >= 60) fartVedTerskel.push({ date: w.date, workout_id: w.id, title: w.title, bevegelse: bev, kilde: brukWatt ? 'watt' : 'fart', verdi: brukWatt ? Math.round(sum / n) : Math.round(1000 / (sum / n)), terskelHr: tersk.threshold_hr, n })
      }
    }
  }

  return { efSerier, frakobling, stravaEkskludert, frakoblingCapNaadd, gap, fartVedTerskel, wattKurve, paceKurve, kadens, konkurranser }
}
