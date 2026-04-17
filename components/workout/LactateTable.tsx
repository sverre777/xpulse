'use client'

import { LactateRow } from '@/lib/types'

interface LactateTableProps {
  rows: LactateRow[]
  onChange: (rows: LactateRow[]) => void
}

export function LactateTable({ rows, onChange }: LactateTableProps) {
  const update = (i: number, field: keyof LactateRow, value: string | number | null) => {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const addRow = () => {
    onChange([...rows, { id: crypto.randomUUID(), measured_at_time: '', mmol: '', heart_rate: '', feeling: null }])
  }

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const iSt: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', width: '100%', padding: 0,
  }

  if (rows.length === 0) {
    return (
      <button type="button" onClick={addRow}
        className="text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
          background: 'none', border: '1px solid rgba(255,69,0,0.3)',
          padding: '6px 12px', cursor: 'pointer',
        }}>
        + Legg til laktatmåling
      </button>
    )
  }

  return (
    <div>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            {['Tidspunkt', 'mmol/L', 'Puls', 'Følelse', ''].map(h => (
              <th key={h} className="py-2 px-2 text-left text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="group" style={{ borderBottom: '1px solid #1A1A1E' }}>
              <td className="px-2 py-1.5 w-24">
                <input type="time" value={row.measured_at_time}
                  onChange={e => update(i, 'measured_at_time', e.target.value)}
                  style={iSt} />
              </td>
              <td className="px-2 py-1.5 w-20">
                <input type="number" step="0.1" min="0" max="20" value={row.mmol}
                  onChange={e => update(i, 'mmol', e.target.value)}
                  placeholder="—" style={{ ...iSt, fontWeight: 600, color: '#FF8C00' }} />
              </td>
              <td className="px-2 py-1.5 w-16">
                <input type="number" value={row.heart_rate}
                  onChange={e => update(i, 'heart_rate', e.target.value)}
                  placeholder="—" style={iSt} />
              </td>
              <td className="px-2 py-1.5 w-24">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button"
                      onClick={() => update(i, 'feeling', row.feeling === n ? null : n)}
                      style={{
                        fontSize: '14px', color: (row.feeling ?? 0) >= n ? '#FF4500' : '#2A2A30',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '1px', lineHeight: 1,
                      }}>★</button>
                  ))}
                </div>
              </td>
              <td className="px-2 py-1.5 w-8">
                <button type="button" onClick={() => removeRow(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={addRow}
        className="mt-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
          background: 'none', border: '1px solid rgba(255,69,0,0.3)',
          padding: '6px 12px', cursor: 'pointer',
        }}>
        + Legg til måling
      </button>
    </div>
  )
}
