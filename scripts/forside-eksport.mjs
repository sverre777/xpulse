// Kjør: node scripts/forside-eksport.mjs (dev-serveren på :3953 må kjøre). Krever playwright i node_modules eller NODE_PATH.
// FORSIDE-EKSPORT: åpner /forside-eksport (lys + mørk), serialiserer hvert [data-eksport]
// til statisk HTML med inline-stiler, og skriver fragmentene til public/forside/*.html.
// Inline `style` (med var(--…)) beholdes; utregnede LAYOUT-egenskaper legges til der de
// ikke er satt inline (Tailwind-klasser finnes ikke på forsiden). Farger beholder var()-
// referansene, så samme markup virker i lys og mørk via app-token-broen i xpulse.html.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
const BASE = 'http://localhost:3953'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const UT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'forside')
mkdirSync(UT, { recursive: true })
const browser = await chromium.launch()
for (const [tema, smal] of [['mork', false], ['lys', false], ['mork', true], ['lys', true]]) {
const ctx = await browser.newContext({ viewport: { width: smal ? 390 : 1200, height: 4000 }, colorScheme: tema === 'lys' ? 'light' : 'dark' })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 200)))
await page.goto(`${BASE}/forside-eksport?tema=${tema}${smal ? '&smal=1' : ''}`, { waitUntil: 'load', timeout: 180000 })
await page.locator('[data-eksport-klar]').waitFor({ timeout: 120000 }); await page.waitForTimeout(6000)
const navn = await page.locator('[data-eksport]').evaluateAll(els => els.map(e => e.getAttribute('data-eksport')))
console.log('flater:', navn.join(', '))
const LAYOUT = ['display','position','top','right','bottom','left','width','height','min-width','min-height','max-width','flex','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-self','justify-content','gap','row-gap','column-gap','grid-template-columns','grid-template-rows','grid-column','grid-row','grid-area','padding','margin','box-sizing','overflow','overflow-x','overflow-y','white-space','text-overflow','text-align','text-transform','letter-spacing','line-height','font-family','font-size','font-weight','font-style','border-radius','border-width','border-style','opacity','z-index','transform','transform-origin','vertical-align','cursor','pointer-events','visibility','user-select','font-variant-numeric','list-style','inset','object-fit','text-decoration','word-break']
const FARGE = ['color','background-color','background','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color','fill','stroke','box-shadow','outline-color']
const html = await page.evaluate(({ LAYOUT, FARGE }) => {
  const ut = {}
  const ARVES = new Set(['font-family','font-size','font-weight','font-style','letter-spacing','line-height','text-transform','text-align','white-space','word-break','list-style','cursor','user-select','font-variant-numeric','color','visibility','fill','stroke'])
  const gaaGjennom = (el, klone, forelderCs) => {
    if (el.nodeType !== 1) return
    const cs = getComputedStyle(el)
    const inline = el.getAttribute('style') || ''
    const satt = new Set(inline.split(';').map(s => s.split(':')[0].trim()).filter(Boolean))
    const deler = []
    const erSvg = el instanceof SVGElement
    if (!erSvg || el.tagName.toLowerCase() === 'svg') {
      for (const p of LAYOUT) {
        if (satt.has(p)) continue
        const v = cs.getPropertyValue(p)
        if (!v) continue
        // Arvelige egenskaper skrives bare når de avviker fra forelderen.
        if (ARVES.has(p) && forelderCs && forelderCs.getPropertyValue(p) === v) continue
        if (p === 'display' && v === 'block' && !erSvg && !['span','b','i','em','small','a','button','svg','img','label','input','select'].includes(el.tagName.toLowerCase())) continue
        if (p === 'position' && v === 'static') continue
        // Bredde/høyde fryses ALDRI på flytende elementer (tekst, knapper, bokser i
        // grid/flex) — bare på absolutt plasserte og på svg/img/input, ellers kan
        // ikke flaten krympe på mobil (målt: kalenderuka ble 587 px på 390).
        if (['width','height','min-width','min-height','max-width','flex-basis'].includes(p)
          && cs.position === 'static' && !['svg','img','canvas','input','select','textarea'].includes(el.tagName.toLowerCase())) continue
        if (['top','right','bottom','left','inset'].includes(p) && v === 'auto') continue
        if (p === 'transform' && v === 'none') continue
        if (p === 'opacity' && v === '1') continue
        if (p === 'z-index' && v === 'auto') continue
        if (p === 'cursor' && v === 'auto') continue
        if (p === 'pointer-events' && v === 'auto') continue
        if (p === 'visibility' && v === 'visible') continue
        if (p === 'overflow' && v === 'visible') continue
        if ((p === 'overflow-x' || p === 'overflow-y') && v === 'visible') continue
        if (p === 'text-decoration' && /none/.test(v)) continue
        if (p === 'list-style' && /none|outside/.test(v) && el.tagName.toLowerCase() !== 'ul') continue
        if (p === 'user-select' && v === 'auto') continue
        deler.push(`${p}:${v}`)
      }
      // Farger: bare når ikke satt inline (inline har var()-referanser vi vil beholde)
      for (const p of FARGE) {
        if (satt.has(p) || (p === 'background-color' && satt.has('background')) || (p.startsWith('border') && (satt.has('border') || satt.has('border-color')))) continue
        const v = cs.getPropertyValue(p)
        if (!v || v === 'none' || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') continue
        if (ARVES.has(p) && forelderCs && forelderCs.getPropertyValue(p) === v) continue
        if (p === 'background' ) continue
        if (p === 'box-shadow' && v === 'none') continue
        if (p === 'fill' && !erSvg) continue
        if (p === 'stroke' && !erSvg) continue
        deler.push(`${p}:${v}`)
      }
    }
    if (deler.length) klone.setAttribute('style', (inline ? inline.replace(/;?\s*$/, ';') : '') + deler.join(';'))
    // Rydd bort klasser (Tailwind) og hendelsesattributter
    klone.removeAttribute('class')
    for (const a of [...klone.attributes]) if (/^on|^data-headlessui|^tabindex$/.test(a.name)) klone.removeAttribute(a.name)
    if (klone.tagName && /^(button|input|select|textarea)$/i.test(klone.tagName)) klone.setAttribute('disabled', '')
    const barn = [...el.childNodes], kbarn = [...klone.childNodes]
    barn.forEach((b, i) => { if (kbarn[i]) gaaGjennom(b, kbarn[i], cs) })
  }
  for (const el of document.querySelectorAll('[data-eksport]')) {
    const navn = el.getAttribute('data-eksport')
    const klone = el.cloneNode(true)
    gaaGjennom(el, klone, getComputedStyle(el.parentElement))
    klone.removeAttribute('style')
    ut[navn] = klone.innerHTML
  }
  return ut
}, { LAYOUT, FARGE })
for (const [navn, h] of Object.entries(html)) {
  writeFileSync(`${UT}/${navn}.${tema}${smal ? '.m' : ''}.html`, h)
  console.log(tema, smal ? 'smal' : 'bred', navn, Math.round(h.length / 1024) + ' KB')
}
await page.screenshot({ path: `/tmp/forside-eksport-${tema}${smal ? '-smal' : ''}.png`, fullPage: true })
await ctx.close()
}
await browser.close()
