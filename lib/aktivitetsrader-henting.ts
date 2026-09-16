// AKTIVITETSRADER FOR MANGE ØKTER - hentingen, med to feller stengt.
// (Sverre 16. sep 2026, som del av «radene vinner på trenerflatene».)
//
// FELLE 1 - URL-EN SPRENGES I STILLHET.
// `.in('workout_id', [600 uuid-er])` blir en URL på ~22 kB. PostgREST svarer
// ikke med en feilmelding man kan lese - fetch kaster «fetch failed», og en
// try/catch rundt ville gitt tom liste. Derfor bolkes id-ene her, ett sted,
// og funksjonen nekter å ta imot en for stor bolk.
//
// FELLE 2 - SVARET KUTTES I STILLHET.
// PostgREST returnerer maks 1000 rader. En bolk på 100 klokkeøkter à 30
// runder er 3000 rader: de 2000 siste forsvinner uten et pip, og utøveren
// ser ut til å ha trent mindre enn han har. Ingen oppdager det.
//
// Derfor teller vi eksplisitt: hver bolk hentes med count: 'exact', og vi
// henter videre med range() til vi har PRESIS så mange rader som basen sier
// finnes. Kommer vi ikke i mål, feiler vi HØYT. Vi går aldri videre med et
// tall vi ikke vet er komplett.

import type { RadForTid } from '@/lib/ren-treningstid'

/** PostgREST-grensa. Et svar på nøyaktig dette tallet er mistenkt kuttet. */
export const RAD_GRENSE = 1000

/**
 * Økter per bolk.
 *
 * Valgt etter FORVENTET radtall, ikke etter hva som ser pent ut: snittøkta
 * har ~6 rader, så 25 økter er ~150 rader - godt under grensa. En bolk med
 * bare tunge klokkeøkter kan likevel sprenge den, og da tar sidehentingen
 * under seg resten.
 */
export const OKTER_PER_BOLK = 25

/** Nok til 50 000 rader i én bolk. Passeres den, er noe galt - ikke tregt. */
const MAKS_SIDER = 50

type Klient = {
  from: (t: string) => {
    select: (s: string, o?: { count: 'exact' }) => {
      in: (k: string, v: string[]) => {
        order: (k: string, o: { ascending: boolean }) => {
          range: (a: number, b: number) => PromiseLike<{
            data: unknown[] | null; error: { message: string } | null; count: number | null
          }>
        }
      }
    }
  }
}

/**
 * Alle aktivitetsradene for øktene, komplett eller feil.
 *
 * Aldri en halv liste: enten er alle radene med, eller så får kalleren en
 * feilmelding å vise.
 */
export async function hentRaderForOkter(
  supabase: unknown,
  oktIds: string[],
): Promise<{ rader: RadForTid[] } | { error: string }> {
  if (oktIds.length === 0) return { rader: [] }
  const sb = supabase as Klient

  const bolker: string[][] = []
  for (let i = 0; i < oktIds.length; i += OKTER_PER_BOLK) {
    bolker.push(oktIds.slice(i, i + OKTER_PER_BOLK))
  }

  const svar = await Promise.all(bolker.map(async (bolk): Promise<RadForTid[] | { error: string }> => {
    const ut: RadForTid[] = []
    let forventet: number | null = null

    for (let side = 0; side < MAKS_SIDER; side++) {
      const { data, error, count } = await sb
        .from('workout_activities')
        .select('workout_id, activity_type, duration_seconds', { count: 'exact' })
        .in('workout_id', bolk)
        // Stabil sortering: uten den kan range() hoppe over eller gjenta rader.
        .order('id', { ascending: true })
        .range(side * RAD_GRENSE, side * RAD_GRENSE + RAD_GRENSE - 1)
      if (error) return { error: error.message }
      if (forventet == null) forventet = count ?? 0
      const fikk = (data ?? []) as RadForTid[]
      ut.push(...fikk)
      // Basen har sagt hvor mange som finnes. Har vi dem, er vi ferdige -
      // ikke «da lista var kortere enn en side», som kan lyve.
      if (ut.length >= forventet) return ut
      if (fikk.length === 0) break
    }
    return {
      error: `Fikk bare ${ut.length} av ${forventet} aktivitetsrader for ${bolk.length} økter.`
        + ' Svaret er kuttet - tallene ville vært for lave.',
    }
  }))

  const feilet = svar.find((s): s is { error: string } => !Array.isArray(s))
  if (feilet) return feilet
  return { rader: (svar as RadForTid[][]).flat() }
}
