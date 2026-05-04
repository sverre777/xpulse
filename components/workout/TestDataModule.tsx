'use client'

import type { Sport, TestData } from '@/lib/types'
import { SPORTS } from '@/lib/types'
import {
  TestPRInputForm, deriveTestType, type TestPRFormValue,
} from '@/components/test-pr/TestPRInputForm'

interface Props {
  data: TestData
  onChange: (data: TestData) => void
  mode: 'plan' | 'dagbok'
  // Sport for selve workout-raden (egen fra TestData.sport som er
  // test-kategori). Bruker kan endre primær-sport for denne testen —
  // f.eks. langrenn-utøver tester sykkelpace. Default = workoutets sport.
  // Skjules når undefined (f.eks. i mal-bygging).
  workoutSport?: Sport
  onWorkoutSportChange?: (sport: Sport) => void
}

const sportSelectStyle: React.CSSProperties = {
  backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', outline: 'none',
}

// Tynn adapter mellom WorkoutFormData.test_data og det felles
// TestPRInputForm-skjemaet. WorkoutForm bruker fortsatt TestData-shapen
// for serialisering til workout_test_data, men UI-en deles med
// manuell-modal i Analyse via TestPRInputForm.
export function TestDataModule({ data, onChange, mode, workoutSport, onWorkoutSportChange }: Props) {
  const formValue: TestPRFormValue = {
    sport: data.sport,
    subcategory: data.subcategory,
    custom_label: data.custom_label,
    value: data.primary_result,
    unit: data.primary_unit,
    notes: data.protocol_notes,
    achieved_at: '',
    equipment: data.equipment,
    conditions: data.conditions,
  }

  const onFormChange = (next: TestPRFormValue) => {
    const merged: TestData = {
      ...data,
      sport: next.sport,
      subcategory: next.subcategory,
      custom_label: next.custom_label,
      primary_result: next.value,
      primary_unit: next.unit,
      protocol_notes: next.notes,
      equipment: next.equipment,
      conditions: next.conditions,
      test_type: deriveTestType(next),
    }
    onChange(merged)
  }

  return (
    <div>
      {onWorkoutSportChange && workoutSport && (
        <div className="p-4 mb-3"
          style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <div className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Sport for denne testen
          </div>
          <select value={workoutSport}
            onChange={e => onWorkoutSportChange(e.target.value as Sport)}
            style={sportSelectStyle} className="w-full px-3 py-2">
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}
      <TestPRInputForm
        value={formValue}
        onChange={onFormChange}
        mode="workout"
        showEquipmentConditions
        title={`Test-protokoll ${mode === 'plan' ? '— Plan' : '— Resultat'}`}
      />
    </div>
  )
}
