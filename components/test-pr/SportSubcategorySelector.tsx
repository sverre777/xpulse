'use client'

import {
  TEST_PR_SPORTS_AND_SUBCATEGORIES, findTestPRSport,
  type TestPRSport,
} from '@/lib/types'

const inputStyle: React.CSSProperties = {
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', outline: 'none', padding: '8px 10px', width: '100%',
}

interface Props {
  sport: TestPRSport | ''
  subcategory: string
  customLabel: string
  onSportChange: (sport: TestPRSport | '') => void
  onSubcategoryChange: (subcategory: string) => void
  onCustomLabelChange: (label: string) => void
}

export function SportSubcategorySelector({
  sport, subcategory, customLabel,
  onSportChange, onSubcategoryChange, onCustomLabelChange,
}: Props) {
  const def = sport ? findTestPRSport(sport) : null
  const subs = def?.subcategories ?? []
  // "Annet" har tom underkategori-liste → vis kun fritekst.
  // "Egen" som valgt underkategori → vis fritekst i tillegg.
  const showCustom = sport === 'annet' || subcategory === 'Egen'

  const onSelectSport = (val: string) => {
    const next = (val || '') as TestPRSport | ''
    onSportChange(next)
    // Reset underkategori når sport endres slik at vi ikke står med
    // ugyldig kombinasjon. Custom-label nullstilles også for ren start.
    onSubcategoryChange('')
    onCustomLabelChange('')
  }

  return (
    <>
      <Field label="Sport">
        <select value={sport} onChange={e => onSelectSport(e.target.value)} style={inputStyle}>
          <option value="">— velg sport —</option>
          {TEST_PR_SPORTS_AND_SUBCATEGORIES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>

      {subs.length > 0 && (
        <Field label="Underkategori">
          <select value={subcategory} onChange={e => onSubcategoryChange(e.target.value)} style={inputStyle}>
            <option value="">— velg —</option>
            {subs.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}

      {showCustom && (
        <Field label={sport === 'annet' ? 'Hva tester du?' : 'Egen test (fritekst)'}>
          <input value={customLabel}
            onChange={e => onCustomLabelChange(e.target.value)}
            placeholder="f.eks. Standhopp m/sving, 6×400m, Pull-up dødheng…"
            style={inputStyle} />
        </Field>
      )}
    </>
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
