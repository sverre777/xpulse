'use client'

// Kontrollene over grafene — ÉN kilde for chip-raden og det merkede
// nedtrekket. Fasiten er «Custom graf — fleksibel nedbryting»
// (CustomBreakdownChart): etikett i små versaler over, oransje fylt chip for
// valgt, og 32px høyde så radene står på linje. Skyting-grafen skal kjennes
// som samme verktøy, og da må kontrollene komme fra samme sted — ikke fra en
// kopi som driver fra fasiten neste gang noen justerer en farge.

interface ChipOption<T extends string> {
  value: T
  label: string
  /** Satt = valget kan ikke velges nå, med begrunnelse i title. */
  disabledReason?: string
}

export function ChipSelector<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: ChipOption<T>[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(o => {
          const av = !!o.disabledReason
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => !av && onChange(o.value)}
              disabled={av}
              title={o.disabledReason}
              className="px-3.5 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: value === o.value ? '#FF4500' : 'var(--flate-3)',
                border: value === o.value ? '1px solid #FF4500' : '1px solid var(--kant-3)',
                color: value === o.value ? 'var(--tekst-1-ren)' : 'var(--tekst-1-app)',
                cursor: av ? 'not-allowed' : 'pointer',
                opacity: av ? 0.45 : 1,
                minHeight: 32,
                borderRadius: 999,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SelectControl({
  label, value, onChange, children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3.5 py-1.5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: 'var(--flate-3)',
          border: '1px solid var(--kant-3)',
          color: 'var(--tekst-1-app)',
          minHeight: 32,
          borderRadius: 999,
        }}
      >
        {children}
      </select>
    </div>
  )
}
