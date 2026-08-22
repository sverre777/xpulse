'use client'

// Filter-chip i PILLEFORM — fasit: designfilens `.chip` (border-radius 999)
// og `.xp-chip` i globals.css. Utstyr-siden og Min skipark hadde hver sin
// firkantede lokalvariant; begge bruker denne nå, så de ikke driver fra
// hverandre igjen.

interface Props {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  title?: string
}

export function FilterChip({ active, onClick, children, className = '', title }: Props) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`xp-chip${active ? ' on' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </button>
  )
}
