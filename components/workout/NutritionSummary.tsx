import { NUTRITION_TYPES, type NutritionEntryRow } from '@/lib/types'
import { nutritionTotals } from '@/lib/nutrition-totals'

// Read-only-visning av ernæring per økt. Brukes i dagbok/dag-detalj-modal
// og workouts-historikk.

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  NUTRITION_TYPES.map(t => [t.value, t.label])
)

interface Props {
  entries: NutritionEntryRow[]
  durationMinutes: number | null
}

export function NutritionSummary({ entries, durationMinutes }: Props) {
  if (entries.length === 0) return null

  const totals = nutritionTotals(entries, durationMinutes)
  const sorted = [...entries].sort((a, b) => {
    const ax = a.time_offset_minutes === '' ? Infinity : Number(a.time_offset_minutes)
    const bx = b.time_offset_minutes === '' ? Infinity : Number(b.time_offset_minutes)
    return ax - bx
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Ernæring · {entries.length} {entries.length === 1 ? 'rad' : 'rader'}
        </span>
      </div>

      <ul className="list-none p-0 space-y-1">
        {sorted.map(e => {
          const label = e.nutrition_type === 'egendefinert' && e.custom_label
            ? e.custom_label
            : TYPE_LABELS[e.nutrition_type] ?? e.nutrition_type
          const time = e.time_offset_minutes
            ? `${e.time_offset_minutes} min`
            : '—'
          const macros: string[] = []
          if (e.carbs_g) macros.push(`${e.carbs_g} g karbo`)
          if (e.protein_g) macros.push(`${e.protein_g} g prot`)
          if (e.ketones_g) macros.push(`${e.ketones_g} g ket`)
          return (
            <li key={e.id}
              className="flex items-baseline gap-3 px-2 py-1"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                color: 'rgba(242,240,236,0.7)',
                background: '#0F0F14', border: '1px solid #1A1A1E',
              }}>
              <span style={{ color: '#FF4500', minWidth: 50 }}>{time}</span>
              <span style={{ color: '#F0F0F2', minWidth: 90 }}>{label}</span>
              <span style={{ color: 'rgba(242,240,236,0.55)' }}>{macros.join(' · ')}</span>
              {e.notes && (
                <span style={{ color: '#555560', fontStyle: 'italic', marginLeft: 'auto' }}>
                  — {e.notes}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <div className="px-3 py-2 flex flex-wrap gap-x-6 gap-y-1"
        style={{
          background: '#0F0F14', border: '1px solid #1E1E22',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
          color: 'rgba(242,240,236,0.75)',
        }}>
        <strong style={{ color: '#F0F0F2' }}>Total</strong>
        {totals.carbs_g !== null && <span>{totals.carbs_g} g karbo</span>}
        {totals.protein_g !== null && <span>{totals.protein_g} g prot</span>}
        {totals.ketones_g !== null && <span>{totals.ketones_g} g ket</span>}
        {totals.carbs_per_hour !== null && (
          <span style={{ color: '#FF4500' }}>≈ {totals.carbs_per_hour} g karbo/time</span>
        )}
      </div>
    </div>
  )
}
