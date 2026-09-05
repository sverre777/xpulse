'use client'

// YTELSE bolk 5 (Sverre 5. sep 2026): KompaktKurve bodde i WorkoutDetailChart
// — kalenderen dro dermed inn hele øktgraf-modulen (OktKurve, PlanGraf,
// punkter, zoom …) for en miniatyr. Nå egen fil; WorkoutDetailChart
// re-eksporterer for gamle importer.
import { useMemo } from 'react'
import { PlanSpokelse } from './PlanSpokelse'
import type { PlanBlokk } from '@/app/actions/runder'
import { PunktIkon } from './Punkt'
import type { KompaktPunkt } from '@/lib/types'
import { SEGMENT_FARGER, segmentBakgrunn, type Segment, type SegmentType } from '@/lib/segmenter'

// ── Kompakt kurve — oversikten (kalender, øktliste) ──────────
// Samme kurve i miniatyr: pulsen som tynn linje og segmentbåndet under.
// Ingen kontroller, ingen etiketter — bare formen, så et blikk på
// kalenderen viser om økta var jevn eller hadde drag.

export function KompaktKurve({ hr, totalSek, segmenter, hoyde = 30, plan = [], punkter = [] }: {
  hr: Array<{ t: number; hr: number }>
  totalSek: number
  segmenter: Segment[]
  hoyde?: number
  /** Planens blokker som spøkelse bak (bolk 7) — uten bryter i oversikten. */
  plan?: Array<{ startSek: number; sluttSek: number; sone: string | null; type: string; soner?: Record<string, number> }>
  /** Punktene som ikoner øverst (bolk 8). */
  punkter?: KompaktPunkt[]
}) {
  const B = 320
  const sti = useMemo(() => {
    if (hr.length < 2 || totalSek <= 0) return ''
    let lo = Infinity, hi = -Infinity
    for (const p of hr) { if (p.hr < lo) lo = p.hr; if (p.hr > hi) hi = p.hr }
    const spenn = Math.max(1, hi - lo)
    const H = hoyde - 6
    return hr.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${((p.t / totalSek) * B).toFixed(1)} ${(1 + (1 - (p.hr - lo) / spenn) * (H - 2)).toFixed(1)}`,
    ).join(' ')
  }, [hr, totalSek, hoyde])
  if (totalSek <= 0 || (hr.length < 2 && segmenter.length === 0)) return null
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / totalSek) * 100))}%`
  const spokelser: PlanBlokk[] = plan.map((p, i) => ({ id: `p${i}`, type: p.type, navn: null, startSek: p.startSek, sluttSek: p.sluttSek, sone: p.sone, soner: p.soner }))
  return (
    <div data-kompakt-kurve aria-hidden style={{ position: 'relative', height: hoyde, marginTop: 3 }}>
      {spokelser.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hoyde - 6 }}>
          <PlanSpokelse blokker={spokelser} pct={pct} dempet={0.22} />
        </div>
      )}
      {punkter.filter(p => p.sek >= 0 && p.sek <= totalSek).map((p, i) => (
        <span key={`kp-${i}`} data-kompakt-punkt={p.slag} style={{ position: 'absolute', left: pct(p.sek), top: -2, transform: 'translateX(-50%)', lineHeight: 1 }}>
          <PunktIkon slag={p.slag} planlagt={p.planlagt} storrelse={8} />
        </span>
      ))}
      {sti && (
        <svg viewBox={`0 0 ${B} ${hoyde - 6}`} preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, width: '100%', height: hoyde - 6 }}>
          <path d={sti} fill="none" stroke="#E23A5A" strokeWidth={1.2} opacity={0.85} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {segmenter.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 }}>
          {segmenter.map(sg => (
            <span key={sg.aktivitetId} style={{
              position: 'absolute', left: pct(sg.startSek),
              width: `calc(${pct(sg.sluttSek - sg.startSek)} - 1px)`, minWidth: 2,
              top: 0, bottom: 0, borderRadius: 1, background: segmentBakgrunn(sg.type), opacity: 0.9,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
