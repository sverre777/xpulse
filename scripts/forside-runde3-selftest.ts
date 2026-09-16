// FORSIDEN, RUNDE 3 - utfallssjekker mot den ekte sida (regel 40).
// Kjør: npm run forside-e2e        (starter en statisk server på public/ selv)
//
// Sjekker: seksjonsrekkefølgen, at fjernede seksjoner ikke finnes, at #inside
// bytter tilstand ved klikk, at en dag åpner og lukker, at karusellen går til
// neste scene ved klikk på prikk, ingen døde ankere, ingen console-feil eller
// 404, og ingen lang tankestrek i det som ble lagt til (regel 31).
// Trenger playwright-core (devDependency) og Chrome.

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}

async function main() {
  console.log('\nFORSIDEN - RUNDE 3\n')
  // Regel 31 i det nye: statisk, uten nettleser.
  for (const f of ['public/xpulse.html', 'public/forside/runde3.css', 'public/forside/karusell.js', 'public/forside/oktgraf.js',
    'public/forside/scener-flyt.js', 'public/forside/scener-detaljene.js', 'public/forside/scener-trener.js', 'public/forside/faktisk-ut.js']) {
    const t = readFileSync(f, 'utf8'); ok(`ingen lang tankestrek i ${f}`, !/[–—]/.test(t))
  }
  const port = 8791
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: 'public', stdio: 'ignore' })
  await new Promise(r => setTimeout(r, 900))
  let b: { close: () => Promise<void> } | null = null
  try {
    const spec: string = 'playwright-core'
    const { chromium } = await import(spec)
    const br = await chromium.launch({ channel: 'chrome' }); b = br
    const feilLogg: string[] = []
    const p = await br.newPage({ viewport: { width: 1440, height: 1000 } })
    p.on('pageerror', (e: Error) => feilLogg.push(e.message))
    p.on('console', (m: { type: () => string; text: () => string }) => { if (m.type() === 'error') feilLogg.push(m.text()) })
    p.on('response', (r: { status: () => number; url: () => string }) => { if (r.status() >= 400) feilLogg.push(r.status() + ' ' + r.url()) })
    await p.goto(`http://localhost:${port}/xpulse.html`, { waitUntil: 'load' })
    await p.waitForTimeout(1500)

    const rekke = await p.evaluate(() => [...document.querySelectorAll('header[id],section[id]')].map(e => e.id).join(' > '))
    ok('seksjonsrekkefølgen er den nye', rekke === 'topp > problem > inside > flyt > dflyt > sports > tflyt > features > hvorfor > testimonials > priser > faq > signup', rekke)
    ok('fjernede seksjoner finnes ikke (nytt, flyten, skiskyting, trener)', await p.evaluate(() => !document.querySelector('#nytt,#flyten,#skiskyting,#trener,.sk-skyt,.hero-flow,.fu-appvindu')))
    const ankre = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')!).filter(h => h.length > 1 && !document.querySelector(h)))
    ok('alle #-ankere peker på noe som finnes', ankre.length === 0, ankre.join(' '))
    ok('heroen: variant B, undertittel og piller', await p.evaluate(() => !!document.querySelector('h1.h7-b') && !!document.querySelector('.h7-sub') && getComputedStyle(document.querySelector('.h7 .btn.pri')!).borderRadius === '999px'))

    // #inside bytter tilstand ved klikk
    const st = () => p.evaluate(() => { const S = (window as unknown as { FV: { STATE: { vis: string; pc: { visning: string; modus: string }; mob: { visning: string; modus: string } } } }).FV.STATE; const s = S[S.vis as 'pc' | 'mob']; return `${S.vis}/${s.visning}/${s.modus}` })
    ok('#inside starter pc/maned/grid', (await st()) === 'pc/maned/grid', await st())
    await p.locator('#inside .fv-ytre [data-yvis="uke"]').first().click(); await p.waitForTimeout(300)
    ok('klikk Uke -> uke', (await st()) === 'pc/uke/grid', await st())
    await p.locator('#inside .fv-ytre [data-yvis="maned"]').first().click(); await p.locator('#inside .fv-ytre [data-ymodus="liste"]').first().click(); await p.waitForTimeout(300)
    ok('klikk Måned + Liste -> maned/liste', (await st()) === 'pc/maned/liste', await st())
    await p.locator('#inside .fv-ytre [data-v="mob"]').first().click(); await p.waitForTimeout(300)
    ok('klikk Mobil -> mob (liste som standard)', (await st()) === 'mob/maned/liste', await st())
    await p.locator('#inside .fv-ytre [data-v="pc"]').first().click(); await p.locator('#inside .fv-ytre [data-ymodus="grid"]').first().click(); await p.waitForTimeout(300)
    await p.locator('#fv-pc [data-dag="2026-09-15"]').first().click(); await p.waitForTimeout(400)
    ok('en dag åpner (tir 15. sep) med øktgraf og helsekort', await p.evaluate(() => { const b = document.querySelector('.fv-pop'); return !!b && /Tirsdag 15. september/.test(b.textContent!) && !!b.querySelector('.og') && /Hvilepuls/.test(b.textContent!) }))
    await p.evaluate(() => (document.querySelector('.fv-pop .x') as HTMLElement).click()); await p.waitForTimeout(300)
    ok('... og lukker', await p.evaluate(() => !document.querySelector('.fv-pop')))

    // karusellen: klikk på prikk 2 -> scene 2 aktiv
    for (const [pre, navn] of [['', 'flyt'], ['d', 'dflyt'], ['t', 'tflyt']]) {
      await p.locator(`#${pre}prikker .prikk`).nth(1).click(); await p.waitForTimeout(500)
      const on = await p.evaluate((pre: string) => [...document.querySelectorAll(`#${pre}spor .sc`)].findIndex(s => s.classList.contains('on')), pre)
      ok(`${navn}: klikk på prikk 2 gir scene 2`, on === 1, `aktiv indeks ${on}`)
    }
    ok('flyt har 10 scener (utkastene slatt pa 16. sep), dflyt 7, tflyt 5', await p.evaluate(() => [document.querySelectorAll('#spor .sc').length, document.querySelectorAll('#dspor .sc').length, document.querySelectorAll('#tspor .sc').length].join(',')) === '10,7,5')
    ok('trener-kort 5 viser de tre nye bryterne som vanlige brytere, uten «Kommer»', await p.evaluate(() => !/Kommer/.test(document.querySelector('#tflyt')!.textContent!) && document.querySelectorAll('#tspor .t-rr').length === 8))
    ok('ingen console-feil, pageerror eller 404', feilLogg.length === 0, feilLogg.join(' | ').slice(0, 300))
  } finally {
    if (b) await b.close()
    srv.kill()
  }
}

main().catch(e => { console.error(e); feil++ }).then(() => {
  console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
  process.exit(feil === 0 ? 0 : 1)
})
