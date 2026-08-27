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
import { byggSignaturBase, signerStrideeKall, lesSigneringsnokkel } from '../lib/stridee-signering'
import {
  verifiserLevering, dekrypterHendelse, forGammel, alderSekunder,
  lesPrivateNokler, velgNokkel, velgNokkelKandidater, kvittering, b64u,
  kreverKonto, KONTOLOSE_HENDELSER, subjektFraHendelse,
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

  // ── BAR PKCS#8-DER (bolk 1d) ───────────────────────────────────────────
  // MÅLT I PROD: env-verdien er 64 tegn og starter på 'M' — altså 48 byte
  // PKCS#8 DER uten PEM-armor. Samme nøkkel som PEM-en, bare uten rammen.
  console.log('\n— bar PKCS#8-DER —')

  const stripArmor = (s: string) => s.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const derB64 = stripArmor(pem)
  sjekk('prod-signaturen: 64 tegn', derB64.length, 64)
  sjekk('prod-signaturen: starter på M', derB64[0], 'M')

  const fraDer = lesPrivateNokler(derB64)
  sjekk('bar DER gir én nøkkel', fraDer.length, 1)
  sjekk('bar DER gir crv X25519', fraDer[0]?.crv, 'X25519')
  sjekk('bar DER gir samme d som PEM-en', fraDer[0]?.d === fraPem[0]?.d, true)
  sjekk('bar DER = samme d som JWK-eksporten', fraDer[0]?.d === boksPrivJwk.d, true)

  // Samme toleranse som ellers: padding, mellomrom, flere nøkler.
  sjekk('bar DER m/ omkringliggende mellomrom', lesPrivateNokler(`  ${derB64}  `).length, 1)
  const derB64_2 = stripArmor(pem2)
  sjekk('to bare DER-er på hver sin linje',
    lesPrivateNokler(`${derB64}\n${derB64_2}`).length, 2)
  sjekk('bar DER + rå 32-byte i samme verdi',
    lesPrivateNokler(`${derB64}\n${raaD}`).length, 2)

  // FEIL KURVE uten armor: Ed25519-DER er også 48 byte — OID-sjekken fanger
  // den, og det er den SAMME sjekken som PEM-grenen bruker.
  const edDerB64 = stripArmor(edPem)
  sjekk('Ed25519-DER er også 48 byte', b64u.decode(edDerB64.replace(/\+/g, '-').replace(/\//g, '_')).length, 48)
  sjekk('Ed25519-DER uten armor gir 0 nøkler', lesPrivateNokler(edDerB64).length, 0)

  // 48 byte som IKKE er en PKCS#8 i det hele tatt.
  sjekk('48 byte tullball gir 0 nøkler',
    lesPrivateNokler(b64u.encode(new Uint8Array(48).fill(1))).length, 0)

  // ── RUNDTUR: bar DER som env-verdi må dekryptere en ekte JWE ────────────
  const rundturDer = await dekrypterHendelse(jweUtenKid, lesPrivateNokler(derB64))
  sjekk('RUNDTUR bar DER dekrypterer', rundturDer.ok, true)
  sjekk('RUNDTUR bar DER gir riktig nonce', rundturDer.data?.nonce, nonce)
  const rundturDerKid = await dekrypterHendelse(jweFremmedKid, lesPrivateNokler(derB64))
  sjekk('RUNDTUR bar DER m/ ukjent kid dekrypterer', rundturDerKid.ok, true)

  // ── KONTOLØSE HENDELSER (bolk 1e) ──────────────────────────────────────
  // MÅLT I PROD: en ping ble avvist med «klarteksten mangler account_id».
  // Pingen er testen på at vi kan åpne konvolutten — den har ingen konto, og
  // vi avviste altså den ene hendelsen som skulle bevise at alt virker.
  console.log('\n— kontoløse hendelser —')

  sjekk('ping krever IKKE konto', kreverKonto('ping'), false)
  sjekk('activity.created krever konto', kreverKonto('activity.created'), true)
  sjekk('daily.summary krever konto', kreverKonto('daily.summary'), true)
  sjekk('workout.pushed krever konto', kreverKonto('workout.pushed'), true)
  sjekk('UKJENT type krever konto', kreverKonto('noe.helt.nytt'), true)
  sjekk('type null krever konto', kreverKonto(null), true)
  sjekk('type tom streng krever konto', kreverKonto(''), true)
  sjekk('kun ping er kontoløs', KONTOLOSE_HENDELSER.size, 1)

  // Hele kjeden, ikke bare beslutningen: ekte JWE → ekte dekryptering → den
  // faktiske beslutningen ruta tar på steg 5.
  const forsegl = async (payload: unknown) =>
    new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM', kid: 'boks-1' })
      .encrypt(pub)

  // Ping UTEN account_id — slik Stridee faktisk sender den.
  const pingNonce = 'ping-' + Math.random().toString(36).slice(2)
  const pingJwe = await forsegl({ nonce: pingNonce, type: 'ping' })
  const pingKlar = await dekrypterHendelse(pingJwe, [boksPrivJwk])
  sjekk('ping dekrypteres', pingKlar.ok, true)
  const pingType = typeof pingKlar.data?.type === 'string' ? pingKlar.data.type : null
  const pingKonto = typeof pingKlar.data?.account_id === 'string' ? pingKlar.data.account_id : null
  sjekk('ping har ingen konto i klarteksten', pingKonto, null)
  sjekk('STEG 5: ping slipper gjennom uten konto', !pingKonto && kreverKonto(pingType), false)
  sjekk('ping har nonce å ekko', pingKlar.data?.nonce, pingNonce)
  // Nonce-kravet står uendret — også for ping.
  sjekk('ping-kvittering har nonce på TOPPNIVÅ', kvittering(pingNonce).nonce, pingNonce)

  // activity.created UTEN account_id — skal fortsatt avvises.
  const aktJwe = await forsegl({ nonce: 'n-akt', type: 'activity.created' })
  const aktKlar = await dekrypterHendelse(aktJwe, [boksPrivJwk])
  const aktType = typeof aktKlar.data?.type === 'string' ? aktKlar.data.type : null
  const aktKonto = typeof aktKlar.data?.account_id === 'string' ? aktKlar.data.account_id : null
  sjekk('STEG 5: activity.created uten konto AVVISES', !aktKonto && kreverKonto(aktType), true)

  // Ukjent type uten konto — skal også avvises.
  const ukjentJwe = await forsegl({ nonce: 'n-ukj', type: 'noe.nytt' })
  const ukjentKlar = await dekrypterHendelse(ukjentJwe, [boksPrivJwk])
  const ukjentType = typeof ukjentKlar.data?.type === 'string' ? ukjentKlar.data.type : null
  sjekk('STEG 5: ukjent type uten konto AVVISES', kreverKonto(ukjentType), true)

  // FORFALSKNING: «ping» utenpå konvolutten skal ikke hjelpe når klarteksten
  // sier noe annet — typen leses fra ciphertext, aldri fra kropp.type.
  const juksKropp = JSON.stringify({ id: 'x', type: 'ping', enc: aktJwe })
  const juksKlar = await dekrypterHendelse((JSON.parse(juksKropp) as { enc: string }).enc, [boksPrivJwk])
  const juksType = typeof juksKlar.data?.type === 'string' ? juksKlar.data.type : null
  sjekk('ping utenpå konvolutten hjelper ikke', kreverKonto(juksType), true)

  // ── SUBJEKTET (bolk 2) ─────────────────────────────────────────────────
  // Dokumentasjonen deres motsier seg selv: /docs/webhooks sier account_id,
  // /docs/events sier user_id. Vi målte den leverte pingen — den har ingen
  // av delene, nøyaktig som /docs/events beskriver ping. Vi leser user_id
  // først og account_id som fallback, slik at vi er robuste uansett hvem av
  // sidene som stemmer for en hendelsestype vi ikke har sett ennå.
  console.log('\n— subjekt —')

  sjekk('user_id er subjektet', subjektFraHendelse({ user_id: 'su_1' }), 'su_1')
  sjekk('account_id godtas som fallback', subjektFraHendelse({ account_id: 'ac_1' }), 'ac_1')
  sjekk('user_id VINNER over account_id',
    subjektFraHendelse({ user_id: 'su_1', account_id: 'ac_1' }), 'su_1')
  sjekk('ping (ingen av delene) gir null', subjektFraHendelse({ nonce: 'n', type: 'ping' }), null)
  sjekk('tom user_id faller tilbake', subjektFraHendelse({ user_id: '', account_id: 'ac_2' }), 'ac_2')
  sjekk('ingenting gir null', subjektFraHendelse({}), null)

  // Den EKTE envelopen fra /docs/events — activity.created bærer user_id.
  const ekteAktivitet = {
    id: 'evt', type: 'activity.created', created: '2026-08-04T06:14:02Z',
    webhook_id: 'wh', nonce: 'n-1',
    user_id: '4c9a7e15-6d3b-42f8-91c0-8e5b2a7d04f6', provider: 'coros', data: {},
  }
  sjekk('ekte activity.created gir subjekt',
    subjektFraHendelse(ekteAktivitet), '4c9a7e15-6d3b-42f8-91c0-8e5b2a7d04f6')
  sjekk('STEG 5: activity.created m/ user_id slipper gjennom',
    !subjektFraHendelse(ekteAktivitet) && kreverKonto('activity.created'), false)

  // Den EKTE pingen slik den faktisk lå i prod (målt 26. aug).
  const ektePing = {
    id: '9f2c1e7a', type: 'ping', created: '2026-08-04T06:14:02Z',
    webhook_id: '2d7b45c1', nonce: 'Kd4nWpLb', data: {},
  }
  sjekk('ekte ping har ingen subjekt', subjektFraHendelse(ektePing), null)
  sjekk('STEG 5: ekte ping slipper likevel gjennom',
    !subjektFraHendelse(ektePing) && kreverKonto('ping'), false)

  // ── SIGNERING AV UTGÅENDE KALL (RFC 9421, bolk 2/3) ────────────────────
  // Verifiseres med den OFFENTLIGE nøkkelen mot signature base — beviser at
  // både basen og signeringen stemmer, mot ekte krypto.
  console.log('\n— signering —')

  // Kurve-argumentet: Ed25519-PEM godtas PÅ SIGNERINGSVEIEN…
  const edFraPem = lesPrivateNokler(edPem, 'Ed25519')
  sjekk('Ed25519-PEM godtas på signeringsveien', edFraPem.length, 1)
  sjekk('…med crv Ed25519', edFraPem[0]?.crv, 'Ed25519')
  // …mens dekrypteringsveien (default) fortsatt avviser den — fella er tett
  // begge veier.
  sjekk('Ed25519-PEM avvises fortsatt på webhook-veien', lesPrivateNokler(edPem).length, 0)
  sjekk('X25519-PEM avvises på signeringsveien', lesPrivateNokler(pem, 'Ed25519').length, 0)
  // Bar DER og rå 32 byte følger samme kurve-argument.
  sjekk('bar Ed25519-DER godtas på signeringsveien',
    lesPrivateNokler(edDerB64, 'Ed25519').length, 1)
  const edRaaD = (await exportJWK(sign.privateKey)).d as string
  sjekk('rå 32-byte på signeringsveien får crv Ed25519',
    lesPrivateNokler(edRaaD, 'Ed25519')[0]?.crv, 'Ed25519')

  // Full signering av et kall MED kropp — dokumentasjonens eksempel-form.
  const kropp2 = JSON.stringify({ provider: 'coros', external_user_id: 'u1', return_uri: 'https://x-pulse.no/x' })
  const headere = await signerStrideeKall({
    metode: 'post',
    url: 'https://api.stridee.fit/v1/connect',
    body: kropp2,
    nokkel: edFraPem[0],
    keyid: 'test-key-1',
    createdUnixSekunder: 1770124811,
    nonce: 'test-nonce',
  })
  sjekk('Signature-Input starter med sig1=(', headere['Signature-Input'].startsWith('sig1=("@method" "@target-uri" "content-digest")'), true)
  sjekk('created står i params', headere['Signature-Input'].includes(';created=1770124811;'), true)
  sjekk('keyid er sitert', headere['Signature-Input'].includes('keyid="test-key-1"'), true)
  sjekk('alg er ed25519', headere['Signature-Input'].endsWith('alg="ed25519"'), true)
  sjekk('Content-Digest har sha-256-kolonneform',
    /^sha-256=:[A-Za-z0-9+/]+=*:$/.test(headere['Content-Digest'] ?? ''), true)
  sjekk('Signature har kolonneform', /^sig1=:[A-Za-z0-9+/]+=*:$/.test(headere['Signature']), true)

  // Digesten mot en UAVHENGIG beregning (Buffer, ikke vår egen hjelper).
  const uavhengig = 'sha-256=:' + Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kropp2)),
  ).toString('base64') + ':'
  sjekk('digest matcher uavhengig beregning', headere['Content-Digest'], uavhengig)

  // VERIFISER signaturen med den offentlige nøkkelen over basen.
  const params2 = headere['Signature-Input'].slice('sig1='.length)
  const base2 = byggSignaturBase('POST', 'https://api.stridee.fit/v1/connect', headere['Content-Digest']!, params2)
  sjekk('basen slutter uten linjeskift', base2.endsWith('\n'), false)
  sjekk('basen har 4 linjer for kall m/ kropp', base2.split('\n').length, 4)
  const sigB64 = headere['Signature'].slice('sig1=:'.length, -1)
  const sigBytes = Uint8Array.from(Buffer.from(sigB64, 'base64'))
  const pubEd = await crypto.subtle.importKey('jwk',
    { kty: 'OKP', crv: 'Ed25519', x: (await exportJWK(sign.publicKey)).x },
    'Ed25519', false, ['verify'])
  sjekk('signaturen VERIFISERER med offentlig nøkkel',
    await crypto.subtle.verify('Ed25519', pubEd, sigBytes, new TextEncoder().encode(base2)), true)
  // Tuklet base skal feile — beviser at verifikasjonen faktisk biter.
  sjekk('tuklet base feiler verifikasjon',
    await crypto.subtle.verify('Ed25519', pubEd, sigBytes, new TextEncoder().encode(base2 + ' ')), false)

  // GET uten kropp: ingen content-digest, komponentlista uten den.
  const getHeadere = await signerStrideeKall({
    metode: 'GET',
    url: 'https://api.stridee.fit/v1/connections?external_user_id=u1',
    nokkel: edFraPem[0],
    keyid: 'test-key-1',
  })
  sjekk('GET har ingen Content-Digest', getHeadere['Content-Digest'], undefined)
  sjekk('GET-komponentene er method+target-uri',
    getHeadere['Signature-Input'].startsWith('sig1=("@method" "@target-uri")'), true)
  const getParams = getHeadere['Signature-Input'].slice('sig1='.length)
  const getBase = byggSignaturBase('GET', 'https://api.stridee.fit/v1/connections?external_user_id=u1', null, getParams)
  sjekk('GET-basen har 3 linjer', getBase.split('\n').length, 3)
  const getSig = Uint8Array.from(Buffer.from(getHeadere['Signature'].slice('sig1=:'.length, -1), 'base64'))
  sjekk('GET-signaturen verifiserer',
    await crypto.subtle.verify('Ed25519', pubEd, getSig, new TextEncoder().encode(getBase)), true)

  // Ferske nonce-er per kall (server avviser gjentak).
  const a1 = await signerStrideeKall({ metode: 'GET', url: 'https://x/1', nokkel: edFraPem[0], keyid: 'k' })
  const a2 = await signerStrideeKall({ metode: 'GET', url: 'https://x/1', nokkel: edFraPem[0], keyid: 'k' })
  sjekk('nonce er fersk per kall', a1['Signature-Input'] === a2['Signature-Input'], false)

  // Feil kurve inn i signeringen skal kaste, ikke signere søppel.
  let kastet = false
  try { await signerStrideeKall({ metode: 'GET', url: 'https://x', nokkel: boksPrivJwk, keyid: 'k' }) }
  catch { kastet = true }
  sjekk('X25519-nøkkel inn i signeringen kaster', kastet, true)

  // Env-lesingen: begge variablene må være satt.
  delete process.env.STRIDEE_SIGNING_PRIVATE_KEY
  sjekk('uten env: ærlig feil', 'feil' in lesSigneringsnokkel(), true)
  process.env.STRIDEE_SIGNING_PRIVATE_KEY = edPem
  delete process.env.STRIDEE_SIGNING_KEY_ID
  sjekk('uten keyid: ærlig feil', 'feil' in lesSigneringsnokkel(), true)
  process.env.STRIDEE_SIGNING_KEY_ID = 'kid-1'
  const lest = lesSigneringsnokkel()
  sjekk('med env: nøkkel + keyid', !('feil' in lest) && lest.keyid === 'kid-1'
    && lest.nokkel.crv === 'Ed25519', true)

  console.log('\n— kvittering —')
  const k = kvittering(nonce)
  sjekk('nonce ligger paa TOPPNIVA', k.nonce, nonce)
  sjekk('kvitteringen har ingen andre felter', Object.keys(k).join(','), 'nonce')

  console.log(feil === 0 ? '\nAlle tester grønne.' : `\n${feil} feil.`)
  process.exit(feil === 0 ? 0 : 1)
}
void main()
