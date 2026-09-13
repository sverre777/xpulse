// Kjøres fra en katalog med `npm i potrace` (ikke en avhengighet i appen). Leser design/ikoner/*.png.
// Sporing av Sverres ikonark -> SVG-paths i 24x24.
//   fyll  : potrace (fylte flater, fill=currentColor)
//   strek : midtlinje (Zhang-Suen-skjelett -> polylinjer), stroke=currentColor 1.7;
//           fylte deler i strek-ikoner (prikker, ruter) spores som fyll.
// Kjør: node spor.mjs  -> ikoner.json + galleri.html
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { trace as potraceTrace } from 'potrace'
const require = createRequire('/Users/sveco/Desktop/Claude x-pulse/x-pulse/package.json')
const sharp = require('sharp')

const ROT = '/Users/sveco/Desktop/Claude x-pulse/x-pulse/design/ikoner/'
const UT = '/private/tmp/claude-501/-Users-sveco/d659923d-1971-4ec7-b0a5-5c8b465ea454/scratchpad/ikonsett/'
mkdirSync(UT + 'crop', { recursive: true })
const F = 'fyll', S = 'strek'
// Rader = leserekkefølge på arket. [navn, variant]; null = ignorer (dublett som ark 15 overstyrer).
const par = navn => navn.flatMap(n => [[n, F], [n, S]])
const ARK = {
  '01-handlinger-fyll.png': [['synk', 'skyting', 'legg-til', 'lukk'], ['fullfort', 'favoritt', 'forrige', 'neste'], ['apne-fane', 'flytt', 'fjern', 'for-okt'], ['planlegg', 'klokke', 'samling', 'konkurranse']].map(r => r.map(n => [n, F])),
  '02-handlinger-strek.png': [['synk', 'skyting', 'legg-til', 'lukk'], ['fullfort', 'favoritt', 'forrige', 'neste'], ['apne-fane', 'flytt', 'fjern', 'for-okt'], ['planlegg', 'klokke', 'samling', 'konkurranse']].map(r => r.map(n => [n, S])),
  '03-meny-fyll.png': [['hjem', 'plan', 'arsplan', 'dagbok'], ['analyse', 'mer', 'maler', 'live-styrke'], ['utstyr', 'helse', 'ai-coach', 'trener'], ['innboks', 'innstillinger', 'hjelp', 'profil'], ['soner', 'lys', 'mork', 'logg-ut']].map(r => r.map(n => [n, F])),
  '04-meny-strek.png': [['hjem', 'plan', 'arsplan', 'dagbok'], ['analyse', 'mer', 'maler', 'live-styrke'], ['utstyr', 'helse', 'ai-coach', 'trener'], ['innboks', 'innstillinger', 'hjelp', 'profil'], ['soner', 'lys', 'mork', 'logg-ut']].map(r => r.map(n => [n, S])),
  '05-idrett-fyll-strek.png': [par(['langrenn', 'skiskyting']), par(['langlop', 'loping']), par(['sykling', 'triatlon']), par(['multisport', 'skyting'])],
  '06-kalender-fyll-strek.png': [par(['hoydesamling', 'treningssamling']), par(['fellestrening', 'laktat']), par(['a-konkurranse', 'b-konkurranse']), par(['c-konkurranse', 'testlop']), par(['test', 'peak'])],
  '07-varmetrening.png': [par(['varmetrening'])],
  '08-trening-og-ernaering.png': [par(['vektvest']), par(['styrketrening']), par(['borse-pa-ryggen']), par(['ernaering'])],
  '09-treningsverdier.png': [par(['puls']), [[null, F], [null, S]], par(['tempo']), par(['kadens']), par(['hoyde'])],
  '10-utstyr.png': [par(['rulleski', 'skisko']), par(['lopesko', 'skistaver']), par(['sykkelsko', 'bat']), par(['annet', 'ski'])],
  '11-verktoy.png': [par(['sok', 'hamburgermeny']), par(['play', 'advarsel']), par(['slett', 'last-ned']), par(['last-opp', 'las'])],
  '12-oktbygger.png': [par(['angre', 'kutt']), par(['gjenta-forrige', 'superserie']), par(['sla-sammen', 'splitt']), par(['del-her', 'standardokt-serie'])],
  '13-kalender-og-okt.png': [par(['hviledag', 'termometer']), par(['skade', 'reisedag']), par(['oppvarming', 'pause']), par(['aktiv-pause', 'veksling']), par(['nedjogg', 'vekt'])],
  '14-bibliotek-og-innstillinger.png': [par(['bokmerke', 'lagre']), par(['bibliotek', 'koble-flett']), par(['tips', 'lengdetest']), par(['parallelltest', 'abonnement']), par(['personvern', 'maleenheter'])],
  '15-oppdaterte-ikoner.png': [par(['aktivitet']), par(['watt']), par(['sykdom'])],
}

