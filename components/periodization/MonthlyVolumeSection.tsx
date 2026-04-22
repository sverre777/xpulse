'use client'

import { useState } from 'react'
import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'
import { MonthlyVolumeInput } from './MonthlyVolumeInput'

function enumerateMonths(startDate: string, endDate: string): { year: number; month: number }[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const months: { year: number; month: number }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

export function MonthlyVolumeSection({
  userId, seasonId, startDate, endDate, plans,
}: {
  userId: string
  seasonId: string | null
  startDate: string
  endDate: string
  plans: MonthlyVolumePlan[]
}) {
  const [open, setOpen] = useState(false)
  const months = enumerateMonths(startDate, endDate)
  const byKey = new Map(plans.map(p => [`${p.year}-${p.month}`, p]))

  const totalHours = plans.reduce((s, p) => s + (Number(p.planned_hours) || 0), 0)
  const totalKm = plans.reduce((s, p) => s + (Number(p.planned_km) || 0), 0)

  return (
    <section className="mb-6"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{
          background: 'none',
          border: 'none',
          borderBottom: open ? '1px solid #1E1E22' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}>
        <div className="flex items-center gap-3">
          <span style={{ width: '12px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2',
            fontSize: '18px',
            letterSpacing: '0.06em',
          }}>
            Planlagt volum per måned
          </span>
          <span className="text-[11px] tracking-wider uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {totalHours > 0 || totalKm > 0
              ? `${totalHours.toFixed(0)} t · ${totalKm.toFixed(0)} km`
              : 'ikke satt'}
          </span>
        </div>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#8A8A96',
          fontSize: '12px',
        }}>
          {open ? '▾ Skjul' : '▸ Vis'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {months.map(({ year, month }) => {
            const existing = byKey.get(`${year}-${month}`) ?? null
            return (
              <MonthlyVolumeInput
                key={`${year}-${month}`}
                userId={userId}
                seasonId={seasonId}
                year={year}
                month={month}
                initialHours={existing?.planned_hours ?? null}
                initialKm={existing?.planned_km ?? null}
                initialNotes={existing?.notes ?? null}
              />
            )
          })}
          <p className="mt-3 text-[11px]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Endringer lagres automatisk.
          </p>
        </div>
      )}
    </section>
  )
}
