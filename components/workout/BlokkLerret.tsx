'use client'

import { useRef } from 'react'
import type { KurveHjelpere } from './OktKurve'

// LERRET A og B (Øktbyggeren bolk 3): blokker i stedet for pulskurve.
//
// SAMME KOMPONENT, ANNET LERRET (fasiten): verktøykassen over — palett,
// drag, grensehåndtak, del/slå sammen/omdøp/type/slett, angre — er den
// samme. Det eneste som skifter er hva man plasserer PÅ, og hvor tallene
// kommer fra:
//   A · PLAN                  — planlagte verdier, ingen puls å lese
//   B · GJENNOMFØRT UTEN KLOKKE — snitt/makspuls FØRES per drag
//
// Derfor gir denne komponenten NØYAKTIG samme hjelpere som OktKurve
// (KurveHjelpere): segmentlaget og punktene tegnes med samme kode, uten
// å vite hvilket lerret de står på.

const H = 150

export function BlokkLerret({
  totalSek, planlagt = false, overlay, onKlikk,
}: {
  totalSek: number
  /** Lerret A: planlagt økt — punkter tegnes hule/stiplet. */
  planlagt?: boolean
  overlay?: (h: KurveHjelpere) => React.ReactNode
  onKlikk?: (sek: number) => void
}) {
  const flate = useRef<HTMLDivElement | null>(null)
  const spenn = Math.max(1, totalSek)

  const hjelpere: KurveHjelpere = {
    pct: sek => `${Math.max(0, Math.min(100, (sek / spenn) * 100))}%`,
    x: sek => (sek / spenn) * 1000,
    // Uten kurve finnes ingen y-verdi å feste et punkt til — punktene
    // legges i overkant, der de er lesbare og ikke dekker blokkene.
    yPctForSerie: () => '22%',
    fraSek: 0,
    tilSek: spenn,
    sekFraAndel: andel => Math.max(0, Math.min(1, andel)) * spenn,
  }

  const tidsmerker = [0, 0.25, 0.5, 0.75, 1].map(f => f * spenn)

  return (
    <div>
      <div ref={flate}
        data-oktkurve="1"
        onClick={e => {
          if (!onKlikk || !flate.current) return
          const r = flate.current.getBoundingClientRect()
          const andel = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)))
          onKlikk(andel * spenn)
        }}
        style={{
          position: 'relative', height: H, touchAction: 'none',
          background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)',
          borderRadius: 10, overflow: 'hidden',
          // Planlagt økt markeres med en svak stiplet ramme, så det er
          // synlig hvilket lerret man står i uten en egen etikett.
          borderStyle: planlagt ? 'dashed' : 'solid',
        }}>
        {/* Grunnlinje + tidsraster, så blokkene har noe å stå på. */}
        {tidsmerker.map((t, i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', left: hjelpere.pct(t), top: 0, bottom: 22,
            width: 1, background: 'var(--kant-3)', opacity: 0.6,
          }} />
        ))}
        {overlay?.(hjelpere)}
      </div>
      <div className="flex justify-between" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'var(--tekst-8-alt)', marginTop: 2,
      }}>
        {tidsmerker.map((t, i) => {
          const m = Math.floor(t / 60), s = Math.floor(t % 60)
          return <span key={i}>{`${m}:${String(s).padStart(2, '0')}`}</span>
        })}
      </div>
    </div>
  )
}
