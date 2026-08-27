/**
 * Stridee bolk 2 — prosesseringen av konto-hendelser.
 *
 * LESER FRA stridee_events, ALDRI fra webhook-handleren. Handleren har ti
 * sekunders frist på hele responsen og skal gjøre nøyaktig fire ting:
 * verifisere, dekryptere, lagre, ekko. Alt annet skjer her, etterpå, og kan
 * ta den tiden det tar — feiler det, ligger hendelsen fortsatt lagret og vi
 * prøver igjen uten å be Stridee sende på nytt.
 *
 * NAVNGIVING: stridee_user_id er DERES id for personen, user_id er VÅR.
 * De står side om side i hele denne fila, og en forveksling ville betydd at
 * én utøver fikk en annens treningsdata. Derfor er det aldri bare «user_id»
 * når det er deres.
 *
 * Ligger i Stridee-modulen fordi resten av appen ikke skal vite at
 * leverandøren heter Stridee — den ser «klokkesynk-leverandør».
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { subjektFraHendelse, type DekryptertHendelse } from './stridee'

/** Providerne vi kobler GJENNOM Stridee. Polar går direkte via AccessLink. */
export const STRIDEE_PROVIDERE = ['garmin', 'coros', 'wahoo', 'zepp'] as const
export type StrideeProvider = typeof STRIDEE_PROVIDERE[number]

export function erStrideeProvider(v: unknown): v is StrideeProvider {
  return typeof v === 'string' && (STRIDEE_PROVIDERE as readonly string[]).includes(v)
}

/** Hendelsestypene denne prosesseringen bryr seg om. Resten lagres og ligger. */
const KONTO_HENDELSER = new Set([
  'account.connected', 'account.disconnected', 'account.reauth_required', 'account.deleted',
])

export interface ProsesseringsResultat {
  behandlet: number
  hoppet_over: number
  feilet: number
  detaljer: string[]
}

interface EventRad {
  id: string
  event_type: string | null
  stridee_user_id: string | null
  payload: DekryptertHendelse
}

/**
 * Connection-id-en hendelsen gjelder. Ligger i data-blokka; account-hendelser
 * bærer den (dokumentert for reauth_required: «carrying the same
 * connection_id»). Null når hendelsen gjelder hele kontoen.
 */
function connectionIdFra(p: DekryptertHendelse): string | null {
  const data = p.data as Record<string, unknown> | undefined
  const kandidater = [data?.connection_id, data?.id, p.connection_id]
  for (const k of kandidater) if (typeof k === 'string' && k) return k
  return null
}

function providerFra(p: DekryptertHendelse): string | null {
  const data = p.data as Record<string, unknown> | undefined
  const v = p.provider ?? data?.provider
  return typeof v === 'string' && v ? v : null
}

/**
 * Behandler ubehandlede konto-hendelser.
 *
 * Idempotent: hver hendelse markeres processed_at når den er ferdig, og alle
 * skrivinger er upsert/oppdateringer som tåler å kjøres to ganger. Stridee
 * gjentar leveringer, og vi vil heller behandle noe to ganger enn å miste en
 * frakobling.
 */
export async function prosesserKontoHendelser(
  db: SupabaseClient,
  maks = 200,
): Promise<ProsesseringsResultat> {
  const res: ProsesseringsResultat = { behandlet: 0, hoppet_over: 0, feilet: 0, detaljer: [] }

  const { data: rader, error } = await db
    .from('stridee_events')
    .select('id, event_type, stridee_user_id, payload')
    .is('processed_at', null)
    .order('received_at', { ascending: true })
    .limit(maks)
  if (error) {
    res.feilet++
    res.detaljer.push(`oppslag feilet: ${error.message}`)
    return res
  }

  for (const rad of (rader ?? []) as EventRad[]) {
    const type = rad.event_type ?? null

    // Ikke en konto-hendelse: la den ligge ubehandlet til sin egen
    // prosessering (aktiviteter kommer i bolk 4). Vi markerer den IKKE som
    // behandlet — da ville den blitt usynlig for den som skal ha den.
    if (!type || !KONTO_HENDELSER.has(type)) {
      res.hoppet_over++
      continue
    }

    // Subjektet: fra kolonnen om den er fylt, ellers fra payloaden (rader
    // lagret før stridee_user_id-kolonnen fantes).
    const strideeUserId = rad.stridee_user_id ?? subjektFraHendelse(rad.payload ?? {})
    if (!strideeUserId) {
      res.feilet++
      res.detaljer.push(`${rad.id}: ${type} uten subjekt`)
      await merkBehandlet(db, rad.id, 'hendelsen bar ingen stridee_user_id')
      continue
    }

    try {
      const melding = await behandleEn(db, type, strideeUserId, rad.payload ?? {})
      await merkBehandlet(db, rad.id, null)
      res.behandlet++
      res.detaljer.push(`${type}: ${melding}`)
    } catch (e) {
      res.feilet++
      const grunn = e instanceof Error ? e.message : String(e)
      res.detaljer.push(`${rad.id}: ${type} feilet — ${grunn}`)
      await merkBehandlet(db, rad.id, grunn)   // attempts++ , men ikke processed
    }
  }

  return res
}

