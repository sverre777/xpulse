import type { SupabaseClient } from '@supabase/supabase-js'
import { mapFitSportToXpulse, mapFitManufacturerToSource } from '@/lib/fit-mapping'
import { fitFilType, hentFitStruktur, oppsummerSessions, sessionSomLap } from '@/lib/fit-extract'
import {
  FILTYPE_FORKLARING,
  createWorkoutFromFit,
  detectFitConflict,
  fitFileHash,
  formatFitDuration,
  parseFit,
} from '@/lib/fit-import'
import { upsertWithManualWins } from '@/lib/polar-health-import'
import { lastNedStrideeFil } from '@/lib/stridee-api'
import {
  erStrideeProvider,
  merkBehandlet,
  type ProsesseringsResultat,
} from '@/lib/stridee-prosessering'
import type { DekryptertHendelse } from '@/lib/stridee'

/**
 * Stridee bolk 4 — data-hendelsene: activity.created og wellness.created/
 * updated. Leser fra stridee_events, aldri fra webhook-handleren (ti
 * sekunders frist der; her kan det ta den tiden det tar).
 *
 * AKTIVITETER går gjennom NØYAKTIG samme kjerne som manuell .fit-opplasting
 * (lib/fit-import.ts) — én sannhet for cascade-formen, enhets-fellene og
 * sonene. Fila lastes ned via hendelsens data.file.url: et vanlig signert
 * kall som svarer 302 til en kortlevd URL (URL-en i hendelsen utløper aldri).
 *
 * WELLNESS skrives med samme skrivevei som Polar-helseimporten:
 * upsertWithManualWins mot sleep_records/health_metrics med kilde per verdi
 * — en manuelt ført verdi røres ALDRI. Kilden er providernavnet (garmin/
 * coros), så frakoblings-oppryddingen (planBrandPurge) kan skille merkene.
 * Formene under er MÅLT mot 45 ekte hendelser i prod (27. aug), ikke lest
 * fra docs — docs mangler feltlistene for alt annet enn sleep.
 *
 * KONFLIKT-POLICY for aktiviteter er Polar-importens, ikke opplastingens:
 * en eksisterende økt innenfor ±30 min → hopp over (hendelsen markeres
 * behandlet med notat). Økter UTEN klokkeslett teller IKKE som konflikt —
 * ellers ville hver manuelle loggføring blokkert importen den dagen. Dette
 * fanger også økter som allerede kom via Strava.
 */

const DATA_HENDELSER = new Set(['activity.created', 'wellness.created', 'wellness.updated'])

interface EventRad {
  id: string
  event_type: string | null
  stridee_user_id: string | null
  attempts: number | null
  payload: DekryptertHendelse
}

interface Sammendrag { [k: string]: unknown }

