'use client'

import { useMemo } from 'react'

// Delt kurve-motor for økt-grafen (og «Legg til detaljer» fra bolk 3).
// Fasit: design/xpulse-oktgraf-design.html.
//
// HVORFOR EGEN SVG OG IKKE RECHARTS: fasiten krever pinch/scroll-zoom,
// touch-krysshår, annoteringer frikoblet fra seriene og et lag med
// draggbare vinduer. «Legg til detaljer» hadde allerede en håndtegnet
// kurve nettopp derfor — dette samler de to i ÉN komponent (regel 11)
// i stedet for å legge til en tredje. Recharts blir stående på alle
// ANDRE grafer i appen (analyse, trender, helse) — dette er ikke en
// app-omfattende motorbytte.
//
// ÉN Y-AKSE: fokus-serien eier aksen og tegnes i full styrke; øvrige
// påslåtte serier tegnes dempet som formkontekst UTEN egen akse. Den
// gamle dobbeltaksen (0–160 venstre / 0–600 høyre) er borte — to skalaer
// på samme flate får leseren til å tro at kurver krysser hverandre.
//
// NEDSAMPLING ER INNEBYGD, ikke et senere tillegg: målt i prod er median
// 3 796 punkter per serie og STØRSTE økt 23 325 (6t 29min på 1 Hz =
// 116 625 punkter over fem serier). Uten reduksjon blir path-attributtet
// alene over 1 MB. Vi reduserer til skjermoppløsning med min/max per
// piksel-kolonne — topper og bunner overlever, som er hele poenget med
// en pulskurve. Ved zoom re-samples det synlige vinduet, så detaljene
// kommer tilbake når man går nær.

export const VISNING_BREDDE = 1000

export interface KurvePunkt { t: number; v: number }

export interface KurveSerie {
  id: string
  navn: string
  farge: string
  punkter: KurvePunkt[]
  /** Formaterer en verdi for lesing (akse + lesetall). */
  format: (v: number) => string
  /** Tegnes som fylt areal bak kurvene (høyde) — kan aldri være fokus. */
  somAreal?: boolean
}

interface Props {
  serier: KurveSerie[]
  /** Serier som er påslått (fokus + kontekst). */
  paaIds: string[]
  /** Serien som eier y-aksen og tegnes i full styrke. */
  fokusId: string | null
  totalSek: number
  /** Synlig tidsvindu [fra, til] — hele økta når den ikke er satt (zoom kommer i bolk 3). */
  vindu?: [number, number]
  hoyde?: number
  /** Annoteringer oppå plot-flaten. Får hjelpere til å regne posisjon. */
  overlay?: (h: KurveHjelpere) => React.ReactNode
  /** Innhold rett under plot-flaten (segmentbånd), samme x-skala. */
  underlag?: (h: KurveHjelpere) => React.ReactNode
}

export interface KurveHjelpere {
  /** Sekund → prosent av bredden (streng, klar for CSS left/width). */
  pct: (sek: number) => string
  /** Sekund → x i viewBox-koordinater. */
  x: (sek: number) => number
  /** Verdi i fokus-serien → y i prosent (for markører PÅ kurven). */
  yPctForSerie: (serieId: string, sek: number) => string
  fraSek: number
  tilSek: number
}

/**
 * Min/max-nedsampling: for hver piksel-kolonne beholdes både laveste og
 * høyeste verdi, i tidsrekkefølge. Bevarer spisser (en 3-sekunders
 * pulstopp forsvinner med naiv hvert-n-te-punkt-reduksjon), og gir
 * maksimalt 2 punkter per kolonne uansett hvor lang økta er.
 */
export function nedsample(
  punkter: KurvePunkt[], fraSek: number, tilSek: number, kolonner = VISNING_BREDDE,
): KurvePunkt[] {
  if (punkter.length === 0) return []
  const spenn = Math.max(1, tilSek - fraSek)
  const bøtter = new Map<number, { min: KurvePunkt; maks: KurvePunkt }>()
  for (const p of punkter) {
    if (p.t < fraSek || p.t > tilSek) continue
    const k = Math.floor(((p.t - fraSek) / spenn) * kolonner)
    const b = bøtter.get(k)
    if (!b) bøtter.set(k, { min: p, maks: p })
    else {
      if (p.v < b.min.v) b.min = p
      if (p.v > b.maks.v) b.maks = p
    }
  }
  const ut: KurvePunkt[] = []
  for (const k of [...bøtter.keys()].sort((a, b) => a - b)) {
    const b = bøtter.get(k)!
    // Tidsrekkefølge innad i kolonnen, ellers zig-zagger linja bakover.
    if (b.min.t <= b.maks.t) { ut.push(b.min); if (b.maks !== b.min) ut.push(b.maks) }
    else { ut.push(b.maks); ut.push(b.min) }
  }
  return ut
}

/** Pene akse-verdier rundt et intervall (maks ~5 streker). */
function akseVerdier(lo: number, hi: number): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return []
  const spenn = hi - lo
  const raa = spenn / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raa)))
  const steg = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raa) ?? mag * 10
  const ut: number[] = []
  for (let v = Math.ceil(lo / steg) * steg; v <= hi + 1e-9; v += steg) ut.push(Math.round(v * 100) / 100)
  return ut
}

