'use client'

// Kø #48 bolk 4–6 — SAMMENLIGNING i standardøkt-seriedetaljen.
// SF-4-avgjørelsen (20. aug): INNHOLDSAVHENGIG FRA START — seksjoner som ikke
// gjelder økta vises ikke. Grunnlaget (velger, nøkkeltall, drag-graf, trend)
// vises alltid; styrke/skyting/puls/laktat kun når dataene finnes.
//
// Prinsipper:
//   · Datapath: compareWorkoutsDetailed (samme som Sammenligning-fanen).
//   · Aktivitetslista ER draglista — ingen ny datamodell.
//   · Delta er VEILEDNINGSTALL i nøytral grå — aldri alarmer/farger.
//   · Aldri dobbel y-akse: én metrikk om gangen, byttes med velger.
//   · Sonefarger fra ZONE_COLORS_V2 (import, aldri kopi).
//   · Snitt regnes kun på FØRTE verdier.
//   · Trener: read-only — samme RLS-vei (egen + utøvere-vi-coacher).

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  compareWorkoutsDetailed,
  type DetailedWorkout,
} from '@/app/actions/compare-workouts'
import type { SessionSeriesWithExecutions } from '@/app/actions/standard-sessions'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import {
  CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_TOOLTIP_BOX, CHART_LINE_WIDTH,
} from './chart-theme'

const ACCENT = '#FF8A5C'
// L/S-konvensjonen fra skyting-analysen: liggende blå, stående oransje.
const POS_FARGE: Record<'L' | 'S', string> = { L: '#1A6FD4', S: '#FF8C00' }
// Linjefarger for opptil 5 valgte gjennomføringer (direktemerkes).
const LINJE_FARGER = ['#FF8A5C', '#1A6FD4', '#28A86E', '#E8B93C', '#8B5CF6']

const FONT = "'Barlow Condensed', sans-serif"
const T_LABEL: React.CSSProperties = {
  fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--tekst-5-app)',
}

