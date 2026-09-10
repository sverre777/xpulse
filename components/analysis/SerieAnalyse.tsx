'use client'

// BOLK 6 (Analyse v2 + tillegg 6. sep) — STANDARDØKTER: ALT OVER TID + SIDE OM SIDE.
// Per serie: velg gjennomføringer (avkrysning · siste 5 · beste · konkurranser),
// ÉN graf m/ variabelvelger (drag-indeks som serie eller hele økta), TABELLEN
// «alle gjennomføringer × alle variabler» (sorterbar, delta vs forrige/beste,
// beste markert), og ØktGraf-ene OPPÅ HVERANDRE / SIDE OM SIDE (samme
// komponent som Sammenligning, bolk 5). Stjerne: favoritt = serie + variabel.
// Alle tall fra hentSerieAnalyse (lib-formler) — ingen kopier her.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceDot } from 'recharts'
import { hentSerieAnalyse, type SerieAnalyse as SerieAnalyseData, type SerieRad } from '@/app/actions/serie-analyse'
import type { SessionSeriesWithExecutions } from '@/app/actions/standard-sessions'
import { ChartWrapper } from './ChartWrapper'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE } from './chart-theme'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'
import { SammenligningVisning, type SammenligningVisningValg } from './SammenligningVisning'
import { formatPace } from '@/lib/pace-utils'
import { WEATHER_LABELS } from '@/lib/types'

const FONT = "'Barlow Condensed', sans-serif"
const FARGER = ['#FF4500', '#1A6FD4', '#28A86E', '#E8B93C', '#A855F7', '#0EA5E9', '#F97316', '#E23A5A']
const fmtDato = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}` }
const fmtHM = (sek: number) => { const m = Math.round(sek / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}t ${String(m % 60).padStart(2, '0')}` }
const fmtPace = (s: number) => `${formatPace(Math.round(s), 'min_per_km')}`

/** Variablene — id, navn, per drag eller hele økta, henter verdi, format, «lavere er bedre». */
interface Variabel { id: string; navn: string; perDrag: boolean; hel: (r: SerieRad) => number | null; drag?: (d: SerieRad['drag'][number]) => number | null; fmt: (v: number) => string; lavereBedre: boolean; skyting?: boolean }
const VARIABLER: Variabel[] = [
  { id: 'tid', navn: 'Tid', perDrag: true, hel: r => r.totalSek || null, drag: d => d.sek, fmt: v => fmtHM(v), lavereBedre: true },
  { id: 'tempo', navn: 'Tempo', perDrag: true, hel: r => r.tempoSekPerKm, drag: d => d.tempoSekPerKm, fmt: v => fmtPace(v), lavereBedre: true },
  { id: 'puls', navn: 'Snittpuls', perDrag: true, hel: r => r.snittpuls, drag: d => d.snittpuls, fmt: v => `${Math.round(v)}`, lavereBedre: true },
  { id: 'makspuls', navn: 'Makspuls', perDrag: true, hel: r => r.makspuls, drag: d => d.makspuls, fmt: v => `${Math.round(v)}`, lavereBedre: true },
  { id: 'watt', navn: 'Watt', perDrag: true, hel: r => r.snittwatt, drag: d => d.watt, fmt: v => `${Math.round(v)} W`, lavereBedre: false },
  { id: 'np', navn: 'NP', perDrag: false, hel: r => r.np, fmt: v => `${Math.round(v)} W`, lavereBedre: false },
  { id: 'kadens', navn: 'Kadens', perDrag: false, hel: r => r.kadens, fmt: v => `${Math.round(v)}`, lavereBedre: false },
  { id: 'laktat', navn: 'Laktat maks', perDrag: false, hel: r => r.laktatMaks, fmt: v => `${v.toFixed(1).replace('.', ',')} mmol`, lavereBedre: true },
  { id: 'treff', navn: 'Treff %', perDrag: true, hel: r => r.treffPct, drag: d => d.treff && d.treff.shots > 0 ? Math.round((d.treff.hits / d.treff.shots) * 1000) / 10 : null, fmt: v => `${v} %`, lavereBedre: false, skyting: true },
  { id: 'skytetid', navn: 'Skytetid', perDrag: false, hel: r => r.skytetidSnitt, fmt: v => `${v} s`, lavereBedre: true, skyting: true },
  { id: 'opplevd', navn: 'Opplevd', perDrag: false, hel: r => r.opplevd, fmt: v => `${v}`, lavereBedre: true },
  { id: 'ef', navn: 'EF', perDrag: false, hel: r => r.ef, fmt: v => `${v}`, lavereBedre: false },
  { id: 'frakobling', navn: 'Frakobling', perDrag: false, hel: r => r.frakoblingPct, fmt: v => `${v.toFixed(1).replace('.', ',')} %`, lavereBedre: true },
  { id: 'terskel', navn: '% av terskel', perDrag: false, hel: r => r.pctAvTerskel, fmt: v => `${v} %`, lavereBedre: true },
]

