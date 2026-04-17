'use client'

import { MovementRow } from '@/lib/types'

interface MovementTableProps {
  rows: MovementRow[]
  onChange: (rows: MovementRow[]) => void
  availableMovements?: string[]
}

export function MovementTable({ rows, onChange, availableMovements = [] }: MovementTableProps) {
  const update = (index: number, field: keyof MovementRow, value: string) => {
    const next = rows.map((r, i) => i === index ? { ...r, [field]: value } : r)
    onChange(next)
  }

  const addRow = () => {
    onChange([...rows, { id: crypto.randomUUID(), movement_name: '', minutes: '', distance_km: '', elevation_meters: '' }])
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index))
  }

  const totalMin = rows.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0)
  const totalKm  = rows.reduce((s, r) => s + (parseFloat(r.distance_km) || 0), 0)
  const totalElev = rows.reduce((s, r) => s + (parseInt(r.elevation_meters) || 0), 0)

  const cell = 'px-2 py-1.5 text-sm'
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
            {['Bevegelsesform', 'Min', 'Km', 'Hm', ''].map((h) => (
              <th
                key={h}
                className="py-2 px-2 text-left text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              style={{ borderBottom: '1px solid #1A1A1E' }}
              className="group"
            >
              <td className={cell} style={{ minWidth: '160px' }}>
                {availableMovements.length > 0 ? (
                  <select
                    value={row.movement_name}
                    onChange={(e) => update(i, 'movement_name', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Velg bevegelsesform</option>
                    {availableMovements.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="__custom__">Annet...</option>
                  </select>
                ) : (
                  <input
                    value={row.movement_name}
                    onChange={(e) => update(i, 'movement_name', e.target.value)}
                    placeholder="Bevegelsesform"
                    style={inputStyle}
                  />
                )}
              </td>
              <td className={cell} style={{ width: '70px' }}>
                <input
                  type="number"
                  value={row.minutes}
                  onChange={(e) => update(i, 'minutes', e.target.value)}
                  placeholder="—"
                  min="0"
                  style={inputStyle}
                />
              </td>
              <td className={cell} style={{ width: '70px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={row.distance_km}
                  onChange={(e) => update(i, 'distance_km', e.target.value)}
                  placeholder="—"
                  min="0"
                  style={inputStyle}
                />
              </td>
              <td className={cell} style={{ width: '70px' }}>
                <input
                  type="number"
                  value={row.elevation_meters}
                  onChange={(e) => update(i, 'elevation_meters', e.target.value)}
                  placeholder="—"
                  min="0"
                  style={inputStyle}
                />
              </td>
              <td className={cell} style={{ width: '32px' }}>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '1px solid #222228' }}>
              <td className="px-2 py-1.5 text-xs tracking-widest uppercase" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
                TOTALT
              </td>
              <td className="px-2 py-1.5 text-sm font-semibold" style={{ color: '#FF4500', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalMin > 0 ? totalMin : '—'}
              </td>
              <td className="px-2 py-1.5 text-sm" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalKm > 0 ? totalKm.toFixed(1) : '—'}
              </td>
              <td className="px-2 py-1.5 text-sm" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalElev > 0 ? totalElev : '—'}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#FF4500',
          background: 'none',
          border: '1px solid rgba(255,69,0,0.3)',
          padding: '6px 12px',
          cursor: 'pointer',
        }}
      >
        + Legg til bevegelsesform
      </button>
    </div>
  )
}