function fmtTid(sek: number): string {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = Math.floor(sek % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function OktKurve({
  serier, paaIds, fokusId, totalSek, vindu, hoyde = 300, overlay, underlag,
}: Props) {
  const [fraSek, tilSek] = vindu ?? [0, Math.max(1, totalSek)]
  const H = hoyde
  const TOPP = 10, BUNN = 22   // plass til x-etiketter under

  const paa = serier.filter(s => paaIds.includes(s.id))
  const fokus = paa.find(s => s.id === fokusId && !s.somAreal) ?? paa.find(s => !s.somAreal) ?? null

  // Y-skalaen eies av FOKUS-serien alene (fasiten). Kontekst-seriene
  // normaliseres inn i samme flate, men har ingen egen akse og skal
  // leses som FORM, ikke som verdier — derfor er de dempet.
  const skala = useMemo(() => {
    const iVindu = (s: KurveSerie) => s.punkter.filter(p => p.t >= fraSek && p.t <= tilSek)
    const spennFor = (s: KurveSerie) => {
      const v = iVindu(s).map(p => p.v)
      if (v.length === 0) return null
      return { lo: Math.min(...v), hi: Math.max(...v) }
    }
    const fokusSpenn = fokus ? spennFor(fokus) : null
    return { fokusSpenn, spennFor }
  }, [fokus, fraSek, tilSek])

  const yFor = (s: KurveSerie, v: number): number => {
    const sp = s.id === fokus?.id ? skala.fokusSpenn : skala.spennFor(s)
    if (!sp) return H / 2
    const pad = Math.max(1e-6, (sp.hi - sp.lo) * 0.08)
    const lo = sp.lo - pad, hi = sp.hi + pad
    return TOPP + (1 - (v - lo) / Math.max(1e-6, hi - lo)) * (H - TOPP - BUNN)
  }
  const xFor = (t: number): number =>
    ((t - fraSek) / Math.max(1, tilSek - fraSek)) * VISNING_BREDDE

  const sti = (s: KurveSerie, somFlate: boolean): string => {
    const pkt = nedsample(s.punkter, fraSek, tilSek)
    if (pkt.length === 0) return ''
    const d = pkt.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.t).toFixed(1)} ${yFor(s, p.v).toFixed(1)}`)
    if (somFlate) {
      d.push(`L${xFor(pkt[pkt.length - 1].t).toFixed(1)} ${H - BUNN}`, `L${xFor(pkt[0].t).toFixed(1)} ${H - BUNN}`, 'Z')
    }
    return d.join(' ')
  }

  const hjelpere: KurveHjelpere = {
    pct: sek => `${Math.max(0, Math.min(100, ((sek - fraSek) / Math.max(1, tilSek - fraSek)) * 100))}%`,
    x: xFor,
    yPctForSerie: (serieId, sek) => {
      const s = paa.find(x => x.id === serieId) ?? fokus
      if (!s || s.punkter.length === 0) return '50%'
      const nær = s.punkter.reduce((b, p) => Math.abs(p.t - sek) < Math.abs(b.t - sek) ? p : b, s.punkter[0])
      return `${(yFor(s, nær.v) / H) * 100}%`
    },
    fraSek, tilSek,
  }

  const ticks = akseVerdier(
    skala.fokusSpenn ? skala.fokusSpenn.lo : 0,
    skala.fokusSpenn ? skala.fokusSpenn.hi : 1,
  )
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => fraSek + f * (tilSek - fraSek))

  return (
    <div>
      <div style={{ position: 'relative', height: H }}>
        <svg viewBox={`0 0 ${VISNING_BREDDE} ${H}`} preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {/* Y-streker fra fokus-serien — eneste akse på flata. */}
          {ticks.map(v => {
            const y = fokus ? yFor(fokus, v) : 0
            return <line key={`g${v}`} x1={0} x2={VISNING_BREDDE} y1={y} y2={y}
              stroke="var(--kant-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.5} />
          })}
          {/* Høyde som fylt areal BAK alt — kontekst, aldri likestilt linje. */}
          {paa.filter(s => s.somAreal).map(s => (
            <path key={s.id} d={sti(s, true)} fill={s.farge} opacity={0.13} stroke="none" />
          ))}
          {/* Kontekst-serier: dempet form, ingen egen akse. */}
          {paa.filter(s => !s.somAreal && s.id !== fokus?.id).map(s => (
            <path key={s.id} d={sti(s, false)} fill="none" stroke={s.farge}
              strokeWidth={1.5} opacity={0.4} vectorEffect="non-scaling-stroke" />
          ))}
          {/* Fokus-serien sist = øverst, i full styrke. */}
          {fokus && (
            <path d={sti(fokus, false)} fill="none" stroke={fokus.farge}
              strokeWidth={2} vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* Y-etiketter i fokus-seriens enhet (utenfor SVG-en så de ikke strekkes). */}
        {fokus && ticks.map(v => (
          <span key={`t${v}`} style={{
            position: 'absolute', left: 2, top: `${(yFor(fokus, v) / H) * 100}%`,
            transform: 'translateY(-50%)', pointerEvents: 'none',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5,
            color: 'var(--tekst-8-alt)', background: 'var(--flate-12-alt)', padding: '0 3px',
          }}>
            {fokus.format(v)}
          </span>
        ))}

        {overlay?.(hjelpere)}
      </div>

      {/* X-akse i tekst. */}
      <div className="flex justify-between" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'var(--tekst-8-alt)',
        marginTop: 2,
      }}>
        {xTicks.map((t, i) => <span key={i}>{fmtTid(t)}</span>)}
      </div>

      {underlag?.(hjelpere)}
    </div>
  )
}