export async function merkBehandlet(db: SupabaseClient, id: string, feil: string | null) {
  if (feil) {
    // Feil: la den være ubehandlet så den prøves igjen, men noter grunnen.
    const { data } = await db.from('stridee_events').select('attempts').eq('id', id).maybeSingle()
    await db.from('stridee_events')
      .update({ process_error: feil, attempts: ((data?.attempts as number) ?? 0) + 1 })
      .eq('id', id)
    return
  }
  await db.from('stridee_events')
    .update({ processed_at: new Date().toISOString(), process_error: null })
    .eq('id', id)
}

async function behandleEn(
  db: SupabaseClient,
  type: string,
  strideeUserId: string,
  payload: DekryptertHendelse,
): Promise<string> {
  // account.deleted: HELE lenken og ALLE dens connections i ÉN operasjon.
  // Halvveis frakoblet er verre enn ikke frakoblet — da tror utøveren at
  // klokka synker mens den ikke gjør det. Funksjonen roterer også vår
  // external_user_id, fordi deres side gjør den gjenbrukbar etter sletting.
  if (type === 'account.deleted') {
    const { data, error } = await db.rpc('stridee_marker_slettet', {
      p_stridee_user_id: strideeUserId,
    })
    if (error) throw new Error(`stridee_marker_slettet: ${error.message}`)
    return data === true ? 'lenke slettet og external_user_id rotert' : 'ukjent konto, ingenting å rydde'
  }

  const { data: link, error: linkFeil } = await db
    .from('stridee_link')
    .select('id')
    .eq('stridee_user_id', strideeUserId)
    .maybeSingle()
  if (linkFeil) throw new Error(`lenke-oppslag: ${linkFeil.message}`)
  if (!link) {
    // Ingen lenke: hendelsen gjelder en konto vi ikke kjenner. Det er ikke
    // en feil — koblingen skjer først når brukeren fullfører flyten.
    return `ingen lenke for subjektet ennå (${type})`
  }
  const linkId = link.id as string

  const connectionId = connectionIdFra(payload)
  const provider = providerFra(payload)

  if (type === 'account.connected') {
    if (!connectionId) throw new Error('account.connected uten connection_id')
    if (!erStrideeProvider(provider)) {
      // Polar kommer aldri denne veien (vi har den direkte), og en ukjent
      // provider skal ikke smugles inn i en CHECK-constraint.
      return `provider «${provider ?? 'ukjent'}» ignorert`
    }
    const { error } = await db.from('stridee_connections').upsert({
      link_id: linkId,
      connection_id: connectionId,
      provider,
      status: 'aktiv',
      oppdatert_at: new Date().toISOString(),
    }, { onConflict: 'connection_id' })
    if (error) throw new Error(`connection-upsert: ${error.message}`)
    await db.from('stridee_link')
      .update({ status: 'aktiv', koblet_at: new Date().toISOString(), oppdatert_at: new Date().toISOString() })
      .eq('id', linkId)
    return `${provider} koblet`
  }

  const nyStatus = type === 'account.reauth_required' ? 'reauth_required' : 'frakoblet'

  // Uten connection_id gjelder hendelsen hele kontoen.
  const q = db.from('stridee_connections')
    .update({ status: nyStatus, oppdatert_at: new Date().toISOString() })
  const { error } = connectionId
    ? await q.eq('connection_id', connectionId)
    : await q.eq('link_id', linkId)
  if (error) throw new Error(`connection-oppdatering: ${error.message}`)

  // Lenkens rollup: reauth_required skal SES av brukeren, så den løftes hit
  // også — klokkesynk-sida leser statusen herfra.
  const { data: aktive } = await db
    .from('stridee_connections')
    .select('status')
    .eq('link_id', linkId)
  const statuser = (aktive ?? []).map(r => r.status as string)
  const linkStatus = statuser.includes('reauth_required')
    ? 'reauth_required'
    : statuser.some(s => s === 'aktiv') ? 'aktiv' : 'frakoblet'
  await db.from('stridee_link')
    .update({ status: linkStatus, oppdatert_at: new Date().toISOString() })
    .eq('id', linkId)

  return `${connectionId ? 'connection' : 'hele lenken'} → ${nyStatus} (lenke: ${linkStatus})`
}
