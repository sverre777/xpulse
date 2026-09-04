'use client'

// Felles knapperad over aktivitetsradene — ÉN komponent brukt i både plan
// og dagbok (regel 11). Fasit: design/xpulse-plott-treff-design.html +
// Øktbygger-omleggingen v6.
//
// Rekkefølge (Øktbygger-fasiten): + Legg til aktivitet ·
// 🎯 + Legg til skyting · ⚡ Øktbygger · 🎯 Plott treff.
//
// Betingelser — knapper SKJULES (aldri deaktiveres) når de ikke gjelder:
//   + Legg til aktivitet  — alltid (plan og dagbok)
//   + Legg til skyting    — brukeren har skiskyting (samme regel som
//                           styrer skyting ellers: userHasBiathlon)
//   🎯 Plott treff        — dagbok + økta har minst én skyting-rad,
//                           uavhengig av klokkesynk. Aldri i plan.
//   ⚡ Øktbygger          — ALLTID: plan og dagbok, med og uten klokke, med
//                           og uten lagret økt. Inni ligger hurtigoppsettet
//                           og, når økta har kurve, verktøyene på kurven.
//                           Navnet er låst til «Øktbygger».
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
  isPlanMode, harSkyting, userHasBiathlon,
  onPlottTreff, onOktbygger, onLeggTilAktivitet, onLeggTilSkyting,
}: {
  isPlanMode: boolean
  harSkyting: boolean
  userHasBiathlon: boolean
  onPlottTreff?: () => void
  onOktbygger?: () => void
  onLeggTilAktivitet: () => void
  onLeggTilSkyting: () => void
}) {
  const visPlottTreff = !isPlanMode && harSkyting && !!onPlottTreff
  const visBygger = !!onOktbygger
  return (
    <div className="flex gap-2 items-center flex-wrap mb-3" data-aktivitet-knapperad>
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
      {visBygger && (
        <button type="button" onClick={onOktbygger}
          style={{ ...PILL_BASE, border: '1.5px solid var(--accent)', color: 'var(--accent)' }}>
          ⚡ Øktbygger
        </button>
      )}
      {visPlottTreff && (
        <button type="button" onClick={onPlottTreff}
          style={{ ...PILL_BASE, border: '1.5px solid #FF4500', color: '#FF4500' }}>
          🎯 Plott treff
        </button>
      )}
    </div>
  )
}
