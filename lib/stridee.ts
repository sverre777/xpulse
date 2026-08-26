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
 * De 32 rå private-nøkkelbytene pakket som PKCS#8 for X25519 (OID 1.3.101.110).
 * Prefikset er fast: SEQUENCE, version 0, AlgorithmIdentifier, OCTET STRING.
 * Brukes til å utlede den offentlige delen — se fullforRaaNokkel.
 */
const PKCS8_X25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
])

/**
 * Dekoder base64url ELLER vanlig base64, med eller uten padding.
 *
 * jose sin base64url.decode avviser `+` og `/` (målt), og nøkkeldashboards
 * gir ut begge former. Vi normaliserer derfor til base64url først.
 * Returnerer null når strengen ikke er gyldig base64 i det hele tatt.
 */
function dekodBase64Fritt(s: string): Uint8Array | null {
  const normalisert = s.trim().replace(/\+/g, '-').replace(/\//g, '_')
  if (!normalisert || /[^A-Za-z0-9\-_=]/.test(normalisert)) return null
  try {
    return base64url.decode(normalisert)
  } catch {
    return null
  }
}

/**
 * PKCS#8 DER (48 byte) → JWK, eller null.
 *
 * ÉN SANNHET OM KURVEN. Både PEM-grenen og den bare base64-grenen går
 * gjennom denne — to kopier av OID-sjekken ville før eller siden vært
 * uenige, og den uenigheten ville sett ut som «nøkkelen virker ikke».
 *
 * MÅLT: en X25519 PKCS#8 er 48 byte (16 OID-prefiks + 32 nøkkel), og en
 * Ed25519 er OGSÅ 48 byte — de skiller seg bare på OID-en (…2b6570 mot
 * …2b656e). Derfor sammenlignes hele prefikset, aldri bare lengden.
 */
function pkcs8DerTilJwk(der: Uint8Array | null): JWK | null {
  if (!der || der.length !== PKCS8_X25519_PREFIX.length + 32) return null
  for (let i = 0; i < PKCS8_X25519_PREFIX.length; i++) {
    if (der[i] !== PKCS8_X25519_PREFIX[i]) return null
  }
  return {
    kty: 'OKP',
    crv: 'X25519',
    d: base64url.encode(der.subarray(PKCS8_X25519_PREFIX.length)),
  }
}

/**
 * PKCS#8-PEM → JWK-er. Stridee leverer privatnøkkelen som .pem-fil.
 *
 * KUN «BEGIN PRIVATE KEY» (PKCS#8). «BEGIN EC PRIVATE KEY» (SEC1) og alt
 * annet hoppes over — vi later ikke som vi forstår et format vi ikke har
 * verifisert.
 *
 * Selve DER-en går gjennom pkcs8DerTilJwk, som eier kurvesjekken.
 */
function lesPemNokler(raa: string): JWK[] {
  const ut: JWK[] = []
  // Alt mellom BEGIN og END, uansett etikett — etiketten sjekkes etterpå, så
  // en EC-blokk blir hoppet over i stedet for å bli feiltolket.
  const blokker = raa.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g)
  for (const blokk of blokker) {
    if (blokk[1] !== 'PRIVATE KEY') continue
    // Linjeskift kan komme som ekte \n, \r\n — eller som de TO tegnene
    // backslash+n hvis env-transporten har manglet dem. Backslash finnes
    // ikke i base64-alfabetet, så begge kan fjernes uten tvetydighet.
    const kropp = blokk[2].replace(/\\[rn]/g, '').replace(/\s+/g, '')
    const jwk = pkcs8DerTilJwk(dekodBase64Fritt(kropp))
    if (jwk) ut.push(jwk)
  }
  return ut
}

/**
 * Leser våre private nøkler. Env-verdien kan være:
 *   · én JWK             {"kty":"OKP",...}
 *   · et JWKS-objekt     {"keys":[...]}
 *   · en liste med JWK-er [...]
 *   · RÅ base64(url) av de 32 private-nøkkelbytene — formatet flere
 *     nøkkeldashboards gir ut. Flere rå nøkler skilles med komma eller
 *     linjeskift, så begge Stridee-nøklene kan ligge inne samtidig.
 *   · PKCS#8-PEM        -----BEGIN PRIVATE KEY----- … — formatet Stridee
 *     leverer som fil. Flere PEM-blokker i samme verdi gir flere nøkler.
 *   · BAR PKCS#8-DER    samme nøkkel som PEM-en, bare uten armor: 48 byte,
 *     64 tegn base64. Dette er det env-verdien faktisk inneholder.
 *
 * Rekkefølgen er JSON → PEM → 48 byte (DER) → 32 byte (rå nøkkel), og hver
 * form kjennes igjen på struktur, aldri gjettes på.
 *
 * Flere former støttes fordi ET ENDEPUNKT KAN HOLDE TO NØKLER gjennom en
 * rotasjon. Vi slår opp på kid fra JWE-headeret i stedet for å anta at det
 * bare finnes én.
 *
 * En rå nøkkel gir JWK-en {kty,crv,d} UTEN kid og UTEN x. Den offentlige
 * delen utledes først ved bruk (fullforRaaNokkel) — jose avviser en X25519-JWK
 * uten x, og x kan ikke leses ut av env, bare regnes ut av d.
 */