export async function prosesserDataHendelser(
  db: SupabaseClient,
  maks = 100,
): Promise<ProsesseringsResultat> {
  const res: ProsesseringsResultat = { behandlet: 0, hoppet_over: 0, feilet: 0, detaljer: [] }

  const { data: rader, error } = await db
    .from('stridee_events')
    .select('id, event_type, stridee_user_id, attempts, payload')
    .is('processed_at', null)
    .in('event_type', [...DATA_HENDELSER])
    .order('received_at', { ascending: true })
    .limit(maks)
  if (error) {
    res.feilet++
    res.detaljer.push(`oppslag feilet: ${error.message}`)
    return res
  }

  // Lenke-oppslaget én gang per subjekt, ikke per hendelse.
  const subjekter = [...new Set((rader ?? []).map(r => r.stridee_user_id).filter(Boolean))] as string[]
  const brukerAv = new Map<string, string>()
  if (subjekter.length > 0) {
    const { data: lenker } = await db
      .from('stridee_link')
      .select('stridee_user_id, user_id')
      .in('stridee_user_id', subjekter)
    for (const l of lenker ?? []) brukerAv.set(l.stridee_user_id as string, l.user_id as string)
  }

  for (const rad of (rader ?? []) as EventRad[]) {
    const type = rad.event_type ?? ''
    const userId = rad.stridee_user_id ? brukerAv.get(rad.stridee_user_id) : undefined
    if (!userId) {
      // Ingen lenke: hendelsen tilhører ingen bruker hos oss. Markeres
      // behandlet — connect-flyten lager lenken FØR leverandøren kjenner
      // brukeren, så dette er foreldreløs data, ikke et kappløp.
      await merkBehandlet(db, rad.id, null)
      res.hoppet_over++
      res.detaljer.push(`${rad.id}: ${type} uten lenket bruker — hoppet over`)
      continue
    }

    // Optimistisk krav på raden (CAS på attempts): to samtidige kjøringer —
    // f.eks. en timeout-avbrutt som fortsetter i bakgrunnen ved siden av
    // retry-kallet — skal aldri behandle SAMME hendelse. Bare den som vinner
    // oppdateringen går videre; taperen hopper over og lar vinneren fullføre.
    const { data: krav } = await db
      .from('stridee_events')
      .update({ attempts: (rad.attempts ?? 0) + 1 })
      .eq('id', rad.id)
      .eq('attempts', rad.attempts ?? 0)
      .is('processed_at', null)
      .select('id')
    if (!krav || krav.length === 0) {
      res.hoppet_over++
      res.detaljer.push(`${rad.id}: ${type} behandles av en annen kjøring — hoppet over`)
      continue
    }

    try {
      const melding = type === 'activity.created'
        ? await importerAktivitet(db, userId, rad.payload ?? {})
        : await importerWellness(db, userId, rad.payload ?? {})
      await merkBehandlet(db, rad.id, null)
      res.behandlet++
      res.detaljer.push(`${type}: ${melding}`)
    } catch (e) {
      res.feilet++
      const grunn = e instanceof Error ? e.message : String(e)
      res.detaljer.push(`${rad.id}: ${type} feilet — ${grunn}`)
      await merkBehandlet(db, rad.id, grunn)   // attempts++, forblir ubehandlet
    }
  }

  return res
}

// ── Aktiviteter ─────────────────────────────────────────────

