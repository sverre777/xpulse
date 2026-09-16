'use server'

// STILLESTAND TIL PAUSE - fase C: handlingen (Sverre 15. sep 2026).
//
// Gjør periodene fra lib/stillestand om til ekte pause-rader på økta. Da
// faller de ut av ren treningstid via IKKE_TRENINGSTID_TYPER, mens
// øktgrafen fortsatt tegner hele kurven fra samples.
//
// TYPEN ER 'pause', IKKE 'aktiv_pause'. Aktiv pause ER treningstid siden
// 9823f70 - bruker vi den, trekkes ingenting fra. Utøveren kan endre raden
// til aktiv pause etterpå hvis han gikk rundt og ventet; da teller den med
// igjen, og det er meningen.
//
// SKYTING HOPPES OVER: standplass ligger allerede utenfor ren treningstid
// (lib/activity-summary). Lot vi en pause overlappe en skyterad, ville tida
// blitt trukket fra to ganger.
//
// ANGRE GÅR PÅ auto_pause (fase 127), IKKE PÅ NAVNET. lap_notes er
// segmentets navn og redigeres fritt av utøveren i Oktbyggeren - døpte han
// pausen om, ville angre mistet den og neste kjøring lagt en ny pause oppå;
// døpte han en annen rad «Stillestand», ville angre slettet hans egen rad.
// Navnet står fortsatt PÅ raden, som synlig og ærlig tekst - det er bare
// ikke nøkkelen. Ingen eksisterende rad endres - bortsett fra sort_order,
// som er ren visning (tidsplassering er dataene), slik at pausene havner
// MELLOM radene og ikke sist i lista.
//
// EGNE ØKTER: handlingen krever at man eier økta. Trener kan ikke føre i
// utøverens dagbok i dag - se køposten om trener som redigerer utøverdata.

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isShootingActivityType } from '@/lib/activity-summary'
import {
  finnStillestand, stillestandSum, fartProver, utenSkytingOverlapp,
  STILLESTAND_MERKE, type StillestandResultat,
} from '@/lib/stillestand'
import { splittForStillestand, angreSplitt, type SplittRad } from '@/lib/stillestand-splitt'
import { beregnSegmenter, type SegmentRad } from '@/lib/segmenter'
import type { Fartprove, Stillestand } from '@/lib/stillestand'
import type { HeartZone } from '@/lib/heart-zones'

// MERK: denne fila kan BARE eksportere async funksjoner. STILLESTAND_MERKE
// og StillestandResultat bor derfor i lib/stillestand - en konstant eller en
// type eksportert herfra velter hele action-chunken i det en
// klientkomponent importerer fra den.

// Skyte-typene har ÉN fasit (lib/activity-summary). En egen startsWith-regel
// her ville gitt samme svar i dag og et annet den dagen lista endres.
const ER_SKYTING = (t: string | null | undefined) => isShootingActivityType(t ?? '')

/** Utøverens pulssoner - grunnlaget for å regne soner per del. */
async function hentPulssoner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brukerId: string,
): Promise<HeartZone[] | null> {
  const { data } = await supabase.from('user_heart_zones')
    .select('zone_name, min_bpm, max_bpm').eq('user_id', brukerId)
  const soner = (data ?? []) as unknown as HeartZone[]
  return soner.length > 0 ? soner : null
}

interface Rad {
  id: string
  activity_type: string
  sort_order: number | null
  duration_seconds: number | null
  window_start_seconds: number | null
  window_duration_seconds: number | null
  lap_notes: string | null
  auto_pause: boolean | null
  split_parent_id: string | null
  split_backup: Record<string, unknown> | null
  movement_name: string | null
  movement_subcategory: string | null
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  zones: Record<string, number> | null
}

const RAD_FELTER = 'id, activity_type, sort_order, duration_seconds, window_start_seconds,'
  + ' window_duration_seconds, lap_notes, auto_pause, split_parent_id, split_backup,'
  + ' movement_name, movement_subcategory, distance_meters, avg_heart_rate, max_heart_rate, zones'

/**
 * Sett økta tilbake slik den var før pausene ble laget.
 *
 * Gjenoppretter hver splittet original FULLT fra split_backup og sletter
 * barna. Brukes både av «angre» og som FØRSTE STEG i en ny kjøring - se
 * kommentaren i gjorStillestandTilPause om hvorfor delete-og-lag-nytt
 * ikke holder når raden er splittet.
 */
