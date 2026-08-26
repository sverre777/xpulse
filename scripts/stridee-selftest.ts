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
  generateKeyPair, exportJWK, importJWK, exportPKCS8, FlattenedSign, CompactEncrypt,
  type JWK, type CryptoKey,
} from 'jose'
import {
  verifiserLevering, dekrypterHendelse, forGammel, alderSekunder,
  lesPrivateNokler, velgNokkel, velgNokkelKandidater, kvittering, b64u,
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

  // ── RÅ NØKLER (bolk 1b) ────────────────────────────────────────────────
  // Env-verdien kan være en bar base64url-streng — formatet flere
  // nøkkeldashboards gir ut. Det var dette som fikk prod til å melde
  // «mangler» om en variabel som hele tiden var satt.
  console.log('\n— rå nøkler —')

  // Selve råformatet: d fra en ekte jose-generert X25519-nøkkel ER de 32
  // private bytene i base64url.
  const raaD = boksPrivJwk.d as string
  const fraRaa = lesPrivateNokler(raaD)
  sjekk('rå base64url gir én nøkkel', fraRaa.length, 1)
  sjekk('rå nøkkel får crv X25519', fraRaa[0]?.crv, 'X25519')
  sjekk('rå nøkkel får kty OKP', fraRaa[0]?.kty, 'OKP')
  sjekk('rå nøkkel har ingen kid', fraRaa[0]?.kid, undefined)
  sjekk('rå nøkkel bevarer d uendret', fraRaa[0]?.d === raaD, true)

  // Vanlig base64 (+ / =) er samme nøkkel — dashboards gir ut begge former.
  const raaBytes = b64u.decode(raaD)
  const raaStd = Buffer.from(raaBytes).toString('base64')
  sjekk('vanlig base64 m/ padding godtas', lesPrivateNokler(raaStd).length, 1)
  sjekk('vanlig base64 gir samme d', lesPrivateNokler(raaStd)[0]?.d === raaD, true)

  // To rå nøkler samtidig — begge Stridee-nøklene kan ligge inne i rotasjon.
  const annenRaaD = (await exportJWK(annenBoks.privateKey)).d as string
  sjekk('to rå nøkler på hver sin linje', lesPrivateNokler(`${raaD}\n${annenRaaD}`).length, 2)
  sjekk('to rå nøkler med komma', lesPrivateNokler(`${raaD},${annenRaaD}`).length, 2)
  sjekk('linjeskift m/ mellomrom tåles', lesPrivateNokler(`  ${raaD}  \n  ${annenRaaD}  `).length, 2)

  // Ikke gjett: feil lengde er ikke en X25519-nøkkel.
  const kort = b64u.encode(new Uint8Array(31).fill(9))
  sjekk('31 byte gir ingen nøkler', lesPrivateNokler(kort).length, 0)
  const lang = b64u.encode(new Uint8Array(33).fill(9))
  sjekk('33 byte gir ingen nøkler', lesPrivateNokler(lang).length, 0)
  sjekk('tullestreng gir ingen nøkler', lesPrivateNokler('dette er ikke en nøkkel').length, 0)
  sjekk('halvveis base64 gir ingen nøkler', lesPrivateNokler('!!!!').length, 0)

  // JSON-formene skal være UENDRET (regresjon på dagens oppførsel).
  sjekk('regresjon: JWK-objekt gir 1', lesPrivateNokler(JSON.stringify(boksPrivJwk)).length, 1)
  sjekk('regresjon: {keys:[a,b]} gir 2',
    lesPrivateNokler(JSON.stringify({ keys: [boksPrivJwk, annenJwk] })).length, 2)
  sjekk('regresjon: JWK beholder kid', lesPrivateNokler(JSON.stringify(boksPrivJwk))[0]?.kid, 'boks-1')

  // ── RUNDTUR: rå nøkkel må faktisk kunne dekryptere en ekte JWE ──────────
  // Uten kid i leveringen.
  const jweUtenKid = await new CompactEncrypt(new TextEncoder().encode(klartekst))
    .setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM' })
    .encrypt(pub)
  const rundtur = await dekrypterHendelse(jweUtenKid, lesPrivateNokler(raaD))
  sjekk('RUNDTUR rå nøkkel dekrypterer', rundtur.ok, true)
  sjekk('RUNDTUR gir riktig nonce', rundtur.data?.nonce, nonce)

  // Leveringen oppgir en kid vi IKKE har — den rå nøkkelen må prøves likevel.
  const jweFremmedKid = await new CompactEncrypt(new TextEncoder().encode(klartekst))
    .setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM', kid: 'kid-vi-ikke-har' })
    .encrypt(pub)
  const rundturKid = await dekrypterHendelse(jweFremmedKid, lesPrivateNokler(raaD))
  sjekk('RUNDTUR ukjent kid + rå nøkkel dekrypterer', rundturKid.ok, true)
  sjekk('RUNDTUR ukjent kid gir riktig nonce', rundturKid.data?.nonce, nonce)

  // Rå nøkkel som IKKE passer skal feile ærlig (ikke krasje).
  const feilRaa = await dekrypterHendelse(jweUtenKid, lesPrivateNokler(annenRaaD))
  sjekk('feil rå nøkkel feiler ærlig', feilRaa.ok, false)

  // Blandet: riktig rå nøkkel ligger BAK en feil — alle kandidater prøves.
  const blandet = await dekrypterHendelse(jweFremmedKid, lesPrivateNokler(`${annenRaaD}\n${raaD}`))
  sjekk('alle kandidater prøves til én lykkes', blandet.ok, true)

  // Kandidatrekkefølgen: eksakt kid-treff først, så de kid-løse.
  const raaJwk = lesPrivateNokler(raaD)[0]
  const kand = velgNokkelKandidater([annenJwk, raaJwk], 'boks-0')
  sjekk('eksakt kid-treff først', kand[0]?.kid, 'boks-0')
  sjekk('kid-løs nøkkel er alltid kandidat', kand.length, 2)
  sjekk('ukjent kid → kun de kid-løse',
    velgNokkelKandidater([annenJwk, raaJwk], 'finnes-ikke').length, 1)

  // ── PEM (bolk 1c) ──────────────────────────────────────────────────────
  // Stridee leverer nøkkelen som .pem-fil. MÅLT: X25519 PKCS#8 er 48 byte
  // (16 OID-prefiks + 32 nøkkel), og en Ed25519-PEM er OGSÅ 48 byte — de
  // skiller seg bare på OID-en. Derfor sjekkes hele prefikset.
  console.log('\n— PEM —')

  const pem = await exportPKCS8(boks.privateKey)
  const fraPem = lesPrivateNokler(pem)
  sjekk('PKCS#8-PEM gir én nøkkel', fraPem.length, 1)
  sjekk('PEM gir crv X25519', fraPem[0]?.crv, 'X25519')
  sjekk('PEM gir samme d som JWK-eksporten', fraPem[0]?.d === boksPrivJwk.d, true)
  sjekk('PEM-nøkkel har ingen kid', fraPem[0]?.kid, undefined)

  // Linjeskift-varianter: env-transport kan gi \r\n — eller de TO tegnene
  // backslash+n hvis ekte linjeskift ikke overlevde.
  sjekk('CRLF tåles', lesPrivateNokler(pem.replace(/\n/g, '\r\n')).length, 1)
  sjekk('literal backslash-n tåles', lesPrivateNokler(pem.replace(/\n/g, '\\n')).length, 1)
  sjekk('ekstra blanke linjer tåles', lesPrivateNokler(`\n\n${pem}\n\n`).length, 1)

  // Flere PEM-blokker i samme verdi.
  const pem2 = await exportPKCS8(annenBoks.privateKey)
  sjekk('to PEM-blokker gir to nøkler', lesPrivateNokler(`${pem}${pem2}`).length, 2)

  // FEIL KURVE: Ed25519-PEM er også 48 byte — OID-sjekken må fange den.
  const edPem = await exportPKCS8(sign.privateKey)
  sjekk('Ed25519-PEM gir 0 nøkler (feil kurve)', lesPrivateNokler(edPem).length, 0)

  // SEC1 («EC PRIVATE KEY») skal ikke godtas — kun PKCS#8.
  const sec1 = '-----BEGIN EC PRIVATE KEY-----\n' +
    b64u.encode(new Uint8Array(48).fill(3)) + '\n-----END EC PRIVATE KEY-----'
  sjekk('EC PRIVATE KEY (SEC1) gir 0 nøkler', lesPrivateNokler(sec1).length, 0)
  sjekk('avkortet PEM gir 0 nøkler',
    lesPrivateNokler(pem.replace('-----END PRIVATE KEY-----', '')).length, 0)
  sjekk('PEM m/ tullball-innhold gir 0 nøkler',
    lesPrivateNokler('-----BEGIN PRIVATE KEY-----\ndette er ikke base64\n-----END PRIVATE KEY-----').length, 0)

  // ── RUNDTUR: PEM som env-verdi må dekryptere en ekte JWE ────────────────
  const rundturPem = await dekrypterHendelse(jweUtenKid, lesPrivateNokler(pem))
  sjekk('RUNDTUR PEM dekrypterer', rundturPem.ok, true)
  sjekk('RUNDTUR PEM gir riktig nonce', rundturPem.data?.nonce, nonce)
  const rundturPemKid = await dekrypterHendelse(jweFremmedKid, lesPrivateNokler(pem))
  sjekk('RUNDTUR PEM m/ ukjent kid dekrypterer', rundturPemKid.ok, true)
  const rundturPemCrlf = await dekrypterHendelse(jweUtenKid, lesPrivateNokler(pem.replace(/\n/g, '\r\n')))
  sjekk('RUNDTUR CRLF-PEM dekrypterer', rundturPemCrlf.ok, true)

  console.log('\n— kvittering —')
  const k = kvittering(nonce)
  sjekk('nonce ligger paa TOPPNIVA', k.nonce, nonce)
  sjekk('kvitteringen har ingen andre felter', Object.keys(k).join(','), 'nonce')

  console.log(feil === 0 ? '\nAlle tester grønne.' : `\n${feil} feil.`)
  process.exit(feil === 0 ? 0 : 1)
}
void main()
