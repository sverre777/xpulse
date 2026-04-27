'use client'

import { useState, useTransition } from 'react'
import {
  getCoachAthleteExport,
  type ExportPeriod,
  type ExportRow,
} from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

const PERIOD_OPTIONS: { value: ExportPeriod; label: string }[] = [
  { value: '30', label: 'Siste 30 dager' },
  { value: '90', label: 'Siste 90 dager' },
  { value: '365', label: 'Siste 12 måneder' },
]

function rowsToCsv(rows: ExportRow[], periodDays: number): string {
  const header = [
    'Navn',
    'E-post',
    `Økter (${periodDays}d)`,
    'Minutter',
    'Km',
    'Konkurranser',
    'Tester/PR',
  ]
  const lines = [header.join(';')]
  for (const r of rows) {
    const fields = [
      r.athleteName,
      r.athleteEmail ?? '',
      String(r.totalSessions),
      String(Math.round(r.totalMinutes)),
      r.totalKm.toFixed(1),
      String(r.competitions),
      String(r.tests),
    ]
    lines.push(fields.map(escapeCsv).join(';'))
  }
  return lines.join('\n')
}

function escapeCsv(v: string): string {
  if (v.includes(';') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export function EksportUtoverDataSection() {
  const [period, setPeriod] = useState<ExportPeriod>('30')
  const [error, setError] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDownload = () => {
    setError(null)
    setRowCount(null)
    startTransition(async () => {
      const res = await getCoachAthleteExport(period)
      if ('error' in res) { setError(res.error); return }
      const csv = rowsToCsv(res.rows, res.periodDays)
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xpulse-utovere-${period}d-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setRowCount(res.rows.length)
    })
  }

  return (
    <section
      className="p-5"
      style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}
    >
      <p className="text-sm mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Last ned aggregert CSV med trening, konkurranser og tester per utøver.
        Inkluderer alle aktive koblinger.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        {PERIOD_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className="flex items-center gap-3 px-3 py-2"
            style={{
              cursor: isPending ? 'not-allowed' : 'pointer',
              border: '1px solid #1E1E22',
              backgroundColor: period === opt.value ? 'rgba(26,111,212,0.1)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="period"
              value={opt.value}
              checked={period === opt.value}
              disabled={isPending}
              onChange={() => setPeriod(opt.value)}
              style={{ accentColor: COACH_BLUE }}
            />
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: COACH_BLUE, color: '#F0F0F2',
          border: 'none', cursor: 'pointer',
        }}
      >
        {isPending ? 'Genererer…' : 'Last ned CSV'}
      </button>

      {error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
      {rowCount !== null && !error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
          Eksporterte {rowCount} {rowCount === 1 ? 'utøver' : 'utøvere'}.
        </p>
      )}
    </section>
  )
}