// ── bildehjelp ──────────────────────────────────────────────
async function lesArk(fil) {
  const { data, info } = await sharp(ROT + fil).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const blekk = new Uint8Array(W * H)   // 0..255: hvor mye "ikon" (ikke bakgrunn, ikke tekst)
  const tekst = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < W * H; i++, p += 3) {
    const r = data[p], g = data[p + 1], b = data[p + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    if (mx < 100 && mx - mn < 45) tekst[i] = 1
    const morke = 255 - mn, sat = mx - mn
    const v = Math.max(morke - 30, sat - 25) * 2.2
    blekk[i] = v <= 0 ? 0 : v >= 255 ? 255 : v
  }
  // tekst dilateres 4 px og nulles i blekk
  const td = dilater(tekst, W, H, 4)
  for (let i = 0; i < W * H; i++) if (td[i]) blekk[i] = 0
  return { W, H, blekk }
}
function dilater(m, W, H, r) {
  const ut = new Uint8Array(W * H)
  // separabel boks-dilatering (nok her)
  const tmp = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x < W; x++) { if (x + r < W && m[y * W + x + r]) s++; if (x - r - 1 >= 0 && m[y * W + x - r - 1]) s--; if (x >= 0) tmp[y * W + x] = s > 0 ? 1 : 0 } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y < H; y++) { if (y + r < H && tmp[(y + r) * W + x]) s++; if (y - r - 1 >= 0 && tmp[(y - r - 1) * W + x]) s--; if (y >= 0) ut[y * W + x] = s > 0 ? 1 : 0 } }
  return ut
}
function komponenter(mask, W, H, minPx = 1) {
  const lab = new Int32Array(W * H).fill(-1); const ut = []; const ko = new Int32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || lab[i] >= 0) continue
    const id = ut.length; let hode = 0, hale = 0; ko[hale++] = i; lab[i] = id
    let x0 = W, x1 = 0, y0 = H, y1 = 0, n = 0
    while (hode < hale) {
      const c = ko[hode++]; const x = c % W, y = (c / W) | 0; n++
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const j = ny * W + nx; if (mask[j] && lab[j] < 0) { lab[j] = id; ko[hale++] = j }
      }
    }
    ut.push({ id, x0, x1, y0, y1, n })
  }
  return { lab, komp: ut.filter(k => k.n >= minPx) }
}

