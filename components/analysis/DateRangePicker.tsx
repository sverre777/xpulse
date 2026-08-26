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
            backgroundColor: value.preset === p.key ? '#FF4500' : 'var(--flate-14)',
            border: value.preset === p.key ? '1px solid #FF4500' : '1px solid var(--kant-3)',
            color: value.preset === p.key ? 'var(--tekst-1-ren)' : 'var(--tekst-1-app)',
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
            backgroundColor: 'var(--flate-3)',
            border: '1px solid var(--kant-3)',
            color: 'var(--tekst-1-app)',
            colorScheme: 'dark',
          }}
        />
        <span style={{ color: 'var(--tekst-8-app)' }}>–</span>
        <input
          type="date"
          value={customTo}
          onChange={e => setCustomTo(e.target.value)}
          onBlur={applyCustom}
          className="px-2 py-1 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'var(--flate-3)',
            border: '1px solid var(--kant-3)',
            color: 'var(--tekst-1-app)',
            colorScheme: 'dark',
          }}
        />
      </div>
    </div>
  )
}
