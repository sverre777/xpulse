'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { pulsIVindu } from '@/lib/segmenter'
import { PAUSE_TYPER, VEKSLING_TYPER } from '@/lib/types'

// ØKTBYGGEREN BOLK 4 — PLANENS RUNDER PÅ KLOKKAS KURVE.
//
// Tre tilstander, aldri en modus som må huskes:
//   FRA KLOKKA            — slik økta står i dag (klokkas runder)
//   BEHOLD PLANENS RUNDER — planens struktur legges på kurven, og
//                           snittpuls/maks/tid per runde LESES fra
//                           samples i rundens vindu
//   TILBAKESTILL TIL KLOKKA — når som helst, uten frist
//
// HVOR PLANENS RUNDER LIGGER: fletten (fase 109) sletter aldri. Ved
// «bytt ut» PARKERES målets originalrader på den konsumerte kilden med
// barna intakt, og klokkas rader flyttes inn. Planens runder ligger
// altså allerede i basen, på den skjulte tvillingen — vi LESER dem der.
// Flett-motoren røres ikke: ingen skriving mot merge_backup, ingen
// flytting av eierskap, ingen endring av kildens synlighet.
//
// runde_backup (fase 116) holder klokkerundene ORDRETT fordi de faktisk
// fjernes fra økta. Skyting-rader er skjema-data, ikke runder: de fredes
// — tas aldri med i backupen og fjernes aldri (samme regel som fletten).
//
// RE-SYNK: kolonnen ryddes aldri av synk. Ligger det en backup der
// samtidig som økta igjen HAR klokkerunder, har klokka skrevet på nytt —
// det varsles synlig (resynkVarsel) i stedet for å overskrives stille.
// Avledet ved lesing, så synk-motoren slipper å endres (regel: Strava
// refaktoreres ikke).
//
// MERK (regel 24): ingen type-re-eksport fra denne fila.

// Fase 116 er kjørt (936 økter · 0 med runde_backup, 1. sep 2026):
// klokkerundene har nå et sted å ligge, og valget kan tilbys.
const RUNDE_BACKUP_FINNES = true

const SKYTING = (t: string | null) => (t ?? '').startsWith('skyting')

// Backupen tar HELE raden ('*'), ikke en liste jeg har skrevet av: en
// glemt kolonne ville gjort «tilbakestill» til en rekonstruksjon i
// stedet for det samme. (Første utkast her gjettet feil navn —
// elevation_gain_m og avg_speed_ms, ikke ..._meters/avg_speed.)
type Rad = Record<string, unknown>
const somRader = (d: unknown): Rad[] => (d ?? []) as Rad[]

export type RundeKilde = 'klokke' | 'plan' | 'ingen'

export interface RundeValg {
  /** Hva radene i økta er nå — målt på proveniens, ikke på en lagret modus. */
  kilde: RundeKilde
  antallNa: number
  /** Planens runder finnes på den skjulte tvillingen og kan legges på kurven. */
  kanVelgePlan: boolean
  antallPlanRunder: number
  /** Det ligger en backup: klokkas runder kan komme tilbake. */
  kanTilbakestille: boolean
  antallIBackup: number
  /** Klokka har skrevet runder på nytt mens en backup lå der. */
  resynkVarsel: boolean
  /** Fase 116 mangler — valget tilbys ikke ennå, og det sies ærlig. */
  venterPaaMigrering: boolean
}

export async function hentRundeValg(workoutId: string): Promise<RundeValg | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [naaRes, tvillingRes, backupRes] = await Promise.all([
    supabase.from('workout_activities')
      .select('id, activity_type, external_id, strava_lap_index')
      .eq('workout_id', workoutId),
    supabase.from('workouts')
      .select('id, merge_mode')
      .eq('merged_into_workout_id', workoutId),
    RUNDE_BACKUP_FINNES
      ? supabase.from('workouts').select('runde_backup').eq('id', workoutId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
  ])
  if (naaRes.error) return null

  const runder = (naaRes.data ?? []).filter(r => !SKYTING(r.activity_type))
  const medKlokke = runder.filter(r => r.external_id || r.strava_lap_index != null).length
  const kilde: RundeKilde = runder.length === 0 ? 'ingen' : medKlokke > 0 ? 'klokke' : 'plan'

  // Planens runder: radene som ble parkert på den skjulte tvillingen.
  let antallPlan = 0
  const tvilling = (tvillingRes.data ?? [])[0]
  if (tvilling) {
    const { count } = await supabase.from('workout_activities')
      .select('id', { count: 'exact', head: true })
      .eq('workout_id', tvilling.id)
      .not('activity_type', 'like', 'skyting%')
    antallPlan = count ?? 0
  }

  const backup = (backupRes.data as { runde_backup?: unknown } | null)?.runde_backup as
    { rader?: unknown[] } | null | undefined
  const antallIBackup = Array.isArray(backup?.rader) ? backup!.rader!.length : 0

  return {
    kilde,
    antallNa: runder.length,
    kanVelgePlan: RUNDE_BACKUP_FINNES && antallPlan > 0 && kilde === 'klokke',
    antallPlanRunder: antallPlan,
    kanTilbakestille: RUNDE_BACKUP_FINNES && antallIBackup > 0,
    antallIBackup,
    resynkVarsel: antallIBackup > 0 && medKlokke > 0,
    venterPaaMigrering: !RUNDE_BACKUP_FINNES && antallPlan > 0,
  }
}