// ── celler: finn ikon-klynger og gi dem navn ─────────────────
function finnKlynger(ark, W, H, blekk) {
  const mask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mask[i] = blekk[i] > 110 ? 1 : 0
  const r = Math.round(W * 0.017)
  const dil = dilater(mask, W, H, r)
  const { komp } = komponenter(dil, W, H, 300)
  // ekte bbox = blekk-piksler inni den dilaterte komponenten
  const kl = komp.map(k => {
    let x0 = W, x1 = 0, y0 = H, y1 = 0, n = 0
    for (let y = Math.max(0, k.y0); y <= k.y1; y++) for (let x = Math.max(0, k.x0); x <= k.x1; x++) { if (mask[y * W + x]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } }
    return { x0, x1, y0, y1, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
  }).filter(k => k.n >= 250 && k.cy > 0.11 * H && Math.max(k.x1 - k.x0, k.y1 - k.y0) > 12 && Math.min(k.x1 - k.x0, k.y1 - k.y0) > 4)
  // rader
  kl.sort((a, b) => a.cy - b.cy)
  const rader = []
  for (const k of kl) { const r = rader[rader.length - 1]; if (r && Math.abs(k.cy - r.cy) < 0.085 * H) { r.k.push(k); r.cy = r.k.reduce((s, q) => s + q.cy, 0) / r.k.length } else rader.push({ cy: k.cy, k: [k] }) }
  for (const r of rader) r.k.sort((a, b) => a.cx - b.cx)
  return rader
}
function slaaSammenTilAntall(klynger, antall) {
  const k = klynger.map(q => ({ ...q }))
  while (k.length > antall) {
    let best = -1, bestGap = Infinity
    for (let i = 0; i + 1 < k.length; i++) { const gap = k[i + 1].x0 - k[i].x1; if (gap < bestGap) { bestGap = gap; best = i } }
    const a = k[best], b = k[best + 1]
    k.splice(best, 2, { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), n: a.n + b.n, cx: 0, cy: 0 })
    k[best].cx = (k[best].x0 + k[best].x1) / 2; k[best].cy = (k[best].y0 + k[best].y1) / 2
  }
  return k
}

// ── crop og geometri ────────────────────────────────────────
const PAD = 6
function crop(blekk, W, H, b) {
  const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD), x1 = Math.min(W - 1, b.x1 + PAD), y1 = Math.min(H - 1, b.y1 + PAD)
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const g = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = blekk[(y0 + y) * W + x0 + x]
  return { g, w, h, x0, y0 }
}
// bbox (i crop-koordinater) -> 24-boks: største side = 20, sentrert
function tilBoks(b) {
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
  const s = 20 / Math.max(bw, bh)
  const ox = 2 + (20 - bw * s) / 2 - b.x0 * s, oy = 2 + (20 - bh * s) / 2 - b.y0 * s
  return { s, ox, oy }
}
const fmt = v => { const r = Math.round(v * 100) / 100; return String(r).replace(/^(-?)0\./, '$1.') }

// ── potrace på et gråbilde (0 = bakgrunn, 255 = blekk) ──────
async function potraceD(g, w, h, navn) {
  const png = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) png[i] = 255 - g[i]
  const fil = `${UT}crop/${navn}.png`
  await sharp(png, { raw: { width: w, height: h, channels: 1 } }).png().toFile(fil)
  const svg = await new Promise((res, rej) => potraceTrace(fil, { threshold: 128, turdSize: 6, alphaMax: 1, optCurve: true, optTolerance: 0.25, turnPolicy: 'minority' }, (e, s) => e ? rej(e) : res(s)))
  const m = /d="([^"]+)"/.exec(svg); return m ? m[1] : ''
}
function transformerD(d, t) {
  // potrace: kommandoer M L C Z med absolutte koordinater
  const tok = d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let ut = '', cmd = '', buf = []
  const flush = () => { if (!cmd) return; if (cmd === 'Z') { ut += 'Z'; return } const p = []; for (let i = 0; i < buf.length; i += 2) p.push(fmt(buf[i] * t.s + t.ox) + ' ' + fmt(buf[i + 1] * t.s + t.oy)); ut += cmd + p.join(' ') }
  for (const x of tok) {
    if (/[A-Za-z]/.test(x)) { flush(); cmd = x.toUpperCase(); buf = []; if (cmd === 'Z') { flush(); cmd = '' } }
    else buf.push(parseFloat(x))
  }
  flush()
  return ut.replace(/\s+/g, ' ').trim()
}

