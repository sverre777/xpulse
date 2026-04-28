'use client'

import {
  NUTRITION_TYPES, type NutritionEntryRow, type NutritionType,
  emptyNutritionEntryRow,
} from '@/lib/types'
import { nutritionTotals } from '@/lib/nutrition-totals'

// Form-seksjon for ernæring per økt. Brukes inni WorkoutForm når brukeren
// vil legge inn gel/drikke/bar etc. underveis i økten.
//
// State er kontrollert av forelderen — vi tar inn entries + onChange og
// rendrer en liste med rad-input og en "+ Legg til"-knapp. Standardstil
// matcher resten av WorkoutForm (mørk bakgrunn, oransje aksent).

interface Props {
  entries: NutritionEntryRow[]
  onChange: (next: NutritionEntryRow[]) => void
  // For karbo/time-beregning. Kan være null hvis varighet ikke er logget enda.
  durationMinutes: number | null
  readOnly?: boolean
}

export function NutritionSection({
  entries, onChange, durationMinutes, readOnly = false,
}: Props) {
  const update = (id: string, patch: Partial<NutritionEntryRow>) => {
    onChange(entries.map(e => e.id === id ? { ...e, ...patch } : e))
  }
  const remove = (id: string) => {
    onChange(entries.filter(e => e.id !== id))
  }
  const add = () => {
    onChange([...entries, emptyNutritionEntryRow()])
  }

  const totals = nutritionTotals(entries, durationMinutes)
  const showTotals = totals.entry_count > 0 && (
    totals.carbs_g !== null || totals.protein_g !== null || totals.ketones_g !== null
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        <h3 className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Ernæring
        </h3>
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {entries.length === 0 ? '— ingen rader' : `${entries.length} ${entries.length === 1 ? 'rad' : 'rader'}`}
        </span>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(e => (
            <NutritionRow
              key={e.id}
              entry={e}
              onChange={p => update(e.id, p)}
              onRemove={() => remove(e.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <button type="button" onClick={add}
          style={{
            background: 'none', border: '1px dashed #2A2A30', color: '#FF4500',
            padding: '10px 16px', cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
            width: '100%',
          }}>
          + Legg til ernæring
        </button>
      )}

      {showTotals && (
        <div className="p-3 flex flex-wrap gap-x-6 gap-y-1"
          style={{
            background: '#0F0F14', border: '1px solid #1E1E22',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'rgba(242,240,236,0.7)',
          }}>
          {totals.carbs_g !== null && (
            <span><span style={{ color: '#555560' }}>Karbo: </span>{totals.carbs_g} g</span>
          )}
          {totals.protein_g !== null && (
            <span><span style={{ color: '#555560' }}>Protein: </span>{totals.protein_g} g</span>
          )}
          {totals.fat_g !== null && (
            <span><span style={{ color: '#555560' }}>Fett: </span>{totals.fat_g} g</span>
          )}
          {totals.ketones_g !== null && (
            <span><span style={{ color: '#555560' }}>Ketoner: </span>{totals.ketones_g} g</span>
          )}
          {totals.carbs_per_hour !== null && (
            <span style={{ color: '#FF4500' }}>≈ {totals.carbs_per_hour} g karbo/time</span>
          )}
        </div>
      )}
    </div>
  )
}

function NutritionRow({
  entry, onChange, onRemove, readOnly,
}: {
  entry: NutritionEntryRow
  onChange: (patch: Partial<NutritionEntryRow>) => void
  onRemove: () => void
  readOnly: boolean
}) {
  return (
    <div className="grid gap-2"
      style={{
        gridTemplateColumns: 'minmax(0, 70px) minmax(0, 1fr) minmax(0, 80px) minmax(0, 80px) minmax(0, 80px) minmax(0, 90px) auto',
        background: '#13131A', border: '1px solid #1E1E22', padding: 8,
      }}>
      <input
        type="number" min="0" inputMode="numeric"
        placeholder="min"
        value={entry.time_offset_minutes}
        onChange={e => onChange({ time_offset_minutes: e.target.value })}
        disabled={readOnly}
        title="Minutter inn i økten"
        style={inputStyle}
      />
      <select
        value={entry.nutrition_type}
        onChange={e => onChange({ nutrition_type: e.target.value as NutritionType })}
        disabled={readOnly}
        style={inputStyle}>
        <option value="">Type …</option>
        {NUTRITION_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        type="text" inputMode="decimal"
        placeholder="g karbo"
        value={entry.carbs_g}
        onChange={e => onChange({ carbs_g: e.target.value })}
        disabled={readOnly}
        style={inputStyle}
      />
      <input
        type="text" inputMode="decimal"
        placeholder="g protein"
        value={entry.protein_g}
        onChange={e => onChange({ protein_g: e.target.value })}
        disabled={readOnly}
        style={inputStyle}
      />
      <input
        type="text" inputMode="decimal"
        placeholder="g fett"
        value={entry.fat_g}
        onChange={e => onChange({ fat_g: e.target.value })}
        disabled={readOnly}
        style={inputStyle}
      />
      <input
        type="text" inputMode="decimal"
        placeholder="g ketoner"
        value={entry.ketones_g}
        onChange={e => onChange({ ketones_g: e.target.value })}
        disabled={readOnly}
        style={inputStyle}
      />
      {!readOnly && (
        <button type="button" onClick={onRemove}
          aria-label="Fjern rad"
          style={{
            background: 'none', border: 'none', color: '#555560',
            cursor: 'pointer', fontSize: 18, padding: '0 6px',
          }}>×</button>
      )}
      {entry.nutrition_type === 'egendefinert' && (
        <input
          type="text"
          placeholder="Beskrivelse"
          value={entry.custom_label}
          onChange={e => onChange({ custom_label: e.target.value })}
          disabled={readOnly}
          style={{ ...inputStyle, gridColumn: '1 / -1' }}
        />
      )}
      {entry.notes && !readOnly && (
        <input
          type="text"
          placeholder="Notat"
          value={entry.notes}
          onChange={e => onChange({ notes: e.target.value })}
          disabled={readOnly}
          style={{ ...inputStyle, gridColumn: '1 / -1' }}
        />
      )}
      {!entry.notes && !readOnly && (
        <button type="button" onClick={() => onChange({ notes: ' ' })}
          style={{
            background: 'none', border: 'none', color: '#555560',
            cursor: 'pointer', fontSize: 11, gridColumn: '1 / -1',
            textAlign: 'left', padding: '2px 0',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
          + Legg til notat
        </button>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0F0F14', border: '1px solid #1E1E22',
  color: '#F0F0F2', padding: '6px 8px', fontSize: 13,
  fontFamily: "'Barlow', sans-serif", outline: 'none',
  minWidth: 0,
}