async function importerAktivitet(
  db: SupabaseClient,
  userId: string,
  payload: DekryptertHendelse,
): Promise<string> {
  const data = (payload.data ?? {}) as Sammendrag
  const aktivitetsId = typeof data.id === 'string' ? data.id : null
  if (!aktivitetsId) throw new Error('activity.created uten data.id')
  const provider = typeof payload.provider === 'string' ? payload.provider : 'klokke'
  const externalId = `stridee_${aktivitetsId}`

  // Dedupe på leverandørens aktivitets-id (webhook-retries, wellness.updated-
  // aktige reprosesseringer).
  const { data: finnes } = await db
    .from('imported_activities')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'stridee')
    .eq('external_id', externalId)
    .maybeSingle()
  if (finnes) return `${aktivitetsId} allerede importert`

  const fil = data.file as { format?: string; url?: string } | undefined
  if (!fil?.url) return `${aktivitetsId} har ingen fil å hente`

  const nedlasting = await lastNedStrideeFil(fil.url)
  if (!nedlasting.data) throw new Error(nedlasting.feil ?? 'nedlasting feilet')
  const buffer = nedlasting.data

  // Samme fil kan være lastet opp manuelt — hashen er kanal-uavhengig.
  const hash = await fitFileHash(buffer)
  const { data: manuell } = await db
    .from('imported_activities')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', `fit_${hash}`)
    .maybeSingle()
  if (manuell) return `${aktivitetsId}: samme fil er allerede lastet opp manuelt`

  const parsed = await parseFit(buffer)
  const { session, sessions, laps: raaLaps, records } = hentFitStruktur(parsed)
  if (!session || !session.start_time) {
    const filtype = fitFilType(parsed)
    return `${aktivitetsId}: ${FILTYPE_FORKLARING[filtype ?? ''] ?? `«${filtype ?? 'ukjent'}»-fil uten session — ikke en økt`}`
  }

  const fitLaps = raaLaps.length > 0 ? raaLaps : [sessionSomLap(session)]
  const totaler = oppsummerSessions(sessions.length > 0 ? sessions : [session])
  const startDate = typeof session.start_time === 'string'
    ? new Date(session.start_time) : session.start_time
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)
  const durationMin = Math.round(totaler.varighetSek / 60)

  // Polar-policyen: konflikt → hopp over, uten klokkeslett teller ikke.
  const konflikt = await detectFitConflict(db, userId, dateStr, timeStr, { utenTidTeller: false })
  if (konflikt) {
    return `${aktivitetsId}: konflikt med eksisterende økt ${konflikt} — ikke importert`
  }

  const mapping = mapFitSportToXpulse(session.sport, session.sub_sport)
  const importedFrom = mapFitManufacturerToSource(parsed.file_ids?.[0]?.manufacturer)
  // Navnet fra klokka når det finnes («Vågan Terrengløp»), ellers
  // bevegelsesformen — samme fallback som Polar.
  const navn = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : mapping.movement
  const tittel = `${navn} — ${formatFitDuration(durationMin)}`

  const resultat = await createWorkoutFromFit(
    db, userId, `klokkesynk (${provider})`, session, records, fitLaps,
    externalId, tittel, mapping, importedFrom,
    dateStr, timeStr, durationMin, totaler.distanseKm, totaler,
    'stridee',
  )
  if (!resultat.ok || !resultat.workout_id) {
    throw new Error(resultat.error ?? 'import feilet')
  }

  await db.from('notifications').insert({
    user_id: userId,
    type: 'klokkesync_imported',
    title: 'Ny økt fra klokka',
    content: `${tittel}`,
    link_url: `/app/dagbok?edit=${resultat.workout_id}`,
  })

  return `${aktivitetsId} → økt ${resultat.workout_id} (${tittel})`
}

// ── Wellness ────────────────────────────────────────────────

