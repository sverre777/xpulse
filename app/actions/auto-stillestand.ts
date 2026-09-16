'use server'

// STILLESTAND TIL PAUSE - fase E: auto-steget (Sverre 15.-16. sep 2026).
//
// Innstillingen «Gjør stillestand til pause automatisk» (profiles.
// auto_pause_from_speed, fase 126) er AV som standard. Er den PÅ, får hver
// NY klokkesynket økt med fartsdata pause-radene sine - og en synlig
// angre-rad på økta. Aldri stille.
//
// ────────────────────────────────────────────────────────────────────────
// HVA SOM UTLØSER DET, OG HVORFOR
//
// Ikke synk-ruta: den skal ikke røres (regel 1), og den finnes i fire
// uavhengige utgaver (Strava-action, Strava-cron, .fit/Stridee, Polar).
// Ikke en tilstandssjekk «finnes det stillestand her?» heller - da ville
// «angre» vært en knapp som ikke virker: radene ville kommet rett tilbake.
//
// Utløseren er SIDELASTING (Sverres valg A, 16. sep): steget kalles én
// gang etter at appen er tegnet. Da er radene og angre-raden den SAMME
// hendelsen - utøveren åpner økta og ser både pausene og veien ut av dem.
// Prisen er at en økt som synkes kl. 06 står uten pauser til han åpner
// appen. Det er en økt ingen har sett på ennå.
//
// HOVEDBOKA imported_activities er «her er økta ferdig importert»: den
// skrives sist i alle fire veiene, og har unique (user_id, source,
// external_id) så en re-synk aldri gjentar seg.
// ────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { gjorStillestandTilPause } from '@/app/actions/stillestand'

/**
 * Tak per kall (Sverre, krav 2).
 *
 * En utøver som kommer hjem fra to ukers samling åpner appen med tretti
 * ubehandlede importer. Ti om gangen, resten ved neste åpning - steget
 * skal aldri gjøre en sidelasting tung.
 */
const AUTO_TAK = 10

// Ikke eksportert: en «use server»-fil kan BARE eksportere async
// funksjoner - en type eller en konstant herfra velter hele action-chunken
// i det en klientkomponent importerer fra fila (målt i fase D).
interface AutoResultat {
  /** Økter steget faktisk behandlet denne gangen. */
  behandlet: number
  /** Økter der det ble laget pause-rader. */
  medPauser: number
  /** Flere står i kø - neste sidelasting tar dem. */
  flereIgjen: boolean
}

export async function kjorAutoStillestand(): Promise<AutoResultat> {
  const tomt: AutoResultat = { behandlet: 0, medPauser: 0, flereIgjen: false }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return tomt

  const { data: profil } = await supabase.from('profiles')
    .select('auto_pause_from_speed, auto_pause_fra_dato')
    .eq('id', user.id).maybeSingle()
  // AV, eller aldri slått på: ingenting skjer av seg selv.
  if (!profil?.auto_pause_from_speed || !profil.auto_pause_fra_dato) return tomt

  // GJELDER FRAMOVER: bare importer som kom ETTER at bryteren ble slått på.
  // Uten datoen ville steget tatt hele historikken med tilbakevirkende
  // kraft første gang noen huket av.
  const { data: kandidater } = await supabase.from('imported_activities')
    .select('id, workout_id')
    .eq('user_id', user.id)
    .eq('auto_pause_behandlet', false)
    .gte('imported_at', profil.auto_pause_fra_dato)
    .not('workout_id', 'is', null)
    .order('imported_at', { ascending: true })
    .limit(AUTO_TAK + 1)
  const funnet = kandidater ?? []
  if (funnet.length === 0) return tomt
  const flereIgjen = funnet.length > AUTO_TAK
  const bolk = funnet.slice(0, AUTO_TAK)

  // KRAV 1 (Sverre): MERK FØR DU BEHANDLER.
  //
  // To faner, eller en rask omlasting, og begge leser «ubehandlet» før noen
  // har merket - da ville begge laget pauser på de samme øktene. Derfor er
  // denne oppdateringen kravet: `eq('auto_pause_behandlet', false)` står i
  // filteret, så Postgres låser raden og bare ETT kall får den. RETURNING
  // (via .select()) gir nøyaktig de radene DETTE kallet vant.
  //
  // Feiler behandlingen etterpå, står raden merket og pausene uteblir. Det
  // er riktig vei å feile: knappen på økta finnes fortsatt, og utøveren
  // velger selv. Motsatt vei - å merke etterpå - ville gitt doble pauser
  // ved hver krasj.
  const { data: vunnet, error: merkeFeil } = await supabase
    .from('imported_activities')
    .update({ auto_pause_behandlet: true })
    .in('id', bolk.map(k => k.id))
    .eq('auto_pause_behandlet', false)
    .select('workout_id')
  if (merkeFeil) return tomt

  let medPauser = 0
  for (const rad of (vunnet ?? [])) {
    const id = rad.workout_id as string | null
    if (!id) continue
    // Samme handling som knappen bruker - én implementasjon. Den gater selv
    // på fartsdata, hopper over standplass og nekter på økter uten
    // aktivitetsrader. Feiler én økt, skal de andre likevel behandles.
    const r = await gjorStillestandTilPause(id)
    if (!('error' in r) && r.antall > 0) medPauser++
  }
  return { behandlet: (vunnet ?? []).length, medPauser, flereIgjen }
}
