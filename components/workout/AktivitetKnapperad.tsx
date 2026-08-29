'use client'

// Felles knapperad over aktivitetsradene — ÉN komponent brukt i både plan
// og dagbok (regel 11). Fasit: design/xpulse-plott-treff-design.html +
// design/xpulse-legg-til-detaljer-design.html (notatene).
//
// Rekkefølge (fasit): 🎯 Plott treff · ⌚ Legg til detaljer ·
// + Legg til aktivitet · + Legg til skyting.
//
// Betingelser — knapper SKJULES (aldri deaktiveres) når de ikke gjelder:
//   + Legg til aktivitet  — alltid (plan og dagbok)
//   + Legg til skyting    — brukeren har skiskyting (samme regel som
//                           styrer skyting ellers: userHasBiathlon)
//   🎯 Plott treff        — dagbok + økta har minst én skyting-rad,
//                           uavhengig av klokkesynk. Aldri i plan.
//   ⌚ Legg til detaljer  — dagbok + klokkesynket økt. Aldri i plan.
// Raden rendres med sida — knappene etterlastes aldri (regel 20). At en
// handler mangler (f.eks. før «Plott treff»-pop-upen finnes) skjuler
// knappen ærlig i stedet for å vise en død knapp.

const PILL_BASE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  letterSpacing: '0.1em', fontSize: 13, textTransform: 'uppercase',
  borderRadius: 999, padding: '8px 18px', cursor: 'pointer',
  whiteSpace: 'nowrap', minHeight: 36, background: 'transparent',
}

export function AktivitetKnapperad({
  isPlanMode, harSkyting, erKlokkesynket, userHasBiathlon,
  onPlottTreff, onLeggTilDetaljer, onLeggTilAktivitet, onLeggTilSkyting,
}: {
  isPlanMode: boolean
  harSkyting: boolean
  erKlokkesynket: boolean
  userHasBiathlon: boolean
  onPlottTreff?: () => void
  onLeggTilDetaljer?: () => void
  onLeggTilAktivitet: () => void
  onLeggTilSkyting: () => void
}) {
  const visPlottTreff = !isPlanMode && harSkyting && !!onPlottTreff
  const visDetaljer = !isPlanMode && erKlokkesynket && !!onLeggTilDetaljer
  return (
    <div className="flex gap-2 items-center flex-wrap mb-3">
      {visPlottTreff && (
        <button type="button" onClick={onPlottTreff}
          style={{ ...PILL_BASE, border: '1.5px solid #FF4500', color: '#FF4500' }}>
          🎯 Plott treff
        </button>
      )}
      {visDetaljer && (
        <button type="button" onClick={onLeggTilDetaljer}
          style={{ ...PILL_BASE, border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)' }}>
          ⌚ Legg til detaljer
        </button>
      )}
      <button type="button" onClick={onLeggTilAktivitet}
        style={{ ...PILL_BASE, border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)' }}>
        + Legg til aktivitet
      </button>
      {userHasBiathlon && (
        <button type="button" onClick={onLeggTilSkyting}
          style={{ ...PILL_BASE, border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)' }}>
        🎯 + Legg til skyting
        </button>
      )}
    </div>
  )
}
