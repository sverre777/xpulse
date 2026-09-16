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
  stillestandRader, ikkeStillestandRader,
  STILLESTAND_MERKE, type StillestandResultat,
} from '@/lib/stillestand'

// MERK: denne fila kan BARE eksportere async funksjoner. STILLESTAND_MERKE
// og StillestandResultat bor derfor i lib/stillestand - en konstant eller en
// type eksportert herfra velter hele action-chunken i det en
// klientkomponent importerer fra den.

// Skyte-typene har ÉN fasit (lib/activity-summary). En egen startsWith-regel
// her ville gitt samme svar i dag og et annet den dagen lista endres.
const ER_SKYTING = (t: string | null | undefined) => isShootingActivityType(t ?? '')

interface Rad {
  id: string
  activity_type: string
  sort_order: number | null
  duration_seconds: number | null
  window_start_seconds: number | null
  window_duration_seconds: number | null
  lap_notes: string | null
  auto_pause: boolean | null
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
    .select('id, activity_type, sort_order, duration_seconds, window_start_seconds, window_duration_seconds, lap_notes, auto_pause')
    .eq('workout_id', workoutId).order('sort_order', { ascending: true })

  const alle = finnStillestand(prover)
  const { beholdt, hoppetOver } = utenSkytingOverlapp(alle, skytevinduer((rader ?? []) as Rad[]))
  const tider = prover.map(p => p.t)
  return {
    antall: beholdt.length,
    sumSek: stillestandSum(beholdt),
    timerTimeSek: null,
    elapsedSek: tider.length > 0 ? Math.max(...tider) - Math.min(...tider) : 0,
    hoppetOverSkyting: hoppetOver,
  }
}

/** Skytevinduene på økta, slik radene plasserer dem i tid. */
function skytevinduer(rader: Rad[]) {
  return rader.filter(r => ER_SKYTING(r.activity_type)).map(r => {
    const start = r.window_start_seconds
    const lengde = r.window_duration_seconds ?? r.duration_seconds ?? 0
    return start == null ? null : { fra: start, til: start + lengde }
  }).filter((x): x is { fra: number; til: number } => x != null)
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

  const { data: samples } = await supabase.from('workout_samples')
    .select('speed_samples, pace_samples').eq('workout_id', workoutId).maybeSingle()
  const prover = fartProver(samples ?? null)
  if (!prover) return { error: 'Økta har ingen fartsdata' }

  const { data: raderRaa, error: lesFeil } = await supabase.from('workout_activities')
    .select('id, activity_type, sort_order, duration_seconds, window_start_seconds, window_duration_seconds, lap_notes, auto_pause')
    .eq('workout_id', workoutId).order('sort_order', { ascending: true })
  if (lesFeil) return { error: lesFeil.message }
  const rader = (raderRaa ?? []) as Rad[]

  // Idempotens: rydd bort forrige kjørings rader før vi teller på nytt.
  // Samme nøkkel som angre - auto_pause, ikke navnet. Ellers ville en
  // omdøpt pause blitt liggende igjen og fått en ny pause oppå seg.
  const gamle = stillestandRader(rader).map(r => r.id)
  if (gamle.length > 0) {
    const { error } = await supabase.from('workout_activities').delete().in('id', gamle)
    if (error) return { error: error.message }
  }
  const beholdteRader = ikkeStillestandRader(rader)

  const { beholdt, hoppetOver } = utenSkytingOverlapp(finnStillestand(prover), skytevinduer(beholdteRader))
  const tider = prover.map(p => p.t)
  const elapsedSek = tider.length > 0 ? Math.max(...tider) - Math.min(...tider) : 0

  if (beholdt.length === 0) {
    return { antall: 0, sumSek: 0, timerTimeSek: null, elapsedSek, hoppetOverSkyting: hoppetOver }
  }

  const nye = beholdt.map(p => ({
    workout_id: workoutId,
    activity_type: 'pause',
    movement_name: null,
    movement_subcategory: null,
    lap_notes: STILLESTAND_MERKE,
    auto_pause: true,
    duration_seconds: p.tilSek - p.fraSek,
    window_start_seconds: p.fraSek,
    window_duration_seconds: p.tilSek - p.fraSek,
    zones: null,
    sort_order: 0,
  }))
  const { data: innsatte, error: skriveFeil } = await supabase
    .from('workout_activities').insert(nye).select('id, window_start_seconds')
  if (skriveFeil) return { error: skriveFeil.message }

  // sort_order er ren visning: sorter ALLE radene etter tid så pausene havner
  // mellom radene og ikke sist. Ingen annen kolonne på de gamle radene røres.
  const iRekkefolge = [
    ...beholdteRader.map(r => ({ id: r.id, t: r.window_start_seconds, s: r.sort_order ?? 0 })),
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
  }
}

/**
 * Angre: sletter nøyaktig radene denne handlingen laget.
 *
 * Kjennetegnet er auto_pause = true. Raden er borte selv om utøveren har
 * døpt den om, og en rad han SELV har kalt «Stillestand» røres aldri.
 */
export async function angreStillestandPauser(
  workoutId: string,
): Promise<{ slettet: number } | { error: string }> {
  const g = await hentGrunnlag(workoutId)
  if (g.feil) return { error: g.feil }
  const { supabase, brukerId } = g

  const { data, error } = await supabase.from('workout_activities')
    .delete().eq('workout_id', workoutId).eq('auto_pause', true).select('id')
  if (error) return { error: error.message }

  updateTag(`user-workouts-${brukerId}`)
  revalidatePath('/app/dagbok')
  revalidatePath('/app/oversikt')
  return { slettet: (data ?? []).length }
}
