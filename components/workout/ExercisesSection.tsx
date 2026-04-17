'use client'

import { ExerciseRow } from '@/lib/types'

interface ExercisesSectionProps {
  rows: ExerciseRow[]
  strengthType: string
  onChange: (rows: ExerciseRow[]) => void
  onStrengthTypeChange: (type: string) => void
}

const STRENGTH_TYPES = [
  { value: 'max',       label: 'Maksstyrke' },
  { value: 'explosive', label: 'Eksplosiv' },
  { value: 'base',      label: 'Basistyrke' },
]

export function ExercisesSection({ rows, strengthType, onChange, onStrengthTypeChange }: ExercisesSectionProps) {
  const update = (index: number, field: keyof ExerciseRow, value: string) => {
    onChange(rows.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const addRow = () => {
    onChange([...rows, { id: crypto.randomUUID(), exercise_name: '', sets: '', reps: '', weight_kg: '' }])
  }

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i))
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
      {/* Strength type */}
      <div className="flex gap-2 mb-4">
        {STRENGTH_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => onStrengthTypeChange(t.value)}
            className="px-3 py-1.5 text-sm tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: strengthType === t.value ? '#FF4500' : 'transparent',
              color: strengthType === t.value ? '#F0F0F2' : '#555560',
              border: `1px solid ${strengthType === t.value ? '#FF4500' : '#222228'}`,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            {['Øvelse', 'Sett', 'Reps', 'Vekt (kg)', ''].map(h => (
              <th key={h} className="py-2 px-2 text-left text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #1A1A1E' }} className="group">
              <td className="px-2 py-1.5" style={{ minWidth: '140px' }}>
                <input value={row.exercise_name} onChange={e => update(i, 'exercise_name', e.target.value)}
                  placeholder="Øvelsesnavn" style={inputStyle} />
              </td>
              <td className="px-2 py-1.5 w-16">
                <input type="number" value={row.sets} onChange={e => update(i, 'sets', e.target.value)}
                  placeholder="—" min="0" style={inputStyle} />
              </td>
              <td className="px-2 py-1.5 w-16">
                <input type="number" value={row.reps} onChange={e => update(i, 'reps', e.target.value)}
                  placeholder="—" min="0" style={inputStyle} />
              </td>
              <td className="px-2 py-1.5 w-20">
                <input type="number" step="0.5" value={row.weight_kg} onChange={e => update(i, 'weight_kg', e.target.value)}
                  placeholder="—" min="0" style={inputStyle} />
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
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#FF4500',
          background: 'none',
          border: '1px solid rgba(255,69,0,0.3)',
          padding: '6px 12px',
          cursor: 'pointer',
        }}>
        + Legg til øvelse
      </button>
    </div>
  )
}
