/**
 * Stridee — klokkesynk for Garmin, COROS, Wahoo og Zepp.
 *
 * Stridee holder Garmin-registreringen og gir oss en signert lenke til
 * klokkeprodusentens EGEN FIT-fil. Vi parser den med lib/fit-extract.ts, som
 * allerede virker.
 *
 * DENNE FILA ER HELE STRIDEE-OVERFLATA. Alt leverandørspesifikt bor her, slik
 * at det å fjerne Stridee er én bryter og ikke en opprydding. Ingenting utenfor
 * denne fila og webhook-ruta skal vite hva Stridee er.
 *
 * TO NØKLER — bland dem aldri:
 *  · X25519  (STRIDEE_WEBHOOK_PRIVATE_KEY) — vi eier den, de FORSEGLER hver
 *    webhook-levering til den. Brukes kun til dekryptering.
 *  · Ed25519 (STRIDEE_SIGNING_PRIVATE_KEY) — vi eier den, vi SIGNERER våre
 *    API-kall med den. Brukes ikke i bolk 1.
 * Deres egen Ed25519-nøkkel signerer leveringene til oss, og hentes fra JWKS-en.
 *
 * Nøklene leses kun på serveren. Aldri NEXT_PUBLIC_, aldri i klientkode.
 */

import {
  createRemoteJWKSet,
  flattenedVerify,
  compactDecrypt,
  importJWK,
  decodeProtectedHeader,
  base64url,
  type JWK,
  type CryptoKey,
} from 'jose'

/**
 * Bryteren. Hele integrasjonen skal kunne skrus av uten at noe annet faller —
 * det å fjerne Stridee skal være ett flagg, ikke en opprydding. Alt
 * Stridee-spesifikt sjekker denne først.
 */
export const STRIDEE_AKTIV = process.env.STRIDEE_AKTIV !== 'false'

export const STRIDEE_JWKS_URL = 'https://api.stridee.fit/.well-known/jwks.json'

/** Leveringer eldre enn dette avvises. Spec: 5 minutter. */
export const STRIDEE_MAKS_ALDER_SEKUNDER = 300

/**
 * Claim-navnene i det SIGNERTE headeret.
 *
 * Vi leser id og timestamp herfra, ikke fra HTTP-headerne — HTTP-kopiene er
 * de eneste ingenting har signert, og en angriper kan sette dem fritt.
 */
export const CLAIM_ID = 'webhook-id'
export const CLAIM_TIMESTAMP = 'webhook-timestamp'

// ─────────────────────────────────────────────────────────────────────────
// Nøkler
// ─────────────────────────────────────────────────────────────────────────

/**
 * Leser våre private nøkler. Env-verdien kan være:
 *   · én JWK             {"kty":"OKP",...}
 *   · et JWKS-objekt     {"keys":[...]}
 *   · en liste med JWK-er [...]
 *
 * Flere former støttes fordi ET ENDEPUNKT KAN HOLDE TO NØKLER gjennom en
 * rotasjon. Vi slår opp på kid fra JWE-headeret i stedet for å anta at det
 * bare finnes én.
 */
export function lesPrivateNokler(raa: string | undefined): JWK[] {
  if (!raa || !raa.trim()) return []
  let parset: unknown
  try {
    parset = JSON.parse(raa)
  } catch {
    return []
  }
  if (Array.isArray(parset)) return parset as JWK[]
  if (parset && typeof parset === 'object') {
    const o = parset as { keys?: unknown }
    if (Array.isArray(o.keys)) return o.keys as JWK[]
    return [parset as JWK]
  }
  return []
}

/** Nøkkelen som matcher kid, eller den eneste hvis leveringen ikke oppgir kid. */
export function velgNokkel(nokler: JWK[], kid: string | undefined): JWK | null {
  if (nokler.length === 0) return null
  if (kid) return nokler.find(k => k.kid === kid) ?? null
  return nokler.length === 1 ? nokler[0] : null
}

// ─────────────────────────────────────────────────────────────────────────
// Steg 1 — signaturen
// ─────────────────────────────────────────────────────────────────────────

/**
 * JWKS-settet. createRemoteJWKSet og IKKE en innlimt nøkkelverdi: settet
 * caches i 10 minutter og hentes på nytt ved ukjent kid. Det er nettopp dét
 * som lar Stridee rotere nøkler uten at vi deployer.
 *
 * Modulnivå slik at cachen faktisk deles mellom kall.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
export function stirdeeJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(STRIDEE_JWKS_URL))
  return jwks
}

export interface SignaturResultat {
  ok: boolean
  grunn?: string
  /** Det signerte headeret. Fasit for id og timestamp. */
  header?: Record<string, unknown>
  id?: string
  timestamp?: string
}

/**
 * Verifiserer detached JWS over den RÅ kroppen.
 *
 * Detached vil si at signaturen ligger i headeret og kroppen er nyttelasten.
 * Vi mater derfor de rå bytene inn som payload — reserialisering ville gitt
 * andre bytes som ikke verifiserer.
 *
 * `hentNokkel` er et argument og ikke en hardkodet JWKS, slik at selvtesten
 * kan kjøre den ekte kodestien mot en ekte nøkkel uten nett.
 */