function revalider(userId: string) {
  updateTag(`user-workouts-${userId}`)
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
}

/** Legger planens runder på kurven. Klokkas runder tas vare på ORDRETT
    først — valget skal kunne angres når som helst. */
export async function beholdPlanensRunder(
  workoutId: string,
): Promise<{ ok: true; lagtInn: number; iBackup: number } | { ok: false; error: string }> {
  if (!RUNDE_BACKUP_FINNES) {
    return { ok: false, error: 'Fase 116 er ikke kjørt ennå — klokkas runder ville ikke hatt et sted å ligge' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: okt } = await supabase.from('workouts')
    .select('id, user_id, runde_backup').eq('id', workoutId).maybeSingle()
  if (!okt) return { ok: false, error: 'Fant ikke økta' }

  const { data: tvillinger } = await supabase.from('workouts')
    .select('id').eq('merged_into_workout_id', workoutId)
  const tvilling = (tvillinger ?? [])[0]
  if (!tvilling) return { ok: false, error: 'Denne økta har ingen planlagte runder å hente' }

  const { data: planRader, error: planFeil } = await supabase.from('workout_activities')
    .select('*').eq('workout_id', tvilling.id).order('sort_order', { ascending: true })
  if (planFeil) return { ok: false, error: planFeil.message }
  const planRunder = somRader(planRader).filter(r => !SKYTING(r.activity_type as string))
  if (planRunder.length === 0) return { ok: false, error: 'Planen har ingen runder å legge på kurven' }

  const { data: naa, error: naaFeil } = await supabase.from('workout_activities')
    .select('*').eq('workout_id', workoutId)
  if (naaFeil) return { ok: false, error: naaFeil.message }
  const klokkeRunder = somRader(naa).filter(r => !SKYTING(r.activity_type as string))

  // 1) BACKUP FØRST — aldri en sletting før det finnes en vei tilbake.
  //    En eksisterende backup beholdes: den eldste er den som faktisk
  //    kom fra klokka, og den skal ikke overskrives av et nytt bytte.
  const eksisterende = okt.runde_backup as { rader?: unknown[] } | null
  if (!eksisterende || !Array.isArray(eksisterende.rader) || eksisterende.rader.length === 0) {
    const { error } = await supabase.from('workouts')
      .update({ runde_backup: { laget_at: new Date().toISOString(), kilde: 'klokke', rader: klokkeRunder } })
      .eq('id', workoutId)
    if (error) return { ok: false, error: `Kunne ikke ta vare på klokkas runder: ${error.message}` }
  }

  // 2) Puls per runde LESES fra samples i rundens eget vindu.
  const { data: samplesRad } = await supabase.from('workout_samples')
    .select('hr_samples').eq('workout_id', workoutId)
    .order('created_at', { ascending: false }).limit(1)
  const hr = (samplesRad?.[0]?.hr_samples ?? []) as Array<{ t: number; hr: number }>
  const kurveSlutt = hr.length > 0 ? hr[hr.length - 1].t : 0

  // 3) Planens runder legges etter hverandre fra start med SINE EGNE
  //    varigheter — ingen skalering som får dem til å se ut som de traff.
  //    Grensene dras etterpå dit draget faktisk begynte.
  let t = 0
  const nye = planRunder.map((rad, i) => {
    const varighet = Math.max(1, Number(rad.window_duration_seconds ?? rad.duration_seconds) || 0)
    const start = t
    const slutt = kurveSlutt > 0 ? Math.min(kurveSlutt, start + varighet) : start + varighet
    t = slutt
    const type = String(rad.activity_type ?? 'aktivitet')
    const lesbar = hr.length > 0 && !PAUSE_TYPER.has(type) && !VEKSLING_TYPER.has(type)
      ? pulsIVindu(hr, start, slutt)
      : { snitt: null as number | null, maks: null as number | null }
    return {
      workout_id: workoutId,
      activity_type: type,
      movement_name: rad.movement_name ?? null,
      movement_subcategory: rad.movement_subcategory ?? null,
      lap_notes: rad.lap_notes ?? null,
      notes: rad.notes ?? null,
      zones: rad.zones ?? null,
      gruppe_id: rad.gruppe_id ?? null,
      sort_order: i,
      duration_seconds: Math.max(1, Math.round(slutt - start)),
      window_start_seconds: Math.round(start),
      window_duration_seconds: Math.max(1, Math.round(slutt - start)),
      distance_meters: rad.distance_meters ?? null,
      // MÅLT vinner over planlagt der klokka faktisk har tall.
      avg_heart_rate: lesbar.snitt,
      max_heart_rate: lesbar.maks,
    }
  })

  // 4) Klokkas runder ut, planens inn. Skyting-radene står urørt.
  if (klokkeRunder.length > 0) {
    const ids = klokkeRunder.map(r => r.id as string)
    const { error } = await supabase.from('workout_activities')
      .delete().in('id', ids).eq('workout_id', workoutId)
    if (error) return { ok: false, error: `Kunne ikke bytte ut rundene: ${error.message}` }
  }
  const { error: innFeil } = await supabase.from('workout_activities').insert(nye)
  if (innFeil) {
    // Kompensasjon: legg klokkas runder tilbake med én gang.
    await supabase.from('workout_activities').insert(
      klokkeRunder.map(r => ({ ...r, workout_id: workoutId })))
    return { ok: false, error: `Kunne ikke legge inn planens runder — ingenting er endret (${innFeil.message})` }
  }

  revalider(okt.user_id as string)
  return { ok: true, lagtInn: nye.length, iBackup: klokkeRunder.length }
}

/** Klokkas runder tilbake, ordrett slik de var. */
export async function tilbakestillTilKlokka(
  workoutId: string,
): Promise<{ ok: true; gjenopprettet: number } | { ok: false; error: string }> {
  if (!RUNDE_BACKUP_FINNES) return { ok: false, error: 'Fase 116 er ikke kjørt ennå' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: okt } = await supabase.from('workouts')
    .select('id, user_id, runde_backup').eq('id', workoutId).maybeSingle()
  if (!okt) return { ok: false, error: 'Fant ikke økta' }
  const backup = okt.runde_backup as { rader?: Record<string, unknown>[] } | null
  const rader = Array.isArray(backup?.rader) ? backup!.rader! : []
  if (rader.length === 0) return { ok: false, error: 'Det finnes ingen klokkerunder å gå tilbake til' }

  const { data: naa } = await supabase.from('workout_activities')
    .select('id, activity_type').eq('workout_id', workoutId)
  const ut = (naa ?? []).filter(r => !SKYTING(r.activity_type)).map(r => r.id)
  if (ut.length > 0) {
    const { error } = await supabase.from('workout_activities')
      .delete().in('id', ut).eq('workout_id', workoutId)
    if (error) return { ok: false, error: `Kunne ikke rydde plass: ${error.message}` }
  }
  const { error: innFeil } = await supabase.from('workout_activities')
    .insert(rader.map(r => ({ ...r, workout_id: workoutId })))
  if (innFeil) return { ok: false, error: `Kunne ikke gjenopprette klokkas runder: ${innFeil.message}` }

  const { error: ryddFeil } = await supabase.from('workouts')
    .update({ runde_backup: null }).eq('id', workoutId)
  if (ryddFeil) return { ok: false, error: ryddFeil.message }

  revalider(okt.user_id as string)
  return { ok: true, gjenopprettet: rader.length }
}

// ── PLANEN SOM SPØKELSE (bolk 6) ─────────────────────────────
//
// Samme kilde som rundevalget: planens struktur ligger parkert på den
// skjulte tvillingen etter en flett. Her LESES den bare — den tegnes bak
// det som faktisk skjedde, slik at man ser hvor virkeligheten forlot
// planen. Ingen skriving, ingen migrering, ingen berøring av fletten.
//
// Blokkene legges etter hverandre fra start med sine egne varigheter.
// Det er ikke en påstand om at planen traff der: et drag som ble 6 min i
// stedet for 8 SKAL se ut som at kurven faller før planens blokk slutter.

export interface PlanBlokk {
  id: string
  type: string
  navn: string | null
  startSek: number
  sluttSek: number
}

export async function hentPlanensRunder(workoutId: string): Promise<PlanBlokk[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: tvillinger } = await supabase.from('workouts')
    .select('id').eq('merged_into_workout_id', workoutId)
  const tvilling = (tvillinger ?? [])[0]
  if (!tvilling) return []

  const { data: rader } = await supabase.from('workout_activities')
    .select('id, activity_type, movement_name, lap_notes, duration_seconds, window_start_seconds, window_duration_seconds')
    .eq('workout_id', tvilling.id).order('sort_order', { ascending: true })

  let t = 0
  const ut: PlanBlokk[] = []
  for (const r of rader ?? []) {
    if (SKYTING(r.activity_type)) continue
    const varighet = Math.max(1, Number(r.window_duration_seconds ?? r.duration_seconds) || 0)
    // Har planen egne vinduer, er de sannheten; ellers legges blokkene
    // etter hverandre slik de sto i rekkefølgen.
    const start = r.window_start_seconds != null ? Number(r.window_start_seconds) : t
    ut.push({
      id: r.id,
      type: r.activity_type ?? 'aktivitet',
      navn: r.lap_notes ?? r.movement_name ?? null,
      startSek: start,
      sluttSek: start + varighet,
    })
    t = start + varighet
  }
  return ut
}

