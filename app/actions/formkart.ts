'use server'

// FORMKARTET bolk 1 - datalaget. ÉN server-action gir hele kartet i ett
// kall, per dag i perioden: sonetid · planlagt tid · CTL/ATL/TSB · helse ·
// dagstatus · hardøkt · skyting · laktat · terskel.
//
// Alt gjenbrukes (regel 11): CTL/ATL/TSB fra getBelastningAnalysis (samme
// TSS-spor som Belastning-fanen), helse fra getHelseOversikt (samme lag-
// modell og M-kilder som Helse-fanen), soner fra computeActivityTotals
// (samme tall som «Status nå»), terskel fra lib/terskel-oppslag. Formlene
// bor i lib/formkart.ts.
//
// ARTIKKEL 9: helsefeltene hentes gjennom getHelseOversikt, som resolver
// med resolveHealthTargetUser - ALDRI can_view_analysis. Sier den nei,
// finnes ikke `helse` på dagene i det hele tatt (payload-bevis, bolk 7),
// og flaten sier fra at banene er skjult.

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { getBelastningAnalysis } from './analysis'
import { getHelseOversikt, type HelseDag } from './helse-oversikt'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { computeActivityTotals, hoyIntensitetSek, emptyZoneSeconds } from '@/lib/activity-summary'
import { resolveTerskel, dominantBevegelse, type TerskelDbRad } from '@/lib/terskel-oppslag'
import { minusDager } from '@/lib/helse-vindu'
import { harSkiskyting, sporterFraProfil } from '@/lib/har-skiskyting'
import {
  erHviledag, pctAvTerskel, skytingForDag, snittOgSd, GRUNNIVAA_DAGER,
  type Formkart, type FormkartDag, type FormkartHelse, type FormkartLaktat, type FormkartOkt, type SerieInn,
} from '@/lib/formkart'

const KONKURRANSE_TYPER = new Set(['competition', 'testlop'])

type AktRad = {
  activity_type: string | null; movement_name: string | null; movement_subcategory: string | null
  duration_seconds: number | null; distance_meters: number | null; avg_heart_rate: number | null
  zones: Record<string, number | string | null> | null
  workout_shooting_series: SerieInn[] | null
  workout_activity_lactate_measurements: { value_mmol: number | string | null }[] | null
}
type OktRad = {
  id: string; title: string | null; date: string; workout_type: string | null
  is_planned: boolean; is_completed: boolean; duration_minutes: number | null
  imported_from: string | null; merged_source: string | null
  workout_activities: AktRad[] | null
}

// Middag-anker (minusDager), ikke midnatt: lokal midnatt gjennom toISOString
// gir dagen FØR i Europe/Oslo, og en dagsløkke på det anker går evig lokalt.
function daysBetween(fra: string, til: string): string[] {
  const ut: string[] = []
  for (let d = fra; d <= til && ut.length < 800; d = minusDager(d, -1)) ut.push(d)
  return ut
}

