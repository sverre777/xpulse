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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
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
            backgroundColor: '#0F0F11',
            border: '1px solid #262629',
            color: '#F0F0F2',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px',
            padding: '8px 10px',
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
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
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
  const baseStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    border: '1px solid #262629',
    background: '#0F0F11',
    color: '#8A8A96',
    cursor: disabled ? 'default' : 'pointer',
    padding: '0 10px',
    minHeight: '40px',
    minWidth: '54px',
  }
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: '#1A1A1E',
    color: '#F0F0F2',
    borderColor: '#FF4500',
  }
  return (
    <div className="flex" role="group" aria-label="Pace-enhet">
      <button type="button"
        disabled={disabled}
        onClick={() => onChange('min_per_km')}
        style={unit === 'min_per_km' ? activeStyle : baseStyle}>
        min/km
      </button>
      <button type="button"
        disabled={disabled}
        onClick={() => onChange('km_per_h')}
        style={{
          ...(unit === 'km_per_h' ? activeStyle : baseStyle),
          marginLeft: '-1px',
        }}>
        km/t
      </button>
    </div>
  )
}
