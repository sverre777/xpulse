// Selvtest for «radene vinner på trenerflatene» (Sverre 16. sep 2026).
// Kjør: npm run trenertid-selftest
//
// De to tingene som lett blir feil:
//   1. FALLBACKEN. duration_minutes skal brukes når økta ikke HAR rader -
//      og også når radene summerer til null. Ellers kan en økt som nettopp
//      fikk pause-rader falle til null timer.
//   2. KUTTINGEN. Et svar på nøyaktig grenseantallet er mistenkt kuttet.
//      Går vi videre med det, ser utøveren ut til å ha trent mindre enn han
//      har - og ingen oppdager det.

import { renTidSekPerOkt, renTidMin, type RadForTid } from '../lib/ren-treningstid.ts'
import { hentRaderForOkter, OKTER_PER_BOLK, RAD_GRENSE } from '../lib/aktivitetsrader-henting.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}
function ok(navn: string, betingelse: boolean, detalj = '') {
  if (betingelse) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`)
  feil++
}

const rad = (workout_id: string, activity_type: string, sek: number): RadForTid =>
  ({ workout_id, activity_type, duration_seconds: sek })

console.log('\nREN TRENINGSTID PÅ TRENERFLATENE\n')
console.log('Regnemåten')
const blandet = [
  rad('a', 'oppvarming', 900), rad('a', 'aktivitet', 2700), rad('a', 'nedjogg', 600),
  rad('a', 'pause', 300),        // ute
  rad('a', 'veksling', 120),     // ute
  rad('a', 'aktiv_pause', 240),  // INNE siden 9823f70
  rad('a', 'skyting_liggende', 480),  // egen kategori, ute
]
sjekk('pause, veksling og skyting er ute - aktiv pause er inne',
  renTidSekPerOkt(blandet).get('a'), 900 + 2700 + 600 + 240)
sjekk('flere økter holdes fra hverandre',
  [...renTidSekPerOkt([rad('a', 'aktivitet', 600), rad('b', 'aktivitet', 1200)]).entries()],
  [['a', 600], ['b', 1200]])

console.log('\nFallbacken (SAMME regel som lib/calendar-summary)')
const tomt = new Map<string, number>()
sjekk('økt uten rader: det utøveren førte står',
  renTidMin({ id: 'x', duration_minutes: 75 }, tomt), 75)
sjekk('økt med rader: radene vinner',
  renTidMin({ id: 'a', duration_minutes: 90 }, renTidSekPerOkt(blandet)), 74)
sjekk('BARE pause- og skyterader: faller tilbake, ikke til null',
  renTidMin({ id: 'p', duration_minutes: 60 },
    renTidSekPerOkt([rad('p', 'pause', 600), rad('p', 'skyting_staaende', 300)])), 60)
sjekk('verken rader eller duration_minutes: 0',
  renTidMin({ id: 'z', duration_minutes: null }, tomt), 0)

// ── En falsk klient, så hentingen kan testes uten database ──────────────
interface Kall { ider: string[]; fra: number; til: number }
function falskKlient(radPerOkt: (id: string) => number, opts: { lyver?: boolean } = {}) {
  const kall: Kall[] = []
  const klient = {
    from() {
      let ider: string[] = []
      const q = {
        select(_s: string, _o?: { count: 'exact' }) { return q },
        in(_k: string, v: string[]) { ider = v; return q },
        order() { return q },
        range(fra: number, til: number) {
          kall.push({ ider, fra, til })
          const alle: RadForTid[] = []
          for (const id of ider) {
            for (let i = 0; i < radPerOkt(id); i++) alle.push(rad(id, 'aktivitet', 600))
          }
          const side = alle.slice(fra, til + 1)
          return Promise.resolve({
            data: side, error: null,
            // «Lyver»: sier at det finnes flere rader enn den noen gang gir ut -
            // slik en kuttet henting ser ut fra utsiden.
            count: opts.lyver ? alle.length + 500 : alle.length,
          })
        },
      }
      return q
    },
  }
  return { klient, kall }
}

// Hentingen er asynkron: pakkes i en funksjon (tsx bygger til cjs, som
// ikke tar top-level await).
async function hentingen() {
  console.log('\nHentingen: URL-fella')
  {
    const ider = Array.from({ length: 600 }, (_, i) => `o${i}`)
    const { klient, kall } = falskKlient(() => 6)
    const svar = await hentRaderForOkter(klient, ider)
    ok('600 økter deles i bolker', !('error' in svar) && kall.length === Math.ceil(600 / OKTER_PER_BOLK),
      `bolker: ${kall.length}`)
    ok('ingen enkeltspørring får mer enn bolkstørrelsen med id-er',
      kall.every(k => k.ider.length <= OKTER_PER_BOLK),
      `største: ${Math.max(...kall.map(k => k.ider.length))}`)
    ok('alle radene kom med', !('error' in svar) && svar.rader.length === 600 * 6,
      'error' in svar ? svar.error : `fikk ${(svar as { rader: RadForTid[] }).rader.length}`)
  }

  console.log('\nHentingen: kutte-fella')
  {
    // 25 klokkeøkter à 120 runder = 3000 rader i én bolk - godt over grensa.
    const ider = Array.from({ length: OKTER_PER_BOLK }, (_, i) => `k${i}`)
    const { klient, kall } = falskKlient(() => 120)
    const svar = await hentRaderForOkter(klient, ider)
    ok('en bolk over grensa hentes sidevis, ikke kuttet',
      !('error' in svar) && svar.rader.length === OKTER_PER_BOLK * 120,
      'error' in svar ? svar.error : `fikk ${(svar as { rader: RadForTid[] }).rader.length} av ${OKTER_PER_BOLK * 120}`)
    ok('sidene hentes med range(), én per 1000',
      kall.length === Math.ceil(OKTER_PER_BOLK * 120 / RAD_GRENSE), `kall: ${kall.length}`)
    ok('andre side starter der første sluttet', kall[1]?.fra === RAD_GRENSE, JSON.stringify(kall[1]))
  }
  {
    const { klient } = falskKlient(() => 40, { lyver: true })
    const svar = await hentRaderForOkter(klient, ['a', 'b'])
    ok('kommer vi ikke i mål, FEILER vi - vi går aldri videre med et for lavt tall',
      'error' in svar, JSON.stringify(svar).slice(0, 120))
    ok('feilmeldingen sier hva som mangler',
      'error' in svar && /av \d+ aktivitetsrader/.test(svar.error), JSON.stringify(svar).slice(0, 160))
  }
  {
    const klient = { from: () => ({ select: () => ({ in: () => ({ order: () => ({
      range: () => Promise.resolve({ data: null, error: { message: 'nede' }, count: null }),
    }) }) }) }) }
    const svar = await hentRaderForOkter(klient, ['a'])
    sjekk('databasefeil bobler opp', svar, { error: 'nede' })
  }
  sjekk('ingen økter: ingen spørringer', await hentRaderForOkter({}, []), { rader: [] })

}
hentingen().then(() => {
  console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
  process.exit(feil === 0 ? 0 : 1)
})

