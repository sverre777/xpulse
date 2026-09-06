'use client'

// BOLK B3 (Trenerside v2, Sverre 6. sep): «Side om side» - én kolonne per utøver
// med en metrikkvelger over. Velgeren styrer ALLE kolonnene samtidig, aldri én
// og én. Over fire kolonner scroller raden vannrett; kortene beholder bredden.
//
// Ingen nye tall: alt kommer fra getMultipleAthletesAnalysis, som nå også henter
// skyting (getShootingDepthAnalysis) og terskel (getTerskelAnalysis). WorkoutStats
// var hentet uten å brukes - den bærer nå «timer per uke» (regel 21).

import { useMemo, useState } from 'react'
import type { MultipleAthletesAnalysis, AthleteMetricsSnapshot } from '@/app/actions/comparison'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES } from '@/lib/heart-zones'
import { TRENER_BLAA, STATUS_GRONN, STATUS_ROD, planPctFarge } from '@/lib/status-farger'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'

export type MetrikkNokkel =
  | 'timer' | 'distanse' | 'okter' | 'soner' | 'hard' | 'plan'
  | 'ctl' | 'tsb' | 'hrv' | 'hvilepuls' | 'sovn' | 'dagsform'
  | 'treff' | 'skudd' | 'skytetid' | 'terskel'
  | 'konkurranser' | 'aarsplan' | 'bevform' | 'hoydemeter' | 'timerPerUke'

interface Metrikk {
  nokkel: MetrikkNokkel
  navn: string
  /** Verdien i kolonnen. null = «-» (ingen data), 'ikke delt' håndteres av kilden. */
  verdi: (s: AthleteMetricsSnapshot) => React.ReactNode
}

function fmtTid(sek: number): string {
  if (!sek || sek <= 0) return '-'
  const t = Math.floor(sek / 3600), m = Math.round((sek % 3600) / 60)
  return t > 0 ? `${t}:${String(m).padStart(2, '0')}` : `${m} min`
}
function snitt(v: (number | null | undefined)[]): number | null {
  const t = v.filter((x): x is number => x != null)
  return t.length > 0 ? Math.round((t.reduce((s, x) => s + x, 0) / t.length) * 10) / 10 : null
}
function hardSek(s: AthleteMetricsSnapshot): number {
  const z = s.overview?.current.zone_seconds
  if (!z) return 0
  return (z.I3 ?? 0) + (z.I4 ?? 0) + (z.I5 ?? 0) + (z.I6 ?? 0) + (z.I7 ?? 0) + (z.I8 ?? 0) + (z.Hurtighet ?? 0)
}

/** Sonestripa - samme farger som ellers (ZONE_COLORS_V2). */
function Sonestripe({ s }: { s: AthleteMetricsSnapshot }) {
  const z = s.overview?.current.zone_seconds
  const sum = z ? ALL_ZONE_NAMES.reduce((a, k) => a + (z[k] ?? 0), 0) : 0
  if (!z || sum <= 0) return <span>-</span>
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
      {ALL_ZONE_NAMES.filter(k => (z[k] ?? 0) > 0).map(k => (
        <i key={k} title={`${k} ${fmtTid(z[k] ?? 0)}`} style={{ width: `${((z[k] ?? 0) / sum) * 100}%`, background: ZONE_COLORS_V2[k] }} />
      ))}
    </div>
  )
}