// ── skjelett ───────────────────────────────────────────────
function tynn(bin, w, h) {
  const g = Uint8Array.from(bin); const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : g[y * w + x]
  let endret = true, runder = 0
  while (endret) {
    endret = false
    for (let iter = 0; iter < 2; iter++) {
      const fjern = []
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!g[y * w + x]) continue
        const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1)
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        if (B < 2 || B > 6) continue
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]; let A = 0; for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) A++
        if (A !== 1) continue
        if (iter === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue } else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue }
        // Spissvern: en piksel med nøyaktig to naboer som selv er naboer er
        // enden på en skrå strek (eller et trappetrinn - det tar oppryddingen).
        // Uten dette eroderer Zhang-Suen enden én piksel per runde (huken
        // «fullfort» gikk fra 239 til 73 piksler).
        if (B === 2) { const nb = [[p2, 0, -1], [p3, 1, -1], [p4, 1, 0], [p5, 1, 1], [p6, 0, 1], [p7, -1, 1], [p8, -1, 0], [p9, -1, -1]].filter(q => q[0]); if (Math.abs(nb[0][1] - nb[1][1]) <= 1 && Math.abs(nb[0][2] - nb[1][2]) <= 1) continue }
        fjern.push(y * w + x)
      }
      if (fjern.length) { endret = true; for (const i of fjern) g[i] = 0 }
    }
    if (++runder > 400) break
  }
  // Overflødige piksler: p fjernes når naboene (uten p) henger sammen som ÉN
  // 8-komponent - da bryter ikke fjerningen linja, og trappetrinn på skrå
  // linjer blir ekte deg-2-kjeder i stedet for falske kryss.
  let igjen = true
  while (igjen) {
    igjen = false
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!g[y * w + x]) continue
      const nb = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; if (P(x + dx, y + dy)) nb.push([x + dx, y + dy]) }
      if (nb.length < 2) continue
      // antall komponenter blant naboene
      const far = nb.map((_, i) => i); const finn = i => far[i] === i ? i : (far[i] = finn(far[i]))
      for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) if (Math.abs(nb[i][0] - nb[j][0]) <= 1 && Math.abs(nb[i][1] - nb[j][1]) <= 1) far[finn(i)] = finn(j)
      const komp = new Set(nb.map((_, i) => finn(i))).size
      if (komp !== 1) continue
      // Spissvern: fjern ikke p om en av naboene da blir et nytt endepunkt -
      // det er spissen på streken, ikke et trappetrinn.
      if (nb.length === 2) { const degUten = q => { let d = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const qx = q[0] + dx, qy = q[1] + dy; if (qx === x && qy === y) continue; if (P(qx, qy)) d++ } return d }; if (degUten(nb[0]) <= 1 || degUten(nb[1]) <= 1) continue }
      g[y * w + x] = 0; igjen = true
    }
  }
  return g
}
function avstand(bin, w, h) {
  // chamfer 3-4 -> /3
  const INF = 1e9; const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = bin[i] ? INF : 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; let m = d[i]
    if (x > 0) m = Math.min(m, d[i - 1] + 3); if (y > 0) { m = Math.min(m, d[i - w] + 3); if (x > 0) m = Math.min(m, d[i - w - 1] + 4); if (x + 1 < w) m = Math.min(m, d[i - w + 1] + 4) } d[i] = m }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; let m = d[i]
    if (x + 1 < w) m = Math.min(m, d[i + 1] + 3); if (y + 1 < h) { m = Math.min(m, d[i + w] + 3); if (x + 1 < w) m = Math.min(m, d[i + w + 1] + 4); if (x > 0) m = Math.min(m, d[i + w - 1] + 4) } d[i] = m }
  for (let i = 0; i < w * h; i++) d[i] /= 3
  return d
}
function naboer(g, w, h, x, y) { const ut = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && g[ny * w + nx]) ut.push(ny * w + nx) } return ut }
function polylinjer(sk, w, h, pruneLen) {
  const g = Uint8Array.from(sk)
  const deg = i => naboer(g, w, h, i % w, (i / w) | 0).length
  // prune spurs
  for (let runde = 0; runde < 3; runde++) {
    let noe = false
    for (let i = 0; i < w * h; i++) {
      if (!g[i] || deg(i) !== 1) continue
      const sti = [i]; let prev = -1, cur = i
      while (true) { const nb = naboer(g, w, h, cur % w, (cur / w) | 0).filter(n => n !== prev); if (nb.length !== 1) break; const nx = nb[0]; if (deg(nx) >= 3) { sti.push(-nx); break } prev = cur; cur = nx; sti.push(cur); if (sti.length > pruneLen + 2) break }
      const traffKryss = sti[sti.length - 1] < 0
      if (traffKryss && sti.length - 1 < pruneLen) { for (const p of sti) if (p >= 0) g[p] = 0; noe = true }
    }
    if (!noe) break
  }
  const D = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (g[i]) D[i] = deg(i)
  const bes = new Uint8Array(w * h); const linjer = []
  const pt = i => [i % w, (i / w) | 0]
  const gaa = (start, forste) => {
    const sti = [pt(start), pt(forste)]; let prev = start, cur = forste
    if (D[cur] === 2) bes[cur] = 1
    while (D[cur] === 2) { const nb = naboer(g, w, h, cur % w, (cur / w) | 0).filter(n => n !== prev); if (nb.length !== 1) break; prev = cur; cur = nb[0]; sti.push(pt(cur)); if (D[cur] === 2) { if (bes[cur]) break; bes[cur] = 1 } }
    return sti
  }
  for (let i = 0; i < w * h; i++) {
    if (!g[i] || D[i] === 2) continue
    for (const n of naboer(g, w, h, i % w, (i / w) | 0)) { if (D[n] === 2 && bes[n]) continue; if (D[n] !== 2 && n < i) continue; linjer.push({ pkt: gaa(i, n), lukket: false }) }
  }
  for (let i = 0; i < w * h; i++) {
    if (!g[i] || D[i] !== 2 || bes[i]) continue
    const nb = naboer(g, w, h, i % w, (i / w) | 0); bes[i] = 1
    const sti = gaa(i, nb[0]); linjer.push({ pkt: sti, lukket: true })
  }
  return linjer.filter(l => l.pkt.length >= 2 || l.lukket)
}
function dp(pkt, eps) {
  if (pkt.length < 3) return pkt
  const [ax, ay] = pkt[0], [bx, by] = pkt[pkt.length - 1]; let maks = -1, idx = -1
  const L = Math.hypot(bx - ax, by - ay)
  for (let i = 1; i + 1 < pkt.length; i++) { const [px, py] = pkt[i]; const d = L === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L; if (d > maks) { maks = d; idx = i } }
  if (maks > eps) return [...dp(pkt.slice(0, idx + 1), eps).slice(0, -1), ...dp(pkt.slice(idx), eps)]
  return [pkt[0], pkt[pkt.length - 1]]
}
function glatt(pkt) { if (pkt.length < 5) return pkt; const ut = [pkt[0]]; for (let i = 1; i + 1 < pkt.length; i++) ut.push([(pkt[i - 1][0] + pkt[i][0] + pkt[i + 1][0]) / 3, (pkt[i - 1][1] + pkt[i][1] + pkt[i + 1][1]) / 3]); ut.push(pkt[pkt.length - 1]); return ut }

