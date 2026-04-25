'use client'

import { useState } from 'react'
import type { SplitRow } from '@/lib/types'
import { parseActivityDuration } from '@/lib/activity-duration'
import { formatPace, type PaceUnit } from '@/lib/pace-utils'

// Kollapsbar split-tabell — én rad per km. Lagres som SplitRow[] der km/duration
// holdes som strings for input-binding. Pace-visningen i hver rad utledes fra
// duration (sekunder for *denne* km'en) og enhet.

interface Props {
  splits: SplitRow[]
  onChange: (next: SplitRow[]) => void
  unit: PaceUnit
}

export function SplitsTable({ splits, onChange, unit }: Props) {
  const [open, setOpen] = useState<boolean>(splits.length > 0)

  const addRow = () => {
    // Auto-nummer: neste km basert på siste eksisterende verdi, ellers 1.
    const last = splits[splits.length - 1]
    const nextKm = last ? (parseInt(last.km) || splits.length) + 1 : 1
    const next: SplitRow = {
      id: crypto.randomUUID(),
      km: String(nextKm),
      duration: '',
    }
    onChange([...splits, next])
    setOpen(true)
  }

  const removeRow = (id: string) => {
    onChange(splits.filter(s => s.id !== id))
  }

  const updateRow = (id: string, patch: Partial<SplitRow>) => {
    onChange(splits.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#8A8A96',
          background: 'none',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
        }}>
        {open ? '▾' : '▸'} Splits per km {splits.length > 0 ? `(${splits.length})` : ''}
      </button>

      {open && (
        <div className="mt-2">
          {splits.length === 0 ? (
            <p className="text-xs mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Ingen splits ført ennå.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid items-center gap-2"
                style={{ gridTemplateColumns: '60px 1fr 1fr 32px' }}>
                <Header>Km</Header>
                <Header>Tid (MM:SS)</Header>
                <Header>Pace</Header>
                <span />
              </div>

              {splits.map(s => {
                const sec = parseActivityDuration(s.duration)
                return (
                  <div key={s.id}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: '60px 1fr 1fr 32px' }}>
                    <input value={s.km}
                      onChange={e => updateRow(s.id, { km: e.target.value })}
                      inputMode="numeric"
                      style={inputStyle} />
                    <input value={s.duration}
                      onChange={e => updateRow(s.id, { duration: e.target.value })}
                      placeholder="4:30"
                      style={inputStyle} />
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: sec ? '#F0F0F2' : '#555560',
                      fontSize: '13px',
                    }}>
                      {sec ? formatPace(sec, unit) : '—'}
                    </span>
                    <button type="button"
                      onClick={() => removeRow(s.id)}
                      aria-label="Fjern split"
                      style={{
                        background: 'none', border: 'none',
                        color: '#555560', fontSize: '18px',
                        cursor: 'pointer', lineHeight: 1,
                      }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={addRow}
            className="mt-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#FF4500',
              background: 'none',
              border: '1px dashed #FF4500',
              padding: '6px 12px',
              cursor: 'pointer',
            }}>
            + Legg til km
          </button>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0F0F11',
  border: '1px solid #262629',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '13px',
  padding: '6px 8px',
  outline: 'none',
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </span>
  )
}

// Re-exporter fra pace-utils slik at gamle imports fortsatt fungerer.
export { serializeSplits, deserializeSplits } from '@/lib/pace-utils'
