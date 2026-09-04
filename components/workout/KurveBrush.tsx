'use client'

import { useMemo, useRef } from 'react'
import { nedsampleSerie } from '@/lib/kurve-nedsample'
import { segmentBakgrunn, fmtKlokkeSek, type Segment } from '@/lib/segmenter'
import type { KurveSerie } from './OktKurve'

// Brush-feltet under grafen (fasit): minikurve + segmentbånd for HELE
// økta, med et lyst felt som viser hvor man er. Uten dette mister man
// stedsansen straks man zoomer inn på et 40-sekunders vindu i en
// to-timers økt.
//
// Feltet kan dras (flytt vinduet) og gripes i endene (endre spennet).

const BREDDE = 1000
const H = 46

export function KurveBrush({
  serie, segmenter, totalSek, vindu, onVindu,
}: {
  /** Fokus-serien tegnes som minikurve — nok til å kjenne igjen formen. */
  serie: KurveSerie | null
  segmenter: Segment[]
  totalSek: number
  vindu: [number, number]
  onVindu: (v: [number, number]) => void
}) {
  const flate = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ slag: 'flytt' | 'venstre' | 'hoyre'; x: number; fra: number; til: number } | null>(null)
  const [fra, til] = vindu
  const heleOkta = fra <= 0.5 && til >= totalSek - 0.5

  const sti = useMemo(() => {
    if (!serie || serie.punkter.length === 0) return ''
    const pkt = nedsampleSerie(serie.punkter, 0, totalSek, 240, p => p.v)
    let lo = Infinity, hi = -Infinity
    for (const p of pkt) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v }
    const spenn = Math.max(1e-6, hi - lo)
    return pkt.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${((p.t / Math.max(1, totalSek)) * BREDDE).toFixed(1)} ${(4 + (1 - (p.v - lo) / spenn) * (H - 20)).toFixed(1)}`,
    ).join(' ')
  }, [serie, totalSek])

  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / Math.max(1, totalSek)) * 100))}%`

  const sekFraX = (clientX: number) => {
    const el = flate.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(totalSek, ((clientX - r.left) / Math.max(1, r.width)) * totalSek))
  }

  const paaFlytt = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const spenn = d.til - d.fra
    const dSek = sekFraX(e.clientX) - sekFraX(d.x)
    if (d.slag === 'flytt') {
      let f = d.fra + dSek, t = d.til + dSek
      if (f < 0) { t -= f; f = 0 }
      if (t > totalSek) { f -= (t - totalSek); t = totalSek }
      onVindu([f, t])
    } else if (d.slag === 'venstre') {
      onVindu([Math.max(0, Math.min(d.til - 20, d.fra + dSek)), d.til])
    } else {
      onVindu([d.fra, Math.min(totalSek, Math.max(d.fra + 20, d.til + dSek))])
    }
    void spenn
  }

  return (
    <div className="mt-2" data-kurve-brush>
      <div ref={flate}
        onPointerMove={paaFlytt}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { drag.current = null }}
        onPointerDown={e => {
          // Klikk utenfor feltet: sentrer vinduet der man trykket.
          if (drag.current) return
          const sek = sekFraX(e.clientX)
          if (sek < fra || sek > til) {
            const spenn = til - fra
            let f = sek - spenn / 2, t = f + spenn
            if (f < 0) { t -= f; f = 0 }
            if (t > totalSek) { f -= (t - totalSek); t = totalSek }
            onVindu([Math.max(0, f), Math.min(totalSek, t)])
          }
        }}
        style={{
          position: 'relative', height: H, touchAction: 'none', cursor: 'pointer',
          background: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderRadius: 8,
          overflow: 'hidden',
        }}>
        <svg viewBox={`0 0 ${BREDDE} ${H}`} preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {sti && <path d={sti} fill="none" stroke={serie?.farge ?? 'var(--tekst-8-alt)'}
            strokeWidth={1} opacity={0.55} vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Segmentbåndet i miniatyr — stedsansen kommer like mye herfra. */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 3, height: 7 }}>
          {segmenter.map(sg => (
            <span key={sg.aktivitetId} aria-hidden style={{
              position: 'absolute', left: pct(sg.startSek),
              width: `calc(${pct(sg.sluttSek - sg.startSek)} - 1px)`, minWidth: 3,
              top: 0, bottom: 0, borderRadius: 2, background: segmentBakgrunn(sg.type), opacity: 0.85,
            }} />
          ))}
        </div>
        {/* Selve vinduet. */}
        {!heleOkta && (
          <>
            <span aria-hidden style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: pct(fra),
              background: 'var(--scrim-70)', opacity: 0.55,
            }} />
            <span aria-hidden style={{
              position: 'absolute', top: 0, bottom: 0, left: pct(til), right: 0,
              background: 'var(--scrim-70)', opacity: 0.55,
            }} />
          </>
        )}
        <div
          onPointerDown={e => {
            e.stopPropagation()
            drag.current = { slag: 'flytt', x: e.clientX, fra, til }
            e.currentTarget.setPointerCapture?.(e.pointerId)
          }}
          role="slider" tabIndex={0}
          aria-label={`Synlig del av økta: ${fmtKlokkeSek(fra)}–${fmtKlokkeSek(til)}`}
          aria-valuemin={0} aria-valuemax={Math.round(totalSek)} aria-valuenow={Math.round(fra)}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: pct(fra),
            width: `calc(${pct(til - fra)})`, minWidth: 8,
            border: `1.5px solid var(--accent)`, borderRadius: 6,
            background: 'rgba(255,69,0,.08)', cursor: 'grab',
          }}>
          {(['venstre', 'hoyre'] as const).map(side => (
            <span key={side}
              onPointerDown={e => {
                e.stopPropagation()
                drag.current = { slag: side, x: e.clientX, fra, til }
                e.currentTarget.setPointerCapture?.(e.pointerId)
              }}
              style={{
                position: 'absolute', top: -6, bottom: -6, width: 36,
                [side === 'venstre' ? 'left' : 'right']: -18,
                cursor: 'ew-resize', display: 'flex', alignItems: 'center',
                justifyContent: side === 'venstre' ? 'flex-end' : 'flex-start',
              }}>
              <span style={{ width: 3, height: 22, borderRadius: 2, background: 'var(--accent)' }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
