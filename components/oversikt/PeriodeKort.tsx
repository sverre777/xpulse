// HJEM v2 bolk 7 — PERIODE. Fasit design/xpulse-hjem-kort-v2-design.html
// (kort 7): aktiv fase (navn + intensitet-chip), datoer · dager igjen,
// framdriftslinje (blå) + «Dag x av y · volum snitt hittil», sesong-tidslinje
// (alle faser som farget stripe, aktiv markert m/ hvit ramme) + navnelinje,
// liste: neste 3 faser (fargeprikk, navn · type, datoer · uker, dager til) +
// neste 2 samlinger (⛺, navn, datoer, dager til) i datorekkefølge. Ingen
// aktiv fase men kommende finnes → «Ingen aktiv fase» + lista. Ingenting →
// «Ingen aktiv periode» + «Åpne årsplan →» (blå). Fot «Åpne periodisering →».
// «mål t/uke» per fase finnes ikke som kolonne (season_periods) — utelatt.

import Link from 'next/link'
import type { OversiktPhase, OversiktPhaseStatus, OversiktPeriodeRad, OversiktSamling } from '@/app/actions/oversikt'

const FONT = "'Barlow Condensed', sans-serif"
const BLAA = '#1A6FD4'
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const INTENSITET: Record<'rolig' | 'medium' | 'hard', { navn: string; farge: string }> = {
  rolig: { navn: 'Rolig', farge: '#28A86E' }, medium: { navn: 'Medium', farge: '#E8B93C' }, hard: { navn: 'Hard', farge: '#E23A5A' },
}
function fmtDato(iso: string): string { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}. ${MND[d.getMonth()]}` }
function spenn(a: string, b: string): string {
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00')
  return da.getMonth() === db.getMonth() ? `${da.getDate()}.–${db.getDate()}. ${MND[da.getMonth()]}` : `${fmtDato(a)} – ${fmtDato(b)}`
}
function dager(a: string, b: string): number { return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000) }

export function PeriodeKort({ phase, phaseStatus, periods, camps, todayISO, snittTimerPerUke }: {
  phase: OversiktPhase | null
  phaseStatus: OversiktPhaseStatus
  periods: OversiktPeriodeRad[]
  camps: OversiktSamling[]
  todayISO: string
  /** Sesongens snittvolum hittil (t/uke) — fra hovedmålet. */
  snittTimerPerUke: number | null
}) {
  const ramme: React.CSSProperties = { backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, minWidth: 0 }
  const kommendeFaser = periods.filter(p => p.start_date > todayISO).slice(0, 3)
  const kommendeSamlinger = camps.filter(c => c.end_date >= todayISO).slice(0, 2)
  const liste = [
    ...kommendeFaser.map(p => ({ slag: 'fase' as const, dato: p.start_date, p })),
    ...kommendeSamlinger.map(c => ({ slag: 'samling' as const, dato: c.start_date, c })),
  ].sort((a, b) => a.dato.localeCompare(b.dato))

  if (!phase && liste.length === 0) {
    return (
      <section className="p-5 h-full flex flex-col" data-periode-kort data-tilstand="ingen" style={ramme}>
        <div className="xp-kh blue"><span className="xp-beam" /><h2 className="xp-kh-t">Periode</h2></div>
        <p className="xp-key-h3">Ingen aktiv periode</p>
        <p className="xp-key-p">{phaseStatus === 'no_season' ? 'Opprett en sesong og legg inn periodene, så vises fasen her.' : 'Legg inn periodene i årsplanen, så vises fasen her.'}</p>
        <div className="mt-auto"><Link href="/app/periodisering" className="xp-hbtn" style={{ backgroundColor: BLAA, color: 'var(--tekst-1-ren)' }}>Åpne årsplan →</Link></div>
      </section>
    )
  }

  const totalt = phase ? dager(phase.start_date, phase.end_date) + 1 : 0
  const dagNr = phase ? Math.min(totalt, Math.max(1, dager(phase.start_date, todayISO) + 1)) : 0
  const igjen = phase ? Math.max(0, dager(todayISO, phase.end_date)) : 0
  const sesongStart = periods[0]?.start_date ?? null
  const sesongSlutt = periods[periods.length - 1]?.end_date ?? null
  const sesongDager = sesongStart && sesongSlutt ? Math.max(1, dager(sesongStart, sesongSlutt) + 1) : 0

  return (
    <section className="p-5 h-full flex flex-col" data-periode-kort data-tilstand={phase ? 'aktiv' : 'gap'} style={ramme}>
      <div className="xp-kh blue" style={{ marginBottom: 8 }}>
        <span className="xp-beam" />
        <h2 className="xp-kh-t">Periode</h2>
        {phase && <span className="xp-kh-tag">uke {phase.week_in_phase} av {phase.phase_weeks_total}</span>}
      </div>

      {phase ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="xp-key-h3" style={{ margin: 0 }}>{phase.name}</p>
            <span data-intensitet={phase.intensity} style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: INTENSITET[phase.intensity].farge, border: `1px solid ${INTENSITET[phase.intensity].farge}`, borderRadius: 999, padding: '1px 7px' }}>
              {INTENSITET[phase.intensity].navn}
            </span>
          </div>
          <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', margin: '4px 0 0' }}>
            {spenn(phase.start_date, phase.end_date)} · {igjen} dager igjen
          </p>
          <div data-fase-framdrift style={{ height: 6, borderRadius: 999, background: 'var(--flate-12-alt)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((dagNr / totalt) * 100)}%`, height: '100%', background: BLAA, borderRadius: 999 }} />
          </div>
          <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)', margin: '3px 0 0' }}>
            Dag {dagNr} av {totalt}{snittTimerPerUke != null ? ` · volum ${snittTimerPerUke.toFixed(1).replace('.', ',')} t/uke snitt hittil` : ''}
          </p>
        </>
      ) : (
        <p className="xp-key-h3" data-ingen-aktiv-fase>Ingen aktiv fase</p>
      )}

      {periods.length > 0 && sesongDager > 0 && (
        <div data-sesong-tidslinje style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {periods.map(p => {
              const w = Math.max(1, (dager(p.start_date, p.end_date) + 1) / sesongDager * 100)
              const aktiv = phase?.id === p.id
              return <span key={p.id} title={`${p.name} · ${spenn(p.start_date, p.end_date)}`} data-tidslinje-fase={aktiv ? 'aktiv' : 'fase'}
                style={{ width: `${w}%`, background: INTENSITET[p.intensity].farge, opacity: aktiv ? 1 : 0.55, outline: aktiv ? '2px solid var(--tekst-1-app)' : 'none', outlineOffset: -1, borderRadius: 2 }} />
            })}
          </div>
          <p style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-alt)', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Sesongen: {periods.map(p => (phase?.id === p.id ? <b key={p.id} style={{ color: 'var(--tekst-1-app)' }}>{p.name.toLowerCase()}</b> : <span key={p.id}>{p.name.toLowerCase()}</span>)).reduce<React.ReactNode[]>((acc, x, i) => (i === 0 ? [x] : [...acc, ' · ', x]), [])}
          </p>
        </div>
      )}

      {liste.length > 0 && (
        <div data-periode-liste className="flex flex-col" style={{ marginTop: 10, borderTop: '1px solid var(--line)' }}>
          {liste.map(r => r.slag === 'fase' ? (
            <div key={`f${r.p.id}`} className="flex items-center gap-3" data-periode-rad="fase" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: INTENSITET[r.p.intensity].farge, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0 }}>{r.p.name}{r.p.focus ? <span style={{ fontWeight: 500, color: 'var(--tekst-5-app)' }}> · {r.p.focus}</span> : null}</p>
                <p style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-alt)', margin: 0 }}>{spenn(r.p.start_date, r.p.end_date)} · {r.p.weeks} {r.p.weeks === 1 ? 'uke' : 'uker'} · {INTENSITET[r.p.intensity].navn.toLowerCase()}</p>
              </div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--tekst-1-app)' }}>{r.p.days_until}<span style={{ fontFamily: FONT, fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--tekst-8-alt)', marginLeft: 3 }}>DAGER</span></span>
            </div>
          ) : (
            <div key={`s${r.c.id}`} className="flex items-center gap-3" data-periode-rad="samling" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>⛺</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0 }}>{r.c.name}{r.c.location ? <span style={{ fontWeight: 500, color: 'var(--tekst-5-app)' }}> · {r.c.location}</span> : null}</p>
                <p style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-alt)', margin: 0 }}>{r.c.is_altitude ? 'høydesamling' : 'samling'} · {spenn(r.c.start_date, r.c.end_date)} · {dager(r.c.start_date, r.c.end_date) + 1} dager</p>
              </div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--tekst-1-app)' }}>{Math.max(0, r.c.days_until)}<span style={{ fontFamily: FONT, fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--tekst-8-alt)', marginLeft: 3 }}>DAGER</span></span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3">
        <Link href="/app/periodisering" style={{ fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: BLAA, textDecoration: 'none' }}>Åpne periodisering →</Link>
      </div>
    </section>
  )
}
