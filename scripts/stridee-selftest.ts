/**
 * Selvtest for Stridee-webhooken. Kjør: npx tsx scripts/stridee-selftest.ts
 *
 * Tester sømmen mot det EKTE jose-biblioteket, ikke mot en antatt
 * datastruktur: vi genererer ekte Ed25519- og X25519-nøkler, signerer en ekte
 * detached JWS over en rå kropp, krypterer en ekte JWE, og kjører alt gjennom
 * funksjonene i lib/stridee.ts. Feiler biblioteket å godta det vi bygger, ser
 * vi det her og ikke i produksjon.
 */
import {
  generateKeyPair, exportJWK, importJWK, FlattenedSign, CompactEncrypt,
  type JWK, type CryptoKey,
} from 'jose'
import {
  verifiserLevering, dekrypterHendelse, forGammel, alderSekunder,
  lesPrivateNokler, velgNokkel, kvittering,
  CLAIM_ID, CLAIM_TIMESTAMP, STRIDEE_MAKS_ALDER_SEKUNDER,
} from '../lib/stridee'

let feil = 0
function sjekk(navn: string, faktisk: unknown, ventet: unknown) {
  const ok = faktisk === ventet
  if (!ok) feil++
  console.log(`${ok ? 'OK  ' : 'FEIL'}  ${navn}: ${String(faktisk)}${ok ? '' : ` (ventet ${String(ventet)})`}`)
}

/**
 * Bygger en ekte detached JWS. `raBytes` velger RFC 7797 (b64:false) framfor
 * RFC 7515 — vi vet ikke hvilken Stridee bruker, saa begge testes.
 */
async function signerDetached(
  kropp: string, privat: CryptoKey, header: Record<string, unknown>, raBytes = false,
) {
  const h: Record<string, unknown> = { alg: 'EdDSA', ...header }
  if (raBytes) { h.b64 = false; h.crit = ['b64'] }
  const jws = await new FlattenedSign(new TextEncoder().encode(kropp))
    .setProtectedHeader(h as never)
    .sign(privat)
  // Compact detached: header..signatur (tom midtdel)
  return `${jws.protected}..${jws.signature}`
}

