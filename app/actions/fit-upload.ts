'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { mapFitSportToXpulse, mapFitManufacturerToSource } from '@/lib/fit-mapping'
import { FIT_MAX_BYTES, formatMB } from '@/lib/fit-limits'
import {
  fitFilType,
  hentFitStruktur,
  oppsummerSessions,
  sessionSomLap,
  type FitParsedData,
} from '@/lib/fit-extract'
import {
  FILTYPE_FORKLARING,
  createWorkoutFromFit,
  detectFitConflict,
  fitFileHash,
  formatFitDuration,
  mergeFitIntoExisting,
  parseFit,
  type FitImportResult,
  type FitParsedPreview,
} from '@/lib/fit-import'

// .fit-fil-opplasting. Brukeren laster opp én eller flere .fit-filer fra
// Garmin/Coros/Polar/Wahoo/etc. Vi parser, sjekker konflikt og enten
// returnerer preview ELLER lagrer direkte (avhengig av om konflikt-
// resolution er gitt).
//
// SELVE IMPORTEN (parse → workouts/workout_activities/workout_samples) bor i
// lib/fit-import.ts og deles med klokkesynk-importen — denne fila eier bare
// det opplastingsspesifikke: auth, FormData, preview/konflikt-dialogen og
// revalidatePath. Mapper til samme struktur som Strava-importen — ingen
// forskjell etter import.

export type { FitImportResult, FitParsedPreview }

