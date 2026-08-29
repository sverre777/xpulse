'use server'

import { createClient } from '@/lib/supabase/server'
import { kanFlislegge, beregnSegmenter, type SegmentRad } from '@/lib/segmenter'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import type { HeartZone } from '@/lib/heart-zones'

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
  /** Segmentets eget navn (workout_activities.lap_notes — der klokkas
      rundenavn hører hjemme; målt tomt i alle 1 000 prod-rader). */
  navn: string | null
  /** Plassering i tid, beregnet med lib/segmenter (runde ELLER vindu). */
  startSek: number | null
  sluttSek: number | null
  /** Feltene segment-editoren eier (bolk 2). */
  distanseKm: number | null
  snittpuls: number | null
  makspuls: number | null
  /** Sonen med tid på raden (zones-jsonb: {I3: sek}) — én sone per segment. */
  sone: string | null
  beskrivelse: string | null
  gruppeId: string | null
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
  /** Lerret A: økta er planlagt og ikke gjennomført ennå. */
  erPlanlagt: boolean
  /** Lerret C: klokka har levert en kurve å plassere på. */
  harKurve: boolean
  /** Brukerens pulssoner — lerret B utleder blokkens sone av FØRT puls. */
  heartZones: HeartZone[]
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

  const [workoutRes, samplesRes, raderRes, laktatRes, ernaeringRes, heartZones] = await Promise.all([
    supabase.from('workouts').select('id, time_of_day, sport, is_planned, is_completed').eq('id', workoutId).maybeSingle(),
    supabase.from('workout_samples').select('hr_samples, pace_samples, speed_samples, watt_samples, altitude_samples, created_at')
      .eq('workout_id', workoutId).order('created_at', { ascending: false }).limit(1),
    supabase.from('workout_activities')
      .select('id, activity_type, movement_name, duration_seconds, sort_order, window_start_seconds, window_duration_seconds, prone_shots, prone_hits, standing_shots, standing_hits, external_id, strava_lap_index, lap_notes, distance_meters, avg_heart_rate, max_heart_rate, zones, notes, workout_shooting_series(time_seconds)')
      .eq('workout_id', workoutId).order('sort_order', { ascending: true }),
    supabase.from('workout_lactate_measurements')
      .select('id, mmol, measured_at_time')
      .eq('workout_id', workoutId).order('sort_order', { ascending: true }),
    supabase.from('workout_nutrition_entries')
      .select('id, nutrition_type, carbs_g, time_offset_minutes')
      .eq('workout_id', workoutId),
    getHeartZonesForUserCached(user.id),
  ])
  const workout = workoutRes.data
  if (!workout) return null

  const samplesRad = samplesRes.data?.[0]
  const hr = (samplesRad?.hr_samples ?? []) as Array<{ t: number; hr: number }>
  const fart = ((samplesRad?.pace_samples ?? samplesRad?.speed_samples) ?? []) as Array<{ t: number; mps: number }>
  const watt = (samplesRad?.watt_samples ?? []) as Array<{ t: number; w: number }>
  const hoyde = (samplesRad?.altitude_samples ?? []) as Array<{ t: number; alt: number }>
  // Uten klokkekurve er øktas lengde summen av radenes varighet — det er
  // lerret A (plan) og B (gjennomført uten klokke). Byggeren skal virke
  // der også; kurven er bare ETT av tre lerret.
  const fraKurve = Math.max(
    hr.length > 0 ? hr[hr.length - 1].t : 0,
    fart.length > 0 ? fart[fart.length - 1].t : 0,
    watt.length > 0 ? watt[watt.length - 1].t : 0,
  )
  const fraRader = (raderRes.data ?? [])
    .reduce((sum, a) => sum + (Number(a.duration_seconds) || 0), 0)
  const totalSek = fraKurve > 0 ? fraKurve : fraRader

  // Plassering i tid via SAMME kjerne som segmentbåndet (regel 11) — men
  // KUN når klokka har levert en kurve. Proveniens-kravet i kanFlislegge
  // finnes for å unngå å GJETTE en klokke-tidslinje; uten klokke er det
  // ingenting å gjette: radene ER strukturen (lerret A og B), og de
  // legges etter hverandre i sort_order.
  const harKurveNaa = hr.length > 0 || fart.length > 0 || watt.length > 0
  const plassering = new Map<string, { startSek: number; sluttSek: number }>()
  if (harKurveNaa && totalSek > 0) {
    for (const sg of beregnSegmenter((raderRes.data ?? []).map(a => tilSegmentRad(a)), totalSek)) {
      plassering.set(sg.aktivitetId, { startSek: sg.startSek, sluttSek: sg.sluttSek })
    }
  } else {
    let t = 0
    for (const a of (raderRes.data ?? [])) {
      const vindu = a.window_start_seconds != null && a.window_duration_seconds != null
      const start = vindu ? Number(a.window_start_seconds) : t
      const varighet = vindu
        ? Number(a.window_duration_seconds)
        : Math.max(1, Number(a.duration_seconds) || 0)
      plassering.set(a.id, { startSek: start, sluttSek: start + varighet })
      if (!vindu) t += varighet
    }
  }

  const rader: DetaljerRad[] = (raderRes.data ?? []).map(a => {
    const serier = (a.workout_shooting_series ?? []) as Array<{ time_seconds: number | null }>
    const skytetid = serier.reduce((sum, s) => sum + (s.time_seconds ?? 0), 0)
    const sg = plassering.get(a.id)
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
      navn: (a.lap_notes as string | null) ?? null,
      startSek: sg?.startSek ?? null,
      sluttSek: sg?.sluttSek ?? null,
      distanseKm: a.distance_meters != null ? Math.round(Number(a.distance_meters) / 10) / 100 : null,
      snittpuls: a.avg_heart_rate != null ? Number(a.avg_heart_rate) : null,
      makspuls: a.max_heart_rate != null ? Number(a.max_heart_rate) : null,
      sone: dominantSone(a.zones as Record<string, number> | null),
      beskrivelse: (a.notes as string | null) ?? null,
      gruppeId: null,
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

  return {
    totalSek, harRunder,
    erPlanlagt: workout.is_planned === true && workout.is_completed !== true,
    harKurve: hr.length > 0 || fart.length > 0 || watt.length > 0,
    heartZones,
    sport: (workout.sport as string | null) ?? null,
    hr, fart, watt, hoyde, rader, laktat, ernaering,
  }
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

// ── Tidslinje-redigering (LTD-A) ─────────────────────────────
// Hele tidslinja lagres i én operasjon: nye segmenter settes inn,
// endrede oppdateres, slettede fjernes. Etter redigering har HVERT
// segment en eksplisitt plassering (window_start/-duration) — tidslinja
// er da data, ikke noe som utledes av rekkefølge og varighet.
//
// duration_seconds følger vindulengden for alt UNNTATT skyting, der
// skytetiden er statistikk-porten og ikke skal endres av at man drar
// vinduet (fasiten).

/** Fase 117 kjørt i prod 29. aug (2 585 rader · 0 med gruppe_id). */
const GRUPPE_KOLONNE_FINNES = true

export interface TidslinjeSegment {
  /** db-id for eksisterende rad, null for nytt segment. */
  dbId: string | null
  activityType: string
  /** movement_name — bevegelsesform der typen har en. */
  bevegelsesform: string | null
  /** lap_notes — segmentets eget navn (tomt = avledet etikett). */
  navn: string | null
  startSek: number
  varighetSek: number
  sortOrder: number
  /** Segment-editorens felter (bolk 2). Tom streng = ikke ført. */
  distanseKm?: string
  snittpuls?: string
  makspuls?: string
  sone?: string
  beskrivelse?: string
  /** Fase 117 — settes KUN for repetisjoner i en kortintervall-gruppe. */
  gruppeId?: string | null
}

export async function lagreTidslinje(
  workoutId: string,
  segmenter: TidslinjeSegment[],
  slettedeIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: workout } = await supabase.from('workouts')
    .select('id').eq('id', workoutId).maybeSingle()
  if (!workout) return { ok: false, error: 'Fant ikke økta' }

  // Overlapp valideres på det ferdige settet — samme regel som klienten,
  // men mot det som faktisk skal lagres (to faner / trener + utøver).
  const sortert = [...segmenter].sort((a, b) => a.startSek - b.startSek)
  for (let i = 1; i < sortert.length; i++) {
    const forrige = sortert[i - 1]
    if (sortert[i].startSek < forrige.startSek + forrige.varighetSek - 0.5) {
      return { ok: false, error: 'To segmenter overlapper i tid — flytt eller kort inn det ene' }
    }
  }
  for (const s of segmenter) {
    if (s.varighetSek < 1) return { ok: false, error: 'Et segment må vare minst ett sekund' }
    if (s.startSek < 0) return { ok: false, error: 'Et segment kan ikke starte før økta' }
  }

  if (slettedeIds.length > 0) {
    const { error } = await supabase.from('workout_activities')
      .delete().in('id', slettedeIds).eq('workout_id', workoutId)
    if (error) return { ok: false, error: `Kunne ikke slette segment: ${error.message}` }
  }

  for (const s of segmenter) {
    const erSkyting = s.activityType.startsWith('skyting')
    const tall = (v?: string) => {
      if (v == null || v.trim() === '') return null
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    const km = tall(s.distanseKm)
    // Sonen lagres som tid i den sonen (zones-jsonb), samme form som
    // intervall-generatoren bruker — ingen ny representasjon.
    const soner = s.sone ? { [s.sone]: Math.round(s.varighetSek) } : null
    const felter = {
      activity_type: s.activityType,
      movement_name: s.bevegelsesform || null,
      lap_notes: s.navn || null,
      window_start_seconds: Math.round(s.startSek),
      window_duration_seconds: Math.round(s.varighetSek),
      sort_order: s.sortOrder,
      distance_meters: km != null ? Math.round(km * 1000) : null,
      avg_heart_rate: tall(s.snittpuls),
      max_heart_rate: tall(s.makspuls),
      notes: s.beskrivelse || null,
      ...(soner ? { zones: soner } : {}),
      // gruppe_id skrives FØRST når fase 117 er kjørt — kolonnen finnes
      // ikke ennå, og et forsøk ville gjort at HELE lagringen feilet for
      // den som deler et drag i repetisjoner. Repetisjonene lagres som
      // ekte rader uansett; det er bare klammen som mangler til da.
      ...(GRUPPE_KOLONNE_FINNES && s.gruppeId ? { gruppe_id: s.gruppeId } : {}),
      // Skyting: varigheten er skytetid-statistikk og røres ikke av drag.
      ...(erSkyting ? {} : { duration_seconds: Math.round(s.varighetSek) }),
    }
    if (s.dbId) {
      const { error, count } = await supabase.from('workout_activities')
        .update(felter, { count: 'exact' })
        .eq('id', s.dbId).eq('workout_id', workoutId)
      if (error) return { ok: false, error: `Kunne ikke lagre segmentet: ${error.message}` }
      if (!count) return { ok: false, error: 'Et segment ble ikke lagret — mangler du redigeringsrett?' }
    } else {
      const { error } = await supabase.from('workout_activities')
        .insert({ workout_id: workoutId, ...felter, duration_seconds: Math.round(s.varighetSek) })
      if (error) return { ok: false, error: `Kunne ikke legge til segmentet: ${error.message}` }
    }
  }

  return { ok: true }
}

// ── Nye punkter lagt inn i byggeren ──────────────────────────
// mmol og nutrition_type er NOT NULL i basen (målt 29. aug), så et punkt
// uten verdi KAN ikke lagres. Det sies ærlig i stedet for å finne på et
// tall som ser målt ut (regel 22).

export interface NyttPunkt {
  slag: 'laktat' | 'ernaering'
  tSek: number
  /** mmol for laktat, ernæringstype for ernæring. */
  verdi: string
}

export async function lagreNyePunkter(
  workoutId: string, punkter: NyttPunkt[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (punkter.length === 0) return { ok: true }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: workout } = await supabase.from('workouts')
    .select('id, user_id, time_of_day').eq('id', workoutId).maybeSingle()
  if (!workout) return { ok: false, error: 'Fant ikke økta' }

  const startSek = klokkeslettTilSek(workout.time_of_day)
  for (const p of punkter) {
    if (p.slag === 'laktat') {
      const mmol = Number(String(p.verdi).replace(',', '.'))
      if (!Number.isFinite(mmol) || mmol <= 0) {
        return { ok: false, error: 'Laktatpunktet mangler verdi — skriv mmol, eller fjern punktet' }
      }
      const { error } = await supabase.from('workout_lactate_measurements').insert({
        workout_id: workoutId, mmol,
        measured_at_time: sekTilKlokkeslett(startSek + p.tSek),
        sort_order: 0,
      })
      if (error) return { ok: false, error: `Kunne ikke lagre laktatpunktet: ${error.message}` }
    } else {
      const type = (p.verdi || '').trim() || 'gel'
      const { error } = await supabase.from('workout_nutrition_entries').insert({
        workout_id: workoutId, user_id: workout.user_id,
        nutrition_type: type,
        time_offset_minutes: Math.round(p.tSek / 60),
      })
      if (error) return { ok: false, error: `Kunne ikke lagre ernæringspunktet: ${error.message}` }
    }
  }
  return { ok: true }
}


/** Sonen med mest tid på raden — «segmentets sone» (zones er {I3: sek}). */
function dominantSone(zones: Record<string, number> | null): string | null {
  if (!zones) return null
  let beste: string | null = null, mest = 0
  for (const [k, v] of Object.entries(zones)) {
    const n = Number(v) || 0
    if (n > mest) { mest = n; beste = k }
  }
  return mest > 0 ? beste : null
}
