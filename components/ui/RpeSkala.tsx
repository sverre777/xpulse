'use client'

// Opplevd/forventet belastning 1–10 — ÉN skala-komponent i hele appen
// (regel 11). Brukes i øktskjemaets «Dagsform og belastning», i grafens
// nøkkeltallsrad (opplevd, ført) og i plan-grafens rad (forventet).
// Fargene går grønn → rød med tallet; valgt tall får fargen, resten står
// nøytrale. Klikk på valgt tall nullstiller.

export const RPE_FARGER = ['#28A86E', '#3BA45C', '#63A94A', '#8FAC3C', '#BCA735', '#E8B93C', '#F09A2E', '#FF8C00', '#F0592B', '#E23A5A']

export function rpeFarge(v: number | null | undefined): string {
  if (v == null || v < 1 || v > 10) return 'var(--tekst-5-app)'
  return RPE_FARGER[Math.round(v) - 1]
}

export function RpeSkala({ value, onChange, kompakt = false, etikett }: {
  value: number | null
  onChange: (v: number | null) => void
  /** Mindre knapper — i nøkkeltallsraden. Treffflaten holdes ≥ 36 px. */
  kompakt?: boolean
  etikett?: string
}) {
  const side = kompakt ? 30 : 32
  return (
    <div className="flex gap-1.5 flex-wrap mt-1" role="group" aria-label={etikett ?? 'Belastning 1–10'}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          aria-pressed={value === n}
          className="text-sm font-bold"
          style={{
            width: side, height: side, minWidth: 30, minHeight: 30,
            // Treffflate ≥ 36 px selv om knappen tegnes mindre.
            boxSizing: 'content-box', padding: kompakt ? 3 : 2,
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: value === n ? RPE_FARGER[n - 1] : 'var(--card2)',
            color: value === n ? 'var(--tekst-1-ren)' : 'var(--mut)',
            border: `1px solid ${value === n ? 'transparent' : 'var(--line2)'}`,
            borderRadius: 8,
            boxShadow: value === n ? '0 0 14px var(--accent-soft)' : 'none',
            cursor: 'pointer',
          }}>
          {n}
        </button>
      ))}
    </div>
  )
}
