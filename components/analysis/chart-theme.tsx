'use client'

// Felles graf-tema for design-finpuss fase 6 (referanse: design/xpulse-graf-design.html).
// KUN stil — ingen datamapping, aggregering eller dataKey-logikk her.
// Konsumeres gradvis, bolk for bolk; eksisterende TOOLTIP_STYLE/AXIS_STYLE/GRID_COLOR
// i ChartWrapper.tsx beholdes til alle bolker er migrert.

import type { ReactNode } from 'react'

// ===== Grid og akser =====
export const CHART_GRID = 'var(--line)' // gridlinjer (--line)
export const CHART_GRID_ZERO = 'var(--line2)' // null-/akselinje (--line2)

export const CHART_AXIS_TICK = {
  fill: 'var(--tekst-8-alt)',
  fontSize: 12,
  fontFamily: "'Barlow Condensed', sans-serif",
} as const

export const CHART_AXIS_LINE = { stroke: 'var(--line2)' } as const
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'

// ===== Sonefarger =====
// Samme hexer som tokens --i1..--i5/--hurt i globals.css + Styrke-grå fra utkastet.
// I1 = grønn ALLTID; rekkefølgen I1→I5 er hellig.
export const CHART_ZONE_COLORS = {
  ...ZONE_COLORS_V2,
  // Styrke er ikke en pulssone og finnes derfor ikke i fasiten — den hører
  // kun hjemme i diagrammer som stabler styrke sammen med sonetid.
  Styrke: '#6E6E78',
} as const

// ===== Serier =====
export const CHART_LINE_WIDTH = 2
export const CHART_DOT = { r: 3, strokeWidth: 0 } as const
export const CHART_ACTIVE_DOT = { r: 4.5, strokeWidth: 0 } as const

// Søyleradius fra utkastet: 8px topp / 3px bunn. Topp-radius KUN på øverste
// segment i en stack — segmenter under bruker BAR_RADIUS_FLAT.
export const BAR_RADIUS: [number, number, number, number] = [8, 8, 3, 3]
export const BAR_RADIUS_FLAT: [number, number, number, number] = [0, 0, 0, 0]

// Snittlinje (ReferenceLine): stiplet oransje som i utkastet.
export const CHART_AVG_LINE = {
  stroke: 'rgba(255,69,0,0.45)',
  strokeDasharray: '6 5',
  strokeWidth: 2,
} as const

// Hover-band bak søyler — samme som dagens cursor-fill.
export const CHART_CURSOR = { fill: 'var(--line)' } as const

export const CHART_LEGEND_STYLE = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 13,
  color: 'var(--mut)',
  letterSpacing: '0.04em',
} as const

// ===== Tooltip =====
// Mørk boks fra utkastet: #0C0C0F, line2-kant, radius 12, skygge, Bebas-tittel,
// rader med fargedot + verdi høyrejustert i bold, valgfri total-rad med skillelinje.
//
// Feltparitet: komponenten leser payload-oppføringene recharts sender inn og
// rendrer NØYAKTIG de samme feltene som standard-tooltipen (navn, verdi, unit),
// inkludert formatter/labelFormatter-props fra <Tooltip>-elementet. Total-raden
// er opt-in (showTotal) og brukes kun der grafen skal vise sum.

interface XpTooltipEntry {
  name?: string | number
  value?: number | string | Array<number | string>
  color?: string
  unit?: string | number
  dataKey?: string | number
  payload?: Record<string, unknown>
}

type XpTooltipFormatter = (
  value: XpTooltipEntry['value'],
  name: XpTooltipEntry['name'],
  entry: XpTooltipEntry,
  index: number,
) => ReactNode | [ReactNode, ReactNode]

// Eksportert boks-stil for grafer med EGNE custom tooltips (f.eks. Ernering)
// — samme visuelle språk som XpTooltip, men innholdet styres av grafen selv
// slik at eksisterende felter bevares nøyaktig.
export const CHART_TOOLTIP_BOX = {
  minWidth: 150,
  backgroundColor: 'var(--flate-5)',
  border: '1px solid var(--line2)',
  borderRadius: 12,
  padding: '12px 14px',
  boxShadow: '0 12px 34px var(--skygge-55)',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 14,
} as const

const TIP_BOX = {
  minWidth: 150,
  backgroundColor: 'var(--flate-5)',
  border: '1px solid var(--line2)',
  borderRadius: 12,
  padding: '12px 14px',
  boxShadow: '0 12px 34px var(--skygge-55)',
} as const

const TIP_TITLE = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 16,
  letterSpacing: '0.08em',
  color: 'var(--ink)',
  marginBottom: 6,
} as const

const TIP_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 14,
  color: 'var(--mut)',
  lineHeight: 1.6,
} as const

const TIP_DOT = {
  width: 8,
  height: 8,
  borderRadius: 2,
  flexShrink: 0,
} as const

const TIP_VALUE = {
  color: 'var(--ink)',
  fontWeight: 600,
  marginLeft: 'auto',
  paddingLeft: 12,
} as const

const TIP_TOTAL_ROW = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  borderTop: '1px solid var(--line)',
  marginTop: 6,
  paddingTop: 6,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 14,
  color: 'var(--mut)',
} as const

const TIP_TOTAL_VALUE = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 16,
  letterSpacing: '0.05em',
  color: 'var(--ink)',
} as const

export function XpTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  showTotal,
  totalLabel = 'Totalt',
  totalFormatter,
}: {
  active?: boolean
  payload?: XpTooltipEntry[]
  label?: string | number
  formatter?: XpTooltipFormatter
  labelFormatter?: (label: string | number, payload: XpTooltipEntry[]) => ReactNode
  showTotal?: boolean
  totalLabel?: string
  totalFormatter?: (total: number) => ReactNode
}) {
  if (!active || !payload || payload.length === 0) return null

  const title = label != null && label !== ''
    ? (labelFormatter ? labelFormatter(label, payload) : label)
    : null

  const total = showTotal
    ? payload.reduce((sum, e) => sum + (typeof e.value === 'number' ? e.value : 0), 0)
    : null

  return (
    <div style={TIP_BOX}>
      {title != null && <div style={TIP_TITLE}>{title}</div>}
      {payload.map((entry, i) => {
        // Samme formatter-semantikk som recharts' standard-tooltip:
        // retur [verdi, navn] overstyrer begge, ellers kun verdien.
        let name: ReactNode = entry.name
        let value: ReactNode = Array.isArray(entry.value) ? entry.value.join(' - ') : entry.value
        if (formatter && entry.value != null) {
          const out = formatter(entry.value, entry.name, entry, i)
          if (Array.isArray(out)) {
            value = out[0]
            if (out[1] != null) name = out[1]
          } else if (out != null) {
            value = out
          }
        }
        return (
          <div key={`${String(entry.dataKey ?? entry.name ?? i)}-${i}`} style={TIP_ROW}>
            <span style={{ ...TIP_DOT, background: entry.color ?? 'var(--mut)' }} />
            <span>{name}</span>
            <b style={TIP_VALUE}>
              {value}
              {entry.unit != null ? ` ${entry.unit}` : ''}
            </b>
          </div>
        )
      })}
      {total != null && (
        <div style={TIP_TOTAL_ROW}>
          <span>{totalLabel}</span>
          <b style={TIP_TOTAL_VALUE}>{totalFormatter ? totalFormatter(total) : total}</b>
        </div>
      )}
    </div>
  )
}
