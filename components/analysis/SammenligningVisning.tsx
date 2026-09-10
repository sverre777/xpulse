'use client'

// BOLK 5 (Analyse v2, Sverre 5. sep): SAMMENLIGNING AV 2–4 ØKTER med ØktGraf
// — ÉN komponent (WorkoutDetailChart), ikke egne kurver. To visninger:
// STABLET (én graf per økt, felles tidsakse, valgfri «start på første drag»)
// og OPPÅ HVERANDRE (én graf: valgt økts blokker bak, de andre øktenes
// samme metrikk oppå i hver sin farge). Felles «På grafen»-chips styrer
// alle grafene. Under: nøkkeltall-rad per økt (delta mot første) med
// terskel-chip for øktas dato, runder side ved side per drag-indeks og
// skyting per serie side ved side. En PLANLAGT økt i settet er referanse:
// omriss bak alle. Stjerne på alt: favoritt = øktsett + visning (config).
// Ingen kopier av formler — nøkkeltallene kommer fra actionen (lib).

import { Fragment, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { WorkoutDetailChart, byggSerier, Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'
import type { KurveSerie } from '@/components/workout/OktKurve'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { hentSammenligning, type SammenligningOkt } from '@/app/actions/sammenligning'
import { segmentTypeFor } from '@/lib/segmenter'
import { faktiskeBlokker, tilSpokelser } from '@/lib/gjennomfort-kart'
import { byggPlanBlokker } from '@/lib/plan-graf'
import { resolveSoner } from '@/lib/terskel-oppslag'
import { formatPace } from '@/lib/pace-utils'
import { SPORTS, WEATHER_LABELS } from '@/lib/types'
import { ChartWrapper } from './ChartWrapper'

const FONT = "'Barlow Condensed', sans-serif"
/** Én farge per økt — fasit: oransje · blå · grønn · gul. */
export const OKT_FARGER = ['#FF4500', '#1A6FD4', '#28A86E', '#E8B93C']
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export type SammenligningVisningValg = 'stablet' | 'oppa' | 'rutenett'
export interface SammenligningConfig { ids: string[]; visning: SammenligningVisningValg; forskyv: boolean; metrikk: string | null; valgt: string | null }

function fmtDato(iso: string): string { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}. ${MND[d.getMonth()]}` }
function fmtHM(sek: number): string { const m = Math.round(sek / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}t ${String(m % 60).padStart(2, '0')}` }
function fmtKm(m: number | null): string { return m != null && m > 0 ? `${(m / 1000).toFixed(2).replace('.', ',')} km` : '-' }
function sportLabel(v: string): string { return SPORTS.find(s => s.value === v)?.label ?? v }
function tall(v: number | null | undefined, d = 0): string { return v == null ? '-' : v.toFixed(d).replace('.', ',') }

/** Første drags start — «start på første drag» flytter t=0 dit. */
function forsteDragSek(k: WorkoutKlokkesyncData | null): number {
  if (!k) return 0
  const drag = k.segmenter.filter(sg => sg.type === 'drag')
  return drag.length > 0 ? Math.min(...drag.map(sg => sg.startSek)) : 0
}

/** Klokkedata forskjøvet o sekunder (alt før t=0 faller bort). Ren funksjon. */
function forskyvKlokke(k: WorkoutKlokkesyncData, o: number): WorkoutKlokkesyncData {
  if (o <= 0 || !k.samples) return k
  const skift = <T extends { t: number }>(xs: T[] | null): T[] | null => xs ? xs.filter(x => x.t >= o).map(x => ({ ...x, t: x.t - o })) : null
  return {
    ...k,
    totalSek: Math.max(0, k.totalSek - o),
    samples: {
      hr_samples: skift(k.samples.hr_samples), watt_samples: skift(k.samples.watt_samples),
      pace_samples: skift(k.samples.pace_samples), speed_samples: skift(k.samples.speed_samples),
      altitude_samples: skift(k.samples.altitude_samples), cadence_samples: skift(k.samples.cadence_samples),
    },
    segmenter: k.segmenter.filter(sg => sg.sluttSek > o).map(sg => ({ ...sg, startSek: Math.max(0, sg.startSek - o), sluttSek: sg.sluttSek - o })),
    lapMarkers: k.lapMarkers.filter(l => l.t_start >= o).map(l => ({ ...l, t_start: l.t_start - o })),
    lactate: k.lactate.filter(l => l.t >= o).map(l => ({ ...l, t: l.t - o })),
    nutrition: k.nutrition.filter(l => l.t >= o).map(l => ({ ...l, t: l.t - o })),
    shooting: k.shooting.filter(l => l.t >= o).map(l => ({ ...l, t: l.t - o })),
    tidspunktNotater: [],
  }
}

interface Props {
  okter: SammenligningOkt[]
  harSki: boolean
  targetUserId?: string
  /** Fase 122: lagret favoritt-oppsett (visning, forskyv, metrikk, valgt). */
  initialConfig?: Record<string, unknown> | null
  /** Bolk 6 (Standardøkter): egen nøkkel/tittel, styrt visning og uten tabellene (serien har sin egen). */
  chartKey?: string
  tittel?: string
  modus?: SammenligningVisningValg
  onModus?: (m: SammenligningVisningValg) => void
  skjulTabeller?: boolean
}

export function SammenligningVisning({ okter, harSki, initialConfig, chartKey = 'sammenlign_oktsett', tittel = 'Sammenligning av økter', modus, onModus, skjulTabeller = false }: Props) {
  const montert = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [visningEgen, setVisningEgen] = useState<SammenligningVisningValg>(initialConfig?.visning === 'oppa' || initialConfig?.visning === 'rutenett' ? initialConfig.visning : 'stablet')
  const visning = modus ?? visningEgen
  const setVisning = (m: SammenligningVisningValg) => { setVisningEgen(m); onModus?.(m) }
  const [forskyv, setForskyv] = useState<boolean>(initialConfig?.forskyv === true)
  const [valgtId, setValgtId] = useState<string | null>(typeof initialConfig?.valgt === 'string' ? initialConfig.valgt : null)
  const referanse = okter.find(o => o.isPlanned) ?? null
  const faktiske = okter.filter(o => !o.isPlanned)
  // Standardvalg = første økt MED klokkedata — ellers står «Oppå hverandre» tom når første økt mangler kurve.
  const valgt = faktiske.find(o => o.id === valgtId) ?? faktiske.find(o => o.klokke?.samples) ?? faktiske[0] ?? null

  // Klokkedata per økt, forskjøvet når «start på første drag» er på.
  const klokker = useMemo(() => new Map(okter.map(o => [o.id, o.klokke && forskyv ? forskyvKlokke(o.klokke, forsteDragSek(o.klokke)) : o.klokke])), [okter, forskyv])
  const serierFor = (o: SammenligningOkt): KurveSerie[] => {
    const k = klokker.get(o.id)
    return k?.samples && k.sport ? byggSerier(k.sport, k.samples) : []
  }
  // Felles chips: metrikkene som finnes i minst én økt.
  const metrikker = useMemo(() => {
    const m = new Map<string, KurveSerie>()
    for (const o of okter) for (const s of serierFor(o)) if (!m.has(s.id)) m.set(s.id, s)
    return [...m.values()]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okter, klokker])
  // null = ingenting valgt ennå → første metrikk som finnes (avledet, ingen effekt).
  const [paaValg, setPaaIds] = useState<string[] | null>(() => {
    const m = typeof initialConfig?.metrikk === 'string' ? initialConfig.metrikk : null
    return m ? [m] : null
  })
  const [fokusValg, setFokusId] = useState<string | null>(typeof initialConfig?.metrikk === 'string' ? initialConfig.metrikk : null)
  const paaIds = paaValg ?? (metrikker.length > 0 ? [metrikker[0].id] : [])
  const fokusId = paaValg ? fokusValg : (metrikker[0]?.id ?? null)
  const velg = (id: string) => {
    const s = metrikker.find(x => x.id === id)
    const paa = paaIds.includes(id)
    if (paa && fokusId === id) {
      const rest = paaIds.filter(x => x !== id)
      setPaaIds(rest)
      setFokusId(rest.find(x => !metrikker.find(m => m.id === x)?.somAreal) ?? null)
      return
    }
    if (!paa) setPaaIds([...paaIds, id])
    if (!s?.somAreal) setFokusId(id)
  }
  const styrt = { paaIds, fokusId, velg }

  const tidsakseSek = useMemo(() => Math.max(0, ...okter.map(o => klokker.get(o.id)?.totalSek ?? 0)), [okter, klokker])

  // Planlagt økt i settet = referanse: omriss bak alle grafene.
  const referanseBlokker = useMemo(() => {
    const k = referanse?.klokke
    if (!k || k.segmenter.length === 0) return undefined
    const inn = faktiskeBlokker(k.segmenter, null, null, {
      ftp: k.ftp, rader: k.rader, heartZones: k.heartZones,
      sonerFor: k.sonerRader.length > 0 ? (navn, sub) => resolveSoner(k.sonerRader, navn, sub) : undefined,
    })
    return tilSpokelser(byggPlanBlokker(inn, k.heartZones))
  }, [referanse])

  const fargeFor = (id: string) => OKT_FARGER[okter.findIndex(o => o.id === id) % OKT_FARGER.length]
  const config: SammenligningConfig = { ids: okter.map(o => o.id), visning, forskyv, metrikk: fokusId, valgt: valgt?.id ?? null }

  const graf = (o: SammenligningOkt, ekstra?: KurveSerie[]) => {
    const k = klokker.get(o.id)
    if (!k?.samples || !k.sport) {
      return <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)', padding: '18px 0' }}>Ingen klokkedata på denne økta - nøkkeltall og runder står under.</p>
    }
    if (!montert) return <div style={{ height: 190 }} aria-hidden />
    return (
      <WorkoutDetailChart
        workoutId={o.id} sport={k.sport} samples={k.samples} laps={k.lapMarkers} lactate={k.lactate} nutrition={k.nutrition}
        shooting={harSki ? k.shooting : []} segmenter={harSki ? k.segmenter : k.segmenter.filter(sg => !sg.type.startsWith('skyting'))}
        heartZones={k.heartZones} np={k.wattMetrikker?.np ?? null} ftp={k.ftp} sonerRader={k.sonerRader} rader={k.rader}
        height={170} tetthet="skjema" flate="oversikt" kontroller="visning" punktStil="ikon"
        kurveStandard
        styrt={styrt} ekstraSerier={ekstra} tidsakseSek={tidsakseSek}
        planBlokkerInn={referanseBlokker as never} />
    )
  }

  const bryter = (aktiv: boolean, tekst: string, onClick: () => void, data: string) => (
    <button type="button" onClick={onClick} aria-pressed={aktiv} data-sammenlign-valg={data}
      style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 12px', minHeight: 32, cursor: 'pointer', border: 'none', background: aktiv ? 'var(--accent)' : 'transparent', color: aktiv ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)' }}>
      {tekst}
    </button>
  )

  return (
    <ChartWrapper chartKey={chartKey} title={tittel} height="auto" config={config as unknown as Record<string, unknown>}
      subtitle={okter.map((o, i) => `${i + 1}. ${fmtDato(o.date)} ${o.title}`).join(' · ')}>
      <div className="flex flex-col gap-4" data-sammenligning data-visning={visning}>
        {/* Øktene: farge, dato, tittel, terskel-chip og vær */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${okter.length}, minmax(0, 1fr))` }} data-sammenlign-hoder>
          {okter.map(o => (
            <div key={o.id} data-okt-hode={o.id} style={{ borderTop: `3px solid ${fargeFor(o.id)}`, paddingTop: 6, minWidth: 0 }}>
              <p style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: fargeFor(o.id), margin: 0 }}>
                {fmtDato(o.date)}{o.isPlanned ? ' · plan (referanse)' : ''}
              </p>
              <p className="truncate" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0 }}>{o.title}</p>
              <div className="flex gap-1.5 flex-wrap" style={{ marginTop: 4 }}>
                <span style={chipStil}>{sportLabel(o.sport)}</span>
                {o.terskel && (
                  <span style={chipStil} data-terskel-chip title="Terskelen som gjaldt på øktas dato (resolveTerskel)">
                    Terskel {o.terskel.threshold_hr} bpm{o.terskel.threshold_pace_sec_km ? ` · ${formatPace(o.terskel.threshold_pace_sec_km, 'min_per_km')}` : ''}{o.terskel.ftp_watts ? ` · FTP ${o.terskel.ftp_watts} W` : ''}
                  </span>
                )}
                {o.vaer && (o.vaer.temperature != null || o.vaer.weather_type) && (
                  <span style={chipStil} data-vaer-chip>
                    {o.vaer.temperature != null ? `${o.vaer.temperature}°` : ''}{o.vaer.weather_type ? ` ${WEATHER_LABELS[o.vaer.weather_type as keyof typeof WEATHER_LABELS] ?? o.vaer.weather_type}` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Visningsvalg + felles «På grafen»-chips */}
        <div className="flex gap-4 flex-wrap items-center">
          <Gruppe navn="Grafer">
            <span role="group" data-sammenlign-visning style={{ display: 'inline-flex', border: '1px solid var(--kant-3)', borderRadius: 999, overflow: 'hidden' }}>
              {bryter(visning === 'stablet', 'Stablet', () => setVisning('stablet'), 'stablet')}
              {bryter(visning === 'oppa', 'Oppå hverandre', () => setVisning('oppa'), 'oppa')}
              {bryter(visning === 'rutenett', 'Side om side', () => setVisning('rutenett'), 'rutenett')}
            </span>
          </Gruppe>
          {(visning === 'stablet' || visning === 'rutenett') && (
            <Chip farge="var(--accent)" etikett="Start på første drag" paa={forskyv} fokus={false} onClick={() => setForskyv(v => !v)} />
          )}
          {metrikker.length > 0 && (
            <Gruppe navn="På grafen">
              {metrikker.map(m => (
                <Chip key={m.id} farge={m.farge} etikett={m.navn} paa={paaIds.includes(m.id)} fokus={fokusId === m.id && !m.somAreal} onClick={() => velg(m.id)} />
              ))}
            </Gruppe>
          )}
          {visning === 'oppa' && faktiske.length > 1 && (
            <Gruppe navn="Blokker bak">
              {faktiske.map(o => (
                <Chip key={o.id} farge={fargeFor(o.id)} etikett={fmtDato(o.date)} paa={valgt?.id === o.id} fokus={false} onClick={() => setValgtId(o.id)} />
              ))}
            </Gruppe>
          )}
        </div>

        {/* Grafene */}
        {visning === 'stablet' ? (
          <div className="flex flex-col gap-3" data-sammenlign-stablet>
            {faktiske.map(o => (
              <div key={o.id} data-sammenlign-graf={o.id} style={{ borderLeft: `3px solid ${fargeFor(o.id)}`, paddingLeft: 10 }}>
                <p style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: fargeFor(o.id), margin: '0 0 4px' }}>{fmtDato(o.date)} · {o.title}</p>
                {graf(o)}
              </div>
            ))}
          </div>
        ) : visning === 'rutenett' ? (
          /* Bolk 6: SIDE OM SIDE — rutenett 2–3 i bredden, felles tidsakse, samme chips. */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-sammenlign-rutenett>
            {faktiske.map(o => (
              <div key={o.id} data-sammenlign-graf={o.id} style={{ borderTop: `3px solid ${fargeFor(o.id)}`, paddingTop: 6, minWidth: 0 }}>
                <p style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: fargeFor(o.id), margin: '0 0 4px' }}>{fmtDato(o.date)} · {o.title}</p>
                {graf(o)}
              </div>
            ))}
          </div>
        ) : valgt ? (
          <div data-sammenlign-oppa data-valgt={valgt.id} style={{ borderLeft: `3px solid ${fargeFor(valgt.id)}`, paddingLeft: 10 }}>
            {graf(valgt, faktiske.filter(o => o.id !== valgt.id).flatMap(o => serierFor(o).filter(s => !s.somAreal).map(s => ({
              ...s, id: `${s.id}@${o.id}`, gruppe: s.id, farge: fargeFor(o.id), navn: `${s.navn} · ${fmtDato(o.date)}`,
            }))))}
          </div>
        ) : null}

        {!skjulTabeller && <Nokkeltall okter={okter} fargeFor={fargeFor} />}
        {!skjulTabeller && <RunderSideVedSide okter={okter} fargeFor={fargeFor} />}
        {!skjulTabeller && harSki && <SkytingSideVedSide okter={okter} fargeFor={fargeFor} />}
      </div>
    </ChartWrapper>
  )
}

const chipStil: React.CSSProperties = { fontFamily: FONT, fontSize: 11, letterSpacing: '0.06em', color: 'var(--tekst-5-app)', border: '1px solid var(--line2)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { fontFamily: FONT, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', padding: '5px 8px', borderBottom: '1px solid var(--linje2, var(--kant-3))', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
const deltaStil: React.CSSProperties = { color: 'var(--tekst-8-app)', fontSize: 11.5, marginLeft: 4 }

function delta(v: number | null, ref: number | null, fmt: (d: number) => string): ReactNode {
  if (v == null || ref == null) return null
  const d = v - ref
  if (Math.abs(d) < 1e-9) return <span style={deltaStil}>±0</span>
  return <span style={deltaStil} data-delta>({d > 0 ? '+' : '−'}{fmt(Math.abs(d))})</span>
}

// ── Nøkkeltall-rad per økt: varighet · TSS · IF · NP · EF · frakobling · laktat maks · treff · opplevd
function Nokkeltall({ okter, fargeFor }: { okter: SammenligningOkt[]; fargeFor: (id: string) => string }) {
  const forste = okter[0]?.nokkeltall
  const rader: Array<{ k: string; v: (n: SammenligningOkt['nokkeltall']) => number | null; fmt: (x: number) => string; vis?: boolean }> = [
    { k: 'Varighet', v: n => n.varighetSek, fmt: x => fmtHM(x) },
    { k: 'TSS', v: n => n.tss, fmt: x => tall(x) },
    { k: 'IF', v: n => n.if, fmt: x => tall(x, 2), vis: okter.some(o => o.nokkeltall.if != null) },
    { k: 'NP', v: n => n.np, fmt: x => `${tall(x)} W`, vis: okter.some(o => o.nokkeltall.np != null) },
    { k: 'EF', v: n => n.ef, fmt: x => tall(x, 2), vis: okter.some(o => o.nokkeltall.ef != null) },
    { k: 'Frakobling', v: n => n.frakoblingPct, fmt: x => `${tall(x, 1)} %`, vis: okter.some(o => o.nokkeltall.frakoblingPct != null) },
    { k: 'Laktat maks', v: n => n.laktatMaks, fmt: x => `${tall(x, 1)} mmol`, vis: okter.some(o => o.nokkeltall.laktatMaks != null) },
    { k: 'Treff', v: n => (n.treff && n.treff.shots > 0 ? Math.round((n.treff.hits / n.treff.shots) * 1000) / 10 : null), fmt: x => `${tall(x, 1)} %`, vis: okter.some(o => o.nokkeltall.treff != null) },
    { k: 'Opplevd', v: n => n.opplevd, fmt: x => tall(x), vis: okter.some(o => o.nokkeltall.opplevd != null) },
  ]
  return (
    <div className="overflow-x-auto xp-hscroll" data-sammenlign-nokkeltall>
      <p style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', margin: '0 0 4px' }}>Nøkkeltall · delta mot første økt</p>
      <table style={{ borderCollapse: 'collapse', minWidth: 120 + okter.length * 150 }}>
        <thead><tr><th style={th}></th>{okter.map(o => <th key={o.id} style={{ ...th, color: fargeFor(o.id) }}>{fmtDato(o.date)}</th>)}</tr></thead>
        <tbody>
          {rader.filter(r => r.vis !== false).map(r => (
            <tr key={r.k} data-nokkeltall={r.k}>
              <td style={{ ...td, color: 'var(--tekst-5-app)' }}>{r.k}</td>
              {okter.map((o, i) => { const v = r.v(o.nokkeltall); return (
                <td key={o.id} style={td}>{v == null ? '-' : r.fmt(v)}{i > 0 && forste ? delta(v, r.v(forste), r.fmt) : null}</td>
              ) })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Runder side ved side per drag-indeks
function RunderSideVedSide({ okter, fargeFor }: { okter: SammenligningOkt[]; fargeFor: (id: string) => string }) {
  const drag = okter.map(o => o.aktiviteter.filter(a => segmentTypeFor(a.activity_type ?? 'aktivitet', a.movement_name ?? '') === 'drag'))
  const n = Math.max(0, ...drag.map(d => d.length))
  if (n === 0) return null
  const tempo = (a: SammenligningOkt['aktiviteter'][number]): number | null =>
    a.avg_pace_seconds_per_km ?? (a.distance_meters && a.duration_seconds && a.distance_meters > 0 ? a.duration_seconds / (a.distance_meters / 1000) : null)
  const treff = (a: SammenligningOkt['aktiviteter'][number]): string | null => {
    let h = 0, s = 0
    for (const x of a.shooting_series) if (x.hits != null) { h += x.hits; s += x.shots }
    return s > 0 ? `${h}/${s}` : null
  }
  const harWatt = okter.some((o, i) => drag[i].some(a => a.avg_watts != null))
  const harTreff = okter.some((o, i) => drag[i].some(a => treff(a) != null))
  return (
    <div className="overflow-x-auto xp-hscroll" data-sammenlign-runder>
      <p style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', margin: '0 0 4px' }}>Runder side ved side · per drag · delta mot første økt</p>
      <table style={{ borderCollapse: 'collapse', minWidth: 60 + okter.length * 240 }}>
        <thead>
          <tr><th style={th}>Drag</th>{okter.map(o => <th key={o.id} colSpan={4 + (harWatt ? 1 : 0) + (harTreff ? 1 : 0)} style={{ ...th, color: fargeFor(o.id) }}>{fmtDato(o.date)}</th>)}</tr>
          <tr><th style={th}></th>{okter.map(o => (<Fragment key={o.id}><th style={th}>tid</th><th style={th}>km</th><th style={th}>tempo</th><th style={th}>snitt · maks</th>{harWatt && <th style={th}>watt</th>}{harTreff && <th style={th}>treff</th>}</Fragment>))}</tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => (
            <tr key={i} data-drag-rad={i + 1}>
              <td style={{ ...td, color: 'var(--tekst-5-app)' }}>{i + 1}</td>
              {okter.map((o, k) => {
                const a = drag[k][i], ref = drag[0][i]
                if (!a) return <td key={o.id} colSpan={4 + (harWatt ? 1 : 0) + (harTreff ? 1 : 0)} style={{ ...td, color: 'var(--tekst-8-app)' }}>-</td>
                const t = tempo(a), tr = ref ? tempo(ref) : null
                return (
                  <Fragment key={o.id}>
                    <td style={td}>{a.duration_seconds != null ? fmtHM(a.duration_seconds) : '-'}{k > 0 && ref ? delta(a.duration_seconds, ref.duration_seconds, x => fmtHM(x)) : null}</td>
                    <td style={td}>{fmtKm(a.distance_meters)}</td>
                    <td style={td}>{t != null ? formatPace(Math.round(t), 'min_per_km') : '-'}{k > 0 && t != null && tr != null ? delta(t, tr, x => formatPace(Math.round(x), 'min_per_km')) : null}</td>
                    <td style={td}>{a.avg_heart_rate ?? '-'} · {a.max_heart_rate ?? '-'}{k > 0 && ref ? delta(a.avg_heart_rate, ref.avg_heart_rate, x => `${Math.round(x)}`) : null}</td>
                    {harWatt && <td style={td}>{a.avg_watts != null ? `${a.avg_watts} W` : '-'}{k > 0 && ref ? delta(a.avg_watts, ref.avg_watts, x => `${Math.round(x)} W`) : null}</td>}
                    {harTreff && <td style={td}>{treff(a) ?? '-'}</td>}
                  </Fragment>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Skyting per serie side ved side (skiskyttere)
function SkytingSideVedSide({ okter, fargeFor }: { okter: SammenligningOkt[]; fargeFor: (id: string) => string }) {
  const serier = okter.map(o => o.aktiviteter.flatMap(a => a.shooting_series))
  const n = Math.max(0, ...serier.map(s => s.length))
  if (n === 0) return null
  return (
    <div className="overflow-x-auto xp-hscroll" data-sammenlign-skyting>
      <p style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', margin: '0 0 4px' }}>Skyting per serie side ved side</p>
      <table style={{ borderCollapse: 'collapse', minWidth: 60 + okter.length * 200 }}>
        <thead>
          <tr><th style={th}>Serie</th>{okter.map(o => <th key={o.id} colSpan={3} style={{ ...th, color: fargeFor(o.id) }}>{fmtDato(o.date)}</th>)}</tr>
          <tr><th style={th}></th>{okter.map(o => (<Fragment key={o.id}><th style={th}>stilling · treff</th><th style={th}>tid</th><th style={th}>puls</th></Fragment>))}</tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => (
            <tr key={i} data-serie-rad={i + 1}>
              <td style={{ ...td, color: 'var(--tekst-5-app)' }}>{i + 1}</td>
              {okter.map((o, k) => {
                const s = serier[k][i]
                if (!s) return <td key={o.id} colSpan={3} style={{ ...td, color: 'var(--tekst-8-app)' }}>-</td>
                return (
                  <Fragment key={o.id}>
                    <td style={td}>{s.position === 'L' ? 'Ligg' : 'Stå'} {s.hits ?? '-'}/{s.shots}</td>
                    <td style={td}>{s.time_seconds != null ? `${s.time_seconds} s` : '-'}</td>
                    <td style={td}>{s.avg_heart_rate ?? '-'}</td>
                  </Fragment>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


/** Favoritt = øktsett + visning: henter selv (config.ids) og viser sammenligningen. */
export function SammenligningFavoritt({ ids, harSki, targetUserId, initialConfig }: { ids: string[]; harSki: boolean; targetUserId?: string; initialConfig?: Record<string, unknown> | null }) {
  const [okter, setOkter] = useState<SammenligningOkt[] | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    hentSammenligning(ids, targetUserId).then(res => { if (!live) return; if ('error' in res) setFeil(res.error); else setOkter(res) })
    return () => { live = false }
  }, [ids, targetUserId])
  if (feil) return <p style={{ fontFamily: FONT, color: 'var(--tekst-8-app)' }}>{feil}</p>
  if (!okter) return <div className="py-10 text-center" style={{ border: '1px dashed var(--kant-3)' }}><p className="text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: '#FF4500' }}>Laster økter…</p></div>
  if (okter.length < 2) return <p style={{ fontFamily: FONT, color: 'var(--tekst-8-app)' }}>Øktene i denne favoritten finnes ikke lenger.</p>
  return <SammenligningVisning okter={okter} harSki={harSki} targetUserId={targetUserId} initialConfig={initialConfig} />
}