async function syttSammenIgjen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rader: Rad[],
): Promise<{ rader: Rad[] } | { error: string }> {
  const resultat = angreSplitt(rader as unknown as SplittRad[])
  if (resultat.slettede.length > 0) {
    const { error } = await supabase.from('workout_activities').delete().in('id', resultat.slettede)
    if (error) return { error: error.message }
  }
  for (const r of resultat.rader) {
    const original = rader.find(x => x.id === r.id)
    if (!original?.split_backup) continue
    const { split_backup: _b, ...felter } = r as unknown as Record<string, unknown>
    const { error } = await supabase.from('workout_activities')
      .update({ ...felter, split_backup: null, split_parent_id: null })
      .eq('id', r.id)
    if (error) return { error: error.message }
  }
  // Rydd også bort rader fra den gamle oppå-varianten, som aldri ble
  // splittet: de er auto_pause uten forelder.
  const gamleOppaa = resultat.rader.filter(r =>
    (r as unknown as Rad).auto_pause === true && !r.split_backup).map(r => r.id)
  if (gamleOppaa.length > 0) {
    const { error } = await supabase.from('workout_activities').delete().in('id', gamleOppaa)
    if (error) return { error: error.message }
  }
  return { rader: resultat.rader.filter(r => !gamleOppaa.includes(r.id)) as unknown as Rad[] }
}

interface Grunnlag {
  feil?: string
  supabase: Awaited<ReturnType<typeof createClient>>
  brukerId: string
}

async function hentGrunnlag(workoutId: string): Promise<Grunnlag> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { feil: 'Ikke innlogget', supabase, brukerId: '' }

  const { data: okt } = await supabase.from('workouts')
    .select('id, user_id').eq('id', workoutId).maybeSingle()
  if (!okt) return { feil: 'Fant ikke økta', supabase, brukerId: user.id }
  if (okt.user_id !== user.id) return { feil: 'Økta tilhører noen andre', supabase, brukerId: user.id }

  return { supabase, brukerId: user.id }
}

/**
 * Hva ville skjedd? Samme regning som utførelsen, men uten å skrive noe.
 * Dialogen i fase D viser disse tallene FØR brukeren bekrefter.
 */
export async function forhandsvisStillestand(
  workoutId: string,
): Promise<StillestandResultat | { error: string }> {
  const g = await hentGrunnlag(workoutId)
  if (g.feil) return { error: g.feil }
  const { supabase } = g

  const { data: samples } = await supabase.from('workout_samples')
    .select('speed_samples, pace_samples').eq('workout_id', workoutId).maybeSingle()
  const prover = fartProver(samples ?? null)
  if (!prover) return { error: 'Økta har ingen fartsdata' }

  const { data: rader } = await supabase.from('workout_activities')
    .select(RAD_FELTER)
    .eq('workout_id', workoutId).order('sort_order', { ascending: true })

  // SAMME funksjon som kjøringen bruker. Dialogen skal aldri kunne love
  // noe kjøringen ikke gjør.
  const f = periodeneSomBlirPauser(prover, (rader ?? []) as unknown as Rad[])
  return {
    antall: f.beholdt.length,
    sumSek: stillestandSum(f.beholdt),
    timerTimeSek: null,
    elapsedSek: f.totalSek,
    hoppetOverSkyting: f.hoppetOverSkyting,
    utenforRader: f.utenforRader,
  }
}

/**
 * HVOR LIGGER HVER RAD - ÉN KILDE (Sverre 16. sep 2026).
 *
 * .fit-importen skriver ALDRI window_start_seconds/window_duration_seconds
 * (verifisert: null treff i lib/fit-import). Resten av appen håndterer det
 * ved å FLISLEGGE radene - beregnSegmenter, samme funksjon båndet og
 * øktbyggeren bruker.
 *
 * Denne fila regnet plasseringen selv, to steder, og begge leste window_*
 * rått. På en importert økt ga det:
 *   · splitten fant ingen rad å dele - knappen gjorde ingenting, stille
 *   · skytevinduer ga TOM LISTE, så standplass-vakta beskyttet ingenting
 * Det siste var ufarlig så lenge splitten ikke skrev noe. I det
 * plasseringen rettes, ville pausene blitt lagt oppå standplass og tida
 * trukket fra to ganger.
 *
 * Derfor: ingen egen utregning her. Plasseringen kommer fra biblioteket.
 */
