'use client'

import { ReactNode } from 'react'

export function ChartWrapper({
  title, subtitle, children, height = 280,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
}) {
  return (
    <div className="p-5" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <div className="mb-4">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs mt-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ width: '100%', height }}>
        {children}
      </div>
    </div>
  )
}

// Delt tooltip-stil for alle diagrammer (mørk).
export const TOOLTIP_STYLE = {
  backgroundColor: '#0A0A0B',
  border: '1px solid #1E1E22',
  borderRadius: 0,
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '12px',
} as const

export const AXIS_STYLE = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 11,
  fill: '#555560',
} as const

export const GRID_COLOR = '#1E1E22'