const METRIKKER: Metrikk[] = [
  { nokkel: 'timer', navn: 'Timer', verdi: s => fmtTid(s.overview?.current.total_seconds ?? 0) },
  { nokkel: 'distanse', navn: 'Distanse', verdi: s => { const m = s.overview?.current.total_meters ?? 0; return m > 0 ? `${Math.round(m / 100) / 10} km` : '-' } },
  { nokkel: 'okter', navn: 'Økter', verdi: s => String(s.overview?.current.workout_count ?? 0) },
  { nokkel: 'hard', navn: 'Hard I3+', verdi: s => fmtTid(hardSek(s)) },
  { nokkel: 'soner', navn: 'Soner', verdi: s => <Sonestripe s={s} /> },
  {
    nokkel: 'plan', navn: '% av plan', verdi: s => {
      const p = s.plan
      if (!p || p.planned.totalMinutes <= 0) return <span style={{ color: 'var(--tekst-8-app)' }}>ingen plan</span>
      const pct = Math.round((p.actual.totalMinutes / p.planned.totalMinutes) * 100)
      return <span style={{ color: planPctFarge(pct, ORANSJE) }}>{pct} %</span>
    },
  },
  { nokkel: 'ctl', navn: 'CTL', verdi: s => (s.belastning?.hasData ? String(Math.round(s.belastning.current.ctl)) : '-') },
  { nokkel: 'tsb', navn: 'TSB', verdi: s => { const b = s.belastning; if (!b?.hasData) return '-'; const v = Math.round(b.current.tsb); return <span style={{ color: v >= 0 ? STATUS_GRONN : STATUS_ROD }}>{v > 0 ? `+${v}` : v}</span> } },
  { nokkel: 'hrv', navn: 'HRV', verdi: s => { const v = snitt((s.health?.daily ?? []).map(d => d.hrv_ms)); return v == null ? <span style={{ color: 'var(--tekst-8-app)' }}>ikke delt</span> : String(v) } },
  { nokkel: 'hvilepuls', navn: 'Hvilepuls', verdi: s => { const v = snitt((s.health?.daily ?? []).map(d => d.resting_hr)); return v == null ? <span style={{ color: 'var(--tekst-8-app)' }}>ikke delt</span> : String(v) } },
  { nokkel: 'sovn', navn: 'Søvn', verdi: s => { const v = snitt((s.health?.daily ?? []).map(d => d.sleep_hours)); return v == null ? <span style={{ color: 'var(--tekst-8-app)' }}>ikke delt</span> : `${String(v).replace('.', ',')} t` } },
  { nokkel: 'dagsform', navn: 'Dagsform', verdi: s => { const v = snitt((s.health?.daily ?? []).map(d => d.day_form)); return v == null ? '-' : `${String(v).replace('.', ',')}/10` } },
  { nokkel: 'treff', navn: 'Treff %', verdi: s => { const a = s.skyting?.totals.accuracy_pct; return a == null ? '-' : `${a} %` } },
  { nokkel: 'skudd', navn: 'Skudd', verdi: s => { const n = s.skyting?.totals.shots ?? 0; return n > 0 ? String(n) : '-' } },
  {
    nokkel: 'skytetid', navn: 'Skytetid', verdi: s => {
      const t = (s.skyting?.series ?? []).map(x => x.duration_seconds).filter((v): v is number => v != null && v > 0)
      return t.length > 0 ? `${(Math.round((t.reduce((a, v) => a + v, 0) / t.length) * 10) / 10).toString().replace('.', ',')} s` : '-'
    },
  },
  {
    nokkel: 'terskel', navn: 'LT2 puls / laktat', verdi: s => {
      const e = s.terskel?.estimate
      const lt2 = e?.lt2_hr ?? e?.profile_threshold_hr ?? null
      const siste = (s.terskel?.historikk ?? []).slice(-1)[0]
      const fart = siste?.threshold_pace_sec_km
      return (
        <>
          {lt2 != null ? `${lt2} slag` : '-'}
          {fart != null && <span style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)', marginLeft: 6 }}>{Math.floor(fart / 60)}:{String(Math.round(fart % 60)).padStart(2, '0')}/km</span>}
        </>
      )
    },
  },
  { nokkel: 'konkurranser', navn: 'Konkurranser', verdi: s => String(s.overview?.current.competitions.length ?? 0) },
  { nokkel: 'aarsplan', navn: 'Årsplan', verdi: s => (s.periodization ? 'Lagt' : <span style={{ color: 'var(--tekst-8-app)' }}>ingen</span>) },
  { nokkel: 'bevform', navn: 'Bev.former', verdi: s => { const r = s.overview?.current.movement_breakdown ?? []; return r.length > 0 ? r.slice(0, 2).map(x => x.movement_name).join(' · ') : '-' } },
  { nokkel: 'hoydemeter', navn: 'Høydemeter', verdi: s => { const m = s.overview?.current.sport_specific?.elevation_meters; return m ? `${Math.round(m)} m` : '-' } },
  {
    nokkel: 'timerPerUke', navn: 'Timer per uke', verdi: s => {
      const uker = s.stats?.weeks ?? []
      if (uker.length === 0) return '-'
      const maks = Math.max(...uker.map(u => u.totalSeconds))
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26, marginTop: 4 }}>
          {uker.slice(-12).map(u => (
            <i key={u.weekKey} title={`${u.label}: ${fmtTid(u.totalSeconds)}`}
              style={{ flex: 1, minWidth: 3, height: `${maks > 0 ? Math.max(2, (u.totalSeconds / maks) * 100) : 2}%`, background: TRENER_BLAA, borderRadius: '2px 2px 0 0' }} />
          ))}
        </div>
      )
    },
  },
]

