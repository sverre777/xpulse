'use client'

import { useRef, useState, useTransition } from 'react'
import { upsertMonthlyVolumePlan } from '@/app/actions/volume-plans'

const MONTHS_NO = [
  'Januar','Februar','Mars','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Desember',
] as const

export interface MonthlyVolumeInputProps {
  userId: string
  seasonId: string | null
  year: number
  month: number // 1-12
  initialHours: number | null
  initialKm: number | null
  initialNotes: string | null
}

export function MonthlyVolumeInput({
  userId, seasonId, year, month,
  initialHours, initialKm, initialNotes,
}: MonthlyVolumeInputProps) {
  const [hours, setHours] = useState(initialHours != null ? String(initialHours) : '')
  const [km, setKm] = useState(initialKm != null ? String(initialKm) : '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const saveTimer = useRef<number | null>(null)

  const doSave = () => {
    startTransition(async () => {
      const res = await upsertMonthlyVolumePlan(userId, year, month, {
        season_id: seasonId,
        planned_hours: hours,
        planned_km: km,
        notes,
      })
      if (res.error) {
        setErr(res.error)
        setSaved(false)
      } else {
        setErr(null)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1200)
      }
    })
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(doSave, 600)
  }

  const iSt: React.CSSProperties = {
    backgroundColor: '#1A1A22',
    border: '1px solid #1E1E22',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '13px',
    padding: '4px 8px',
    width: '100%',
  }

  const labelSt: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    color: '#8A8A96',
    fontSize: '13px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '2px',
    display: 'block',
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2"
      style={{ borderTop: '1px solid #1A1A1E' }}>
      <div className="col-span-12 md:col-span-2 flex items-center">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '15px',
          letterSpacing: '0.04em',
        }}>
          {MONTHS_NO[month - 1]} {year}
        </span>
      </div>
      <div className="col-span-4 md:col-span-2">
        <label style={labelSt}>Timer</label>
        <input
          value={hours}
          onChange={e => { setHours(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="—"
          inputMode="decimal"
          style={iSt} />
      </div>
      <div className="col-span-4 md:col-span-2">
        <label style={labelSt}>Km</label>
        <input
          value={km}
          onChange={e => { setKm(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="—"
          inputMode="decimal"
          style={iSt} />
      </div>
      <div className="col-span-12 md:col-span-5">
        <label style={labelSt}>Notat</label>
        <input
          value={notes}
          onChange={e => { setNotes(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="Valgfritt"
          style={iSt} />
      </div>
      <div className="col-span-4 md:col-span-1 flex items-end h-full">
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '13px',
          color: err ? '#E11D48' : saved ? '#28A86E' : '#555560',
        }}>
          {err ? 'Feil' : saved ? 'Lagret' : isPending ? '…' : ''}
        </span>
      </div>
      {err && (
        <div className="col-span-12 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {err}
        </div>
      )}
    </div>
  )
}