async function sporStrek(c, t, navn) {
  const bin = new Uint8Array(c.w * c.h); for (let i = 0; i < c.w * c.h; i++) bin[i] = c.g[i] > 128 ? 1 : 0
  const dist = avstand(bin, c.w, c.h)
  const { lab, komp } = komponenter(bin, c.w, c.h, 12)
  const storrelse = Math.max(c.w, c.h) - 2 * PAD
  const strekHalv = 0.031 * storrelse
  const fyllMask = new Uint8Array(c.w * c.h), linjeMask = new Uint8Array(c.w * c.h)
  let tykkelser = []
  for (const k of komp) {
    let maks = 0; for (let y = k.y0; y <= k.y1; y++) for (let x = k.x0; x <= k.x1; x++) { const i = y * c.w + x; if (lab[i] === k.id && dist[i] > maks) maks = dist[i] }
    const erFyll = maks > 1.75 * strekHalv
    for (let y = k.y0; y <= k.y1; y++) for (let x = k.x0; x <= k.x1; x++) { const i = y * c.w + x; if (lab[i] === k.id) (erFyll ? fyllMask : linjeMask)[i] = 1 }
    if (!erFyll) tykkelser.push(maks)
  }
  let linjer = ''
  if (tykkelser.length) {
    const sk = tynn(linjeMask, c.w, c.h)
    const tykk = 2 * Math.max(...tykkelser)
    const poly = polylinjer(sk, c.w, c.h, Math.max(5, Math.round(1.6 * tykk)))
    if (process.argv[2]) { console.log(`  ${navn}: crop ${c.w}x${c.h}, komponenter ${komp.length}, linjekomp ${tykkelser.length}, tykkelse ~${tykk.toFixed(1)}, skjelettpiksler ${sk.reduce((a, b) => a + b, 0)}, polylinjer ${poly.length}: ${poly.map(l => (l.lukket ? 'O' : '-') + l.pkt.length).join(' ')}`); const w = c.w, h = c.h; let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" style="background:#fff">`; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sk[y * w + x]) svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="#f00"/>`; for (const l of poly) svg += `<path d="M${l.pkt.map(q => q.join(' ')).join('L')}${l.lukket ? 'Z' : ''}" fill="none" stroke="#00f" stroke-width="0.6" opacity="0.7"/>`; writeFileSync(`${UT}debug-${navn}.svg`, svg + '</svg>') }
    const deler = []
    for (const l of poly) {
      let p = dp(glatt(l.pkt), 1.15)
      if (l.lukket && p.length >= 3) { const d = 'M' + p.map(([x, y]) => fmt(x * t.s + t.ox) + ' ' + fmt(y * t.s + t.oy)).join('L') + 'Z'; deler.push(d) }
      else if (p.length >= 2) { const len = p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0); if (len < 2) continue; deler.push('M' + p.map(([x, y]) => fmt(x * t.s + t.ox) + ' ' + fmt(y * t.s + t.oy)).join('L')) }
    }
    linjer = deler.join('')
  }
  let fyll = null
  if (fyllMask.some(v => v)) { const g = new Uint8Array(c.w * c.h); for (let i = 0; i < c.w * c.h; i++) g[i] = fyllMask[i] ? 255 : 0; fyll = transformerD(await potraceD(g, c.w, c.h, navn + '-strekfyll'), t) }
  return { linjer, fyll }
}

