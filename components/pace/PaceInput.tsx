'use client'

import { useEffect, useState } from 'react'
import {
  PaceUnit, parsePaceInput, paceToInputText, formatPace,
} from '@/lib/pace-utils'

// Tekst-input for pace med toggle min/km <-> km/t. Kanonisk verdi er sekunder
// per km (heltall), holdt utenfor komponenten i ActivityRow-skjemaet.
//
// `value` er sekunder per km som tall, eller null/0 = tom. `onChange` får
// neste sekunder-per-km, eller null hvis brukeren tømte feltet eller skrev
// ugyldig verdi (parse-feil viser også feilmeldingstekst under).
//
// `unit` er den AKTIVE visningsenheten — eier eies utenfor (typisk lagret
// som ActivityRow.pace_unit_preference || profile.default_pace_unit).
//
// Når brukeren bytter enhet, beholdes sekunder-verdien — bare visningen flips.

interface Props {
  value: number | null
  onChange: (next: number | null) => void
  unit: PaceUnit
  onUnitChange: (next: PaceUnit) => void
  // Auto-utregnet forslag som brukeren kan akseptere når feltet er tomt og
  // distanse + duration er fylt inn andre steder. null = ingen forslag.
  computedSuggestion?: number | null
  onAcceptSuggestion?: () => void
  label?: string
  disabled?: boolean
}

export function PaceInput({
  value, onChange, unit, onUnitChange,
  computedSuggestion, onAcceptSuggestion,
  label = 'Snittpace',
  disabled = false,
}: Props) {
  // Lokal tekst — tillater frittstående redigering, parses ved blur/onChange.
  const [text, setText] = useState<string>(() => paceToInputText(value, unit))
  const [error, setError] = useState<string | null>(null)

  // Synkroniser tekst når enhet eller verdi endres utenfra (f.eks. når en annen
  // rad-endring auto-fyller pace, eller bruker bytter enhet).
  useEffect(() => {
    setText(paceToInputText(value, unit))
    setError(null)
  }, [value, unit])

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      setError(null)
      onChange(null)
      return
    }
    const parsed = parsePaceInput(raw, unit)
    if (parsed == null) {
      setError(unit === 'min_per_km'
        ? 'Bruk MM:SS, f.eks. 4:30'
        : 'Skriv tall, f.eks. 13.5')
      return
    }
    setError(null)
    // Avrund til hele sekunder for kanonisk lagring.
    onChange(Math.round(parsed))
  }

  const placeholder = unit === 'min_per_km' ? '4:30' : '13.5'
  const hasSuggestion = !value && computedSuggestion != null && computedSuggestion > 0

  return (
    <div>
      <label className="block mb-1 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </label>

      <div className="flex items-stretch gap-1">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={e => commit(e.target.value)}
          placeholder={placeholder}
          inputMode={unit === 'km_per_h' ? 'decimal' : 'text'}
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: 'var(--flate-8)',
            border: '1px solid var(--kant-5)',
            borderRadius: 999,   // Sverre 18. sep: pille, som resten
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px',
            padding: '8px 14px',
            minHeight: '40px',
            outline: 'none',
          }}
        />

        <UnitToggle
          unit={unit}
          onChange={onUnitChange}
          disabled={disabled}
        />
      </div>

      {error && (
        <p className="mt-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}

      {hasSuggestion && (
        <button
          type="button"
          onClick={onAcceptSuggestion}
          className="mt-1 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: 'none',
            border: 'none',
            color: '#1A6FD4',
            cursor: 'pointer',
            padding: 0,
          }}>
          Auto: {formatPace(computedSuggestion!, unit)} · klikk for å sette
        </button>
      )}

      {/* Konvertering-hint: vis motsatt enhet under feltet når en gyldig verdi
          finnes, slik at brukeren ser begge representasjonene samtidig. */}
      {value != null && value > 0 && !error && (
        <p className="mt-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          = {formatPace(value, unit === 'min_per_km' ? 'km_per_h' : 'min_per_km')}
        </p>
      )}
    </div>
  )
}

function UnitToggle({
  unit, onChange, disabled,
}: {
  unit: PaceUnit
  onChange: (u: PaceUnit) => void
  disabled?: boolean
}) {
  // Sverre 14. sep: enhetsbryteren er en PILLE som resten av appen
  // (.xp-seg-pill), ikke en firkantet delt boks. Aktiv del fylt oransje.
  return (
    // Sverre 18. sep: min/km og km/t får LIKE mye plass (km/t ble klippet på mobil).
    <div className="xp-seg-pill" role="group" aria-label="Pace-enhet" data-pace-enhet={unit} style={{ flex: 'none' }}>
      <button type="button"
        disabled={disabled}
        onClick={() => onChange('min_per_km')}
        className={unit === 'min_per_km' ? 'on' : undefined}
        style={{ width: 76, padding: '8px 0', textAlign: 'center' }}>
        min/km
      </button>
      <button type="button"
        disabled={disabled}
        onClick={() => onChange('km_per_h')}
        className={unit === 'km_per_h' ? 'on' : undefined}
        style={{ width: 76, padding: '8px 0', textAlign: 'center' }}>
        km/t
      </button>
    </div>
  )
}
