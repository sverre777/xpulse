'use client'

import { useState } from 'react'
import { PRESETS, rangeFromPreset, type DateRange, type PresetKey } from './date-range'

// Re-eksporter for bakoverkompatibilitet — andre moduler importerer fortsatt
// rangeFromPreset/DateRange fra denne filen. Nye server-imports bør gå
// direkte mot './date-range'.
export { rangeFromPreset }
export type { DateRange, PresetKey }

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
            backgroundColor: value.preset === p.key ? '#FF4500' : '#1A1A22',
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