export async function verifiserLevering(
  raBody: string,
  signaturHeader: string | null,
  hentNokkel: Parameters<typeof flattenedVerify>[1],
): Promise<SignaturResultat> {
  if (!signaturHeader) return { ok: false, grunn: 'mangler webhook-signature' }

  // Compact JWS er tre deler: header.payload.signatur. Ved detached er
  // midtdelen tom, og vi setter inn kroppen selv.
  const deler = signaturHeader.trim().split('.')
  if (deler.length !== 3) return { ok: false, grunn: 'signaturen er ikke compact JWS' }
  const [beskyttet, , signatur] = deler

  // TO FORMER FOR DETACHED, og vi vet ikke hvilken Stridee bruker:
  //  · RFC 7515 (vanligst): signeringsinngangen er BASE64URL(kropp), så
  //    verifikatoren må kode kroppen selv før den mates inn.
  //  · RFC 7797 «b64»: false: signeringsinngangen er de RÅ bytene, og det
  //    står i det beskyttede headeret.
  // Vi leser headeret og velger deretter. Selvtesten dekker begge.
  let b64: unknown = true
  try {
    const h = JSON.parse(new TextDecoder().decode(base64url.decode(beskyttet))) as Record<string, unknown>
    if ('b64' in h) b64 = h.b64
  } catch {
    return { ok: false, grunn: 'det beskyttede headeret kunne ikke leses' }
  }
  const nyttelast: string | Uint8Array = b64 === false
    ? new TextEncoder().encode(raBody)
    : base64url.encode(raBody)

  try {
    const res = await flattenedVerify(
      { protected: beskyttet, payload: nyttelast, signature: signatur },
      hentNokkel,
      { algorithms: ['EdDSA'], crit: b64 === false ? { b64: true } : undefined },
    )
    const header = res.protectedHeader as unknown as Record<string, unknown>
    const id = header[CLAIM_ID]
    const timestamp = header[CLAIM_TIMESTAMP]
    if (typeof id !== 'string' || !id) {
      return { ok: false, grunn: `signert header mangler ${CLAIM_ID}`, header }
    }
    if (typeof timestamp !== 'string' && typeof timestamp !== 'number') {
      return { ok: false, grunn: `signert header mangler ${CLAIM_TIMESTAMP}`, header }
    }
    return { ok: true, header, id, timestamp: String(timestamp) }
  } catch (e) {
    return { ok: false, grunn: e instanceof Error ? e.message : 'signatur avvist' }
  }
}

/** Sekunder siden leveringen ble signert. Godtar ISO-tid og unix-sekunder. */
export function alderSekunder(timestamp: string, naa: number = Date.now()): number | null {
  const tall = Number(timestamp)
  const ms = Number.isFinite(tall) && timestamp.trim() !== ''
    ? (tall > 1e11 ? tall : tall * 1000)   // ms eller sekunder
    : Date.parse(timestamp)
  if (!Number.isFinite(ms)) return null
  return (naa - ms) / 1000
}

export function forGammel(timestamp: string, naa: number = Date.now()): boolean {
  const alder = alderSekunder(timestamp, naa)
  if (alder === null) return true          // uleselig tid = avvis
  return Math.abs(alder) > STRIDEE_MAKS_ALDER_SEKUNDER
}

// ─────────────────────────────────────────────────────────────────────────
// Steg 2 — dekrypteringen
// ─────────────────────────────────────────────────────────────────────────

export interface StrideeKropp {
  id?: string
  type?: string
  /** JWE i compact form. Alt av innhold ligger her. */
  enc?: string
}

export interface DekryptertHendelse {
  nonce?: string
  account_id?: string
  type?: string
  [k: string]: unknown
}

export interface DekrypteringsResultat {
  ok: boolean
  grunn?: string
  data?: DekryptertHendelse
  kid?: string
}

/**
 * Dekrypterer JWE-en. ECDH-ES (X25519 ephemeral-static) + A256GCM.
 * AAD er det beskyttede headeret, som compactDecrypt håndterer selv.
 *
 * kid leses UT AV JWE-headeret og brukes til å velge riktig privatnøkkel —
 * et endepunkt kan holde to gjennom en rotasjon.
 */
export async function dekrypterHendelse(
  jwe: string,
  nokler: JWK[],
): Promise<DekrypteringsResultat> {
  let kid: string | undefined
  try {
    kid = decodeProtectedHeader(jwe).kid
  } catch {
    return { ok: false, grunn: 'JWE-headeret kunne ikke leses' }
  }
  const jwk = velgNokkel(nokler, kid)
  if (!jwk) {
    return {
      ok: false,
      kid,
      grunn: kid
        ? `ingen privatnokkel med kid ${kid}`
        : 'leveringen oppgir ingen kid og vi har flere nokler',
    }
  }
  try {
    const key = (await importJWK(jwk, 'ECDH-ES')) as CryptoKey
    const { plaintext } = await compactDecrypt(jwe, key, {
      keyManagementAlgorithms: ['ECDH-ES'],
      contentEncryptionAlgorithms: ['A256GCM'],
    })
    return { ok: true, kid, data: JSON.parse(new TextDecoder().decode(plaintext)) }
  } catch (e) {
    return { ok: false, kid, grunn: e instanceof Error ? e.message : 'dekryptering feilet' }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Kvitteringen
// ─────────────────────────────────────────────────────────────────────────

/**
 * Kvitteringen Stridee forventer.
 *
 * Nonce SKAL ligge på TOPPNIVÅ. Bare noe som holder vår private nøkkel kan
 * produsere verdien, så det er ekkoet som beviser at vi faktisk dekrypterte.
 * Et bart 200, {"ok":true}, eller nonce nestet i et annet objekt teller som
 * INTET ekko. Hvert forsøk får ny nonce, så en cachet verdi virker ikke.
 */
export function kvittering(nonce: string): { nonce: string } {
  return { nonce }
}

/** Base64url-hjelper, eksportert så selvtesten bruker samme som produksjon. */
export const b64u = base64url
