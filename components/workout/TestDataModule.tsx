'use client'

import type { TestData } from '@/lib/types'
import {
  TestPRInputForm, deriveTestType, type TestPRFormValue,
} from '@/components/test-pr/TestPRInputForm'

interface Props {
  data: TestData
  onChange: (data: TestData) => void
  mode: 'plan' | 'dagbok'
}

// Tynn adapter mellom WorkoutFormData.test_data og det felles
// TestPRInputForm-skjemaet. WorkoutForm bruker fortsatt TestData-shapen
// for serialisering til workout_test_data, men UI-en deles med
// manuell-modal i Analyse via TestPRInputForm.
export function TestDataModule({ data, onChange, mode }: Props) {
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
    <TestPRInputForm
      value={formValue}
      onChange={onFormChange}
      mode="workout"
      showEquipmentConditions
      title={`Test-protokoll ${mode === 'plan' ? '— Plan' : '— Resultat'}`}
    />
  )
}
