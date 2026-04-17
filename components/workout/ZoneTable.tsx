'use client'

import { useState } from 'react'
import { ZoneRow, INTENSITY_ZONES } from '@/lib/types'

interface ZoneTableProps {
  rows: ZoneRow[]
  onChange: (rows: ZoneRow[]) => void
}

export function ZoneTable({ rows, onChange }: ZoneTableProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const visibleZones = showAdvanced ? INTENSITY_ZONES : INTENSITY_ZONES.slice(0, 5)

  const update = (zone: string, value: string) => {
    const exists = rows.find(r => r.zone_name === zone)
    if (exists) {
      onChange(rows.map(r => r.zone_name === zone ? { ...r, minutes: value } : r))
    } else {
      onChange([...rows, { zone_name: zone, minutes: value }])
    }
  }

  const getValue = (zone: string) => rows.find(r => r.zone_name === zone)?.minutes ?? ''

  const totalMin = rows.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0)

  const zoneColors: Record<string, string> = {
    I1: '#2A5A8A', I2: '#1A7A4A', I3: '#8A8A10',
    I4: '#8A5A00', I5: '#8A1A00', I6: '#6A008A',
    I7: '#4A004A', I8: '#2A002A',
  }

  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '14px',
    width: '100%',
    padding: '0',
  }

  return (
    <div>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <th className="py-2 px-2 text-left text-xs tracking-widest uppercase w-20"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}>
              Sone
            </th>
            <th className="py-2 px-2 text-left text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}>
              Min
            </th>
            <th className="py-2 px-2 text-left text-xs w-32"
              style={{ color: '#2A2A30' }}>
              ░
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleZones.map((zone) => {
            const val = getValue(zone)
            const pct = totalMin > 0 ? Math.round(((parseInt(val) || 0) / totalMin) * 100) : 0
            return (
              <tr key={zone} style={{ borderBottom: '1px solid #1A1A1E' }}>
                <td className="px-2 py-1.5">
                  <span
                    className="inline-block px-2 py-0.5 text-xs font-semibold tracking-widest"
                    style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      backgroundColor: zoneColors[zone] ?? '#333',
                      color: '#F0F0F2',
                      fontSize: '13px',
                      minWidth: '32px',
                      textAlign: 'center',
                    }}
                  >
                    {zone}
                  </span>
                </td>
                <td className="px-2 py-1.5 w-20">
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => update(zone, e.target.value)}
                    placeholder="—"
                    min="0"
                    style={inputStyle}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5" style={{ backgroundColor: '#1A1A1E' }}>
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: zoneColors[zone] ?? '#555' }}
                      />
                    </div>
                    {pct > 0 && (
                      <span className="text-xs w-8 text-right" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        {totalMin > 0 && (
          <tfoot>
            <tr style={{ borderTop: '1px solid #222228' }}>
              <td className="px-2 py-1.5 text-xs tracking-widest uppercase" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
                TOTALT
              </td>
              <td className="px-2 py-1.5 text-sm font-semibold" style={{ color: '#FF4500', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalMin}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#555560',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {showAdvanced ? '– Skjul I6–I8' : '+ Vis I6–I8 (avansert)'}
      </button>
    </div>
  )
}
