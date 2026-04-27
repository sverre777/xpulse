'use client'

import type { TestPRSport } from '@/lib/types'
import { SportSubcategorySelector } from './SportSubcategorySelector'

const inputStyle: React.CSSProperties = {
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', outline: 'none', padding: '8px 10px', width: '100%',
}

const TEST_BLUE = '#1A6FD4'

// Felles dataformat for Test/PR-input. Brukes av både dagbok-skjema
// (workout_test_data) og manuell PR-modal i Analyse (personal_records).
// Felter som er irrelevante i et gitt mode-valg skjules av komponenten.
export interface TestPRFormValue {
  sport: TestPRSport | ''
  subcategory: string
  custom_label: string
  value: string          // numerisk resultat som streng (parses ved lagring)
  unit: string
  notes: string
  achieved_at: string    // YYYY-MM-DD — kun brukt i manuell-modus
  equipment: string
  conditions: string
}

export function emptyTestPRFormValue(achievedAt?: string): TestPRFormValue {
  return {
    sport: '',
    subcategory: '',
    custom_label: '',
    value: '',
    unit: '',
    notes: '',
    achieved_at: achievedAt ?? new Date().toISOString().slice(0, 10),
    equipment: '',
    conditions: '',
  }
}

interface Props {
  value: TestPRFormValue
  onChange: (next: TestPRFormValue) => void
  // 'workout' = brukes i WorkoutForm (har egen dato-kontekst),
  // 'manual'  = brukes i Analyse-modal (eget dato-felt + log-toggle).
  mode: 'workout' | 'manual'
  // Når true vises utstyr/forhold-feltene (kun aktuelt i workout-mode).
  showEquipmentConditions?: boolean
  // Tittel-merkelapp ('— Plan' / '— Resultat' / 'Ny Test/PR' osv).
  title?: string
  // Plassholder for Resultat-feltet.
  valuePlaceholder?: string
}

export function TestPRInputForm({
  value, onChange, mode, showEquipmentConditions, title, valuePlaceholder,
}: Props) {
  const set = <K extends keyof TestPRFormValue>(k: K, v: TestPRFormValue[K]) =>
    onChange({ ...value, [k]: v })

  const isManual = mode === 'manual'

  return (
    <div className="p-4"
      style={{ backgroundColor: '#111113', border: `1px solid ${TEST_BLUE}44` }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: TEST_BLUE, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: TEST_BLUE }}>
          {title ?? 'Test/PR'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SportSubcategorySelector
          sport={value.sport}
          subcategory={value.subcategory}
          customLabel={value.custom_label}
          onPatch={patch => onChange({
            ...value,
            ...(patch.sport !== undefined ? { sport: patch.sport } : null),
            ...(patch.subcategory !== undefined ? { subcategory: patch.subcategory } : null),
            ...(patch.customLabel !== undefined ? { custom_label: patch.customLabel } : null),
          })}
        />

        <Field label="Resultat">
          <input value={value.value}
            onChange={e => set('value', e.target.value)}
            placeholder={valuePlaceholder ?? 'f.eks. 320 eller 18.42'}
            style={inputStyle} />
        </Field>

        <Field label="Enhet">
          <input value={value.unit}
            onChange={e => set('unit', e.target.value)}
            placeholder="sek, watt, ml/kg/min, kg, reps…"
            style={inputStyle} />
        </Field>

        {isManual && (
          <Field label="Oppnådd dato">
            <input type="date" value={value.achieved_at}
              onChange={e => set('achieved_at', e.target.value)}
              style={inputStyle} />
          </Field>
        )}

        {showEquipmentConditions && (
          <>
            <Field label="Utstyr (valgfri)">
              <input value={value.equipment}
                onChange={e => set('equipment', e.target.value)}
                placeholder="Tredemølle, SRM, Concept2…"
                style={inputStyle} />
            </Field>
            <Field label="Forhold (valgfri)">
              <input value={value.conditions}
                onChange={e => set('conditions', e.target.value)}
                placeholder="+12°C, lett motvind, tørr bane…"
                style={inputStyle} />
            </Field>
          </>
        )}

        <div className="md:col-span-2">
          <Field label="Protokoll-notater (valgfri)">
            <textarea value={value.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Hvordan gikk det? Følelse, pacing, utstyr, forhold…"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>
      </div>

      <p className="mt-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Test/PR-resultatet vises i «Tester & PR» i analyse — samme felter
        som test-protokoll i Dagbok.
      </p>
    </div>
  )
}

// Validering brukt av begge skjemaene før lagring. Returnerer feilmelding
// (eller null hvis ok). "Resultat" må være parselbart som tall.
export function validateTestPRForm(v: TestPRFormValue): string | null {
  if (!v.sport) return 'Sport mangler'
  const def = v.sport
  // For sport='annet' eller subcategory='Egen' kreves custom_label.
  const needsCustom = def === 'annet' || v.subcategory === 'Egen'
  if (needsCustom && !v.custom_label.trim()) return 'Fyll inn fritekst-beskrivelse'
  if (def !== 'annet' && !v.subcategory) return 'Underkategori mangler'
  const num = parseFloat(v.value.replace(',', '.'))
  if (!Number.isFinite(num)) return 'Resultat må være et tall'
  if (!v.unit.trim()) return 'Enhet mangler'
  return null
}

// Avled "record_type"/"test_type" (legacy-felt) fra sport+subcategory+custom_label.
// Brukes som test_type på workout_test_data og record_type på personal_records,
// slik at eksisterende lister/grupperinger fortsatt fungerer.
export function deriveTestType(v: TestPRFormValue): string {
  if (v.sport === 'annet') return v.custom_label.trim()
  if (v.subcategory === 'Egen') return v.custom_label.trim()
  return v.subcategory
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
