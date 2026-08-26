'use client'

// Kø #47 bolk 3: SKUDDPLOTTING. Popup med én blink per skudd (hvit før
// plotting, svart skive m/ nummerert merke der man trykker). Blinken har
// KUN to sirkler: skivekanten (115 mm) og liggende-sonen (45 mm, stiplet,
// tegnet 46 % for lesbarhet — reelt 39 %, se lib/shooting) — sonen vises
// kun for L-serier; stående = hele skiva. Bom utenfor skiva plottes i
// randen. Delvis plotting er alltid OK (null-hull i arrayet). Bulk: flere
// serier i samme popup m/ egen farge per serie + legend.

import { useState } from 'react'
import type { ShootingSeriesRow } from '@/lib/types'
import {
  SHOT_DISC_R, SHOT_INNER_R_DRAWN, SHOT_SERIES_COLORS, type ShotPoint,
} from '@/lib/shooting'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function Blink({ point, isL, color, number, onPick, onClear }: {
  point: ShotPoint
  isL: boolean
  color: string
  number: number
  onPick: (p: { x: number; y: number }) => void
  onClear: () => void
}) {
  const plotted = point != null
  return (
    <svg
      viewBox="0 0 100 100" width={62} height={62}
      role="button"
      aria-label={`Skudd ${number}${plotted ? ' — plottet, trykk for å flytte' : ''}`}
      style={{ cursor: 'crosshair', touchAction: 'none', flexShrink: 0 }}
      onPointerDown={e => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        onPick({
          x: clamp01((e.clientX - rect.left) / rect.width),
          y: clamp01((e.clientY - rect.top) / rect.height),
        })
      }}
      onDoubleClick={onClear}
    >
      {/* Skiva (115 mm) — hvit før plotting, svart etter. */}
      <circle cx={50} cy={50} r={SHOT_DISC_R * 100}
        fill={plotted ? 'var(--card)' : 'var(--ink)'}
        stroke={plotted ? 'var(--tekst-10)' : 'var(--mut)'} strokeWidth={2} />
      {/* Liggende-sonen — kun L, stiplet, ingen pynte-ringer ellers. */}
      {isL && (
        <circle cx={50} cy={50} r={SHOT_INNER_R_DRAWN * 100} fill="none"
          stroke={plotted ? 'var(--tekst-8-alt)' : 'var(--mut)'} strokeWidth={1.5}
          strokeDasharray="4 3" />
      )}
      {plotted && point && (
        <>
          <circle cx={point.x * 100} cy={point.y * 100} r={8} fill={color} />
          <text x={point.x * 100} y={point.y * 100 + 3.5} textAnchor="middle"
            fontSize={9.5} fontWeight={700} fill="var(--flate-3)"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", pointerEvents: 'none' }}>
            {number}
          </text>
        </>
      )}
    </svg>
  )
}

export function ShotPlotModal({ series, seriesNumbers, onSave, onClose }: {
  // Én serie (🎯 på raden) eller flere (bulk) — farge per serie + legend.
  series: ShootingSeriesRow[]
  // Serienummer i blokken (for label «Serie 2 · S»).
  seriesNumbers: number[]
  onSave: (updates: { id: string; shot_plot: ShotPoint[] }[]) => void
  onClose: () => void
}) {
  // Lokal kopi — padles/kuttes til skudd-antallet per serie.
  const [plots, setPlots] = useState<Record<string, ShotPoint[]>>(() => {
    const out: Record<string, ShotPoint[]> = {}
    for (const s of series) {
      const n = Math.max(1, Math.min(12, parseInt(s.shots) || 5))
      const existing = s.shot_plot ?? []
      out[s.id] = Array.from({ length: n }, (_, i) => existing[i] ?? null)
    }
    return out
  })

  const setPoint = (sid: string, idx: number, p: ShotPoint) =>
    setPlots(prev => ({ ...prev, [sid]: prev[sid].map((q, i) => i === idx ? p : q) }))

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'var(--scrim-75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
          maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '18px 16px',
        }}>
        <div className="flex items-center justify-between mb-2">
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 20, letterSpacing: '0.08em' }}>
            🎯 Skuddplott
          </h3>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, minWidth: 40, minHeight: 40 }}>
            ×
          </button>
        </div>
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', lineHeight: 1.5 }}>
          Trykk på blinken der skuddet satt — utenfor skiva = bom i randen.
          Stiplet sirkel = liggende-sonen. Dobbelttrykk fjerner et skudd.
          Delvis plotting er helt OK.
        </p>

        {series.map((s, si) => {
          const color = SHOT_SERIES_COLORS[si % SHOT_SERIES_COLORS.length]
          const pts = plots[s.id]
          return (
            <div key={s.id} className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, fontWeight: 700, color: 'var(--tekst-1-app)', letterSpacing: '0.05em' }}>
                  Serie {seriesNumbers[si]} · {s.position === 'S' ? 'Stående' : 'Liggende'}
                </span>
                {pts.some(p => p) && (
                  <button type="button"
                    onClick={() => setPlots(prev => ({ ...prev, [s.id]: prev[s.id].map(() => null) }))}
                    className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}>
                    Nullstill
                  </button>
                )}
              </div>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {pts.map((p, i) => (
                  <Blink key={i} point={p} isL={s.position !== 'S'} color={color} number={i + 1}
                    onPick={q => setPoint(s.id, i, q)}
                    onClear={() => setPoint(s.id, i, null)} />
                ))}
              </div>
            </div>
          )
        })}

        <div className="flex justify-end gap-2 mt-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tekst-1-app)', cursor: 'pointer', minHeight: 40 }}>
            Avbryt
          </button>
          <button type="button"
            onClick={() => { onSave(series.map(s => ({ id: s.id, shot_plot: plots[s.id] }))); onClose() }}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: 'var(--accent)', border: 'none', borderRadius: 10, color: 'var(--tekst-1-ren)', cursor: 'pointer', minHeight: 40 }}>
            Lagre plott
          </button>
        </div>
      </div>
    </div>
  )
}
