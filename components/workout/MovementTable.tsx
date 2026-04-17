'use client'

import { useState } from 'react'
import { MovementRow, MOVEMENT_CATEGORIES, getSubcategories } from '@/lib/types'

interface MovementTableProps {
  rows: MovementRow[]
  onChange: (rows: MovementRow[]) => void
  defaultMovements?: string[]
}

export function MovementTable({ rows, onChange, defaultMovements = [] }: MovementTableProps) {
  const [customInput, setCustomInput] = useState('')
  const allCategories = MOVEMENT_CATEGORIES.map(m => m.name)

  const update = (i: number, field: keyof MovementRow, value: string) => {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const addRow = (name?: string) => {
    onChange([...rows, { id: crypto.randomUUID(), movement_name: name ?? '', minutes: '', distance_km: '', elevation_meters: '' }])
  }

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const parseDisplayName = (name: string): { parent: string; sub: string } => {
    if (name.includes(' — ')) {
      const [p, s] = name.split(' — ')
      return { parent: p, sub: s }
    }
    return { parent: name, sub: '' }
  }

  const buildName = (parent: string, sub: string) => sub ? `${parent} — ${sub}` : parent

  const iSt: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', width: '100%', padding: 0,
  }
  const selSt: React.CSSProperties = { ...iSt, cursor: 'pointer' }

  const totalMin  = rows.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0)
  const totalKm   = rows.reduce((s, r) => s + (parseFloat(r.distance_km) || 0), 0)
  const totalElev = rows.reduce((s, r) => s + (parseInt(r.elevation_meters) || 0), 0)

  return (
    <div>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            {['Bevegelsesform', 'Underkategori', 'Min', 'Km', 'Hm', ''].map(h => (
              <th key={h} className="py-2 px-2 text-left text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { parent, sub } = parseDisplayName(row.movement_name)
            const subs = getSubcategories(parent)
            return (
              <tr key={row.id} className="group" style={{ borderBottom: '1px solid #1A1A1E' }}>
                {/* Parent movement */}
                <td className="px-2 py-1.5" style={{ minWidth: '120px' }}>
                  <select value={parent}
                    onChange={e => {
                      const newSubs = getSubcategories(e.target.value)
                      update(i, 'movement_name', buildName(e.target.value, newSubs.length > 0 ? newSubs[0] : ''))
                    }}
                    style={selSt}>
                    <option value="">Velg...</option>
                    {allCategories.map(m => <option key={m} value={m}>{m}</option>)}
                    {/* Custom from prev sessions */}
                    {row.movement_name && !allCategories.includes(parent) && (
                      <option value={parent}>{parent}</option>
                    )}
                  </select>
                </td>
                {/* Subcategory */}
                <td className="px-2 py-1.5" style={{ minWidth: '110px' }}>
                  {subs.length > 0 ? (
                    <select value={sub} onChange={e => update(i, 'movement_name', buildName(parent, e.target.value))}
                      style={selSt}>
                      <option value="">Alle</option>
                      {subs.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span style={{ color: '#333340', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif" }}>—</span>
                  )}
                </td>
                <td className="px-2 py-1.5" style={{ width: '60px' }}>
                  <input type="number" value={row.minutes} onChange={e => update(i, 'minutes', e.target.value)}
                    placeholder="—" min="0" style={iSt} />
                </td>
                <td className="px-2 py-1.5" style={{ width: '60px' }}>
                  <input type="number" step="0.1" value={row.distance_km} onChange={e => update(i, 'distance_km', e.target.value)}
                    placeholder="—" min="0" style={iSt} />
                </td>
                <td className="px-2 py-1.5" style={{ width: '60px' }}>
                  <input type="number" value={row.elevation_meters} onChange={e => update(i, 'elevation_meters', e.target.value)}
                    placeholder="—" min="0" style={iSt} />
                </td>
                <td className="px-2 py-1.5 w-8">
                  <button type="button" onClick={() => removeRow(i)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '1px solid #222228' }}>
              <td colSpan={2} className="px-2 py-1.5 text-xs tracking-widest uppercase"
                style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>Totalt</td>
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

      {/* Quick-add default movements */}
      <div className="mt-3 flex flex-wrap gap-2">
        {defaultMovements.filter(m => !rows.some(r => r.movement_name.startsWith(m))).map(m => (
          <button key={m} type="button" onClick={() => addRow(m)}
            className="px-2 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
              background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
            }}>
            + {m}
          </button>
        ))}
        <button type="button" onClick={() => addRow()}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
            background: 'none', border: '1px solid rgba(255,69,0,0.3)', cursor: 'pointer',
          }}>
          + Annet
        </button>
      </div>
    </div>
  )
}
