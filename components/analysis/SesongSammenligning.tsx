'use client'

// Sesong mot sesong (prestasjonsmodellen bolk 4). ÉN komponent
// (regel 11) montert to steder: Analyse › Oversikt og nederst under
// Årsplan. Par-søyler per månedsindeks fra sesongstart — valgt sesong
// i oransje, sammenligningen dempet (fargefasiten). Sesongene og
// metrikken velges fritt; metrikk-byttet er rent klient-side og
// svarer i samme tick (regel 20). Aldri dobbel y-akse.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { getSeasons, type Season } from '@/app/actions/seasons'
import { getSesongData, type SesongData } from '@/app/actions/sesong-sammenligning'
import { ChartWrapper } from './ChartWrapper'
import { XpTooltip, CHART_GRID, CHART_GRID_ZERO, CHART_AXIS_TICK } from './chart-theme'

type Metrikk = 'timer' | 'km' | 'okter' | 'ef'
const METRIKKER: [Metrikk, string][] = [
  ['timer', 'Timer'], ['km', 'KM'], ['okter', 'Økter'], ['ef', 'EF'],
]
const ORANSJE = '#FF4500'
const DEMPET = 'var(--line2)'

interface Props {
  // Server-montering (Årsplan) sender sesongene; Analyse-siden lar
  // komponenten hente selv.
  initialSeasons?: Season[]
  targetUserId?: string
}

export function SesongSammenligning({ initialSeasons, targetUserId }: Props) {
  const [seasons, setSeasons] = useState<Season[] | null>(initialSeasons ?? null)
  const [valgA, setValgA] = useState<string | null>(initialSeasons?.[0]?.id ?? null)
  const [valgB, setValgB] = useState<string | null>(initialSeasons?.[1]?.id ?? null)
  const [metrikk, setMetrikk] = useState<Metrikk>('timer')
  const [dataById, setDataById] = useState<Record<string, SesongData>>({})

  useEffect(() => {
    if (seasons !== null) return
    let cancelled = false
    getSeasons(targetUserId).then(res => {
      if (cancelled || 'error' in res) { if (!cancelled) setSeasons([]); return }
      setSeasons(res)
      setValgA(res[0]?.id ?? null)
      setValgB(res[1]?.id ?? null)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    for (const id of [valgA, valgB]) {
      if (!id || dataById[id]) continue
      getSesongData(id, targetUserId).then(res => {
        if ('error' in res) return
        setDataById(prev => (prev[id] ? prev : { ...prev, [id]: res }))
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valgA, valgB, targetUserId])

  const a = valgA ? dataById[valgA] : undefined
  const b = valgB ? dataById[valgB] : undefined
  const navnA = seasons?.find(s => s.id === valgA)?.name ?? ''
  const navnB = seasons?.find(s => s.id === valgB)?.name ?? ''

  // Par per månedsindeks fra sesongstart — sesonger kan ha ulik
  // lengde/startmåned; indeksen er sammenligningsaksen, etiketten
  // følger den valgte sesongen.
  const rader = useMemo(() => {
    if (!a) return []
    const antall = Math.max(a.maaneder.length, b?.maaneder.length ?? 0)
    const ut: { label: string; a: number | null; b: number | null }[] = []
    for (let i = 0; i < antall; i++) {
      const ma = a.maaneder[i]
      const mb = b?.maaneder[i]
      ut.push({
        label: ma?.label ?? mb?.label ?? '',
        a: ma ? ma[metrikk] : null,
        b: mb ? mb[metrikk] : null,
      })
    }
    return ut
  }, [a, b, metrikk])

  const stravaUtenforEf = (a?.stravaUtenforEf ?? 0) + (b?.stravaUtenforEf ?? 0)

  const velgerStil: React.CSSProperties = {
    backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
    color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, padding: '6px 10px', borderRadius: 8, maxWidth: 180,
  }

  return (
    <ChartWrapper
      title="Sesong mot sesong"
      subtitle="Per måned fra sesongstart — sesonggrensene følger årsplanen"
      height="auto">
      {seasons === null ? (
        <p className="py-6 text-center text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          Henter sesonger …
        </p>
      ) : seasons.length === 0 ? (
        <p className="py-6 text-center text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          Ingen sesonger ennå —{' '}
          <Link href="/app/periodisering" style={{ color: ORANSJE }}>opprett en i Årsplan</Link>{' '}
          for å sammenligne.
        </p>
      ) : (
        <div>
          {/* Kontrollrad over grafen → height=auto (regel 17). */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select aria-label="Valgt sesong" value={valgA ?? ''} style={velgerStil}
              onChange={e => setValgA(e.target.value || null)}>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 13 }}>mot</span>
            <select aria-label="Sammenlignings-sesong" value={valgB ?? ''} style={velgerStil}
              onChange={e => setValgB(e.target.value || null)}>
              <option value="">Ingen</option>
              {seasons.filter(s => s.id !== valgA).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="flex gap-1.5 ml-auto">
              {METRIKKER.map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMetrikk(m)}
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    color: metrikk === m ? ORANSJE : 'var(--tekst-8-app)',
                    background: metrikk === m ? 'rgba(255,69,0,.08)' : 'none',
                    border: `1px solid ${metrikk === m ? ORANSJE : 'var(--kant-3)'}`,
                    borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
                  }}>
                  {label}
                </button>
              ))}
            </span>
          </div>

          {metrikk === 'ef' && (
            <p className="text-xs mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              EF: snitt per måned av rolige økter over 20 min
              {stravaUtenforEf > 0 && ` · ${stravaUtenforEf} Strava-økter teller i volum, men holdes utenfor EF (Stravas vilkår)`}
              .
            </p>
          )}

          {!a ? (
            <p className="py-6 text-center text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Henter sesongdata …
            </p>
          ) : (
            <>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={rader} barGap={3}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
                    <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={44} />
                    <Tooltip
                      content={<XpTooltip />}
                      formatter={(v, name) => [
                        <span key="r"><strong>{Number(v)}</strong> {metrikk === 'okter' ? 'økter' : metrikk === 'timer' ? 't' : metrikk === 'km' ? 'km' : ''}</span>,
                        name === 'b' ? navnB : navnA,
                      ]}
                    />
                    {valgB && <Bar dataKey="b" fill={DEMPET} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
                    <Bar dataKey="a" fill={ORANSJE} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                {valgB && (
                  <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: DEMPET, marginRight: 5 }} />{navnB}</span>
                )}
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: ORANSJE, marginRight: 5 }} />{navnA}</span>
              </div>
              {seasons.length === 1 && (
                <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                  Bare én sesong ennå —{' '}
                  <Link href="/app/periodisering" style={{ color: ORANSJE }}>opprett flere i Årsplan</Link>{' '}
                  for å sammenligne.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </ChartWrapper>
  )
}
