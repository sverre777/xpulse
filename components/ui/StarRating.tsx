'use client'

// ÉN følelses-skala i hele appen (regel 11): 1–5 stjerner, samme komponent
// for øktenes dagsform (WorkoutForm) og den daglige energiføringen
// (helsekortet/HealthForm). To skalaer for «hvordan føler du deg» ville
// vært to fasiter som spriker. Klikk på valgt stjerne nullstiller.
export function StarRating({ value, onChange, size = 26 }: {
  value: number | null
  onChange: (v: number | null) => void
  size?: number
}) {
  return (
    <div className="flex gap-0.5 mt-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} av 5`}
          style={{
            fontSize: size, color: (value ?? 0) >= n ? 'var(--i3)' : 'var(--line2)',
            textShadow: (value ?? 0) >= n ? '0 0 12px rgba(232,185,60,.35)' : 'none',
            background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1,
          }}>
          ★
        </button>
      ))}
    </div>
  )
}
