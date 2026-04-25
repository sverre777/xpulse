'use client'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  // Når på = også opprett en planlagt/ferdig workout (workout_type='test')
  // i Dagbok på dato'en. Når av = kun PR-rad.
  // Kort hjelpetekst kan overstyres ved behov.
  hint?: string
}

export function LogToDagbokToggle({ checked, onChange, hint }: Props) {
  return (
    <label className="flex items-start gap-2 mt-3 cursor-pointer">
      <input type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: '3px', accentColor: '#1A6FD4' }} />
      <span>
        <span className="block text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#1A6FD4' }}>
          Logg også som økt i Dagbok?
        </span>
        <span className="block text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {hint ?? 'Når på opprettes også en test-økt i Dagbok på datoen, slik at den teller med i belastning og kalender.'}
        </span>
      </span>
    </label>
  )
}
