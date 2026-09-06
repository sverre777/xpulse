'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { StarButton } from './StarButton'
import { sjekkGrafNokkel } from './graf-nokkel'
import { useFavorites } from './FavoritesContext'

/** Fase 122: en stjernet custom-graf lagrer oppsettet sitt når brukeren
    endrer kontrollene (debounce 700 ms, bare når det faktisk er endret). */
export function useFavorittConfig(chartKey: string | undefined, config: Record<string, unknown> | null | undefined) {
  const { favorites, configs, setConfig, readOnly } = useFavorites()
  const json = config === undefined ? undefined : JSON.stringify(config ?? null)
  const sist = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!chartKey || json === undefined || readOnly || !favorites.has(chartKey)) return
    const lagret = JSON.stringify(configs[chartKey] ?? null)
    if (json === lagret || json === sist.current) return
    const t = setTimeout(() => { sist.current = json; void setConfig(chartKey, config ?? null) }, 700)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey, json, favorites, readOnly])
}

export function ChartWrapper({
  title, subtitle, children, height = 280, chartKey, config,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  // 'auto': innholdet styrer høyden (for kort med dynamiske kontroller over
  // grafen — fast høyde kollapser graf-området når kontrollene stables på mobil).
  height?: number | 'auto'
  chartKey?: string
  /** Custom-grafer: gjeldende oppsett — lagres med favoritten og ved endring (fase 122). */
  config?: Record<string, unknown> | null
}) {
  // Bolk 1: alle grafer har stjerne — nøkkelen skal stå i registeret.
  sjekkGrafNokkel(chartKey, title)
  useFavorittConfig(chartKey, config)
  return (
    <div className="p-5" data-chart-key={chartKey} style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)' }}>
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
            <StarButton chartKey={chartKey} config={config} />
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
