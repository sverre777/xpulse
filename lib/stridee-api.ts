/**
 * Stridee bolk 3/4 — de signerte API-kallene våre.
 *
 * Alt går gjennom signerStrideeKall (RFC 9421). Basen er api.stridee.fit —
 * samme vert som JWKS-en, verifisert i /docs/connections-eksemplene.
 *
 * ABSTRAKSJONEN: ingenting utenfor Stridee-modulen importerer denne fila.
 * Connect-ruta og klokkesync-sidas synk er de eneste kallerne, og begge bor
 * i modulen. Resten av appen ser «klokkesynk-leverandør».
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { signerStrideeKall, lesSigneringsnokkel } from './stridee-signering'
import { erStrideeProvider, type StrideeProvider } from './stridee-prosessering'

const STRIDEE_API_BASE = 'https://api.stridee.fit'

interface KallInput {
  metode: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  sti: string
  body?: unknown
}

/**
 * Ett signert kall. Feil er verdier, ikke unntak — kallerne er redirects og
 * sider som skal vise en lesbar melding, aldri en 500.
 */
async function strideeKall<T>(input: KallInput): Promise<{ data?: T; feil?: string; status?: number }> {
  const nokkel = lesSigneringsnokkel()
  if ('feil' in nokkel) return { feil: nokkel.feil }

  const url = `${STRIDEE_API_BASE}${input.sti}`
  const body = input.body === undefined ? undefined : JSON.stringify(input.body)
  const signatur = await signerStrideeKall({
    metode: input.metode, url, body,
    nokkel: nokkel.nokkel, keyid: nokkel.keyid,
  })

  const headere: Record<string, string> = {
    'Signature-Input': signatur['Signature-Input'],
    'Signature': signatur['Signature'],
  }
  if (signatur['Content-Digest']) headere['Content-Digest'] = signatur['Content-Digest']
  if (body !== undefined) headere['Content-Type'] = 'application/json'

  let svar: Response
  try {
    svar = await fetch(url, { method: input.metode, headers: headere, body })
  } catch (e) {
    return { feil: `nettverksfeil mot leverandøren: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!svar.ok) {
    // Statuskoden er diagnosen; kroppen deres logges ikke (kan inneholde
    // detaljer vi ikke eier). 401/403 her betyr signatur/keyid-trøbbel.
    return { feil: `leverandøren svarte ${svar.status} på ${input.metode} ${input.sti}`, status: svar.status }
  }
  if (svar.status === 204) return { data: undefined as T }
  try {
    return { data: (await svar.json()) as T }
  } catch {
    return { feil: 'leverandøren svarte uten gyldig JSON' }
  }
}

/**
 * Kobler fra ÉN klokke hos leverandøren. 204 = frakoblet; 404 = «isn't
 * yours or is already disconnected» — regnes som allerede borte (målet er
 * nådd). account.disconnected-hendelsen kommer i tillegg via webhooken og
 * er idempotent mot vår lokale oppdatering.
 */
export async function slettStrideeConnection(
  connectionId: string,
): Promise<{ ok: boolean; alleredeBorte: boolean; feil?: string }> {
  const res = await strideeKall<void>({ metode: 'DELETE', sti: `/v1/connections/${connectionId}` })
  if (!res.feil) return { ok: true, alleredeBorte: false }
  if (res.status === 404) return { ok: true, alleredeBorte: true }
  return { ok: false, alleredeBorte: false, feil: res.feil }
}

/**
 * Sletter hele kontoen hos leverandøren (deres user_id): vår referanse,
 * alle connections og nedlastingstilgangen. Utløser ÉN account.deleted-
 * hendelse. Brukes ved siste frakobling og ved kontosletting hos oss.
 */
export async function slettStrideeKonto(
  strideeUserId: string,
): Promise<{ ok: boolean; alleredeBorte: boolean; feil?: string }> {
  const res = await strideeKall<void>({ metode: 'DELETE', sti: `/v1/accounts/${strideeUserId}` })
  if (!res.feil) return { ok: true, alleredeBorte: false }
  if (res.status === 404) return { ok: true, alleredeBorte: true }
  return { ok: false, alleredeBorte: false, feil: res.feil }
}

/**
 * Leverandørens egen administrasjonsside for personens tilkoblinger hos
 * OSS (med frakoblingsknapper). Lenka varer 30 dager, men skal mintes
 * fersk per besøk — aldri lagres.
 */
export async function hentManageLink(
  externalUserId: string,
): Promise<{ url?: string; feil?: string }> {
  const res = await strideeKall<{ manage_url: string }>({
    metode: 'POST',
    sti: '/v1/connections/manage-link',
    body: { external_user_id: externalUserId },
  })
  if (res.feil || !res.data?.manage_url) return { feil: res.feil ?? 'svar uten manage_url' }
  return { url: res.data.manage_url }
}

/** Største fil vi laster ned. En times økt med 1s-opptak er ~0,5 MB —
 * 20 MB rommer selv fjelløkter på mange timer, og stopper det som ikke
 * er en aktivitetsfil. */
const STRIDEE_FIL_MAKS_BYTE = 20 * 1024 * 1024

/**
 * Laster ned en originalfil (FIT) fra hendelsens data.file.url.
 *
 * Dokumentert flyt (/docs/events): URL-en i hendelsen utløper ALDRI og er
 * et vanlig signert kall; svaret er 302 til en kortlevd URL som bærer sin
 * egen autorisasjon. Vi følger redirecten MANUELT: signaturen vår er bundet
 * til @target-uri og ville uansett vært ugyldig for redirect-målet, og
 * målet trenger den ikke.
 *
 * URL-en må ligge under vårt API-base. Den kommer riktignok fra en
 * verifisert og dekryptert levering, men vi signerer aldri kall mot en
 * adresse payloaden selv har valgt utenfor leverandørens vert.
 */
export async function lastNedStrideeFil(
  filUrl: string,
): Promise<{ data?: Buffer; feil?: string }> {
  if (!filUrl.startsWith(`${STRIDEE_API_BASE}/`)) {
    return { feil: `fil-URL utenfor leverandørens API avvist (${filUrl.slice(0, 40)}…)` }
  }
  const nokkel = lesSigneringsnokkel()
  if ('feil' in nokkel) return { feil: nokkel.feil }

  const signatur = await signerStrideeKall({
    metode: 'GET', url: filUrl,
    nokkel: nokkel.nokkel, keyid: nokkel.keyid,
  })
  let hopp: Response
  try {
    hopp = await fetch(filUrl, {
      method: 'GET',
      headers: {
        'Signature-Input': signatur['Signature-Input'],
        'Signature': signatur['Signature'],
      },
      redirect: 'manual',
    })
  } catch (e) {
    return { feil: `nettverksfeil mot leverandøren: ${e instanceof Error ? e.message : String(e)}` }
  }

  let filSvar: Response
  if (hopp.status >= 300 && hopp.status < 400) {
    const mål = hopp.headers.get('location')
    if (!mål) return { feil: `302 uten Location fra ${filUrl.slice(0, 60)}` }
    try {
      filSvar = await fetch(mål)
    } catch (e) {
      return { feil: `nedlasting fra kortlevd URL feilet: ${e instanceof Error ? e.message : String(e)}` }
    }
  } else if (hopp.ok) {
    // Skulle de begynne å svare 200 med bytes direkte, tar vi det også.
    filSvar = hopp
  } else {
    return { feil: `leverandøren svarte ${hopp.status} på fil-kallet` }
  }

  if (!filSvar.ok) return { feil: `fil-nedlastingen svarte ${filSvar.status}` }
  const bytes = Buffer.from(await filSvar.arrayBuffer())
  if (bytes.length === 0) return { feil: 'fila var tom' }
  if (bytes.length > STRIDEE_FIL_MAKS_BYTE) {
    return { feil: `fila er ${(bytes.length / 1048576).toFixed(1)} MB — grensen er 20 MB` }
  }
  return { data: bytes }
}

export interface ConnectSvar {
  connect_url: string
  user_id: string
  expires_at: string
}

/** POST /v1/connect — starter tilkoblingen og gir redirect-URL-en. */
export async function startStrideeConnect(
  provider: StrideeProvider,
  externalUserId: string,
  returnUri: string,
): Promise<{ data?: ConnectSvar; feil?: string }> {
  return strideeKall<ConnectSvar>({
    metode: 'POST',
    sti: '/v1/connect',
    body: { provider, external_user_id: externalUserId, return_uri: returnUri },
  })
}

export interface ApiConnection {
  id: string
  user_id: string
  external_user_id: string
  provider: string
  status: string
}

/** GET /v1/connections — kun LEVENDE tilkoblinger (frakoblede utelates). */
export async function hentStrideeConnections(
  externalUserId: string,
): Promise<{ data?: ApiConnection[]; feil?: string }> {
  const res = await strideeKall<{ connections: ApiConnection[] }>({
    metode: 'GET',
    sti: `/v1/connections?external_user_id=${encodeURIComponent(externalUserId)}`,
  })
  if (res.feil) return { feil: res.feil }
  return { data: res.data?.connections ?? [] }
}

/**
 * Synker stridee_connections fra DERES API — den autoritative kilden.
 *
 * Brukes av callbacken: query-parametrene i return_uri (?status=&user_id=)
 * er USIGNERTE og kan settes av hvem som helst i adressefeltet. Vi kobler
 * derfor ALDRI på dem — ved retur spør vi API-et med vår egen signatur og
 * skriver det DET svarer. Webhook-prosesseringen skriver det samme senere;
 * upsert på connection_id gjør dobbeltskrivingen ufarlig.
 *
 * API-et returnerer kun levende tilkoblinger, så rader som har forsvunnet
 * markeres frakoblet — men bare når kallet LYKTES: en nettverksfeil skal
 * aldri frakoble noen.
 */
export async function synkConnectionsFraApi(
  db: SupabaseClient,
  vaarUserId: string,
): Promise<{ ok: boolean; feil?: string }> {
  const { data: link } = await db
    .from('stridee_link')
    .select('id, external_user_id, stridee_user_id')
    .eq('user_id', vaarUserId)
    .maybeSingle()
  if (!link) return { ok: true }   // ingen lenke = ingenting å synke

  const res = await hentStrideeConnections(link.external_user_id as string)
  if (res.feil || !res.data) return { ok: false, feil: res.feil }

  const naa = new Date().toISOString()
  const levende = new Set<string>()
  for (const c of res.data) {
    if (!erStrideeProvider(c.provider)) continue   // polar m.fl. hører ikke hjemme her
    levende.add(c.id)
    const { error } = await db.from('stridee_connections').upsert({
      link_id: link.id,
      connection_id: c.id,
      provider: c.provider,
      status: c.status === 'reauth_required' ? 'reauth_required' : 'aktiv',
      oppdatert_at: naa,
    }, { onConflict: 'connection_id' })
    if (error) return { ok: false, feil: `connection-upsert: ${error.message}` }
    // stridee_user_id settes ved connect-start; API-svaret bekrefter den.
    if (!link.stridee_user_id && c.user_id) {
      await db.from('stridee_link')
        .update({ stridee_user_id: c.user_id, oppdatert_at: naa })
        .eq('id', link.id)
    }
  }

  // Rader API-et ikke lenger kjenner = frakoblet på deres side.
  const { data: vaare } = await db
    .from('stridee_connections')
    .select('connection_id')
    .eq('link_id', link.id)
    .neq('status', 'frakoblet')
  for (const rad of vaare ?? []) {
    if (!levende.has(rad.connection_id as string)) {
      await db.from('stridee_connections')
        .update({ status: 'frakoblet', oppdatert_at: naa })
        .eq('connection_id', rad.connection_id)
    }
  }

  // Lenkens rollup — samme regel som prosesseringen.
  const { data: alle } = await db
    .from('stridee_connections').select('status').eq('link_id', link.id)
  const statuser = (alle ?? []).map(r => r.status as string)
  const linkStatus = statuser.includes('reauth_required') ? 'reauth_required'
    : statuser.includes('aktiv') ? 'aktiv'
    : statuser.length > 0 ? 'frakoblet' : 'pending'
  await db.from('stridee_link')
    .update({
      status: linkStatus,
      ...(linkStatus === 'aktiv' ? { koblet_at: naa } : {}),
      oppdatert_at: naa,
    })
    .eq('id', link.id)

  return { ok: true }
}
