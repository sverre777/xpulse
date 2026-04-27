'use client'

import type { ReactNode } from 'react'
import { StarButton } from './StarButton'

// Gjenbrukbart kort for Oversikt-fanen. Stort Bebas Neue-tall, liten delta (forrige
// periode) og uppercase-etikett. Delta fargelegges positivt/negativt avhengig av
// `positiveIsGood` (f.eks. mer tid = bra, høyere hvilepuls = dårlig).

export interface MetricCardProps {
  label: string
  value: string                   // ferdigformatert — "12t 30min", "123 km", "—"
  sublabel?: string | null        // f.eks. "Forrige periode: 10t 15min"
  deltaPercent?: number | null    // +/- prosent vs. forrige periode
  positiveIsGood?: boolean        // styrer farge på delta. Default true.
  accent?: string                 // venstre-kant aksent-farge
  children?: ReactNode            // plass for micro-charts (sone-bar, chips)
  chartKey?: string               // gjør kortet stjerne-bart (Mine grafer)
}

function formatDelta(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  if (!Number.isFinite(n)) return null
  if (n === 0) return '±0%'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

export function MetricCard({
  label, value, sublabel, deltaPercent, positiveIsGood = true, accent = '#FF4500', children, chartKey,
}: MetricCardProps) {
  const delta = formatDelta(deltaPercent)
  const isPositive = deltaPercent !== null && deltaPercent !== undefined && deltaPercent > 0
  const isNegative = deltaPercent !== null && deltaPercent !== undefined && deltaPercent < 0
  const good = (positiveIsGood ? isPositive : isNegative)
  const bad = (positiveIsGood ? isNegative : isPositive)
  const deltaColor = good ? '#28A86E' : bad ? '#E11D48' : '#8A8A96'

  return (
    <div
      className="p-4 flex flex-col gap-1 relative"
      style={{
        backgroundColor: '#111113',
        border: '1px solid #1E1E22',
        borderLeft: `3px solid ${accent}`,
        minHeight: '110px',
      }}
    >
      {chartKey && (
        <div className="absolute top-2 right-2">
          <StarButton chartKey={chartKey} />
        </div>
      )}
      <p
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', paddingRight: chartKey ? '24px' : undefined }}
      >
        {label}
      </p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2',
            fontSize: '40px',
            lineHeight: 1,
            letterSpacing: '0.03em',
          }}
        >
          {value}
        </span>
        {delta && (
          <span
            className="text-xs tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: deltaColor }}
          >
            {delta}
          </span>
        )}
      </div>
      {sublabel && (
        <p
          className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
        >
          {sublabel}
        </p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