function bestIdx(rader: SerieRad[], v: Variabel): number {
  let b = -1, bv: number | null = null
  rader.forEach((r, i) => { const x = v.hel(r); if (x == null) return; if (bv == null || (v.lavereBedre ? x < bv : x > bv)) { bv = x; b = i } })
  return b
}

export function SerieAnalyse({ serie, harSki, targetUserId, initialConfig, chartKey = 'standardokter_serie' }: {
  serie: SessionSeriesWithExecutions
  harSki: boolean
  targetUserId?: string
  initialConfig?: Record<string, unknown> | null
  chartKey?: string
}) {
  const alleIds = useMemo(() => serie.executions.map(e => e.workout_id), [serie.executions])
  const [valgte, setValgte] = useState<string[]>(() => Array.isArray(initialConfig?.valgte) ? (initialConfig.valgte as string[]).filter(id => alleIds.includes(id)) : alleIds.slice(-5))
  const [variabel, setVariabel] = useState<string>(typeof initialConfig?.variabel === 'string' ? initialConfig.variabel : 'tid')
  const [modus, setModus] = useState<SammenligningVisningValg>(initialConfig?.modus === 'rutenett' || initialConfig?.modus === 'stablet' ? initialConfig.modus : 'oppa')
  const [data, setData] = useState<SerieAnalyseData | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [sort, setSort] = useState<{ id: string; opp: boolean }>({ id: 'dato', opp: true })

  useEffect(() => {
    let live = true
    hentSerieAnalyse(alleIds, valgte, targetUserId)
      .then(res => { if (!live) return; if ('error' in res) setFeil(res.error); else { setData(res); setFeil(null) } })
      .catch((e: unknown) => { if (live) setFeil(`Kunne ikke hente serien: ${e instanceof Error ? e.message : String(e)}`) })
    return () => { live = false }
  }, [alleIds, valgte, targetUserId])

  const rader = useMemo(() => data?.rader ?? [], [data])
  const variabler = VARIABLER.filter(v => (!v.skyting || harSki) && rader.some(r => v.hel(r) != null))
  const v = variabler.find(x => x.id === variabel) ?? variabler[0] ?? VARIABLER[0]
  const beste = bestIdx(rader, v)
  const config = { serieId: serie.id, valgte, variabel: v.id, modus }
  const valgteRader = rader.filter(r => valgte.includes(r.workout_id))

  // Graf: per drag (linje per drag-indeks) eller hele økta (én linje), x = dato, kun valgte.
  // Rene avledninger — React-kompilatoren memoiserer selv (manuell useMemo på avledede objekter brøt den).
  const grafRader = valgteRader.map(r => {
    const rad: Record<string, string | number | null> = { dato: fmtDato(r.date), hel: v.hel(r) }
    if (v.perDrag && v.drag) for (const d of r.drag) rad[`d${d.idx}`] = v.drag(d)
    return rad
  })
  const maksDrag = Math.max(0, ...valgteRader.map(r => r.drag.length))
  const [perDrag, setPerDrag] = useState(true)
  const visPerDrag = perDrag && v.perDrag && maksDrag > 1

  const hurtig = (hvilke: 'siste5' | 'beste' | 'konk' | 'alle') => {
    if (hvilke === 'siste5') setValgte(alleIds.slice(-5))
    else if (hvilke === 'alle') setValgte(alleIds.slice(-6))
    else if (hvilke === 'konk') setValgte(rader.filter(r => r.erKonkurranse).map(r => r.workout_id).slice(-6))
    else { const sortert = [...rader].filter(r => v.hel(r) != null).sort((a, b) => v.lavereBedre ? v.hel(a)! - v.hel(b)! : v.hel(b)! - v.hel(a)!); setValgte(sortert.slice(0, 5).map(r => r.workout_id)) }
  }
  const toggle = (id: string) => setValgte(x => x.includes(id) ? x.filter(y => y !== id) : (x.length >= 6 ? x : [...x, id]))

  const sortert = (() => {
    const kol = VARIABLER.find(x => x.id === sort.id)
    const arr = [...rader]
    arr.sort((a, b) => { const va = kol ? kol.hel(a) : a.date, vb = kol ? kol.hel(b) : b.date; if (va == null) return 1; if (vb == null) return -1; return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.opp ? 1 : -1) })
    return arr
  })()

  const th: React.CSSProperties = { fontFamily: FONT, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }
  const td: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  const delta = (r: SerieRad, i: number, kol: Variabel): ReactNode => {
    const x = kol.hel(r); if (x == null) return null
    const forrige = rader[rader.indexOf(r) - 1]; const fv = forrige ? kol.hel(forrige) : null
    const bv = beste >= 0 ? kol.hel(rader[bestIdx(rader, kol)]) : null
    const d = (a: number | null) => a == null ? '-' : `${x - a > 0 ? '+' : ''}${kol.fmt(Math.abs(x - a)).replace(/^/, x - a < 0 ? '−' : '')}`
    void i
    return <span style={{ color: 'var(--tekst-8-app)', fontSize: 11, marginLeft: 4 }} title="mot forrige · mot beste">({d(fv)} · {d(bv)})</span>
  }

  return (
    <div className="space-y-4" data-serie-analyse={serie.id}>
      <ChartWrapper chartKey={chartKey} title={`${serie.name} - over tid`} height="auto" config={config}
        subtitle="Velg gjennomføringer og variabel - per drag (én linje per drag-indeks) eller hele økta. Beste markert. Lavere er bedre for tid, tempo, puls, laktat, opplevd og frakobling.">
        <div className="flex gap-4 flex-wrap items-center mb-2">
          <Gruppe navn="Gjennomføringer">
            <Chip farge="var(--accent)" etikett="Siste 5" paa={false} fokus={false} onClick={() => hurtig('siste5')} />
            <Chip farge="var(--accent)" etikett="Beste 5" paa={false} fokus={false} onClick={() => hurtig('beste')} />
            {rader.some(r => r.erKonkurranse) && <Chip farge="#E23A5A" etikett="Konkurranser" paa={false} fokus={false} onClick={() => hurtig('konk')} />}
            <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>{valgte.length} valgt (maks 6) - kryss av i tabellen</span>
          </Gruppe>
        </div>
        <div className="flex gap-4 flex-wrap items-center mb-2">
          <Gruppe navn="Variabel">
            {variabler.map(x => <Chip key={x.id} farge="var(--accent)" etikett={x.navn} paa={v.id === x.id} fokus={v.id === x.id} onClick={() => setVariabel(x.id)} />)}
          </Gruppe>
          {v.perDrag && maksDrag > 1 && <Chip farge="#1A6FD4" etikett="Per drag" paa={visPerDrag} fokus={false} onClick={() => setPerDrag(p => !p)} />}
        </div>
        {feil ? <p style={{ fontFamily: FONT, color: '#E23A5A' }}>{feil}</p> : !data ? (
          <div className="py-10 text-center" style={{ border: '1px dashed var(--kant-3)' }}><p className="text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: '#FF4500' }}>Laster serien…</p></div>
        ) : grafRader.length < 2 ? (
          <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)' }}>Velg minst to gjennomføringer.</p>
        ) : (
          <div style={{ height: 280 }} data-serie-graf={v.id}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={grafRader} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="dato" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
                <YAxis reversed={v.id === 'tempo'} domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={56} tickFormatter={(x: number) => v.id === 'tempo' ? fmtPace(x) : v.id === 'tid' ? `${Math.round(x / 60)}m` : `${x}`} />
                <Tooltip content={<XpTooltip />} formatter={(x, n) => [v.fmt(Number(x)), String(n)]} />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                {visPerDrag
                  ? Array.from({ length: maksDrag }, (_, i) => <Line key={i} dataKey={`d${i + 1}`} name={`Drag ${i + 1}`} stroke={FARGER[i % FARGER.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)
                  : <Line dataKey="hel" name={v.navn} stroke="#FF4500" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive={false} />}
                {!visPerDrag && beste >= 0 && valgte.includes(rader[beste].workout_id) && v.hel(rader[beste]) != null && (
                  <ReferenceDot x={fmtDato(rader[beste].date)} y={v.hel(rader[beste])!} r={7} fill="#E8B93C" stroke="var(--tekst-1-app)" label={{ value: '★ beste', position: 'top', fill: '#E8B93C', fontSize: 11 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartWrapper>

      <ChartWrapper chartKey="standardokter_tabell" title="Alle gjennomføringer × alle variabler" height="auto" config={{ serieId: serie.id, sort: sort.id, opp: sort.opp }}
        subtitle="Klikk en kolonne for å sortere · parentes = mot forrige · mot beste · ★ = beste for valgt variabel · kryss av for grafene">
        {!data ? null : (
          <div className="overflow-x-auto xp-hscroll">
            <table style={{ borderCollapse: 'collapse', minWidth: 900 }} data-serie-tabell>
              <thead>
                <tr>
                  <th style={th}></th>
                  <th style={th} onClick={() => setSort(s => ({ id: 'dato', opp: s.id === 'dato' ? !s.opp : true }))}>Dato {sort.id === 'dato' ? (sort.opp ? '↑' : '↓') : ''}</th>
                  {variabler.map(x => <th key={x.id} style={th} onClick={() => setSort(s => ({ id: x.id, opp: s.id === x.id ? !s.opp : true }))}>{x.navn} {sort.id === x.id ? (sort.opp ? '↑' : '↓') : ''}</th>)}
                  <th style={th}>Vær / føre</th>
                </tr>
              </thead>
              <tbody>
                {sortert.map((r, i) => {
                  const erBeste = beste >= 0 && rader[beste].workout_id === r.workout_id
                  return (
                    <tr key={r.workout_id} data-serie-rad={r.workout_id} style={{ background: erBeste ? 'rgba(232,185,60,.10)' : undefined }}>
                      <td style={td}><input type="checkbox" checked={valgte.includes(r.workout_id)} onChange={() => toggle(r.workout_id)} aria-label={`Vis ${fmtDato(r.date)} i grafene`} /></td>
                      <td style={td}>{erBeste ? '★ ' : ''}{fmtDato(r.date)}{r.erKonkurranse ? ' 🏁' : ''}<span style={{ color: 'var(--tekst-8-app)', marginLeft: 6 }}>{r.title}</span></td>
                      {variabler.map(x => { const val = x.hel(r); return <td key={x.id} style={td}>{val == null ? '-' : x.fmt(val)}{val != null ? delta(r, i, x) : null}</td> })}
                      <td style={{ ...td, color: 'var(--tekst-5-app)' }}>{r.vaer ? [r.vaer.temperatur != null ? `${r.vaer.temperatur}°` : null, r.vaer.type ? (WEATHER_LABELS[r.vaer.type as keyof typeof WEATHER_LABELS] ?? r.vaer.type) : null, ...r.vaer.fore].filter(Boolean).join(' · ') || '-' : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartWrapper>

      {data && data.pakker.length >= 2 && (
        <SammenligningVisning okter={data.pakker} harSki={harSki} targetUserId={targetUserId} chartKey="standardokter_grafer"
          tittel={`${serie.name} - gjennomføringene`} modus={modus} onModus={setModus} skjulTabeller initialConfig={{ metrikk: initialConfig?.metrikk ?? null }} />
      )}
    </div>
  )
}

/** Favoritt = serie + variabel: henter biblioteket selv og viser serien. */
export function SerieFavoritt({ serieId, harSki, targetUserId, initialConfig }: { serieId: string; harSki: boolean; targetUserId?: string; initialConfig?: Record<string, unknown> | null }) {
  const [serie, setSerie] = useState<SessionSeriesWithExecutions | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    import('@/app/actions/standard-sessions').then(m => m.getSessionSeriesLibrary(targetUserId)).then(res => { if (!live) return; setSerie(Array.isArray(res) ? (res.find(s => s.id === serieId) ?? null) : null) })
    return () => { live = false }
  }, [serieId, targetUserId])
  if (serie === undefined) return <div className="py-10 text-center" style={{ border: '1px dashed var(--kant-3)' }}><p className="text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: '#FF4500' }}>Laster serien…</p></div>
  if (!serie) return <p style={{ fontFamily: FONT, color: 'var(--tekst-8-app)' }}>Serien finnes ikke lenger.</p>
  return <SerieAnalyse serie={serie} harSki={harSki} targetUserId={targetUserId} initialConfig={initialConfig} />
}