// RFC 3339 med riktig offset (ikke Z med forskjøvet klokke): sleep_start/
// sleep_end skal bety det klokka mente, i utøverens sone.
function isoMedOffset(unixSek: number, offsetSek: number | null): string {
  const off = offsetSek ?? 0
  const lokal = new Date((unixSek + off) * 1000).toISOString().slice(0, 19)
  if (off === 0) return `${lokal}Z`
  const fortegn = off < 0 ? '-' : '+'
  const abs = Math.abs(off)
  const tt = String(Math.floor(abs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0')
  return `${lokal}${fortegn}${tt}:${mm}`
}

function tall(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

async function importerWellness(
  db: SupabaseClient,
  userId: string,
  payload: DekryptertHendelse,
): Promise<string> {
  const data = (payload.data ?? {}) as Sammendrag
  const kind = typeof data.kind === 'string' ? data.kind : null
  const dato = typeof data.calendar_date === 'string' ? data.calendar_date : null
  const provider = typeof payload.provider === 'string' && erStrideeProvider(payload.provider)
    ? payload.provider : null
  if (!kind) return 'wellness uten kind — ingenting å hente'
  if (!dato) return `${kind} uten calendar_date — ingenting å hente`
  if (!provider) return `${kind} med ukjent provider — hoppet over`

  const s = (data.summary ?? {}) as Sammendrag

  if (kind === 'sleep') {
    const varighetSek = tall(s.durationInSeconds)
    const startSek = tall(s.startTimeInSeconds)
    const offsetSek = tall(s.startTimeOffsetInSeconds)
    const vaakenSek = tall(s.awakeDurationInSeconds) ?? 0
    const umaaltSek = tall(s.unmeasurableSleepInSeconds) ?? 0
    // durationInSeconds er summen av søvnfasene (målt: deep+light+rem
    // stemmer eksakt) — våken tid kommer i tillegg. Slutten er dermed
    // start + faser + våken + umålt.
    const felles = {
      sleep_start: startSek != null ? isoMedOffset(startSek, offsetSek) : null,
      sleep_end: startSek != null && varighetSek != null
        ? isoMedOffset(startSek + varighetSek + vaakenSek + umaaltSek, offsetSek) : null,
      total_sleep_minutes: varighetSek != null ? Math.round(varighetSek / 60) : null,
      awake_minutes: vaakenSek ? Math.round(vaakenSek / 60) : (tall(s.awakeDurationInSeconds) != null ? 0 : null),
      deep_minutes: tall(s.deepSleepDurationInSeconds) != null ? Math.round((tall(s.deepSleepDurationInSeconds) as number) / 60) : null,
      light_minutes: tall(s.lightSleepDurationInSeconds) != null ? Math.round((tall(s.lightSleepDurationInSeconds) as number) / 60) : null,
      rem_minutes: tall(s.remSleepInSeconds) != null ? Math.round((tall(s.remSleepInSeconds) as number) / 60) : null,
      sleep_score: tall((s.overallSleepScore as Sammendrag | undefined)?.value),
    }
    const skrevet = await upsertWithManualWins(db, 'sleep_records', userId, dato, felles, provider)
    if (skrevet.error) throw new Error(`sleep_records: ${skrevet.error}`)

    const merke: Sammendrag = {}
    if (typeof s.validation === 'string') merke.sleep_validation = s.validation
    if (s.sleepScores && typeof s.sleepScores === 'object') merke.sleep_scores = s.sleepScores
    const napSek = tall(s.totalNapDurationInSeconds)
    if (napSek) merke.nap_minutes = Math.round(napSek / 60)

    // Stadie-tidslinja fra serien (hypnogrammet). Formen er MÅLT i prod:
    // sleepLevelsMap.{deep,light,rem,awake} = intervaller med
    // {startTimeInSeconds, endTimeInSeconds}. SpO2 og respirasjon i samme
    // serie hentes BEVISST ikke (personvern §12: biosensing utelates).
    // Feiler serien, står natta med fallback-stripa — aldri feil hendelsen.
    let serieNotat = ''
    const serieUrl = typeof data.series_url === 'string' ? data.series_url : null
    if (serieUrl) {
      const stadier = await hentSovnstadier(serieUrl)
      if (stadier === null) {
        serieNotat = ', serie utilgjengelig (fallback-stripe)'
      } else if (stadier.length > 0) {
        merke.sleep_stages = stadier
        serieNotat = `, ${stadier.length} stadie-intervaller`
      }
    }

    const merkeFeil = await lagreMerkeverdier(db, userId, dato, provider, merke)
    if (merkeFeil) throw new Error(`merkeverdier: ${merkeFeil}`)

    return `søvn ${dato}: ${skrevet.written} felt skrevet${serieNotat}${skrevet.keptManual.length ? `, manuell beholdt: ${skrevet.keptManual.join(',')}` : ''}`
  }

  if (kind === 'daily') {
    const felles = {
      resting_hr: tall(s.restingHeartRateInBeatsPerMinute),
      steps: tall(s.steps),
      daily_distance_m: tall(s.distanceInMeters) != null ? Math.round(tall(s.distanceInMeters) as number) : null,
      stairs_climbed: tall(s.floorsClimbed),
      active_minutes: tall(s.activeTimeInSeconds) != null ? Math.round((tall(s.activeTimeInSeconds) as number) / 60) : null,
    }
    const skrevet = await upsertWithManualWins(db, 'health_metrics', userId, dato, felles, provider)
    if (skrevet.error) throw new Error(`health_metrics: ${skrevet.error}`)

    const merke: Sammendrag = {}
    for (const [fra, til] of [
      ['bodyBatteryChargedValue', 'body_battery_charged'],
      ['bodyBatteryDrainedValue', 'body_battery_drained'],
      ['averageStressLevel', 'avg_stress'],
      ['maxStressLevel', 'max_stress'],
      // Kalorier hentes BEVISST ikke (helse-prinsippet + personvern §12) —
      // activeKilocalories står i payloaden, men skal aldri lagres.
    ] as const) {
      const v = tall(s[fra])
      if (v != null) merke[til] = v
    }
    if (typeof s.stressQualifier === 'string') merke.stress_qualifier = s.stressQualifier
    const merkeFeil = await lagreMerkeverdier(db, userId, dato, provider, merke)
    if (merkeFeil) throw new Error(`merkeverdier: ${merkeFeil}`)

    return `døgn ${dato}: ${skrevet.written} felt skrevet${skrevet.keptManual.length ? `, manuell beholdt: ${skrevet.keptManual.join(',')}` : ''}`
  }

  if (kind === 'hrv') {
    const felles = { hrv_ms: tall(s.lastNightAvg) }
    const skrevet = await upsertWithManualWins(db, 'health_metrics', userId, dato, felles, provider)
    if (skrevet.error) throw new Error(`health_metrics: ${skrevet.error}`)
    const hoy = tall(s.lastNight5MinHigh)
    const merkeFeil = hoy != null
      ? await lagreMerkeverdier(db, userId, dato, provider, { hrv_5min_high: hoy })
      : null
    if (merkeFeil) throw new Error(`merkeverdier: ${merkeFeil}`)
    return `hrv ${dato}: ${skrevet.written} felt skrevet`
  }

  if (kind === 'fitness') {
    const merke: Sammendrag = {}
    const vo2 = tall(s.vo2Max)
    const alder = tall(s.fitnessAge)
    if (vo2 != null) merke.vo2max = vo2
    if (alder != null) merke.fitness_age = alder
    if (Object.keys(merke).length === 0) return `fitness ${dato}: ingen verdier`
    const merkeFeil = await lagreMerkeverdier(db, userId, dato, provider, merke)
    if (merkeFeil) throw new Error(`merkeverdier: ${merkeFeil}`)
    return `fitness ${dato}: vo2max/fitness_age lagret`
  }

  // stress-hendelsen bærer ingen verdier i summary (målt i prod: kun
  // tidsfelter) — stressnivåene kommer i daily. Markeres behandlet.
  if (kind === 'stress') return `stress ${dato}: ingen verdier i payloaden (kommer via daily)`

  return `ukjent wellness-kind «${kind}» — hoppet over`
}

/**
 * Henter søvnserien og trekker ut stadie-tidslinja — KUN sleepLevelsMap
 * (aldri SpO2/respirasjon, personvern §12). Normaliseres til vårt eget
 * navnesett (dyp/lett/rem/vaken) med epoch-sekunder, sortert.
 * null = serien var utilgjengelig; [] = serie uten stadier.
 */
export async function hentSovnstadier(
  serieUrl: string,
): Promise<{ s: string; fra: number; til: number }[] | null> {
  const svar = await lastNedStrideeFil(serieUrl)
  if (!svar.data) {
    console.warn(`[stridee-import] søvnserie feilet: ${svar.feil}`)
    return null
  }
  let serie: Record<string, unknown>
  try {
    serie = JSON.parse(svar.data.toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
  const kart = serie.sleepLevelsMap as Record<string, unknown> | undefined
  if (!kart || typeof kart !== 'object') return []
  const NAVN: Record<string, string> = { deep: 'dyp', light: 'lett', rem: 'rem', awake: 'vaken' }
  const ut: { s: string; fra: number; til: number }[] = []
  for (const [deres, vaart] of Object.entries(NAVN)) {
    const liste = kart[deres]
    if (!Array.isArray(liste)) continue
    for (const iv of liste) {
      const fra = (iv as Record<string, unknown>)?.startTimeInSeconds
      const til = (iv as Record<string, unknown>)?.endTimeInSeconds
      if (typeof fra === 'number' && typeof til === 'number' && til > fra) {
        ut.push({ s: vaart, fra, til })
      }
    }
  }
  return ut.sort((a, b) => a.fra - b.fra)
}

/**
 * Engangs-backfill: netter som alt er importert (hendelsen behandlet) får
 * stadie-tidslinja i etterkant. Leser lagrede sleep-hendelser og henter
 * seriene deres — hopper over datoer som allerede har sleep_stages.
 * Kalles fra cron-ruta (CRON_SECRET), kjøres manuelt én gang etter deploy.
 */
export async function backfillSovnstadier(db: SupabaseClient): Promise<string[]> {
  const ut: string[] = []
  const { data: rader } = await db
    .from('stridee_events')
    .select('stridee_user_id, payload')
    .in('event_type', ['wellness.created', 'wellness.updated'])
    .order('received_at', { ascending: true })
  type P = { provider?: string; data?: { kind?: string; series_url?: string; calendar_date?: string } }
  for (const rad of rader ?? []) {
    const p = rad.payload as P
    if (p?.data?.kind !== 'sleep' || typeof p.data.series_url !== 'string' || !p.data.calendar_date) continue
    if (!erStrideeProvider(p.provider)) continue
    const { data: lenke } = await db.from('stridee_link')
      .select('user_id').eq('stridee_user_id', rad.stridee_user_id).maybeSingle()
    if (!lenke) continue
    const dato = p.data.calendar_date
    const { data: finnes } = await db.from('health_brand_metrics')
      .select('metrics').eq('user_id', lenke.user_id).eq('date', dato).eq('brand', p.provider).maybeSingle()
    if ((finnes?.metrics as Record<string, unknown> | null)?.sleep_stages) {
      ut.push(`${dato}: har alt stadier`)
      continue
    }
    const stadier = await hentSovnstadier(p.data.series_url)
    if (!stadier || stadier.length === 0) {
      ut.push(`${dato}: serie ${stadier === null ? 'utilgjengelig' : 'uten stadier'}`)
      continue
    }
    const feil = await lagreMerkeverdier(db, lenke.user_id as string, dato, p.provider, { sleep_stages: stadier })
    ut.push(`${dato}: ${feil ?? `${stadier.length} intervaller lagret`}`)
  }
  return ut
}

// Merkespesifikke verdier (health_brand_metrics) — slås sammen med det som
// ligger der fra før, så en delvis import ikke sletter felter. Egen kopi av
// Polar-importens private merge fordi Polar-synken ikke skal røres (stående
// regel) — brand-parameteren er forskjellen.
async function lagreMerkeverdier(
  db: SupabaseClient,
  userId: string,
  dato: string,
  brand: string,
  metrics: Sammendrag,
): Promise<string | null> {
  if (Object.keys(metrics).length === 0) return null
  const { data: eksisterende, error: lesFeil } = await db
    .from('health_brand_metrics')
    .select('metrics')
    .eq('user_id', userId)
    .eq('date', dato)
    .eq('brand', brand)
    .maybeSingle()
  if (lesFeil) return lesFeil.message

  const sammenslaatt = {
    ...((eksisterende?.metrics as Sammendrag | null) ?? {}),
    ...metrics,
  }
  const { error: skrivFeil } = await db
    .from('health_brand_metrics')
    .upsert({
      user_id: userId,
      date: dato,
      brand,
      metrics: sammenslaatt,
      imported_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,brand' })
  return skrivFeil ? skrivFeil.message : null
}

/**
 * Rydder behandlede hendelser eldre enn 30 dager. Payloaden er råmaterialet
 * for reprosessering — 30 dager er nok til å oppdage og rette en importfeil,
 * og filene kan uansett hentes på nytt via data.file.url (utløper aldri).
 */
export async function ryddGamleHendelser(db: SupabaseClient): Promise<number> {
  const grense = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data, error } = await db
    .from('stridee_events')
    .delete()
    .not('processed_at', 'is', null)
    .lt('received_at', grense)
    .select('id')
  if (error) {
    console.warn(`[stridee-import] opprydding feilet: ${error.message}`)
    return 0
  }
  return (data ?? []).length
}