async function main() {
  // ── Ekte nokler
  const sign = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  const boks = await generateKeyPair('ECDH-ES', { crv: 'X25519', extractable: true })
  const boksPrivJwk = { ...(await exportJWK(boks.privateKey)), kid: 'boks-1' } as JWK
  const boksPubJwk = { ...(await exportJWK(boks.publicKey)), kid: 'boks-1' } as JWK
  const hentNokkel = async () => sign.publicKey

  // ── Ekte JWE med nonce og account_id
  const nonce = 'nonce-' + Math.random().toString(36).slice(2)
  const klartekst = JSON.stringify({ nonce, account_id: 'acct_123', type: 'activity.created' })
  const pub = (await importJWK(boksPubJwk, 'ECDH-ES')) as CryptoKey
  const jwe = await new CompactEncrypt(new TextEncoder().encode(klartekst))
    .setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM', kid: 'boks-1' })
    .encrypt(pub)

  // ── Ekte ra kropp
  const naa = Date.now()
  const stempel = new Date(naa).toISOString()
  const kropp = JSON.stringify({ id: 'msg_1', type: 'encrypted', enc: jwe })
  const sig = await signerDetached(kropp, sign.privateKey, {
    [CLAIM_ID]: 'msg_1', [CLAIM_TIMESTAMP]: stempel,
  })

  console.log('— signatur —')
  const v = await verifiserLevering(kropp, sig, hentNokkel)
  sjekk('gyldig detached JWS godtas', v.ok, true)
  sjekk('id leses fra SIGNERT header', v.id, 'msg_1')
  sjekk('timestamp leses fra SIGNERT header', v.timestamp, stempel)

  // RFC 7797-varianten: ra bytes som signeringsinngang.
  const sig7797 = await signerDetached(kropp, sign.privateKey,
    { [CLAIM_ID]: 'msg_1', [CLAIM_TIMESTAMP]: stempel }, true)
  const v7797 = await verifiserLevering(kropp, sig7797, hentNokkel)
  sjekk('RFC 7797 (b64:false) godtas ogsaa', v7797.ok, true)
  sjekk('RFC 7797 gir samme id', v7797.id, 'msg_1')

  // Endret kropp ma avvises — det er hele poenget med ra bytes.
  const tuklet = kropp.replace('acct', 'acct') + ' '
  sjekk('endret kropp avvises', (await verifiserLevering(tuklet, sig, hentNokkel)).ok, false)
  sjekk('manglende signatur avvises', (await verifiserLevering(kropp, null, hentNokkel)).ok, false)
  sjekk('sohppel-signatur avvises', (await verifiserLevering(kropp, 'aaa', hentNokkel)).ok, false)

  // Feil nokkel
  const annen = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  sjekk('feil nokkel avvises',
    (await verifiserLevering(kropp, sig, async () => annen.publicKey)).ok, false)

  // Signert header UTEN id
  const utenId = await signerDetached(kropp, sign.privateKey, { [CLAIM_TIMESTAMP]: stempel })
  sjekk('signert header uten id avvises',
    (await verifiserLevering(kropp, utenId, hentNokkel)).ok, false)

  console.log('\n— alder —')
  sjekk('fersk levering er ikke for gammel', forGammel(stempel, naa), false)
  const gammelt = new Date(naa - (STRIDEE_MAKS_ALDER_SEKUNDER + 60) * 1000).toISOString()
  sjekk('levering eldre enn 5 min avvises', forGammel(gammelt, naa), true)
  const fremtid = new Date(naa + (STRIDEE_MAKS_ALDER_SEKUNDER + 60) * 1000).toISOString()
  sjekk('levering langt fram i tid avvises ogsaa', forGammel(fremtid, naa), true)
  sjekk('uleselig tid avvises', forGammel('tullball', naa), true)
  // Floor til hele sekunder kaster bort inntil 999 ms, saa alderen maales med
  // toleranse. Poenget er at ENHETEN tolkes riktig, ikke at den er eksakt 0.
  sjekk('unix-sekunder tolkes som sekunder',
    alderSekunder(String(Math.floor(naa / 1000)), naa)! < 1.001, true)
  sjekk('unix-millisekunder tolkes som ms', alderSekunder(String(naa), naa), 0)

  console.log('\n— dekryptering —')
  const d = await dekrypterHendelse(jwe, [boksPrivJwk])
  sjekk('JWE dekrypteres', d.ok, true)
  sjekk('nonce hentes ut av ciphertext', d.data?.nonce, nonce)
  sjekk('account_id ligger INNE i ciphertext', d.data?.account_id, 'acct_123')
  sjekk('kid leses fra JWE-headeret', d.kid, 'boks-1')

  // Rotasjon: to nokler, riktig velges paa kid
  const annenBoks = await generateKeyPair('ECDH-ES', { crv: 'X25519', extractable: true })
  const annenJwk = { ...(await exportJWK(annenBoks.privateKey)), kid: 'boks-0' } as JWK
  const dRot = await dekrypterHendelse(jwe, [annenJwk, boksPrivJwk])
  sjekk('riktig nokkel velges under rotasjon', dRot.ok, true)
  sjekk('feil nokkel alene feiler', (await dekrypterHendelse(jwe, [annenJwk])).ok, false)
  sjekk('ingen nokler feiler', (await dekrypterHendelse(jwe, [])).ok, false)

  console.log('\n— nokkellesing —')
  sjekk('enkelt JWK', lesPrivateNokler(JSON.stringify(boksPrivJwk)).length, 1)
  sjekk('JWKS-objekt', lesPrivateNokler(JSON.stringify({ keys: [boksPrivJwk, annenJwk] })).length, 2)
  sjekk('liste', lesPrivateNokler(JSON.stringify([boksPrivJwk])).length, 1)
  sjekk('tom env gir ingen nokler', lesPrivateNokler(undefined).length, 0)
  sjekk('sohppel-env gir ingen nokler', lesPrivateNokler('ikke json').length, 0)
  sjekk('kid velger riktig', velgNokkel([annenJwk, boksPrivJwk], 'boks-1')?.kid, 'boks-1')
  sjekk('ukjent kid gir null', velgNokkel([boksPrivJwk], 'finnes-ikke'), null)
  sjekk('uten kid og EN nokkel gaar bra', velgNokkel([boksPrivJwk], undefined)?.kid, 'boks-1')
  sjekk('uten kid og TO nokler gir null', velgNokkel([annenJwk, boksPrivJwk], undefined), null)

  console.log('\n— kvittering —')
  const k = kvittering(nonce)
  sjekk('nonce ligger paa TOPPNIVA', k.nonce, nonce)
  sjekk('kvitteringen har ingen andre felter', Object.keys(k).join(','), 'nonce')

  console.log(feil === 0 ? '\nAlle tester grønne.' : `\n${feil} feil.`)
  process.exit(feil === 0 ? 0 : 1)
}
void main()
