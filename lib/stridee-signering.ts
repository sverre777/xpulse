/**
 * Stridee bolk 2/3 — signering av VÅRE utgående API-kall.
 *
 * RFC 9421 HTTP Message Signatures med Ed25519, slik
 * platform.stridee.fit/docs/api/signing spesifiserer (lest 27. aug):
 *
 *   · Nøyaktig tre komponenter signeres: "@method", "@target-uri" og
 *     "content-digest" — den siste kun når kallet har kropp.
 *   · Signature base er linjene i den rekkefølgen, med "@signature-params"
 *     som SISTE linje UTEN etterfølgende linjeskift. Den detaljen er lett å
 *     miste og umulig å se i en diff — testen låser den.
 *   · created = unix-SEKUNDER, maks 5 min skjev; nonce fersk per kall
 *     (server avviser gjentak i 5-minuttersvinduet); alg alltid "ed25519".
 *   · Digest og signatur er STANDARD base64 (ikke url-varianten som resten
 *     av Stridee-flatene bruker) pakket i kolon — RFC 8941 byte sequence.
 *
 * NØKKELEN: STRIDEE_SIGNING_PRIVATE_KEY, Ed25519 — ALDRI webhook-nøkkelen
 * (X25519). lesPrivateNokler gjenbrukes med kurve-argumentet; kurvesjekken
 * som ble laget for å avvise Ed25519 på dekrypteringsveien slipper den
 * gjennom her fordi forventet kurve er et argument, ikke en antakelse.
 * keyid kommer fra konsollen deres (STRIDEE_SIGNING_KEY_ID) og peker på den
 * registrerte offentlige nøkkelen.
 */

import type { JWK } from 'jose'
import { lesPrivateNokler, b64u, type OkpKurve } from './stridee'

const ED25519: OkpKurve = 'Ed25519'

/** PKCS#8-prefikset for Ed25519 (OID 1.3.101.112) — for WebCrypto-import. */
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])

function standardBase64(bytes: Uint8Array): string {
  // b64u er base64url; RFC 8941 byte sequences bruker standard-alfabetet.
  return b64u.encode(bytes).replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (Math.ceil((bytes.length * 4) / 3) % 4)) % 4)
}

async function importSigneringsnokkel(jwk: JWK): Promise<CryptoKey> {
  if (jwk.crv !== ED25519 || !jwk.d) {
    throw new Error('signeringsnøkkelen er ikke en Ed25519-privatnøkkel')
  }
  const d = b64u.decode(jwk.d)
  if (d.length !== 32) throw new Error('signeringsnøkkelen har feil lengde')
  const der = new Uint8Array(PKCS8_ED25519_PREFIX.length + 32)
  der.set(PKCS8_ED25519_PREFIX)
  der.set(d, PKCS8_ED25519_PREFIX.length)
  return crypto.subtle.importKey('pkcs8', der as unknown as ArrayBuffer, 'Ed25519', false, ['sign'])
}

export interface SigneringsInput {
  metode: string
  /** Absolutt URL inkludert query — @target-uri er hele adressen. */
  url: string
  /** Rå kropp nøyaktig slik den sendes. undefined = kall uten kropp (GET). */
  body?: string
  nokkel: JWK
  keyid: string
  /** Overstyres kun i test — produksjon bruker klokka og fersk tilfeldighet. */
  createdUnixSekunder?: number
  nonce?: string
}

export interface SignerteHeadere {
  'Signature-Input': string
  'Signature': string
  'Content-Digest'?: string
}

/**
 * Bygger signature base EKSAKT slik spesifikasjonen viser den. Eksportert
 * for testene: å verifisere signaturen mot denne beviser at både basen og
 * signeringen stemmer — mot ekte krypto, ikke mot en antatt streng.
 */
export function byggSignaturBase(
  metode: string, url: string, contentDigest: string | null, params: string,
): string {
  const linjer = [
    `"@method": ${metode.toUpperCase()}`,
    `"@target-uri": ${url}`,
  ]
  if (contentDigest !== null) linjer.push(`"content-digest": ${contentDigest}`)
  linjer.push(`"@signature-params": ${params}`)
  // SISTE linje uten trailing newline — spesifisert eksplisitt hos dem.
  return linjer.join('\n')
}

export async function signerStrideeKall(input: SigneringsInput): Promise<SignerteHeadere> {
  const harKropp = input.body !== undefined
  const created = input.createdUnixSekunder ?? Math.floor(Date.now() / 1000)
  const nonce = input.nonce ?? b64u.encode(crypto.getRandomValues(new Uint8Array(16)))

  let contentDigest: string | null = null
  if (harKropp) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.body))
    contentDigest = `sha-256=:${standardBase64(new Uint8Array(hash))}:`
  }

  const komponenter = harKropp
    ? '("@method" "@target-uri" "content-digest")'
    : '("@method" "@target-uri")'
  const params =
    `${komponenter};created=${created};keyid="${input.keyid}";nonce="${nonce}";alg="ed25519"`

  const base = byggSignaturBase(input.metode, input.url, contentDigest, params)
  const key = await importSigneringsnokkel(input.nokkel)
  const sig = new Uint8Array(
    await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(base)),
  )

  const headere: SignerteHeadere = {
    'Signature-Input': `sig1=${params}`,
    'Signature': `sig1=:${standardBase64(sig)}:`,
  }
  if (contentDigest) headere['Content-Digest'] = contentDigest
  return headere
}

/**
 * Signeringsnøkkelen fra env. Ed25519-kurven er et EKSPLISITT argument til
 * parseren — webhook-veien leser samme env-mønster med X25519, og det er
 * nettopp forvekslingen av de to denne signaturen forhindrer.
 */
export function lesSigneringsnokkel(): { nokkel: JWK; keyid: string } | { feil: string } {
  const raa = process.env.STRIDEE_SIGNING_PRIVATE_KEY
  if (!raa || !raa.trim()) return { feil: 'STRIDEE_SIGNING_PRIVATE_KEY er ikke satt' }
  const nokler = lesPrivateNokler(raa, ED25519)
  if (nokler.length === 0) {
    return { feil: 'STRIDEE_SIGNING_PRIVATE_KEY kunne ikke tolkes som Ed25519 (JWK/PEM/base64)' }
  }
  const keyid = process.env.STRIDEE_SIGNING_KEY_ID
  if (!keyid || !keyid.trim()) return { feil: 'STRIDEE_SIGNING_KEY_ID er ikke satt' }
  return { nokkel: nokler[0], keyid: keyid.trim() }
}
