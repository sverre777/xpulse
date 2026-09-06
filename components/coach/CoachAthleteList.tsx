'use client'

// BOLK B1 (Trenerside v2, Sverre 6. sep): utøverlista er hovedsaken på trener-hjem.
// Én rad per utøver med timer, % av plan, sonestripe + hard I3+, skudd/treff og HRV
// for valgt periode (Uke · Måned · År). Tallene kommer fra ÉN aggregator
// (getTrenerOversikt) som kjører de eksisterende funksjonene per utøver — ingen
// nye beregninger, ingen runde per rad (regel 20).

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { CoachAthleteCard, AthleteLoggingStatus } from '@/app/actions/coach-dashboard'
import { getTrenerOversikt } from '@/app/actions/trener-oversikt'
import type { TrenerUtoverRad } from '@/lib/trener-oversikt-type'
import { SPORTS, type Sport } from '@/lib/types'
import { ZoneBar } from '@/components/oversikt/kort-deler'
import type { OversiktZoneSeconds } from '@/app/actions/oversikt'
import { UtoverDetaljer } from './UtoverDetaljer'
import { STATUS_GRONN, STATUS_GUL, STATUS_ROD, TRENER_BLAA, planPctFarge, PLAN_SKALA_MAKS } from '@/lib/status-farger'

const COACH_BLUE = TRENER_BLAA
const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'

type Periode = 'uke' | 'maaned' | 'aar'
const PERIODE_NAVN: Record<Periode, string> = { uke: 'Uke', maaned: 'Måned', aar: 'År' }

interface Props {
  athletes: CoachAthleteCard[]
}

const STATUS_COLOR: Record<AthleteLoggingStatus, string> = {
  active:   STATUS_GRONN,
  delayed:  STATUS_GUL,
  inactive: STATUS_ROD,
}

