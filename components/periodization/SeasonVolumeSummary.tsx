'use client'

import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'

export function SeasonVolumeSummary({ plans }: { plans: MonthlyVolumePlan[] }) {
  const totalHours = plans.reduce((s, p) => s + (Number(p.planned_hours) || 0), 0)
  const totalKm = plans.reduce((s, p) => s + (Number(p.planned_km) || 0), 0)

  if (totalHours <= 0 && totalKm <= 0) return null

  return (
    <div className="mt-3 pt-3 flex flex-wrap items-baseline gap-3"
      style={{ borderTop: '1px solid var(--kant-3)' }}>
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Planlagt årstotal
      </span>
      {totalHours > 0 && (
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: 'var(--tekst-1-app)',
          fontSize: '18px',
          letterSpacing: '0.04em',
        }}>
          {totalHours.toFixed(0)} <span style={{ color: 'var(--tekst-5-app)', fontSize: '13px' }}>timer</span>
        </span>
      )}
      {totalKm > 0 && (
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: 'var(--tekst-1-app)',
          fontSize: '18px',
          letterSpacing: '0.04em',
        }}>
          {totalKm.toFixed(0)} <span style={{ color: 'var(--tekst-5-app)', fontSize: '13px' }}>km</span>
        </span>
      )}
    </div>
  )
}
