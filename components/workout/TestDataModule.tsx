'use client'

import { TestData, Sport, TEST_TYPES_BY_SPORT } from '@/lib/types'

interface Props {
  data: TestData
  onChange: (data: TestData) => void
  sport: Sport
  mode: 'plan' | 'dagbok'
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', outline: 'none', padding: '8px 10px', width: '100%',
}

// Blå aksent for test-modul — samme "test" visual-språk som trener bruker for test-maler.
const TEST_BLUE = '#1A6FD4'

export function TestDataModule({ data, onChange, sport, mode }: Props) {
  const suggestions = TEST_TYPES_BY_SPORT[sport] ?? []
  const set = <K extends keyof TestData>(k: K, v: TestData[K]) =>
    onChange({ ...data, [k]: v })

  const isPlan = mode === 'plan'

  const onTestTypeChange = (val: string) => {
    const match = suggestions.find(s => s.value === val)
    onChange({
      ...data,
      test_type: val,
      primary_unit: data.primary_unit || match?.unit || '',
    })
  }

  return (
    <div className="p-4 mb-4"
      style={{ backgroundColor: '#111113', border: `1px solid ${TEST_BLUE}44` }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: TEST_BLUE, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: TEST_BLUE }}>
          Test-protokoll {isPlan ? '— Plan' : '— Resultat'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Test-type">
          <input
            list="test-type-suggestions"
            value={data.test_type}
            onChange={e => onTestTypeChange(e.target.value)}
            placeholder="f.eks. 5km_tt, FTP_20…"
            style={iSt} />
          <datalist id="test-type-suggestions">
            {suggestions.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </datalist>
        </Field>

        <Field label={isPlan ? 'Mål (primær)' : 'Resultat (primær)'}>
          <input value={data.primary_result}
            onChange={e => set('primary_result', e.target.value)}
            placeholder="f.eks. 18:42 eller 320"
            style={iSt} />
        </Field>

        <Field label="Enhet">
          <input value={data.primary_unit}
            onChange={e => set('primary_unit', e.target.value)}
            placeholder="sek, tid, watt, ml/kg/min…"
            style={iSt} />
        </Field>

        <Field label="Utstyr (valgfri)">
          <input value={data.equipment}
            onChange={e => set('equipment', e.target.value)}
            placeholder="Tredemølle, SRM, Concept2…"
            style={iSt} />
        </Field>

        <div className="md:col-span-2">
          <Field label="Forhold (valgfri)">
            <input value={data.conditions}
              onChange={e => set('conditions', e.target.value)}
              placeholder="+12°C, lett motvind, tørr bane…"
              style={iSt} />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label={isPlan ? 'Protokoll-notater' : 'Protokoll + gjennomføring'}>
            <textarea value={data.protocol_notes}
              onChange={e => set('protocol_notes', e.target.value)}
              rows={3}
              placeholder={isPlan
                ? 'Hvordan skal testen gjennomføres? Oppvarming, pacing, hvile…'
                : 'Hvordan gikk det? Følelse, pacing, avvik fra protokoll…'}
              style={{ ...iSt, resize: 'vertical' }} />
          </Field>
        </div>
      </div>

      <p className="mt-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Test-resultatet lagres i egen tabell og blir synlig i «Tester & PR» i analyse.
      </p>
    </div>
  )
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