// ── ØKTBYGGER BOLK 3b — bygg og match mot kurven ─────────────
//
// Bygger man en struktur oppå en økt som HAR klokkerunder, erstatter
// strukturen rundene i skjemaet, og skjemaets lagring skriver dem ut av
// basen. Derfor tas klokkas runder vare på ORDRETT her FØR byggingen —
// samme runde_backup som rundevalget, samme «tilbakestill til klokka».

/** Sikrer at klokkas runder ligger i backupen før de erstattes. Finnes
    en backup fra før, røres den ikke (den eldste er klokkas). */
export async function sikreKlokkerundeBackup(
  workoutId: string,
): Promise<{ ok: true; iBackup: number } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }
  const { data: okt } = await supabase.from('workouts')
    .select('id, runde_backup').eq('id', workoutId).maybeSingle()
  if (!okt) return { ok: false, error: 'Fant ikke økta' }
  const eksisterende = okt.runde_backup as { rader?: unknown[] } | null
  if (eksisterende && Array.isArray(eksisterende.rader) && eksisterende.rader.length > 0) {
    return { ok: true, iBackup: eksisterende.rader.length }
  }
  const { data: naa, error } = await supabase.from('workout_activities')
    .select('*').eq('workout_id', workoutId)
  if (error) return { ok: false, error: error.message }
  const klokkeRunder = somRader(naa).filter(r =>
    !SKYTING(r.activity_type as string) && (r.external_id || r.strava_lap_index != null))
  if (klokkeRunder.length === 0) return { ok: true, iBackup: 0 }
  const { error: skriveFeil } = await supabase.from('workouts')
    .update({ runde_backup: { laget_at: new Date().toISOString(), kilde: 'klokke', rader: klokkeRunder } })
    .eq('id', workoutId)
  if (skriveFeil) return { ok: false, error: `Kunne ikke ta vare på klokkas runder: ${skriveFeil.message}` }
  return { ok: true, iBackup: klokkeRunder.length }
}