/** Periodens start og slutt — uka går mandag–søndag, som ellers i appen. */
function periodeDatoer(p: Periode): { fra: string; til: string } {
  const naa = new Date()
  const til = naa.toISOString().slice(0, 10)
  if (p === 'aar') return { fra: `${til.slice(0, 4)}-01-01`, til }
  if (p === 'maaned') return { fra: `${til.slice(0, 7)}-01`, til }
  const d = new Date(til + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return { fra: d.toISOString().slice(0, 10), til }
}

function fmtTid(sek: number): string {
  if (sek <= 0) return '—'
  const t = Math.floor(sek / 3600), m = Math.round((sek % 3600) / 60)
  return t > 0 ? `${t}:${String(m).padStart(2, '0')}` : `${m} min`
}

/** Én tallcelle i raden. */
function Celle({ etikett, children, bredde = 92 }: { etikett: string; children: React.ReactNode; bredde?: number }) {
  return (
    <div data-utover-celle={etikett} style={{ minWidth: 0, width: bredde }}>
      <small style={{ display: 'block', fontFamily: FONT, fontWeight: 600, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{etikett}</small>
      <div style={{ fontFamily: BEBAS, fontSize: 18, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', lineHeight: 1.2 }}>{children}</div>
    </div>
  )
}

/** % av plan: bar med hvit strek på 100 %, skala til 130 %. */
function PlanBar({ rad }: { rad: TrenerUtoverRad }) {
  if (rad.planPct == null) {
    return <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>Ingen plan</span>
  }
  const bredde = Math.min(rad.planPct, PLAN_SKALA_MAKS) / PLAN_SKALA_MAKS * 100
  return (
    <div>
      <span data-utover-planpct>{rad.planPct} %</span>
      <div style={{ height: 6, background: 'var(--line2)', borderRadius: 3, position: 'relative', overflow: 'hidden', marginTop: 3 }}>
        <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bredde}%`, borderRadius: 3, background: planPctFarge(rad.planPct, ORANSJE) }} />
        <i style={{ position: 'absolute', left: `${100 / PLAN_SKALA_MAKS * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--tekst-1-app)', opacity: 0.75 }} />
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<AthleteLoggingStatus, string> = {
  active:   'Logget siste 24t',
  delayed:  'Logget for 2 dager siden',
  inactive: 'Ingen logging 3+ dager',
}

function sportLabel(s: Sport | null): string {
  if (!s) return '—'
  return SPORTS.find(x => x.value === s)?.label ?? s
}

function formatLastWorkout(dateIso: string | null, title: string | null): string {
  if (!dateIso) return 'Ingen logging'
  const d = new Date(dateIso + 'T00:00:00')
  const label = d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
  return title ? `${title} · ${label}` : label
}

export function CoachAthleteList({ athletes }: Props) {
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<'all' | Sport>('all')
  const [periode, setPeriode] = useState<Periode>('uke')
  // ÉN henting for hele lista — ingen runde per rad. Perioden lagres SAMMEN med
  // tallene, så «henter …» følger av at svaret gjelder en annen periode (ingen
  // setState synkront i effekten).
  const [tall, setTall] = useState<{ periode: Periode; kart: Map<string, TrenerUtoverRad> } | null>(null)
  useEffect(() => {
    let live = true
    const { fra, til } = periodeDatoer(periode)
    getTrenerOversikt(fra, til).then(r => {
      if (!live || 'error' in r) return
      setTall({ periode, kart: new Map(r.rader.map(x => [x.id, x])) })
    }).catch(() => {})
    return () => { live = false }
  }, [periode])
  const gjeldende = tall && tall.periode === periode ? tall.kart : null
  // Kun ÉN rad åpen om gangen (fasit). Valget huskes ikke mellom sidelastinger.
  const [apen, setApen] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return athletes.filter(a => {
      if (sportFilter !== 'all' && a.primarySport !== sportFilter) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [athletes, query, sportFilter])

  return (
    <section className="mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}
          >
            Utøvere ({athletes.length}) · {PERIODE_NAVN[periode].toLowerCase()}
          </span>
        </div>
        <div className="flex-1" />
        <div data-utover-periode={periode} role="group" aria-label="Periode"
          style={{ display: 'inline-flex', border: '1px solid var(--line2)', borderRadius: 999, overflow: 'hidden' }}>
          {(['uke', 'maaned', 'aar'] as Periode[]).map(p => (
            <button key={p} type="button" data-utover-periodevalg={p} aria-pressed={periode === p} onClick={() => setPeriode(p)}
              style={{ padding: '5px 12px', fontFamily: FONT, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: periode === p ? COACH_BLUE : 'transparent', color: periode === p ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)' }}>
              {PERIODE_NAVN[p]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søk"
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
            minWidth: '160px',
          }}
        />
        <select
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value as 'all' | Sport)}
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          <option value="all">Alle idretter</option>
          {SPORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-6 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {athletes.length === 0 ? 'Ingen utøvere koblet til ennå.' : 'Ingen utøvere matcher filteret.'}
        </p>
      ) : (
        <ul>
          {filtered.map(a => (
            <li key={a.id} style={{ borderTop: '1px solid var(--line)' }} className="first:border-t-0">
              <div className="flex items-center gap-4 px-5 py-4 flex-wrap xp-utoverrad" data-utover-rad={a.id}>
                {/* Status-prikk */}
                <span
                  aria-label={STATUS_LABEL[a.status]}
                  title={STATUS_LABEL[a.status]}
                  style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    backgroundColor: STATUS_COLOR[a.status], flexShrink: 0,
                  }}
                />

                {/* Navn + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/trener/${a.id}`}
                      className="text-base"
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        color: 'var(--tekst-1-app)',
                        letterSpacing: '0.05em',
                        textDecoration: 'none',
                      }}
                    >
                      {a.name}
                    </Link>
                    {a.unreadCount > 0 && (
                      <span
                        className="text-xs px-1.5"
                        style={{
                          backgroundColor: COACH_BLUE,
                          color: 'var(--tekst-1-app)',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          minWidth: '18px', textAlign: 'center',
                        }}
                      >
                        {a.unreadCount}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs tracking-wide mt-0.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}
                  >
                    {sportLabel(a.primarySport)}
                    {a.mainGoal && ` · ${a.mainGoal}`}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}
                  >
                    {formatLastWorkout(a.lastWorkoutDate, a.lastWorkoutTitle)}
                  </p>
                </div>

                {/* BOLK B1: tallene for valgt periode — én aggregator for hele lista. */}
                {(() => {
                  const r = gjeldende?.get(a.id) ?? null
                  if (!r) {
                    return (
                      <div data-utover-tall="laster" style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)', minWidth: 120 }}>
                        {gjeldende ? 'Ingen tall i perioden' : 'Henter tall …'}
                      </div>
                    )
                  }
                  return (
                    <div className="flex items-center gap-4 flex-wrap" data-utover-tall={a.id}>
                      <Celle etikett="Timer" bredde={70}>{fmtTid(r.timerSek)}</Celle>
                      <Celle etikett="% av plan" bredde={96}><PlanBar rad={r} /></Celle>
                      <Celle etikett="Soner" bredde={150}>
                        <div style={{ marginTop: 2 }}><ZoneBar zones={r.soner as unknown as OversiktZoneSeconds} legend={false} /></div>
                        <span style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)' }}>I3+ {fmtTid(r.hardSek)}</span>
                      </Celle>
                      {r.harSkiskyting && (
                        <Celle etikett="Skudd · treff" bredde={92}>
                          {r.skudd ? r.skudd : '—'}
                          <span style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)', marginLeft: 5 }}>{r.treffPct != null ? `${r.treffPct} %` : ''}</span>
                        </Celle>
                      )}
                      <Celle etikett="HRV" bredde={78}>
                        {!r.helseDelt ? <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>ikke delt</span>
                          : r.hrv == null ? '—'
                          : <>{r.hrv}{r.hrvEndring != null && r.hrvEndring !== 0 && (
                              <span style={{ fontFamily: FONT, fontSize: 11, marginLeft: 4, color: r.hrvEndring > 0 ? STATUS_GRONN : STATUS_ROD }}>
                                {r.hrvEndring > 0 ? '▲' : '▼'} {Math.abs(r.hrvEndring)}
                              </span>
                            )}</>}
                      </Celle>
                    </div>
                  )
                })()}

                {/* Quick actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/app/innboks?to=${a.id}`}
                    className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
                      textDecoration: 'none',
                    }}
                  >
                    Meld
                  </Link>
                  <Link
                    href={`/app/trener/${a.id}?push=1`}
                    className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
                      textDecoration: 'none',
                    }}
                  >
                    Push
                  </Link>
                  <button
                    type="button"
                    data-utover-vismer={a.id}
                    aria-expanded={apen === a.id}
                    onClick={() => setApen(apen === a.id ? null : a.id)}
                    className="px-2 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                    style={{
                      fontFamily: FONT, backgroundColor: COACH_BLUE, color: 'var(--tekst-1-ren)',
                      border: 'none', borderRadius: 6, cursor: 'pointer', minHeight: 30,
                    }}
                  >
                    {apen === a.id ? 'Vis mindre ▴' : 'Vis mer ▾'}
                  </button>
                </div>
              </div>
              {apen === a.id && (() => {
                const r = gjeldende?.get(a.id) ?? null
                const { fra, til } = periodeDatoer(periode)
                return <UtoverDetaljer athleteId={a.id} navn={a.name} fra={fra} til={til}
                  harSkiskyting={r?.harSkiskyting ?? false} helseDelt={r?.helseDelt ?? false} />
              })()}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
