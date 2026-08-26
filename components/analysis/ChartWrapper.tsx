'use client'

import { ReactNode } from 'react'
import { StarButton } from './StarButton'

export function ChartWrapper({
  title, subtitle, children, height = 280, chartKey,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  // 'auto': innholdet styrer høyden (for kort med dynamiske kontroller over
  // grafen — fast høyde kollapser graf-området når kontrollene stables på mobil).
  height?: number | 'auto'
  chartKey?: string
}) {
  return (
    <div className="p-5" style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
            {title}
          </p>
          {subtitle && (
            <p className="text-xs mt-0.5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {chartKey && (
          <div className="shrink-0 -mt-1 -mr-1">
            <StarButton chartKey={chartKey} />
          </div>
        )}
      </div>
      <div style={{ width: '100%', height: height === 'auto' ? undefined : height }}>
        {children}
      </div>
    </div>
  )
}

// Delt tooltip-stil for alle diagrammer (mørk).
export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--flate-3)',
  border: '1px solid var(--kant-3)',
  borderRadius: 0,
  color: 'var(--tekst-1-app)',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '12px',
} as const

export const AXIS_STYLE = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 11,
  fill: 'var(--tekst-8-app)',
} as const

export const GRID_COLOR = 'var(--kant-3)'