function plasseringer(rader: Rad[], totalSek: number): Map<string, { fra: number; til: number }> {
  const segRader: SegmentRad[] = rader.map(r => ({
    id: r.id,
    activity_type: r.activity_type,
    movement_name: r.movement_name,
    duration_seconds: r.duration_seconds,
    window_start_seconds: r.window_start_seconds,
    window_duration_seconds: r.window_duration_seconds,
    prone_shots: null, prone_hits: null, standing_shots: null, standing_hits: null,
    harKlokkeProveniens: true,
    gruppeId: null,
  }))
  const ut = new Map<string, { fra: number; til: number }>()
  for (const sg of beregnSegmenter(segRader, totalSek)) {
    ut.set(sg.aktivitetId, { fra: sg.startSek, til: sg.sluttSek })
  }
  // Rader segmenteringen ikke plasserte (ingen kurve, ingen varighet):
  // fall tilbake på vinduet når det finnes, ellers står de utenfor.
  for (const r of rader) {
    if (ut.has(r.id)) continue
    const fra = r.window_start_seconds
    const lengde = r.window_duration_seconds ?? r.duration_seconds ?? 0
    if (fra != null && lengde > 0) ut.set(r.id, { fra, til: fra + lengde })
  }
  return ut
}

/** Skytevinduene på økta - fra SAMME plassering som alt annet. */
function skytevinduer(rader: Rad[], plass: Map<string, { fra: number; til: number }>) {
  return rader.filter(r => ER_SKYTING(r.activity_type))
    .map(r => plass.get(r.id))
    .filter((x): x is { fra: number; til: number } => !!x)
}

/**
 * Periodene som FAKTISK blir pauser - én funksjon for både forhåndsvisning
 * og kjøring.
 *
 * Forhåndsvisningen telte tidligere rå perioder fra samples, mens kjøringen
 * gjorde det den klarte. Da kunne dialogen si «fant 2 perioder» og
 * ingenting skje. Nå er det ett tall fra ett sted.
 *
 * Et stillestand som faller UTENFOR alle rader telles ikke: den tida er
 * allerede utenfor treningstida, og en nedgang kommer aldri.
 */
function periodeneSomBlirPauser(
  prover: Fartprove[],
  rader: Rad[],
): { beholdt: Stillestand[]; hoppetOverSkyting: number; utenforRader: number;
     plass: Map<string, { fra: number; til: number }>; totalSek: number } {
  const tider = prover.map(p => p.t)
  const totalSek = tider.length > 0 ? Math.max(...tider) - Math.min(...tider) : 0
  const plass = plasseringer(rader, totalSek)
  const alle = finnStillestand(prover)
  const etterSkyting = utenSkytingOverlapp(alle, skytevinduer(rader, plass))
  const inniEnRad = etterSkyting.beholdt.filter(pp =>
    [...plass.values()].some(v => pp.fraSek < v.til && v.fra < pp.tilSek))
  return {
    beholdt: inniEnRad,
    hoppetOverSkyting: etterSkyting.hoppetOver,
    utenforRader: etterSkyting.beholdt.length - inniEnRad.length,
    plass,
    totalSek,
  }
}

/**
 * Lager pause-radene. Idempotent: eksisterende stillestand-rader fjernes
 * først, så en ny kjøring gir samme resultat som den første.
 */