// Hovedfunksjon: motta FormData m/file. Hvis conflictResolution er null og
// det finnes konflikt → returnerer preview. Ellers → fullfør import.
export async function uploadFitFile(
  formData: FormData,
  options: {
    conflictResolution?: 'merge' | 'replace' | 'keep_both' | 'skip'
    conflictWorkoutId?: string
  } = {},
): Promise<FitImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Ingen fil' }
  // Samme grense som klientvalideringen og next.config.ts (FEIL-1).
  // Sjekken her er i praksis uoppnåelig — rammeverket kutter kroppen på
  // grensen før denne koden kjører — men står så meldingen er SANN den
  // dagen grensene endres hver for seg. (Var 20 MB: død kode over et
  // rammeverkstak på 1 MB, og meldingen løy.)
  if (file.size > FIT_MAX_BYTES) {
    return { ok: false, error: `Fila er ${formatMB(file.size)} — grensen er ${formatMB(FIT_MAX_BYTES)}` }
  }

  // Buffer + hash for anti-duplikat. Hash er deterministisk så samme fil
  // alltid får samme external_id.
  const buffer = Buffer.from(await file.arrayBuffer())
  const hash = await fitFileHash(buffer)
  const externalId = `fit_${hash}`

  // Sjekk om allerede importert.
  const { data: existing } = await supabase
    .from('imported_activities')
    .select('id, workout_id')
    .eq('user_id', user.id)
    .eq('source', 'fit_upload')
    .eq('external_id', externalId)
    .maybeSingle()
  if (existing) {
    return { ok: true, workout_id: existing.workout_id ?? undefined }
  }

  // Parse .fit-fila.
  let parsed: FitParsedData
  try {
    parsed = await parseFit(buffer)
  } catch (e) {
    console.error('FIT parse error:', e)
    return { ok: false, error: 'Kunne ikke lese .fit-fila' }
  }

  // I mode:'cascade' setter fit-file-parser ALDRI parsed.sessions/.laps/
  // .records — alt ligger under activity.sessions[].laps[].records[]. Koden
  // leste toppnivået, så hver eneste .fit-fil døde her (FEIL-3).
  const { session, sessions, laps: raaLaps, records: fitRecords } = hentFitStruktur(parsed)

  // Ikke alle .fit-filer er økter. Klokker eksporterer også vekt-, monitor-,
  // program- og løypefiler, og de har ingen session. Uten denne sjekken fikk
  // brukeren «mangler session-data» og ingen anelse om hva som var galt.
  if (!session || !session.start_time) {
    const filtype = fitFilType(parsed)
    const forklaring = FILTYPE_FORKLARING[filtype ?? '']
    if (forklaring) return { ok: false, error: forklaring }
    return {
      ok: false,
      error: filtype && filtype !== 'activity'
        ? `Dette er en «${filtype}»-fil, ikke en treningsøkt — eksporter aktiviteten i stedet`
        : '.fit-fila mangler session-data',
    }
  }

  // Ingen laps (enklere klokker, manuelt førte økter): lag én av sessionen,
  // slik at økta ikke havner i dagboka uten en eneste aktivitetsrad.
  const fitLaps = raaLaps.length > 0 ? raaLaps : [sessionSomLap(session)]
  // Multisport: én session per gren. Totalene summeres, snittpulsen vektes.
  const totaler = oppsummerSessions(sessions.length > 0 ? sessions : [session])

  const startDate = typeof session.start_time === 'string'
    ? new Date(session.start_time) : session.start_time
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)
  // total_elapsed_time mangler hos noen merker — varighetSekunder faller
  // tilbake på total_timer_time i stedet for å gi 0 minutter.
  const durationMin = Math.round(totaler.varighetSek / 60)
  const distanceKm = totaler.distanseKm
  // Movement-mapping (bevegelsesform + subkategori). Workouts.sport hentes
  // fra brukerens primary_sport — manufacturer-merket bestemmer kilde-badge.
  const mapping = mapFitSportToXpulse(session.sport, session.sub_sport)
  const fileId = parsed.file_ids?.[0]
  // Sendes videre RÅ, i den formen parseren ga oss. Her stod det tidligere en
  // `typeof … === 'number' ? … : null`-test, og den gjorde tabellen død:
  // fit-file-parser oversetter enum-felt til profilnavnet sitt, så feltet er
  // strengen 'polar_electro' — ikke 123 — for hvert merke biblioteket kjenner.
  // Testen traff derfor bare ID-er biblioteket IKKE kjenner, og alt annet ble
  // 'fit'. mapFitManufacturerToSource tar begge former.
  const importedFrom = mapFitManufacturerToSource(fileId?.manufacturer)
  const title = `${file.name.replace(/\.fit$/i, '')} — ${formatFitDuration(durationMin)}`

  // Konflikt-deteksjon.
  const conflict = await detectFitConflict(supabase, user.id, dateStr, timeStr)

  // Returner preview hvis konflikt og ingen resolution.
  if (conflict && !options.conflictResolution) {
    return {
      ok: true,
      preview: {
        file_hash: hash,
        filename: file.name,
        title,
        sport: mapping.movement,
        start_date: startDate.toISOString(),
        duration_minutes: durationMin,
        distance_km: Math.round(distanceKm * 100) / 100,
        conflict_workout_id: conflict,
        already_imported: false,
      },
    }
  }

  // Skip → marker som importert m/null workout_id.
  if (options.conflictResolution === 'skip') {
    await supabase.from('imported_activities').insert({
      user_id: user.id,
      source: 'fit_upload',
      external_id: externalId,
      workout_id: null,
    })
    return { ok: true }
  }

  // Replace → slett konflikt-workouten.
  if (options.conflictResolution === 'replace' && options.conflictWorkoutId) {
    await supabase.from('workouts').delete()
      .eq('id', options.conflictWorkoutId).eq('user_id', user.id)
  }

  // Merge → oppdater eksisterende workout med samples + aggregater.
  if (options.conflictResolution === 'merge' && options.conflictWorkoutId) {
    const merged = await mergeFitIntoExisting(
      supabase, user.id, options.conflictWorkoutId,
      session, fitRecords, fitLaps, externalId,
    )
    if (merged.ok) revalidatePath('/app/dagbok')
    return merged
  }

  // Default (ingen konflikt eller keep_both) → opprett ny.
  const result = await createWorkoutFromFit(
    supabase, user.id, file.name, session,
    fitRecords, fitLaps,
    externalId, title, mapping, importedFrom,
    dateStr, timeStr, durationMin, distanceKm, totaler,
  )
  if (result.ok) {
    revalidatePath('/app/dagbok')
    revalidatePath('/app/oversikt')
  }
  return result
}
