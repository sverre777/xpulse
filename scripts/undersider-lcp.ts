// UNDERSIDENE - LCP og KOMPRIMERT overført vekt (transferSize) på 390 og 1440.
// Kjør: npx tsx scripts/undersider-lcp.ts [side ...]   (dev på :3953)
// Samme måling som bolk 0 (FØR-tallene i claude/undersider-bolk0.md): to lastinger
// per flate (LCP-median over ANTALL=5 lastinger - dev-serveren svinger), Chrome. transferSize = det nettleseren faktisk hentet
// (gzip/brotli fra serveren), ikke rå filstørrelse.
export {}
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
const SIDER = process.argv.slice(2).length ? process.argv.slice(2) : ['skiskyting', 'analyse', 'trener']
type R = { lcp: number; kb: number; js: number; css: number; html: number; img: number; n: number }
async function main() {
  const spec = 'playwright-core'; const m = await import(spec); const b = await m.chromium.launch({ channel: 'chrome' })
  try {
    for (const side of SIDER) {
      for (const [navn, vp, mobil] of [['390', { width: 390, height: 844 }, true], ['1440', { width: 1440, height: 900 }, false]] as const) {
        const ut: string[] = []; const lcps: number[] = []; let sist: R | null = null
        const ANTALL = Number(process.env.ANTALL ?? 5)
        for (let k = 0; k < ANTALL; k++) {
          const ctx = await b.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil })
          const p = await ctx.newPage(); p.setDefaultTimeout(90000)
          await p.addInitScript(`window.__lcp = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })`)
          await p.goto(`${BASE}/funksjoner/${side}`, { waitUntil: 'load' }); await p.waitForTimeout(3500)
          const r = (await p.evaluate(`(() => { const res = performance.getEntriesByType('resource'); const nav = performance.getEntriesByType('navigation')[0]; const sum = (f) => res.filter(f).reduce((a, e) => a + (e.transferSize || 0), 0); return { lcp: Math.round(window.__lcp), kb: Math.round((((nav && nav.transferSize) || 0) + sum(() => true)) / 1024), n: res.length, js: Math.round(sum(e => /\\.js(\\?|$)/.test(e.name)) / 1024), css: Math.round(sum(e => /\\.css(\\?|$)/.test(e.name)) / 1024), html: Math.round(sum(e => /\\.html(\\?|$)/.test(e.name)) / 1024), img: Math.round(sum(e => /\\.(webp|png|jpg|svg)(\\?|$)/.test(e.name)) / 1024) } })()`)) as R
          lcps.push(r.lcp); sist = r
          await ctx.close()
        }
        lcps.sort((a, b) => a - b); const med = lcps[Math.floor(lcps.length / 2)]; const r = sist!
        ut.push(`LCP median ${med} ms (${lcps.join('/')}) · ${r.kb} KB overført (js ${r.js} · css ${r.css} · fragment-html ${r.html} · bilder ${r.img})`)
        console.log(`/funksjoner/${side} @${navn}: ${ut.join(' | ')}`)
      }
    }
  } finally { await b.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