export async function getFormkart(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<Formkart | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  // Én runde: alt parallelt. Helse går gjennom sin egen resolver (art. 9).
  const [belastning, helse, okterRes, dagRes, terskelRes, samlingRes, profilRes, heartZones] = await Promise.all([
    getBelastningAnalysis(fromDate, toDate, null, targetUserId),
    getHelseOversikt(minusDager(fromDate, GRUNNIVAA_DAGER - 1), toDate, targetUserId),
    supabase.from('workouts')
      .select('id,title,date,workout_type,is_planned,is_completed,duration_minutes,imported_from,merged_source,workout_activities(activity_type,movement_name,movement_subcategory,duration_seconds,distance_meters,avg_heart_rate,zones,workout_shooting_series(position,shots,hits,time_seconds,avg_heart_rate),workout_activity_lactate_measurements(value_mmol))')
      .eq('user_id', userId).is('merged_into_workout_id', null)
      .gte('date', fromDate).lte('date', toDate).order('date', { ascending: true }),
    supabase.from('day_states').select('date, state_type').eq('user_id', userId).gte('date', fromDate).lte('date', toDate),
    supabase.from('user_thresholds').select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from').eq('user_id', userId),
    supabase.from('season_markings').select('start_date, end_date, is_training_camp, seasons!inner(user_id)')
      .eq('seasons.user_id', userId).lte('start_date', toDate).gte('end_date', fromDate),
    supabase.from('profiles').select('primary_sport, secondary_sports').eq('id', userId).maybeSingle(),
    getHeartZonesForUserCached(userId),
  ])
  if (okterRes.error) return { error: okterRes.error.message }
  if (dagRes.error) return { error: dagRes.error.message }

  const helseInkludert = !('error' in helse)
  const helseSkjultGrunn = 'error' in helse ? helse.error : null
  const helsePerDag = new Map<string, HelseDag>()
  if (!('error' in helse)) for (const d of helse.dager) helsePerDag.set(d.date, d)

  const belastningPerDag = new Map<string, { ctl: number; atl: number; tsb: number }>()
  if (!('error' in belastning)) for (const d of belastning.daily) belastningPerDag.set(d.date, { ctl: d.ctl, atl: d.atl, tsb: d.tsb })

  const status = new Map<string, Set<string>>()
  for (const r of (dagRes.data ?? []) as { date: string; state_type: string }[]) {
    if (!status.has(r.date)) status.set(r.date, new Set())
    status.get(r.date)!.add((r.state_type ?? '').toLowerCase())
  }
  const samlinger = ((samlingRes.data ?? []) as unknown as { start_date: string; end_date: string; is_training_camp: boolean }[])
    .filter(m => m.is_training_camp)

  const terskelRader = (terskelRes.data ?? []) as TerskelDbRad[]
  const okterPerDag = new Map<string, OktRad[]>()
  let importerte = 0
  for (const o of (okterRes.data ?? []) as unknown as OktRad[]) {
    if (!okterPerDag.has(o.date)) okterPerDag.set(o.date, [])
    okterPerDag.get(o.date)!.push(o)
    if (o.imported_from || o.merged_source) importerte++
  }

  const dager: FormkartDag[] = daysBetween(fromDate, toDate).map(dato => {
    const okter = okterPerDag.get(dato) ?? []
    const soneSek = emptyZoneSeconds()
    let treningSek = 0, planlagtSek = 0, hardOkt = false, terskelHr: number | null = null
    const serier: SerieInn[] = []
    const laktat: FormkartLaktat[] = []
    const oktUt: FormkartOkt[] = []
    for (const o of okter) {
      const akt = o.workout_activities ?? []
      const ut: FormkartOkt = { id: o.id, tittel: o.title ?? '', gjennomfort: o.is_completed, importert: o.imported_from ?? o.merged_source ?? null, sek: 0, soneSek: emptyZoneSeconds() }
      oktUt.push(ut)
      if (o.is_completed) {
        const t = computeActivityTotals(akt.map(a => ({
          activity_type: a.activity_type ?? '', duration_seconds: a.duration_seconds, distance_meters: a.distance_meters,
          avg_heart_rate: a.avg_heart_rate, zones: a.zones,
        })), heartZones)
        treningSek += t.totalSeconds
        ut.sek = t.totalSeconds
        for (const k of Object.keys(soneSek) as (keyof typeof soneSek)[]) { soneSek[k] += t.zoneSeconds[k] ?? 0; ut.soneSek[k] = t.zoneSeconds[k] ?? 0 }
        // Hard = tid i I3 eller høyere - samme definisjon som «Status nå».
        if ((t.zoneSeconds.I3 ?? 0) + hoyIntensitetSek(t.zoneSeconds) > 0) hardOkt = true
        const dom = dominantBevegelse(akt)
        const terskel = resolveTerskel(terskelRader, dato, dom.name, dom.sub)
        if (terskel && terskelHr == null) terskelHr = terskel.threshold_hr
        for (const a of akt) {
          for (const s of a.workout_shooting_series ?? []) serier.push(s)
          // Målingen har ingen egen puls i datamodellen - radens snittpuls er
          // den ærligste pulsen vi har, og % av terskel regnes i lib.
          const radTerskel = resolveTerskel(terskelRader, dato, a.movement_name ?? dom.name, a.movement_subcategory ?? dom.sub)
          for (const m of a.workout_activity_lactate_measurements ?? []) {
            const mmol = Number(m.value_mmol)
            if (!Number.isFinite(mmol)) continue
            laktat.push({ workoutId: o.id, bevegelse: a.movement_name ?? dom.name, mmol, puls: a.avg_heart_rate, pctAvTerskel: pctAvTerskel(a.avg_heart_rate, radTerskel?.threshold_hr) })
          }
        }
      } else if (o.is_planned) {
        planlagtSek += (o.duration_minutes ?? 0) * 60
      }
    }
    const st = status.get(dato) ?? new Set<string>()
    const sykdom = st.has('sykdom')
    const bel = belastningPerDag.get(dato)
    const dag: FormkartDag = {
      dato, soneSek, treningSek, planlagtSek, hardOkt,
      status: {
        sykdom, skade: st.has('skade'), reise: st.has('reisedag'),
        samling: samlinger.some(m => m.start_date <= dato && m.end_date >= dato),
        konkurranse: okter.some(o => KONKURRANSE_TYPER.has(o.workout_type ?? '')),
        hviledag: erHviledag({ treningSek, planlagtSek, okter: okter.map(o => ({ gjennomfort: o.is_completed })), sykdom }),
        planlagtIkkeGjort: okter.some(o => o.is_planned && !o.is_completed) && treningSek === 0,
      },
      ctl: bel?.ctl ?? null, atl: bel?.atl ?? null, tsb: bel?.tsb ?? null,
      skyting: skytingForDag(serier),
      laktat,
      terskelHr,
      okter: oktUt,
    }
    if (helseInkludert) {
      const h = helsePerDag.get(dato)
      const helseFelt: FormkartHelse = {
        hrv: h?.hrv_ms ?? null, hvilepuls: h?.resting_hr ?? null,
        sovnTimer: h?.total_sleep_minutes != null ? Math.round((h.total_sleep_minutes / 60) * 10) / 10 : null,
        sovnScore: h?.sleep_score ?? null, folelse: h?.day_form ?? null, kilder: h?.kilder ?? {},
      }
      dag.helse = helseFelt
    }
    return dag
  })

  // Grunnivået regnes på de 60 dagene FØR og med periodens siste dag.
  let grunnivaa: Formkart['grunnivaa'] = null
  if (helseInkludert) {
    const vindu = Array.from(helsePerDag.values()).filter(d => d.date > minusDager(toDate, GRUNNIVAA_DAGER) && d.date <= toDate)
    grunnivaa = { hrv: snittOgSd(vindu.map(d => d.hrv_ms)), hvilepuls: snittOgSd(vindu.map(d => d.resting_hr)) }
  }

  return {
    fra: fromDate, til: toDate, dager, helseInkludert, helseSkjultGrunn,
    harSkyting: harSkiskyting(sporterFraProfil(profilRes.data)),
    importerteOkter: importerte,
    grunnivaa,
  }
}
