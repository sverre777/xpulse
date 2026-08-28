'use client'

// Analyse › Prestasjon (bolk 3, plasseringskartet godkjent 28. aug):
// EF-trend per bevegelsesform + frakoblings-utvikling. Overtar og
// avløser Klokkedata-fanens «Aerob effektivitet»/«Watt/HR»/«Cardiac
// drift» (regel 11 — én ting bor ett sted). Fase 2 (kurver → eFTP →
// W′) får samme hjem senere.
//
// Regel 2: Strava-økter er holdt utenfor av actionen — flaten SIER FRA
// når trendene viser en delmengde. Aldri dobbel y-akse.

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts'
import type { PrestasjonAnalyse, EfPunkt, FrakoblingsPunkt } from '@/app/actions/prestasjon-analyse'
import { ChartWrapper } from './ChartWrapper'
import {
  XpTooltip, CHART_GRID, CHART_GRID_ZERO, CHART_AXIS_TICK,
} from '@/components/analysis/chart-theme'

const GRAD_FARGER = { god: '#28A86E', middels: '#E2A33A', svak: '#E23A5A' } as const

export function PrestasjonTab({ data }: { data: PrestasjonAnalyse }) {
  return (
    <div className="space-y-4">
      {data.stravaEkskludert > 0 && (
        <p className="text-xs px-3 py-2" style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
          border: '1px solid var(--kant-3)', borderLeft: '3px solid #FC5200',
          backgroundColor: 'var(--flate-12-alt)',
        }}>
          {data.stravaEkskludert} Strava-{data.stravaEkskludert === 1 ? 'økt er' : 'økter er'} holdt
          utenfor trendene (Stravas vilkår) — grafene viser en delmengde av treningen.
        </p>
      )}
      <EfSection data={data} />
      <FrakoblingSection data={data} />
    </div>
  )
}

// Eksportert også til FavoriteChartsSection (stjernede grafer på
// Oversikt) — samme komponent begge steder, regel 11. Utvalgs-
// etikettene er del av grafen: et skjult filter skal aldri være
// usynlig på flaten (konvensjonen).
export function EfSection({ data }: { data: PrestasjonAnalyse }) {
  const [valgtBevegelse, setValgtBevegelse] = useState<string | null>(null)
  const serie = useMemo(() => {
    if (data.efSerier.length === 0) return null
    return data.efSerier.find(s => s.bevegelse === valgtBevegelse) ?? data.efSerier[0]
  }, [data.efSerier, valgtBevegelse])

  return (
      <ChartWrapper
        title="Effektivitetsfaktor"
        subtitle="Output per pulsslag — stigende = aerob fremgang uten test · kun rolige økter, intervaller og konkurranser holdes utenfor"
        height="auto"
        chartKey="prestasjon_ef">
        {serie ? (
          <div>
            {/* Kontrollrad over grafen → height=auto (regel 17). */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {data.efSerier.map(s => (
                <button key={s.bevegelse} type="button"
                  onClick={() => setValgtBevegelse(s.bevegelse)}
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    color: s.bevegelse === serie.bevegelse ? 'var(--accent)' : 'var(--tekst-8-app)',
                    background: s.bevegelse === serie.bevegelse ? 'rgba(255,69,0,.08)' : 'none',
                    border: `1px solid ${s.bevegelse === serie.bevegelse ? 'var(--accent)' : 'var(--kant-3)'}`,
                    borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
                  }}>
                  {s.bevegelse} ({s.punkter.length})
                </button>
              ))}
            </div>
            <div style={{ height: 260 }}>
              <EfChart punkter={serie.punkter} />
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Ingen økter med puls og fart/watt (minst 20 min) i perioden ennå.
          </p>
        )}
      </ChartWrapper>
  )
}

export function FrakoblingSection({ data }: { data: PrestasjonAnalyse }) {
  return (
    <div>
      <ChartWrapper
        title="Aerob frakobling"
        subtitle="Utvalg: jevne økter over 40 min med pulskurve og fart/watt — under 5 % betyr at pulsen holder følge hele veien"
        height={data.frakobling.length > 0 ? 300 : 'auto'}
        chartKey="prestasjon_frakobling">
        {data.frakobling.length > 0 ? (
          <FrakoblingChart punkter={data.frakobling} />
        ) : (
          <p className="py-8 text-center text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Ingen kvalifiserte økter i perioden — frakobling krever en jevn
            økt over 40 minutter med pulskurve og fart eller watt fra klokka.
          </p>
        )}
      </ChartWrapper>
      {data.frakoblingCapNaadd && (
        <p className="text-xs mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          Frakoblingsgrafen viser de 50 nyeste kandidat-øktene i perioden.
        </p>
      )}
    </div>
  )
}

function EfChart({ punkter }: { punkter: EfPunkt[] }) {
  const kilde = punkter.some(p => p.kilde === 'watt') ? 'watt' : 'fart'
  const enhet = kilde === 'watt' ? 'W per slag' : 'm/s per slag'
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={punkter}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="date" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={56}
          domain={['auto', 'auto']} />
        <Tooltip
          content={<XpTooltip />}
          formatter={(v, _navn, item) => {
            const p = item.payload as EfPunkt
            return [
              <span key="r"><strong>{Number(v)}</strong> {enhet} · puls {p.hr}</span>,
              p.title,
            ]
          }}
        />
        <Line type="monotone" dataKey="verdi" stroke="#3DD68C" strokeWidth={1.5}
          dot={{ r: 3, fill: '#3DD68C' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function FrakoblingChart({ punkter }: { punkter: FrakoblingsPunkt[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={punkter}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="date" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={44}
          tickFormatter={v => `${v}%`} />
        {/* Utkastets terskler — 5 % (god/middels) og 10 % (middels/svak). */}
        <ReferenceLine y={5} stroke={GRAD_FARGER.middels} strokeDasharray="4 4" />
        <ReferenceLine y={10} stroke={GRAD_FARGER.svak} strokeDasharray="4 4" />
        <Tooltip
          content={<XpTooltip />}
          formatter={(v, _navn, item) => {
            const p = item.payload as FrakoblingsPunkt
            return [
              <span key="r">
                <strong style={{ color: GRAD_FARGER[p.grad] }}>{Number(v).toFixed(1)} %</strong>
                {' '}({p.kilde === 'watt' ? 'Pw:Hr' : 'Pa:Hr'}, {p.grad})
              </span>,
              p.title,
            ]
          }}
        />
        <Line type="monotone" dataKey="driftPct" stroke="#5B8DEF" strokeWidth={1.5}
          isAnimationActive={false}
          dot={(props) => {
            const p = props.payload as FrakoblingsPunkt
            return (
              <circle key={`${p.workout_id}`} cx={props.cx} cy={props.cy} r={4}
                fill={GRAD_FARGER[p.grad]} stroke="none" />
            )
          }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