export async function gjorStillestandTilPause(
  workoutId: string,
): Promise<StillestandResultat | { error: string }> {
  const g = await hentGrunnlag(workoutId)
  if (g.feil) return { error: g.feil }
  const { supabase, brukerId } = g

  // Puls og distanse hentes i SAMME rundtur: delene skal ha MÅLTE verdier,
  // ikke arvede. Et arvet snitt ville påstått at pulsen var den samme
  // gjennom et stopp der den falt.
  const { data: samples } = await supabase.from('workout_samples')
    .select('speed_samples, pace_samples, hr_samples, distance_samples')
    .eq('workout_id', workoutId).maybeSingle()
  const prover = fartProver(samples ?? null)
  if (!prover) return { error: 'Økta har ingen fartsdata' }

  const { data: raderRaa, error: lesFeil } = await supabase.from('workout_activities')
    .select(RAD_FELTER)
    .eq('workout_id', workoutId).order('sort_order', { ascending: true })
  if (lesFeil) return { error: lesFeil.message }
  const rader = (raderRaa ?? []) as unknown as Rad[]

  // IDEMPOTENS: ANGRE FØRST, SÅ SPLITT FRA HEL RAD.
  //
  // Den gamle veien slettet bare pause-radene og laget dem på nytt. Med
  // splitten holder ikke det: sletter vi pausen, blir halvdelene stående
  // som halvdeler og originalen kommer aldri tilbake. Andre kjøring ville
  // gitt et annet tall enn den første - nøyaktig feilen ingen ser før en
  // utøver melder den.
  const syttSammen = await syttSammenIgjen(supabase, rader)
  if ('error' in syttSammen) return { error: syttSammen.error }
  const beholdteRader = syttSammen.rader

  // TREDJE VAKT, server-side: aldri pauser på en økt UTEN aktivitetsrader.
  // Uke- og månedstallene leser radene når økta HAR rader, og faller
  // tilbake til duration_minutes bare når den ikke har noen. Pauser på en
  // tom økt ville flyttet den fra «hele varigheten teller» til «bare
  // pausene finnes». Knappen gater på det samme (StillestandKnapp), men
  // auto-steget i fase E kaller hit uten å gå via knappen - regelen må bo
  // ett sted, og det er her.
  if (beholdteRader.length === 0) {
    return { antall: 0, sumSek: 0, timerTimeSek: null, elapsedSek: 0,
      hoppetOverSkyting: 0, utenforRader: 0 }
  }

  const f = periodeneSomBlirPauser(prover, beholdteRader)
  const beholdt = f.beholdt
  const hoppetOver = f.hoppetOverSkyting
  const elapsedSek = f.totalSek

  if (beholdt.length === 0) {
    return { antall: 0, sumSek: 0, timerTimeSek: null, elapsedSek,
      hoppetOverSkyting: hoppetOver, utenforRader: f.utenforRader }
  }

  // SPLITTEN: raden stoppet ligger i deles, den får ikke pausen oppå seg.
  // Uten dette summerer radene mer enn økta varte, og ren treningstid står
  // stille - se lib/stillestand-splitt.
  // Sonene trenger utøverens egne pulssoner. Finnes de ikke, fordeles
  // originalens soner etter tid i stedet - se lib/stillestand-splitt.
  const soner = await hentPulssoner(supabase, brukerId)
  // Plasseringen sendes MED - splitten skal ikke lese window_* selv.
  const splitt = splittForStillestand(beholdteRader as unknown as SplittRad[], beholdt, {
    plass: f.plass,
    hr: (samples as { hr_samples?: Array<{ t: number; hr: number }> } | null)?.hr_samples ?? null,
    distanse: (samples as { distance_samples?: Array<{ t: number; d: number }> } | null)?.distance_samples ?? null,
    soner,
  })

  // Originalene er kortet og har fått backup: oppdater dem der de står.
  for (const r of splitt.rader) {
    if (!r.split_backup) continue
    const { error } = await supabase.from('workout_activities').update({
      activity_type: r.activity_type,
      window_start_seconds: r.window_start_seconds,
      window_duration_seconds: r.window_duration_seconds,
      duration_seconds: r.duration_seconds,
      distance_meters: r.distance_meters,
      avg_heart_rate: r.avg_heart_rate,
      max_heart_rate: r.max_heart_rate,
      zones: r.zones,
      split_backup: r.split_backup,
      auto_pause: r.activity_type === 'pause',
      ...(r.activity_type === 'pause' ? { lap_notes: STILLESTAND_MERKE } : {}),
    }).eq('id', r.id)
    if (error) return { error: error.message }
  }

  // Barna er nye rader. Pausene merkes auto_pause; aktivitetsdelene er
  // utøverens egen tid og skal ALDRI merkes som maskinskapte.
  const nye = splitt.rader.filter(r => r.split_parent_id).map(r => ({
    workout_id: workoutId,
    activity_type: r.activity_type,
    movement_name: r.activity_type === 'pause' ? null : (r as unknown as Rad).movement_name,
    movement_subcategory: r.activity_type === 'pause' ? null : (r as unknown as Rad).movement_subcategory,
    lap_notes: r.activity_type === 'pause' ? STILLESTAND_MERKE : null,
    auto_pause: r.activity_type === 'pause',
    split_parent_id: r.split_parent_id,
    duration_seconds: r.duration_seconds,
    window_start_seconds: r.window_start_seconds,
    window_duration_seconds: r.window_duration_seconds,
    distance_meters: r.distance_meters,
    avg_heart_rate: r.avg_heart_rate,
    max_heart_rate: r.max_heart_rate,
    zones: r.zones,
    sort_order: 0,
  }))
  const { data: innsatte, error: skriveFeil } = nye.length > 0
    ? await supabase.from('workout_activities').insert(nye).select('id, window_start_seconds')
    : { data: [], error: null }
  if (skriveFeil) return { error: skriveFeil.message }

  // sort_order er ren visning: sorter ALLE radene etter tid så pausene havner
  // mellom radene og ikke sist. Ingen annen kolonne på de gamle radene røres.
  const iRekkefolge = [
    ...splitt.rader.filter(r => !r.split_parent_id)
      .map(r => ({ id: r.id, t: r.window_start_seconds, s: 0 })),
    ...((innsatte ?? []) as { id: string; window_start_seconds: number | null }[])
      .map(r => ({ id: r.id, t: r.window_start_seconds, s: Number.MAX_SAFE_INTEGER })),
  ].sort((a, b) => (a.t ?? Number.MAX_SAFE_INTEGER) - (b.t ?? Number.MAX_SAFE_INTEGER) || a.s - b.s)
  for (const [i, r] of iRekkefolge.entries()) {
    await supabase.from('workout_activities').update({ sort_order: i }).eq('id', r.id)
  }

  updateTag(`user-workouts-${brukerId}`)
  revalidatePath('/app/dagbok')
  revalidatePath('/app/oversikt')
  return {
    antall: beholdt.length,
    sumSek: stillestandSum(beholdt),
    timerTimeSek: null,
    elapsedSek,
    hoppetOverSkyting: hoppetOver,
    utenforRader: f.utenforRader,
  }
}

