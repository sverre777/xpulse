// HJEM v2 bolk 6 — NESTE A-KONKURRANSE. Bygger videre på KonkurranseNedtelling-
// stilen (gull #D4A017, venstre gullstrek, tonet bakgrunn). Fasit
// design/xpulse-hjem-kort-v2-design.html (kort 3): øverst neste A (navn,
// dato, sted · sport · distanse, stor nedtelling, «Mål», fase-hint), under
// lista over de neste 4 konkurransene uansett prioritet i datorekkefølge
// (A gull, B blå, C dempet) — A-en øverst gjentas ikke. Ingen A → neste B/C
// tar toppen (chip i metalinja) + «Ingen A-konkurranse i årsplanen ennå.» +
// «Sett A-konkurranse →». Ingen konkurranser → tekst + «Åpne årsplan →».
// Kilde: season_key_dates a/b/c + konkurranse-økter (bolk 0).

import Link from 'next/link'
import type { OversiktKonkurranse, OversiktPhase } from '@/app/actions/oversikt'
import { SPORTS } from '@/lib/types'

const FONT = "'Barlow Condensed', sans-serif"
const GULL = '#D4A017'
const BLAA = '#1A6FD4'
const UKEDAG = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function sportLabel(v: string | null): string | null { return v ? (SPORTS.find(s => s.value === v)?.label ?? v) : null }
function fmtDato(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${UKEDAG[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]}`
}
function PriChip({ p }: { p: 'A' | 'B' | 'C' | null }) {
  return (
    <span data-pri={p ?? 'ingen'} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, flexShrink: 0,
      fontFamily: FONT, fontSize: 12, fontWeight: 800, color: p === 'C' || !p ? 'var(--tekst-5-app)' : 'var(--tekst-1-ren)',
      background: p === 'A' ? GULL : p === 'B' ? BLAA : 'var(--flate-12-alt)',
    }}>{p ?? '·'}</span>
  )
}
function href(k: OversiktKonkurranse): string {
  return k.linked_workout_id ? `/app/plan?edit=${k.linked_workout_id}` : '/app/periodisering'
}

export function NesteKonkurranseKort({ nesteA, neste, phase }: {
  nesteA: OversiktKonkurranse | null
  neste: OversiktKonkurranse[]
  phase: OversiktPhase | null
}) {
  const topp = nesteA ?? neste[0] ?? null
  const liste = topp ? neste.filter(k => k.id !== topp.id).slice(0, 4) : []
  const ramme: React.CSSProperties = {
    backgroundColor: 'var(--tonet-oransje-1)', border: '1px solid var(--line)', borderLeft: `3px solid ${GULL}`,
    borderRadius: 16, boxShadow: '0 0 20px rgba(212, 160, 23, 0.15)', minWidth: 0,
  }
  const lenke: React.CSSProperties = { fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: GULL, textDecoration: 'none' }

  if (!topp) {
    return (
      <section className="p-5 h-full flex flex-col" data-konk-kort data-tilstand="ingen" style={{ ...ramme, borderLeft: `3px solid ${GULL}66`, boxShadow: 'none', border: '1px dashed var(--line2)' }}>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ width: 16, height: 2, backgroundColor: GULL, display: 'inline-block', opacity: 0.6 }} />
          <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: GULL, opacity: 0.85 }}>Neste A-konkurranse</span>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 15, color: 'var(--tekst-5-app)', margin: 0 }}>Ingen konkurranser i årsplanen ennå. Legg inn sesongens renn, så teller kortet ned til den viktigste.</p>
        <div className="mt-auto pt-4"><Link href="/app/periodisering" style={{ ...lenke, border: `1px solid ${GULL}88`, padding: '5px 10px', display: 'inline-block' }}>Åpne årsplan →</Link></div>
      </section>
    )
  }

  const sport = sportLabel(topp.sport)
  return (
    <section className="p-5 h-full flex flex-col" data-konk-kort data-tilstand={nesteA ? 'a' : 'uten-a'} style={ramme}>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: 16, height: 2, backgroundColor: GULL, display: 'inline-block' }} />
        <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: GULL }}>Neste A-konkurranse</span>
        <span className="ml-auto" style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: GULL }}>{fmtDato(topp.date)}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 26, letterSpacing: '0.03em', lineHeight: 1.1, margin: 0 }}>{topp.name}</h3>
          <p className="flex items-center gap-x-2 gap-y-1 flex-wrap" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', margin: '4px 0 0' }}>
            {!nesteA && <PriChip p={topp.prioritet} />}
            {[topp.location, sport, topp.distance_format].filter(Boolean).map((x, i) => (
              <span key={i} className="inline-flex items-center gap-2">{i > 0 && <span style={{ color: 'var(--tekst-8-alt)' }}>·</span>}{x}</span>
            ))}
          </p>
          {topp.notes && (
            <p data-konk-maal style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-1-app)', margin: '8px 0 0' }}>
              <span style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', marginRight: 8 }}>Mål</span>{topp.notes}
            </p>
          )}
          {phase && (
            <p data-konk-fase style={{ fontFamily: FONT, fontSize: 12.5, color: GULL, margin: '6px 0 0' }}>
              {phase.name} · uke {phase.week_in_phase} av {phase.phase_weeks_total}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end" style={{ flexShrink: 0 }}>
          <span data-nedtelling style={{ fontFamily: "'Bebas Neue', sans-serif", color: GULL, fontSize: 52, letterSpacing: '0.04em', lineHeight: 0.95 }}>
            {topp.days_until === 0 ? 'I DAG' : topp.days_until}
          </span>
          {topp.days_until !== 0 && <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: GULL, marginTop: 4 }}>{topp.days_until === 1 ? 'dag igjen' : 'dager igjen'}</span>}
        </div>
      </div>

      {!nesteA && (
        <p data-ingen-a style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', margin: '10px 0 0' }}>Ingen A-konkurranse i årsplanen ennå.</p>
      )}

      {liste.length > 0 && (
        <div data-konk-liste className="flex flex-col" style={{ marginTop: 12, borderTop: '1px solid var(--line)' }}>
          {liste.map(k => (
            <Link key={k.id} href={href(k)} data-konk-rad={k.prioritet ?? 'ingen'} className="flex items-center gap-3"
              style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit' }}>
              <PriChip p={k.prioritet} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</p>
                <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)', margin: 0 }}>
                  {[fmtDato(k.date), k.location, k.distance_format].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--tekst-1-app)', lineHeight: 1 }}>{k.days_until === 0 ? 'I DAG' : k.days_until}</span>
                {k.days_until !== 0 && <span style={{ display: 'block', fontFamily: FONT, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>dager</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3 flex items-center gap-3 flex-wrap">
        {!nesteA && <Link href="/app/periodisering" data-sett-a style={lenke}>Sett A-konkurranse →</Link>}
        <Link href="/app/periodisering" style={{ ...lenke, color: 'var(--tekst-5-app)' }}>Alle konkurranser</Link>
        <Link href={href(topp)} className="ml-auto" style={lenke}>Åpne detaljer →</Link>
      </div>
    </section>
  )
}