export function lesPrivateNokler(raa: string | undefined): JWK[] {
  if (!raa || !raa.trim()) return []
  try {
    const parset: unknown = JSON.parse(raa)
    if (Array.isArray(parset)) return parset as JWK[]
    if (parset && typeof parset === 'object') {
      const o = parset as { keys?: unknown }
      if (Array.isArray(o.keys)) return o.keys as JWK[]
      return [parset as JWK]
    }
    return []
  } catch {
    // Ikke JSON — da er det (kanskje) rå nøkkelbytes.
  }

  // PEM FØRST: en PEM-blokk inneholder linjeskift, og ville blitt hakket i
  // biter av rå-splittingen under.
  if (raa.includes('-----BEGIN')) return lesPemNokler(raa)

  const ut: JWK[] = []
  for (const bit of raa.split(/[,\n\r]+/)) {
    const token = bit.trim()
    if (!token) continue
    const bytes = dekodBase64Fritt(token)
    if (!bytes) continue
    // 48 byte = PKCS#8 DER uten PEM-armor. Dette er formatet prod faktisk
    // fikk. Samme OID-sjekk som PEM-grenen — feil kurve gir ingen nøkkel.
    if (bytes.length === PKCS8_X25519_PREFIX.length + 32) {
      const jwk = pkcs8DerTilJwk(bytes)
      if (jwk) ut.push(jwk)
      continue
    }
    // 32 byte = de bare private-nøkkelbytene. Ikke gjett på noe annet.
    if (bytes.length === 32) {
      ut.push({ kty: 'OKP', crv: 'X25519', d: base64url.encode(bytes) })
    }
  }
  return ut
}

/**
 * Nøklene som kan ha forseglet leveringen, i den rekkefølgen de skal prøves.
 *
 * En RÅ nøkkel har ingen kid, og leveringen kan likevel oppgi en. Derfor er
 * kid-løse nøkler ALLTID kandidater: eksakt kid-treff først, deretter alle
 * uten kid. Å prøve en nøkkel som ikke passer koster bare et mislykket
 * dekrypteringsforsøk — å ikke prøve den koster hele leveringen.
 */
export function velgNokkelKandidater(nokler: JWK[], kid: string | undefined): JWK[] {
  if (nokler.length === 0) return []
  const utenKid = nokler.filter(k => !k.kid)
  if (kid) {
    const eksakt = nokler.filter(k => k.kid === kid)
    return [...eksakt, ...utenKid]
  }
  // Uten kid i leveringen: én nøkkel er utvetydig, ellers er de kid-løse de
  // eneste vi kan forsvare å prøve.
  if (nokler.length === 1) return [nokler[0]]
  return utenKid
}

/** Første kandidat. Beholdt for kallere som bare vil ha én nøkkel. */
export function velgNokkel(nokler: JWK[], kid: string | undefined): JWK | null {
  return velgNokkelKandidater(nokler, kid)[0] ?? null
}

/**
 * Fyller inn den offentlige delen (x) på en rå nøkkel.
 *
 * MÅLT: jose avviser {kty,crv,d} uten x med «Invalid JWK». x er ikke noe vi
 * kan lese fra env — den må regnes ut av d. Vi pakker de 32 bytene som PKCS#8
 * og lar WebCrypto gjøre kurvematematikken; egen X25519-implementasjon ville
 * vært hjemmesnekret krypto.
 */
async function fullforRaaNokkel(jwk: JWK): Promise<JWK> {
  if (jwk.x || !jwk.d) return jwk
  const d = dekodBase64Fritt(jwk.d)
  if (!d || d.length !== 32) return jwk
  const der = new Uint8Array(PKCS8_X25519_PREFIX.length + 32)
  der.set(PKCS8_X25519_PREFIX)
  der.set(d, PKCS8_X25519_PREFIX.length)
  const key = await crypto.subtle.importKey(
    'pkcs8', der as unknown as ArrayBuffer, 'X25519', true, ['deriveBits'],
  )
  const full = await crypto.subtle.exportKey('jwk', key)
  return { ...jwk, x: full.x }
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
 * et endepunkt kan holde to gjennom en rotasjon. Rå nøkler har ingen kid, så
 * de prøves etter et eventuelt eksakt treff, og vi gir først opp når alle
 * kandidatene har feilet.
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
  // Kandidatene i rekkefølge: eksakt kid-treff først, så alle kid-løse (rå)
  // nøkler. Vi gir først opp når ALLE har feilet — en rå nøkkel bærer ingen
  // kid, og leveringen kan likevel oppgi en.
  const kandidater = velgNokkelKandidater(nokler, kid)
  if (kandidater.length === 0) {
    return {
      ok: false,
      kid,
      grunn: kid
        ? `ingen privatnokkel med kid ${kid} og ingen kid-lose nokler`
        : 'leveringen oppgir ingen kid og vi har flere nokler med kid',
    }
  }
  let sisteGrunn = 'dekryptering feilet'
  for (const jwk of kandidater) {
    try {
      const key = (await importJWK(await fullforRaaNokkel(jwk), 'ECDH-ES')) as CryptoKey
      const { plaintext } = await compactDecrypt(jwe, key, {
        keyManagementAlgorithms: ['ECDH-ES'],
        contentEncryptionAlgorithms: ['A256GCM'],
      })
      return { ok: true, kid, data: JSON.parse(new TextDecoder().decode(plaintext)) }
    } catch (e) {
      sisteGrunn = e instanceof Error ? e.message : 'dekryptering feilet'
    }
  }
  return { ok: false, kid, grunn: sisteGrunn }
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