const STANDARD: MetrikkNokkel[] = ['timer', 'hard', 'plan', 'soner', 'ctl', 'tsb', 'treff', 'terskel', 'timerPerUke']

export function SammenligneKolonner({ data, valgte, onValgte }: {
  data: MultipleAthletesAnalysis
  valgte?: MetrikkNokkel[]
  onValgte?: (v: MetrikkNokkel[]) => void
}) {
  const [egne, setEgne] = useState<MetrikkNokkel[]>(STANDARD)
  const paa = valgte ?? egne
  const settPaa = (v: MetrikkNokkel[]) => { if (onValgte) onValgte(v); else setEgne(v) }
  const rader = useMemo(() => METRIKKER.filter(m => paa.includes(m.nokkel)), [paa])
  const kolonner = data.athletes

  return (
    <div data-sammenligne-kolonner>
      {/* Metrikkvelgeren styrer ALLE kolonnene samtidig. */}
      <div className="flex flex-wrap gap-2 mb-4" data-metrikkvelger>
        {METRIKKER.map(m => {
          const aktiv = paa.includes(m.nokkel)
          return (
            <button key={m.nokkel} type="button" data-metrikk={m.nokkel} aria-pressed={aktiv}
              onClick={() => settPaa(aktiv ? paa.filter(x => x !== m.nokkel) : [...paa, m.nokkel])}
              style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                border: `1px solid ${aktiv ? TRENER_BLAA : 'var(--line2)'}`, borderRadius: 999, padding: '6px 11px',
                background: aktiv ? `color-mix(in srgb, ${TRENER_BLAA} 16%, transparent)` : 'transparent',
                color: aktiv ? TRENER_BLAA : 'var(--tekst-5-app)', cursor: 'pointer', minHeight: 32,
              }}>
              {m.navn}
            </button>
          )
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div data-kolonnerad style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: kolonner.length > 4 ? '300px' : 'minmax(0, 1fr)', gap: 12, minWidth: 'min-content' }}>
          {kolonner.map(s => (
            <div key={s.athlete.id} data-utoverkolonne={s.athlete.id}
              style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', minWidth: 0 }}>
              <div style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: '0.04em', color: 'var(--tekst-1-app)' }}>
                {s.athlete.fullName ?? 'Utøver'}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)', marginBottom: 8 }}>
                {s.permissions.can_view_analysis ? (s.athlete.primarySport ?? '') : 'Mangler analyse-tilgang'}
              </div>
              {rader.map(m => (
                <div key={m.nokkel} data-kolonnerad-metrikk={m.nokkel}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'baseline', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <small style={{ fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{m.navn}</small>
                  <span style={{ fontFamily: BEBAS, fontSize: 18, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', textAlign: 'right', minWidth: 0 }}>
                    {s.permissions.can_view_analysis ? m.verdi(s) : '-'}
                  </span>
                </div>
              ))}
              {/* Soner og timer per uke tegnes i full bredde under tallene. */}
            </div>
          ))}
        </div>
      </div>
      {kolonner.length > 4 && (
        <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)', marginTop: 6 }}>
          Over fire kolonner scroller raden vannrett - kortene beholder bredden.
        </p>
      )}
    </div>
  )
}
