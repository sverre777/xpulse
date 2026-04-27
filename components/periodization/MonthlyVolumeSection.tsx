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
  userId, seasonId, startDate, endDate, plans, canEdit = true, targetUserId,
}: {
  userId: string
  seasonId: string | null
  startDate: string
  endDate: string
  plans: MonthlyVolumePlan[]
  canEdit?: boolean
  targetUserId?: string
}) {
  void targetUserId
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
          <span className="text-xs tracking-wider uppercase"
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
          {!canEdit && (
            <p className="text-xs pt-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Read-only — ingen redigeringsrett.
            </p>
          )}
          {canEdit && months.map(({ year, month }) => {
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
          {!canEdit && months.map(({ year, month }) => {
            const existing = byKey.get(`${year}-${month}`) ?? null
            const hasData = existing?.planned_hours != null || existing?.planned_km != null || existing?.notes
            return (
              <div key={`ro-${year}-${month}`} className="py-2 text-xs"
                style={{ borderTop: '1px solid #1A1A1E', fontFamily: "'Barlow Condensed', sans-serif", color: hasData ? '#C0C0CC' : '#3A3A44' }}>
                <span style={{ color: '#8A8A96', marginRight: 8 }}>{month}/{year}:</span>
                {existing?.planned_hours != null && <span>{existing.planned_hours} t · </span>}
                {existing?.planned_km != null && <span>{existing.planned_km} km</span>}
                {existing?.notes && <span> · {existing.notes}</span>}
                {!hasData && <span>—</span>}
              </div>
            )
          })}
          {canEdit && (
            <p className="mt-3 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Endringer lagres automatisk.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
