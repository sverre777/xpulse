'use client'

import { useState } from 'react'

export type PresetKey = '7d' | '30d' | '3m' | '6m' | '12m' | 'custom'

export interface DateRange {
  from: string   // 'YYYY-MM-DD'
  to: string
  preset: PresetKey
}

const PRESETS: { key: PresetKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 dager',   days: 7 },
  { key: '30d', label: '30 dager',  days: 30 },
  { key: '3m',  label: '3 mnd',     days: 90 },
  { key: '6m',  label: '6 mnd',     days: 180 },
  { key: '12m', label: '12 mnd',    days: 365 },
]

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function rangeFromPreset(preset: PresetKey, today: Date = new Date()): DateRange {
  const p = PRESETS.find(x => x.key === preset)
  const days = p?.days ?? 30
  const to = new Date(today)
  const from = new Date(today)
  from.setDate(today.getDate() - days + 1)
  return { from: formatDate(from), to: formatDate(to), preset }
}

export function DateRangePicker({
  value, onChange,
}: {
  value: DateRange
  onChange: (r: DateRange) => void
}) {
  const [customFrom, setCustomFrom] = useState(value.from)
  const [customTo, setCustomTo] = useState(value.to)

  const applyPreset = (key: PresetKey) => {
    const r = rangeFromPreset(key)
    setCustomFrom(r.from)
    setCustomTo(r.to)
    onChange(r)
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) return
    onChange({ from: customFrom, to: customTo, preset: 'custom' })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <button
          key={p.key}
          type="button"
          onClick={() => applyPreset(p.key)}
          className="px-3 py-1.5 text-xs tracking-widest uppercase transition-colors"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: value.preset === p.key ? '#FF4500' : '#16161A',
            border: value.preset === p.key ? '1px solid #FF4500' : '1px solid #1E1E22',
            color: value.preset === p.key ? '#FFFFFF' : '#F0F0F2',
          }}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={customFrom}
          onChange={e => setCustomFrom(e.target.value)}
          onBlur={applyCustom}
          className="px-2 py-1 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#0A0A0B',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
            colorScheme: 'dark',
          }}
        />
        <span style={{ color: '#555560' }}>–</span>
        <input
          type="date"
          value={customTo}
          onChange={e => setCustomTo(e.target.value)}
          onBlur={applyCustom}
          className="px-2 py-1 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#0A0A0B',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
            colorScheme: 'dark',
          }}
        />
      </div>
    </div>
  )
}
