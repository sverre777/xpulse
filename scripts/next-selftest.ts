// Selvtest for lib/trygg-next - vakta som avgjør hvor bekreftelseslenka
// får lande. Kjør: npm run next-selftest
//
// Dette er en SIKKERHETSVAKT. En feil her er stille: brukeren lander bare
// et annet sted enn han skulle - eller, i verste fall, utenfor appen med
// en fersk sesjon. Derfor testes den, og derfor står den i lib.

import { tryggNext, NEXT_STANDARD } from '../lib/trygg-next.ts'

let feil = 0
const sjekk = (navn: string, faktisk: string, forventet: string) => {
  if (faktisk === forventet) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${faktisk}\n       forventet: ${forventet}`)
  feil++
}

console.log('\nTRYGG NEXT\n')
console.log('Kjente mål slipper gjennom')
for (const s of ['/nytt-passord', '/onboarding/abonnement', '/app/dagbok', '/app/trener', '/app/innstillinger/bekreft-epost']) {
  sjekk(s, tryggNext(s), s)
}
sjekk('vilkårlig /app/-path', tryggNext('/app/oversikt'), '/app/oversikt')

console.log('\nCheckout-unntaket - NØYAKTIG det og ikke mer')
sjekk('athlete_pro', tryggNext('/api/checkout?tier=athlete_pro'), '/api/checkout?tier=athlete_pro')
sjekk('trener_basic', tryggNext('/api/checkout?tier=trener_basic'), '/api/checkout?tier=trener_basic')
sjekk('trener_pro', tryggNext('/api/checkout?tier=trener_pro'), '/api/checkout?tier=trener_pro')
sjekk('promo blir med', tryggNext('/api/checkout?tier=athlete_pro&promo=SOMMER25'), '/api/checkout?tier=athlete_pro&promo=SOMMER25')
sjekk('ukjent tier faller til standard', tryggNext('/api/checkout?tier=gratis_alt'), NEXT_STANDARD)
sjekk('tier med path-traversal faller til standard', tryggNext('/api/checkout?tier=../../noe'), NEXT_STANDARD)
sjekk('uten tier faller til standard', tryggNext('/api/checkout'), NEXT_STANDARD)
sjekk('tom tier faller til standard', tryggNext('/api/checkout?tier='), NEXT_STANDARD)
// Promoen renses, men tier-en er gyldig - da skal han til Stripe uten promo,
// ikke til dagboka. Å miste en rabattkode er bedre enn å miste kjøpet.
sjekk('skitten promo strippes, tier består',
  tryggNext('/api/checkout?tier=athlete_pro&promo=<script>'), '/api/checkout?tier=athlete_pro')
// Ekstra parametre videresendes ALDRI - strengen bygges på nytt.
sjekk('ukjente parametre forsvinner',
  tryggNext('/api/checkout?tier=athlete_pro&redirect=https://evil.com'), '/api/checkout?tier=athlete_pro')

console.log('\nPlass-unntaket - invitert utøver som må registrere seg')
// Ekte form: 32 bytes base64url = 43 tegn.
const ekteToken = 'Zm9vYmFyMTIzNDU2Nzg5MEFCQ0RFRkdISUpLTE1OT1A'
sjekk('gyldig invitasjonstoken slipper gjennom',
  tryggNext(`/plass/${ekteToken}`), `/plass/${ekteToken}`)
sjekk('token med bindestrek og understrek er gyldig base64url',
  tryggNext('/plass/ab-cd_ef-gh_ij-kl_mn-op_qr-st_uv'), '/plass/ab-cd_ef-gh_ij-kl_mn-op_qr-st_uv')
sjekk('/plass uten token faller til standard', tryggNext('/plass'), NEXT_STANDARD)
sjekk('/plass/ med tomt token faller til standard', tryggNext('/plass/'), NEXT_STANDARD)
sjekk('skittent token faller til standard', tryggNext('/plass/<script>alert(1)</script>'), NEXT_STANDARD)
sjekk('token med skråstrek faller til standard', tryggNext('/plass/abc/../../etc'), NEXT_STANDARD)
sjekk('token med query faller til standard', tryggNext('/plass/abc?redirect=https://evil.com'), NEXT_STANDARD)
sjekk('for kort token faller til standard', tryggNext('/plass/kort'), NEXT_STANDARD)
sjekk('for langt token faller til standard', tryggNext(`/plass/${'a'.repeat(200)}`), NEXT_STANDARD)
sjekk('/plassX er ikke /plass', tryggNext(`/plassX/${ekteToken}`), NEXT_STANDARD)

console.log('\nAngrepsforsøk - alle skal falle til standard')
for (const s of [
  '//evil.com',
  '//evil.com/app/dagbok',
  'https://evil.com',
  'http://evil.com/app/dagbok',
  'javascript:alert(1)',
  '/\\evil.com',
  '',
  '   ',
  '/api/checkout/../../etc',
  '/api/checkoutX?tier=athlete_pro',
]) {
  sjekk(JSON.stringify(s), tryggNext(s), NEXT_STANDARD)
}
// Absolutt URL som SER riktig ut: selv om den slapp gjennom en path-sjekk,
// bygges svaret på nytt av de validerte delene og blir internt.
const abs = tryggNext('https://evil.com/api/checkout?tier=athlete_pro')
sjekk('absolutt URL mot checkout blir aldri ekstern', abs, NEXT_STANDARD)
sjekk('null', tryggNext(null), NEXT_STANDARD)
sjekk('undefined', tryggNext(undefined), NEXT_STANDARD)

console.log('\nSvaret er ALLTID en intern path')
for (const s of ['/api/checkout?tier=athlete_pro', '//evil.com', 'https://evil.com/api/checkout?tier=trener_pro', '/app/dagbok']) {
  const ut = tryggNext(s)
  if (ut.startsWith('/') && !ut.startsWith('//')) console.log(`  ok   ${JSON.stringify(s)} -> ${ut}`)
  else { console.log(`  FEIL ${JSON.stringify(s)} -> ${ut}`); feil++ }
}

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