// ── hovedløp ───────────────────────────────────────────────
const DEBUG = process.argv[2] ?? null
const ikoner = {}; const logg = []
for (const [fil, oppsett] of Object.entries(ARK)) {
  if (DEBUG && !oppsett.flat().some(sl => sl[0] === DEBUG)) continue
  const { W, H, blekk } = await lesArk(fil)
  const rader = finnKlynger(fil, W, H, blekk)
  if (rader.length !== oppsett.length) logg.push(`${fil}: fant ${rader.length} rader, ventet ${oppsett.length} (${rader.map(r => r.k.length).join(',')})`)
  for (let ri = 0; ri < Math.min(rader.length, oppsett.length); ri++) {
    const slots = oppsett[ri]; let k = rader[ri].k
    if (k.length !== slots.length) { logg.push(`${fil} rad ${ri + 1}: ${k.length} klynger, ventet ${slots.length} -> ${k.length > slots.length ? 'slår sammen nærmeste' : 'HOPPER'}`); if (k.length < slots.length) continue; k = slaaSammenTilAntall(k, slots.length) }
    for (let si = 0; si < slots.length; si++) {
      const [navn, variant] = slots[si]; if (!navn) continue
      if (DEBUG && navn !== DEBUG) continue
      const c = crop(blekk, W, H, k[si])
      const b = { x0: k[si].x0 - c.x0, x1: k[si].x1 - c.x0, y0: k[si].y0 - c.y0, y1: k[si].y1 - c.y0 }
      const t = tilBoks(b)
      ikoner[navn] = ikoner[navn] ?? { ark: [] }
      if (!ikoner[navn].ark.includes(fil)) ikoner[navn].ark.push(fil)
      const id = `${navn}-${variant}`
      if (variant === F) ikoner[navn].fyll = transformerD(await potraceD(c.g, c.w, c.h, id), t)
      else ikoner[navn].strek = await sporStrek(c, t, id)
      // kilde-crop til galleriet
      const png = Buffer.alloc(c.w * c.h); for (let i = 0; i < c.w * c.h; i++) png[i] = 255 - c.g[i]
      await sharp(png, { raw: { width: c.w, height: c.h, channels: 1 } }).png().toFile(`${UT}crop/${id}-kilde.png`)
    }
  }
}
writeFileSync(UT + 'ikoner.json', JSON.stringify(ikoner, null, 1))
const navn = Object.keys(ikoner)
console.log(`ikoner: ${navn.length}; fyll: ${navn.filter(n => ikoner[n].fyll).length}; strek: ${navn.filter(n => ikoner[n].strek).length}; pathbytes: ${JSON.stringify(ikoner).length}`)
for (const l of logg) console.log('  ! ' + l)
// galleri
const svgF = (d, px) => `<svg viewBox="0 0 24 24" width="${px}" height="${px}"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>`
const svgS = (s, px) => `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none"><path d="${s.linjer}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>${s.fyll ? `<path d="${s.fyll}" fill="currentColor" fill-rule="evenodd"/>` : ''}</svg>`
let html = `<!doctype html><meta charset="utf-8"><style>body{font:12px system-ui;background:#111;color:#eee;margin:16px}.r{display:flex;align-items:center;gap:14px;border-bottom:1px solid #333;padding:6px 0}.n{width:150px;color:#aaa}.k{display:flex;gap:6px}.k svg{color:#fff}.k.l{background:#f4f4f2;padding:4px;border-radius:4px}.k.l svg{color:#222}img{height:40px;background:#fff;border-radius:3px}.o{color:#ff5a1f}</style><h1>Ikonsett - sporing</h1>`
for (const n of navn) {
  const ik = ikoner[n]
  html += `<div class="r"><div class="n">${n}<br><small>${ik.ark.map(a => a.slice(0, 2)).join(' ')}</small></div>`
  html += `<img src="crop/${n}-fyll-kilde.png" onerror="this.style.display='none'"><div class="k">${ik.fyll ? [14, 18, 22, 26].map(px => svgF(ik.fyll, px)).join('') : '<i>-</i>'}</div>`
  html += `<img src="crop/${n}-strek-kilde.png" onerror="this.style.display='none'"><div class="k">${ik.strek ? [14, 18, 22, 26].map(px => svgS(ik.strek, px)).join('') : '<i>-</i>'}</div>`
  html += `<div class="k l">${ik.strek ? svgS(ik.strek, 26) : ''}${ik.fyll ? svgF(ik.fyll, 26) : ''}</div><div class="k"><span class="o">${ik.strek ? svgS(ik.strek, 22) : ''}${ik.fyll ? svgF(ik.fyll, 22) : ''}</span></div></div>`
}
writeFileSync(UT + 'galleri.html', html)
let stor = `<!doctype html><meta charset="utf-8"><style>body{font:11px system-ui;background:#15161a;color:#ddd;margin:10px}.g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.c{border:1px solid #333;border-radius:6px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px}.c .i{display:flex;gap:8px;align-items:center}.c svg{color:#fff}.c img{height:34px;background:#fff;border-radius:3px}</style><div class="g">`
for (const n of navn) { const ik = ikoner[n]; stor += `<div class="c"><b>${n}</b><div class="i">${ik.fyll ? svgF(ik.fyll, 44) : ''}${ik.strek ? svgS(ik.strek, 44) : ''}<span style="display:inline-flex;gap:3px;align-items:center">${ik.fyll ? svgF(ik.fyll, 14) : ''}${ik.strek ? svgS(ik.strek, 14) : ''}</span></div><div class="i"><img src="crop/${n}-fyll-kilde.png"><img src="crop/${n}-strek-kilde.png"></div></div>` }
writeFileSync(UT + 'galleri-stor.html', stor + '</div>')
console.log('skrev ikoner.json + galleri.html')