export interface Klokkerunde {
  type: string
  startSek: number
  varighetSek: number
}

/** Klokkas runder slik de lå på kurven — fra backupen når den finnes,
    ellers fra radene med klokke-proveniens. Flislagt etter rekkefølge
    og varighet, som båndet gjør. */
export async function hentKlokkerunder(workoutId: string): Promise<Klokkerunde[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: okt } = await supabase.from('workouts')
    .select('runde_backup').eq('id', workoutId).maybeSingle()
  const backup = okt?.runde_backup as { rader?: Record<string, unknown>[] } | null
  let rader: Record<string, unknown>[]
  if (backup && Array.isArray(backup.rader) && backup.rader.length > 0) {
    rader = backup.rader
  } else {
    const { data } = await supabase.from('workout_activities')
      .select('activity_type, duration_seconds, sort_order, external_id, strava_lap_index')
      .eq('workout_id', workoutId).order('sort_order', { ascending: true })
    rader = somRader(data).filter(r => !SKYTING(r.activity_type as string) && (r.external_id || r.strava_lap_index != null))
  }
  rader = [...rader].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  let t = 0
  const ut: Klokkerunde[] = []
  for (const r of rader) {
    if (SKYTING(r.activity_type as string)) continue
    const varighet = Math.max(1, Number(r.duration_seconds) || 0)
    ut.push({ type: String(r.activity_type ?? 'aktivitet'), startSek: t, varighetSek: varighet })
    t += varighet
  }
  return ut
}
