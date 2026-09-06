'use client'

// UNDERSIDENE v2 bolk B3 - snarveisraden. Sticky under topplinja, vannrett scroll på
// mobil, aktiv seksjon markeres med ÉN IntersectionObserver. Lenkene er ekte ankre,
// så raden virker uten JS.

import { useEffect, useState } from 'react'

export interface Snarvei { id: string; navn: string }

export function LandingSnarvei({ punkter }: { punkter: Snarvei[] }) {
  const [aktiv, setAktiv] = useState(punkter[0]?.id ?? '')
  useEffect(() => {
    const io = new IntersectionObserver(poster => {
      // Seksjonen nærmest midten av skjermen vinner - samme regel som forsidens skinne.
      const inne = poster.filter(p => p.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (inne?.target.id) setAktiv(inne.target.id)
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5] })
    for (const p of punkter) {
      const el = document.getElementById(p.id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [punkter])
  return (
    <div className="lp-snar">
      <nav className="lp-snar-inn" aria-label="Snarveier på siden">
        {punkter.map(p => (
          <a key={p.id} href={`#${p.id}`} className={p.id === aktiv ? 'on' : undefined}
            aria-current={p.id === aktiv ? 'true' : undefined}>{p.navn}</a>
        ))}
      </nav>
    </div>
  )
}
