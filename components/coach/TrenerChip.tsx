'use client'

// TRENER-MARKERING (Øktbygger bolk 9) — ÉN chip for «denne økta kom fra
// treneren»: «👤 Trener · <fornavn>» i trenerblått (#1A6FD4). Kompakt
// (kalender-chips): en blå prikk med samme tekst som title. Kilden er
// workouts.created_by_coach_id (settes bare i trener-stiene: push av økt/
// konkurranse/mal/hel plan og trener som lagrer i utøverens dagbok) —
// ingen rettigheter endres, og markeringen forsvinner ikke når utøveren
// redigerer (saveWorkout rører ikke feltet for utøveren).

export const TRENER_BLAA = '#1A6FD4'

function fornavn(navn: string | null | undefined): string {
  const n = (navn ?? '').trim()
  return n ? n.split(/\s+/)[0] : 'trener'
}

export function trenerTekst(navn: string | null | undefined): string {
  return `Trener · ${fornavn(navn)}`
}

export function TrenerChip({ navn, style }: { navn: string | null | undefined; style?: React.CSSProperties }) {
  return (
    <span data-trener-chip title={`Lagt inn av ${navn?.trim() || 'treneren din'}`}
      className="inline-flex items-center gap-1 text-xs tracking-widest uppercase px-2 py-0.5"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        backgroundColor: 'rgba(26,111,212,0.12)', color: TRENER_BLAA,
        border: `1px solid ${TRENER_BLAA}`, borderRadius: 999, lineHeight: '18px', whiteSpace: 'nowrap',
        ...style,
      }}>
      <span aria-hidden="true">👤</span> {trenerTekst(navn)}
    </span>
  )
}

/** Kompakt: blå prikk (kalender-chips, ukekort). */
export function TrenerPrikk({ navn }: { navn: string | null | undefined }) {
  return (
    <span data-trener-prikk aria-label={trenerTekst(navn)} title={trenerTekst(navn)} style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      backgroundColor: TRENER_BLAA, marginRight: 4, verticalAlign: 'middle', flexShrink: 0,
    }} />
  )
}