/**
 * Angre: syr økta sammen igjen.
 *
 * IKKE «slett pause-radene». Med splitten ville det etterlatt halvdelene
 * som halvdeler og originalen aldri kommet tilbake. Her gjenopprettes hver
 * splittet original FULLT fra split_backup - alle felter, også de splitten
 * aldri rørte - og barna slettes.
 *
 * REGEL 40 PÅ ANGRE-SIDEN: «radene er borte» er ikke «tallet er tilbake».
 * Kontrakten er at ren treningstid etter angre er lik den før splitten,
 * og den er testet i scripts/stillestand-utfall-selftest.
 *
 * Har utøveren ENDRET TYPEN på en av delene - gjort pausen om til aktiv
 * pause, veksling eller skyting - blir den endringen borte. Det er riktig
 * for en handling som heter «angre», men han skal få vite det FØR han
 * trykker: knappen spør når en del er rørt (StillestandKnapp), og denne
 * funksjonen rapporterer hvor mange deler som var endret, så dialogen kan
 * si det konkret.
 */
export async function angreStillestandPauser(
  workoutId: string,
): Promise<{ slettet: number; endredeDeler: number } | { error: string }> {
  const g = await hentGrunnlag(workoutId)
  if (g.feil) return { error: g.feil }
  const { supabase, brukerId } = g

  const { data: raderRaa, error: lesFeil } = await supabase.from('workout_activities')
    .select(RAD_FELTER).eq('workout_id', workoutId).order('sort_order', { ascending: true })
  if (lesFeil) return { error: lesFeil.message }
  const rader = (raderRaa ?? []) as unknown as Rad[]

  // En del utøveren har gjort om til noe annet enn pause er ikke lenger
  // maskinens rad. Vi teller dem, så dialogen kan si hva som forsvinner.
  const endredeDeler = rader.filter(r =>
    (r.split_parent_id || r.split_backup) && r.auto_pause !== true && r.activity_type === 'pause'
      ? false
      : !!r.split_parent_id && r.activity_type !== 'pause' && r.auto_pause !== true).length

  const syttSammen = await syttSammenIgjen(supabase, rader)
  if ('error' in syttSammen) return { error: syttSammen.error }
  const slettet = rader.length - syttSammen.rader.length

  updateTag(`user-workouts-${brukerId}`)
  revalidatePath('/app/dagbok')
  revalidatePath('/app/oversikt')
  return { slettet, endredeDeler }
}