function fmtDato(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtTid(sec: number | null): string {
  if (sec == null || sec <= 0) return '—'
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')} t` : `${m} min`
}
function fmtPace(secPerKm: number | null): string {
  if (secPerKm == null || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
/** Nøytralt delta-veiledningstall: «+0:12» / «−4». Grå, aldri farget. */
function delta(n: number | null, ref: number | null, fmt: (v: number) => string): string | null {
  if (n == null || ref == null) return null
  const d = n - ref
  if (d === 0) return '±0'
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`
}
function parseZoneMin(v: string | undefined): number {
  if (!v) return 0
  const deler = v.split(':').map(Number)
  if (deler.some(x => !Number.isFinite(x))) return 0
  if (deler.length === 3) return deler[0] * 60 + deler[1] + deler[2] / 60
  if (deler.length === 2) return deler[0] + deler[1] / 60
  return Number(v) || 0
}

type DragMetrikk = 'tid' | 'pace' | 'puls' | 'watt'
const DRAG_METRIKKER: { verdi: DragMetrikk; etikett: string }[] = [
  { verdi: 'tid', etikett: 'Varighet' },
  { verdi: 'pace', etikett: 'Pace' },
  { verdi: 'puls', etikett: 'Puls' },
  { verdi: 'watt', etikett: 'Watt' },
]

export function SerieSammenligning({ serie }: { serie: SessionSeriesWithExecutions }) {
  // Default: de siste 5 gjennomføringene (spec). executions er kronologisk.
  const alle = serie.executions
  const [valgte, setValgte] = useState<string[]>(
    () => alle.slice(-5).map(e => e.workout_id))
  const [data, setData] = useState<DetailedWorkout[] | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [dragMetrikk, setDragMetrikk] = useState<DragMetrikk>('tid')

  useEffect(() => {
    if (valgte.length < 2) { setData(null); return }
    let aktiv = true
    compareWorkoutsDetailed(valgte).then(res => {
      if (!aktiv) return
      if (Array.isArray(res)) { setData(res); setFeil(null) }
      else setFeil(res.error)
    })
    return () => { aktiv = false }
  }, [valgte])

  const toggle = (id: string) => {
    setValgte(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  }

  // ── Avledninger fra valgt data ──
  const rader = useMemo(() => {
    if (!data) return []
    // kronologisk venstre→høyre
    return [...data].sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  const harStyrke = rader.some(w => w.activities.some(a => a.exercises.length > 0))
  const harSkyting = rader.some(w => w.activities.some(a => a.shooting_series.length > 0))
  const harPuls = rader.some(w => w.hr_samples !== null)
  const harLaktat = rader.some(w => w.lactates.length > 0)
  const harSoner = rader.some(w => w.activities.some(a =>
    ALL_ZONE_NAMES.some(z => parseZoneMin(a.zones?.[z]) > 0)))

  // Beste (laveste totaltid av de valgte) — veiledning, ikke premiering.
  const besteTid = useMemo(() => {
    const tider = rader.map(w => w.total_seconds).filter(t => t > 0)
    return tider.length > 0 ? Math.min(...tider) : null
  }, [rader])

  // Drag-graf: aktivitetslista ER draglista. Kun 'aktivitet'-rader.
  const dragData = useMemo(() => {
    const perOkt = rader.map(w =>
      w.activities.filter(a => (a.activity_type ?? 'aktivitet') === 'aktivitet'))
    const maks = Math.max(0, ...perOkt.map(d => d.length))
    const ut: Record<string, number | string | null>[] = []
    for (let i = 0; i < maks; i++) {
      const rad: Record<string, number | string | null> = { drag: i + 1 }
      rader.forEach((w, wi) => {
        const a = perOkt[wi][i]
        rad[w.id] =
          !a ? null
          : dragMetrikk === 'tid' ? (a.duration_seconds != null ? Math.round(a.duration_seconds / 6) / 10 : null)
          : dragMetrikk === 'pace' ? (a.avg_pace_seconds_per_km ?? null)
          : dragMetrikk === 'puls' ? (a.avg_heart_rate ?? null)
          : (a.avg_watts ?? null)
      })
      ut.push(rad)
    }
    return ut
  }, [rader, dragMetrikk])

  // Trend over ALLE gjennomføringer i serien (uavhengig av utvalget).
  const trendData = useMemo(() => alle.map(e => ({
    dato: fmtDato(e.date),
    verdi: e.total_seconds != null && e.total_seconds > 0 ? Math.round(e.total_seconds / 6) / 10 : null,
    puls: e.avg_heart_rate ?? null,
  })), [alle])

  // Styrke: samme øvelse settes OPP MOT HVERANDRE på tvers (navnematch).
  const styrkeRader = useMemo(() => {
    if (!harStyrke) return []
    const navnRekkefolge: string[] = []
    const perNavn = new Map<string, Map<string, string>>() // navn → øktId → oppsummering
    for (const w of rader) {
      for (const a of w.activities) for (const e of a.exercises) {
        const navn = e.exercise_name.trim()
        if (!perNavn.has(navn)) { perNavn.set(navn, new Map()); navnRekkefolge.push(navn) }
        const forte = e.sets.filter(st => st.reps != null || st.weight_kg != null)
        if (forte.length === 0) continue
        // «3×5 @ 100» når alt er likt, ellers settvis «5@100 · 5@100 · 3@105».
        const alleLike = forte.every(st => st.reps === forte[0].reps && st.weight_kg === forte[0].weight_kg)
        const tekst = alleLike
          ? `${forte.length}×${forte[0].reps ?? '—'}${forte[0].weight_kg != null ? ` @ ${forte[0].weight_kg}` : ''}`
          : forte.map(st => `${st.reps ?? '—'}${st.weight_kg != null ? `@${st.weight_kg}` : ''}`).join(' · ')
        perNavn.get(navn)!.set(w.id, tekst)
      }
    }
    return navnRekkefolge.map(navn => ({ navn, perOkt: perNavn.get(navn)! }))
  }, [rader, harStyrke])

  // Skyting: treff % totalt + per posisjon, skytetid og seriepuls per økt.
  const skyting = useMemo(() => {
    if (!harSkyting) return []
    return rader.map(w => {
      const serier = w.activities.flatMap(a => a.shooting_series)
      const forte = serier.filter(sr => sr.hits != null)
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
      const pct = (list: typeof forte) => {
        const skudd = sum(list.map(sr => sr.shots))
        return skudd > 0 ? Math.round((sum(list.map(sr => sr.hits ?? 0)) / skudd) * 100) : null
      }
      const tider = serier.map(sr => sr.time_seconds).filter((t): t is number => t != null)
      const pulser = serier.map(sr => sr.avg_heart_rate).filter((p): p is number => p != null)
      return {
        id: w.id, dato: w.date, serier,
        pctTotal: pct(forte),
        pctL: pct(forte.filter(sr => sr.position === 'L')),
        pctS: pct(forte.filter(sr => sr.position === 'S')),
        snittTid: tider.length > 0 ? Math.round(sum(tider) / tider.length * 10) / 10 : null,
        snittPuls: pulser.length > 0 ? Math.round(sum(pulser) / pulser.length) : null,
      }
    })
  }, [rader, harSkyting])

  // Pulskurver: nedsamplet til ~240 punkter per økt, minutt-akse.
  const pulsData = useMemo(() => {
    if (!harPuls) return []
    const ut: Record<string, number | null>[] = []
    const kurver = rader.map(w => w.hr_samples ?? [])
    const maksMin = Math.max(0, ...kurver.map(k => k.length > 0 ? k[k.length - 1].t / 60 : 0))
    const steg = Math.max(0.5, maksMin / 240)
    for (let m = 0; m <= maksMin; m += steg) {
      const rad: Record<string, number | null> = { min: Math.round(m * 10) / 10 }
      rader.forEach((w, wi) => {
        const k = kurver[wi]
        if (k.length === 0) { rad[w.id] = null; return }
        // nærmeste sample ≤ m minutter
        let sist: number | null = null
        for (const p of k) { if (p.t / 60 <= m) sist = p.hr; else break }
        rad[w.id] = sist
      })
      ut.push(rad)
    }
    return ut
  }, [rader, harPuls])

  const fargeFor = (id: string) => LINJE_FARGER[rader.findIndex(w => w.id === id) % LINJE_FARGER.length]

  if (alle.length < 2) return null

  return (
    <div className="p-4 mt-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <p className="text-xs tracking-widest uppercase mb-2" style={{ fontFamily: FONT, color: ACCENT }}>
        Sammenligning
      </p>

      {/* ── Velger: 2–N gjennomføringer, default siste 5 ── */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[...alle].reverse().map(e => {
          const på = valgte.includes(e.workout_id)
          return (
            <button key={e.workout_id} type="button" onClick={() => toggle(e.workout_id)}
              style={{
                fontFamily: FONT, fontSize: 12.5, borderRadius: 999, padding: '5px 11px',
                cursor: 'pointer', minHeight: 32,
                color: på ? 'var(--flate-3)' : 'var(--tekst-5-app)',
                background: på ? ACCENT : 'none',
                border: `1px solid ${på ? ACCENT : 'var(--line2)'}`,
                fontWeight: på ? 700 : 400,
              }}>
              {fmtDato(e.date)}
            </button>
          )
        })}
      </div>
      {valgte.length < 2 && (
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-8-app)' }}>
          Velg minst to gjennomføringer for å sammenligne.
        </p>
      )}
      {feil && <p style={{ fontFamily: FONT, fontSize: 13.5, color: '#FF4500' }}>{feil}</p>}
      {valgte.length >= 2 && data === null && !feil && (
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-8-app)' }}>Henter øktene…</p>
      )}

      {rader.length >= 2 && (
        <div className="space-y-5">
          {/* ── Nøkkeltall side om side — sticky første kolonne ── */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 120 + rader.length * 118 }}>
              <thead>
                <tr>
                  <th style={{ ...T_LABEL, textAlign: 'left', padding: '6px 10px 6px 0', position: 'sticky', left: 0, background: 'var(--card)' }}>Nøkkeltall</th>
                  {rader.map(w => (
                    <th key={w.id} style={{ ...T_LABEL, color: fargeFor(w.id), textAlign: 'right', padding: '6px 10px' }}>
                      {fmtDato(w.date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ fontFamily: FONT, fontSize: 14, color: 'var(--tekst-1-app)' }}>
                <MetricRow label="Total tid" rader={rader}
                  verdi={w => w.total_seconds || null}
                  vis={v => fmtTid(v)}
                  deltaFmt={v => fmtTid(v).replace(' t', '').replace(' min', 'm')}
                  beste={besteTid} />
                {rader.some(w => w.total_meters > 0) && (
                  <MetricRow label="Distanse" rader={rader}
                    verdi={w => w.total_meters > 0 ? w.total_meters : null}
                    vis={v => `${(v / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} km`}
                    deltaFmt={v => `${(v / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} km`} />
                )}
                {rader.some(w => w.avg_heart_rate != null) && (
                  <MetricRow label="Snittpuls" rader={rader}
                    verdi={w => w.avg_heart_rate}
                    vis={v => `${Math.round(v)}`}
                    deltaFmt={v => `${Math.round(v)}`} />
                )}
                {harLaktat && (
                  <MetricRow label="Laktat (snitt av førte)" rader={rader}
                    verdi={w => w.lactates.length > 0
                      ? Math.round(w.lactates.reduce((s, l) => s + l.mmol, 0) / w.lactates.length * 10) / 10
                      : null}
                    vis={v => `${v.toLocaleString('nb-NO')} mmol`}
                    deltaFmt={v => v.toLocaleString('nb-NO')} />
                )}
                {harSkyting && (
                  <MetricRow label="Treff %" rader={rader}
                    verdi={w => {
                      const sk = skyting.find(x => x.id === w.id)
                      return sk?.pctTotal ?? null
                    }}
                    vis={v => `${v} %`} deltaFmt={v => `${v} pp`} />
                )}
                {harSoner && (
                  <tr>
                    <td style={{ ...T_LABEL, padding: '6px 10px 6px 0', position: 'sticky', left: 0, background: 'var(--card)' }}>Soner</td>
                    {rader.map(w => {
                      const min: Partial<Record<ExtendedZoneName, number>> = {}
                      for (const a of w.activities) for (const z of ALL_ZONE_NAMES) {
                        min[z] = (min[z] ?? 0) + parseZoneMin(a.zones?.[z])
                      }
                      const tot = ALL_ZONE_NAMES.reduce((s, z) => s + (min[z] ?? 0), 0)
                      return (
                        <td key={w.id} style={{ padding: '6px 10px' }}>
                          {tot > 0 ? (
                            <span style={{ display: 'flex', height: 8, borderRadius: 3, overflow: 'hidden', minWidth: 90 }}>
                              {ALL_ZONE_NAMES.filter(z => (min[z] ?? 0) > 0).map(z => (
                                <i key={z} title={`${z}: ${Math.round(min[z] ?? 0)} min`}
                                  style={{ flex: min[z], background: ZONE_COLORS_V2[z] }} />
                              ))}
                            </span>
                          ) : <span style={{ color: 'var(--tekst-8-app)' }}>—</span>}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 text-xs" style={{ fontFamily: FONT, color: 'var(--tekst-8-app)' }}>
              Delta i parentes: mot forrige gjennomføring · mot beste. Veiledningstall, ikke dommer.
            </p>
          </div>

          {/* ── Drag-graf: aktivitetslista er draglista ── */}
          {dragData.length >= 2 && (
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span style={T_LABEL}>Drag for drag</span>
                {DRAG_METRIKKER.map(m => (
                  <button key={m.verdi} type="button" onClick={() => setDragMetrikk(m.verdi)}
                    style={{
                      fontFamily: FONT, fontSize: 12, borderRadius: 999, padding: '4px 10px', cursor: 'pointer',
                      color: dragMetrikk === m.verdi ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
                      background: dragMetrikk === m.verdi ? 'var(--card2)' : 'none',
                      border: `1px solid ${dragMetrikk === m.verdi ? 'var(--line2)' : 'transparent'}`,
                    }}>
                    {m.etikett}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dragData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="drag" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
                  <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44}
                    reversed={dragMetrikk === 'pace'} />
                  <Tooltip contentStyle={CHART_TOOLTIP_BOX}
                    formatter={(v, id) => [
                      typeof v !== 'number' ? '—'
                        : dragMetrikk === 'pace' ? fmtPace(v)
                        : dragMetrikk === 'tid' ? `${v} min` : `${v}`,
                      fmtDato(rader.find(w => w.id === String(id))?.date ?? ''),
                    ]} />
                  {rader.slice(0, 5).map(w => (
                    <Line key={w.id} dataKey={w.id} stroke={fargeFor(w.id)}
                      strokeWidth={CHART_LINE_WIDTH} dot={{ r: 3, strokeWidth: 0 }}
                      connectNulls isAnimationActive={false}
                      label={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* Direktemerking: maks 5 linjer, fargekodet dato-tekst i stedet for legend. */}
              <div className="flex flex-wrap gap-3 mt-1">
                {rader.slice(0, 5).map(w => (
                  <span key={w.id} style={{ fontFamily: FONT, fontSize: 12, color: fargeFor(w.id) }}>
                    ● {fmtDato(w.date)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Pulskurver — kun med klokkesynk-data ── */}
          {harPuls && pulsData.length > 2 && (
            <div>
              <span style={T_LABEL}>Puls gjennom økta</span>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pulsData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="min" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
                    unit=" min" minTickGap={40} />
                  <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
                    width={40} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip contentStyle={CHART_TOOLTIP_BOX}
                    formatter={(v, id) => [String(v ?? '—'), fmtDato(rader.find(w => w.id === String(id))?.date ?? '')]} />
                  {rader.filter(w => w.hr_samples).slice(0, 5).map(w => (
                    <Line key={w.id} dataKey={w.id} stroke={fargeFor(w.id)}
                      strokeWidth={1.6} dot={false} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Styrke: samme øvelse mot seg selv over tid ── */}
          {harStyrke && styrkeRader.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <span style={T_LABEL}>Styrke — reps × vekt per øvelse</span>
              <table style={{ borderCollapse: 'collapse', minWidth: 120 + rader.length * 118, marginTop: 4 }}>
                <thead>
                  <tr>
                    <th style={{ ...T_LABEL, textAlign: 'left', padding: '5px 10px 5px 0', position: 'sticky', left: 0, background: 'var(--card)' }}>Øvelse</th>
                    {rader.map(w => (
                      <th key={w.id} style={{ ...T_LABEL, color: fargeFor(w.id), textAlign: 'right', padding: '5px 10px' }}>{fmtDato(w.date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-1-app)' }}>
                  {styrkeRader.map(r => (
                    <tr key={r.navn} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 10px 6px 0', position: 'sticky', left: 0, background: 'var(--card)', color: 'var(--tekst-3-app)' }}>{r.navn}</td>
                      {rader.map(w => (
                        <td key={w.id} style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {r.perOkt.get(w.id) ?? <span style={{ color: 'var(--tekst-8-app)' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Skyting: I TILLEGG TIL den fysiske delen, aldri i stedet for ── */}
          {harSkyting && (
            <div style={{ overflowX: 'auto' }}>
              <span style={T_LABEL}>Skyting</span>
              <table style={{ borderCollapse: 'collapse', minWidth: 120 + rader.length * 118, marginTop: 4 }}>
                <thead>
                  <tr>
                    <th style={{ ...T_LABEL, textAlign: 'left', padding: '5px 10px 5px 0', position: 'sticky', left: 0, background: 'var(--card)' }} />
                    {rader.map(w => (
                      <th key={w.id} style={{ ...T_LABEL, color: fargeFor(w.id), textAlign: 'right', padding: '5px 10px' }}>{fmtDato(w.date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-1-app)' }}>
                  {([
                    ['Treff % totalt', (sk: (typeof skyting)[number]) => sk.pctTotal != null ? `${sk.pctTotal} %` : '—'],
                    ['Liggende', sk => sk.pctL != null ? `${sk.pctL} %` : '—'],
                    ['Stående', sk => sk.pctS != null ? `${sk.pctS} %` : '—'],
                    ['Skytetid (snitt)', sk => sk.snittTid != null ? `${sk.snittTid.toLocaleString('nb-NO')} s` : '—'],
                    ['Puls på standplass', sk => sk.snittPuls != null ? `${sk.snittPuls}` : '—'],
                  ] as [string, (sk: (typeof skyting)[number]) => string][]).map(([etikett, hent]) => (
                    <tr key={etikett} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{
                        padding: '6px 10px 6px 0', position: 'sticky', left: 0, background: 'var(--card)',
                        color: etikett === 'Liggende' ? POS_FARGE.L : etikett === 'Stående' ? POS_FARGE.S : 'var(--tekst-3-app)',
                      }}>{etikett}</td>
                      {rader.map(w => {
                        const sk = skyting.find(x => x.id === w.id)
                        return <td key={w.id} style={{ padding: '6px 10px', textAlign: 'right' }}>{sk ? hent(sk) : '—'}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Vind/sikt som KONTEKST — serie for serie per gjennomføring. */}
              <div className="flex flex-col gap-1 mt-2">
                {skyting.filter(sk => sk.serier.some(sr => sr.vind_styrke != null || sr.sikt)).map(sk => (
                  <p key={sk.id} style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }}>
                    {fmtDato(sk.dato)}: {sk.serier.map((sr, i) => {
                      const vind = sr.vind_styrke != null
                        ? (sr.vind_styrke === 0 ? 'stille' : `${sr.vind_styrke}${sr.vind_retning ?? ''}`)
                        : null
                      const deler = [vind, sr.sikt?.replace(/_/g, ' ')].filter(Boolean).join(' · ')
                      return deler ? `S${i + 1} ${deler}` : null
                    }).filter(Boolean).join('  ·  ') || 'ingen vind/sikt ført'}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── Trend over ALLE gjennomføringer ── */}
          {trendData.filter(t => t.verdi != null).length >= 2 && (
            <div>
              <span style={T_LABEL}>Trend — alle {alle.length} gjennomføringer (total tid, min)</span>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="dato" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} minTickGap={30} />
                  <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} />
                  <Tooltip contentStyle={CHART_TOOLTIP_BOX} formatter={v => [`${String(v ?? '—')} min`, 'Total tid']} />
                  <Line dataKey="verdi" stroke={ACCENT} strokeWidth={CHART_LINE_WIDTH}
                    dot={{ r: 3, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Én nøkkeltall-rad m/ nøytrale delta mot forrige og beste. */
function MetricRow({ label, rader, verdi, vis, deltaFmt, beste }: {
  label: string
  rader: DetailedWorkout[]
  verdi: (w: DetailedWorkout) => number | null
  vis: (v: number) => string
  deltaFmt: (v: number) => string
  beste?: number | null
}) {
  return (
    <tr style={{ borderTop: '1px solid var(--line)' }}>
      <td style={{
        fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--tekst-5-app)', padding: '6px 10px 6px 0', position: 'sticky', left: 0, background: 'var(--card)',
      }}>{label}</td>
      {rader.map((w, i) => {
        const v = verdi(w)
        const forrige = i > 0 ? verdi(rader[i - 1]) : null
        const dPrev = delta(v, forrige, deltaFmt)
        const dBest = beste != null ? delta(v, beste, deltaFmt) : null
        return (
          <td key={w.id} style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {v != null ? vis(v) : <span style={{ color: 'var(--tekst-8-app)' }}>—</span>}
            {(dPrev || (dBest && dBest !== '±0')) && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--tekst-8-app)' }}>
                {[dPrev, dBest && dBest !== '±0' ? `${dBest} vs beste` : null].filter(Boolean).join(' · ')}
              </span>
            )}
          </td>
        )
      })}
    </tr>
  )
}
