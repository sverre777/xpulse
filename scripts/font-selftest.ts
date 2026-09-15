// Fontvakt (Sverre 15. sep 2026: «feil fonter over alt ... skal ikke skje igjen»).
//
// Det som gikk galt: seks @font-face-regler på forsida sto med
// font-display: optional. Optional gir nettleseren ~100 ms - er fonten ikke
// klar da (kald start, fonter gjennom auth-middlewaren), tegnes reservefonten
// og den BYTTES ALDRI for den sidelastingen. Og 'Inter' sto uten generisk
// fallback, så knapper og sitat falt helt til Times.
//
// Kjør: npx tsx scripts/font-selftest.ts  (feiler med exit 1 ved brudd)
import { readFileSync, existsSync } from 'node:fs'

const feil: string[] = []
const les = (p: string) => readFileSync(p, 'utf8')

for (const fil of ['public/xpulse.html', 'app/globals.css']) {
  const s = les(fil)
  // 1) Aldri optional - swap viser reservefont et øyeblikk, men bytter alltid.
  const opt = s.match(/font-display\s*:\s*optional/g)
  if (opt) feil.push(`${fil}: ${opt.length} × font-display: optional (skal være swap)`)
  // 2) Alle fontfiler i @font-face finnes.
  for (const m of s.matchAll(/url\('(\/fonts\/[^']+)'\)/g)) {
    if (!existsSync('public' + m[1])) feil.push(`${fil}: fontfil mangler: ${m[1]}`)
  }
  // 3) Ingen font-family-stakk med webfont uten generisk fallback (utenfor @font-face).
  const utenFontFace = s.replace(/@font-face\s*\{[^}]*\}/g, '')
  for (const m of utenFontFace.matchAll(/font(?:-family)?\s*:\s*([^;}]*)/g)) {
    const stakk = m[1]
    if (!/'(Inter|Barlow|Barlow Condensed|Bebas Neue)'/.test(stakk)) continue
    if (!/sans-serif|monospace|system-ui/.test(stakk)) feil.push(`${fil}: stakk uten generisk fallback: ${stakk.trim().slice(0, 70)}`)
  }
}
// 4) Fonter går ikke gjennom auth-middlewaren.
const proxy = les('proxy.ts')
if (!/fonts\//.test(proxy) || !/woff2/.test(proxy)) feil.push('proxy.ts: matcher ekskluderer ikke fonts/ og woff2')

if (feil.length) { console.error('FONTVAKT FEILET:\n  ' + feil.join('\n  ')); process.exit(1) }
console.log('fontvakt ok: ingen optional, alle filer finnes, alle stakker har fallback, fonter utenfor middleware')
