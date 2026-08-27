'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { getHelseOversikt, type HelseOversiktData, type HelseDag } from '@/app/actions/helse-oversikt'
import { settDagsform } from '@/app/actions/health'
import { StarRating } from '@/components/ui/StarRating'
import { HELSE_TREND_FARGER } from '@/lib/helse-farger'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE } from '@/components/analysis/chart-theme'
import { StadieStabler, formatTimer } from './SovnGrafikk'
import { HelseDybde } from './HelseDybde'

// HELSE FRA KLOKKA — visning A fra design/xpulse-helse-oversikt-design.html.
// ETT kort, montert flere steder (Helse-fanen i Analyse, nederst i Dagbok,
// pop-upen fra kompaktkortet) — aldri kopier (regel 11). Periodevelgeren bor
// PÅ kortet og styrer fliser, stadiegraf og trender sammen; 1 år = ukesnitt.
// «VIS MER» bytter til dybden (visning B) inne i samme kort.
//
// Regel 20: kortet skjuler seg selv kun når brukeren IKKE har helsedata i
// det hele tatt — en tom periode gir «for lite data», aldri tomme grafer.

type Periode = '7d' | '30d' | '1y' | 'egen'

function isoDato(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dagerSiden(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n)
  return isoDato(d)
}
function dagerSidenAnker(n: number, anker?: string): string {
  const d = anker ? new Date(`${anker}T12:00:00`) : new Date()
  d.setDate(d.getDate() - n)
  return isoDato(d)
}

const FLIS_L: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
  letterSpacing: '0.16em', fontSize: 12, color: 'var(--tekst-5-app)', textTransform: 'uppercase',
}
const FLIS_V: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, lineHeight: 1.05,
  marginTop: 4, color: 'var(--tekst-1-app)',
}

export function HelseOversikt({ targetUserId, kompaktHeader = false, forhandsdata, sluttDato, foringsDato }: {
  targetUserId?: string
  /** Pop-up-konteksten (bolk 2) bruker en litt strammere header. */
  kompaktHeader?: boolean
  /** Ferdig hentet data for standardperioden (30 d) — popupen og server-
   * prefetch slipper dobbelthenting; periodebytte henter som vanlig. */
  forhandsdata?: HelseOversiktData
  /** Anker for periodene (dag-klikk i kalenderen): «30 dager» betyr da
   * 30 dager FREM TIL denne dagen. Uten = i dag. */
  sluttDato?: string
  /** Datoen «Før manuelt» og følelses-føringen retter seg mot (dag-klikk).
   * Uten = i dag. */
  foringsDato?: string
}) {
  const [periode, setPeriode] = useState<Periode>('30d')
  const [egenFra, setEgenFra] = useState(dagerSiden(30))
  const [egenTil, setEgenTil] = useState(isoDato(new Date()))
  // Ingen synkron setState i effekten (lint-regel): lastetilstand utledes
  // av at svaret er merket med nøkkelen sin.
  const [svar, setSvar] = useState<{ nokkel: string; data: HelseOversiktData } | null>(
    forhandsdata
      ? { nokkel: `${dagerSidenAnker(30, sluttDato)}|${sluttDato ?? isoDato(new Date())}|${targetUserId ?? ''}`, data: forhandsdata }
      : null,
  )
  const [visDybde, setVisDybde] = useState(false)

  const anker = sluttDato ?? isoDato(new Date())
  const [fra, til] = useMemo((): [string, string] => {
    if (periode === '7d') return [dagerSidenAnker(7, anker), anker]
    if (periode === '30d') return [dagerSidenAnker(30, anker), anker]
    if (periode === '1y') return [dagerSidenAnker(365, anker), anker]
    return [egenFra, egenTil]
  }, [periode, egenFra, egenTil, anker])

  const nokkel = `${fra}|${til}|${targetUserId ?? ''}`
  useEffect(() => {
    if (svar?.nokkel === nokkel) return  // forhåndsdata dekker allerede spennet
    let avbrutt = false
    getHelseOversikt(fra, til, targetUserId).then(res => {
      if (!avbrutt && !('error' in res)) setSvar({ nokkel, data: res })
    })
    return () => { avbrutt = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fra, til, targetUserId, nokkel])

  const data = svar?.data ?? null
  const laster = svar?.nokkel !== nokkel

  // Regel 20: uten helsedata overhodet — ingen flate.
  if (!laster && data && !data.harData) return null
  if (!data) {
    return laster ? (
      <div className="p-5" style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <p style={{ ...FLIS_L }}>Helse … laster</p>
      </div>
    ) : null
  }

  const dager = data.dager
  const sisteMed = (felt: keyof HelseDag) => [...dager].reverse().find(d => d[felt] != null) ?? null
  const snitt = (felt: keyof HelseDag): number | null => {
    const v = dager.map(d => d[felt]).filter((x): x is number => typeof x === 'number')
    if (v.length === 0) return null
    return v.reduce((a, b) => a + b, 0) / v.length
  }
  const idag = isoDato(new Date())
  const foring = foringsDato ?? idag

  const kildeNavn = data.kilde.navn === 'manual'
    ? 'manuell føring'
    : data.kilde.navn ? data.kilde.navn.charAt(0).toUpperCase() + data.kilde.navn.slice(1) : null
  const kildeTid = data.kilde.tidspunkt
    ? new Date(data.kilde.tidspunkt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    : null

  const chip = (p: Periode, tekst: string) => (
    <button key={p} type="button" onClick={() => { setPeriode(p) }}
      className="transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 13,
        letterSpacing: '0.1em', borderRadius: 999, padding: '6px 14px',
        border: `1px solid ${periode === p ? '#FF4500' : 'var(--line2)'}`,
        background: periode === p ? '#FF4500' : 'var(--card)',
        color: periode === p ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)',
        cursor: 'pointer',
      }}>
      {tekst}
    </button>
  )

  return (
    <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
      {/* ── Header m/ kildemerke + periodevelger ── */}
      <div className="flex flex-wrap gap-3.5 items-center justify-between"
        style={{ padding: kompaktHeader ? '14px 18px' : '18px 22px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.16em', fontSize: 15, color: 'var(--tekst-1-app)' }}>
          <span style={{ display: 'inline-block', width: 26, height: 4, borderRadius: 2, background: '#FF4500', marginRight: 10, verticalAlign: 'middle' }} />
          {visDybde ? 'HELSE — DETALJER' : 'HELSE'}
          {kildeNavn && (
            <span style={{ color: 'var(--tekst-8-app)', fontWeight: 500, letterSpacing: '0.06em', marginLeft: 10, fontSize: 12.5, textTransform: 'none' }}>
              ⌚ {kildeNavn}{kildeTid ? ` · synket ${kildeTid}` : ''}
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {chip('7d', '7 DAGER')}
          {chip('30d', '30 DAGER')}
          {chip('1y', '1 ÅR')}
          {chip('egen', 'EGENDEFINERT')}
        </div>
      </div>
      {periode === 'egen' && (
        <div className="flex gap-2 items-center flex-wrap" style={{ padding: '10px 22px 0', color: 'var(--tekst-8-app)', fontSize: 12.5 }}>
          Fra <input type="date" value={egenFra} onChange={e => setEgenFra(e.target.value)} style={inp} />
          til <input type="date" value={egenTil} onChange={e => setEgenTil(e.target.value)} style={inp} />
        </div>
      )}

      {/* ── Toppfliser: i dag + snitt for perioden ── */}
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 1, background: 'var(--line)', borderBottom: '1px solid var(--line)' }}>
        <Flis navn="HVILEPULS" enhet=" slag" felt="resting_hr" sisteMed={sisteMed} snittAv={snitt} lavereErBedre />
        <Flis navn="HRV (NATT)" enhet=" ms" felt="hrv_ms" sisteMed={sisteMed} snittAv={snitt} />
        <Flis navn="SØVNSCORE" enhet="" felt="sleep_score" sisteMed={sisteMed} snittAv={snitt} />
        <Flis navn="SØVNTID" enhet="" felt="total_sleep_minutes" sisteMed={sisteMed} snittAv={snitt} somTid />
      </div>

      {visDybde ? (
        <HelseDybde data={data} targetUserId={targetUserId} onTilbake={() => setVisDybde(false)} />
      ) : (
        <>
          {/* ── Søvnstadier per natt ── */}
          <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
            <SeksjonsTittel tittel="SØVNSTADIER — PER NATT" merknad={`timer · siste ${Math.min(14, dager.filter(d => d.total_sleep_minutes != null).length)} netter i perioden`} />
            <StadieStabler netter={dager.filter(d => d.total_sleep_minutes != null).slice(-14)} />
          </div>

          {/* ── Trender: TRE småpaneler, hver sin skala — aldri dobbel y-akse ── */}
          <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
            <SeksjonsTittel tittel={`TRENDER — ${periode === '1y' ? '1 ÅR (UKESNITT)' : periode === '7d' ? 'SISTE 7 DAGER' : periode === 'egen' ? 'VALGT PERIODE' : 'SISTE 30 DAGER'}`} merknad="hold over for verdi per dag" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <TrendPanel navn="HRV" enhet="ms" farge={HELSE_TREND_FARGER.hrv} dager={dager} felt="hrv_ms" ukesnitt={periode === '1y'} />
              <TrendPanel navn="HVILEPULS" enhet="bpm" farge={HELSE_TREND_FARGER.hvilepuls} dager={dager} felt="resting_hr" ukesnitt={periode === '1y'} />
              <TrendPanel navn="SØVNSCORE" enhet="" farge={HELSE_TREND_FARGER.sovnscore} dager={dager} felt="sleep_score" ukesnitt={periode === '1y'} />
            </div>
          </div>

          {/* ── Følelse (daglig dagsform, manuell 1–5 — SAMME skala som
                 øktenes, fase 108). Føringsdagens prikk er hurtigføring
                 rett på kortet; de andre lenker til dagens føringsskjema. ── */}
          <FolelseRad dager={dager} foringsDato={foring} snitt={snitt('day_form')}
            kanFore={!targetUserId} sisteDato={anker}
            onFort={v => setSvar(s => {
              // Optimistisk: patch dagen lokalt — ALDRI nullstill svaret
              // (det ville re-hentet og fått hele kortet til å blinke).
              if (!s) return s
              const dager = [...s.data.dager]
              const i = dager.findIndex(d => d.date === foring)
              if (i >= 0) dager[i] = { ...dager[i], day_form: v }
              else dager.push({
                date: foring, resting_hr: null, hrv_ms: null, steps: null,
                daily_distance_m: null, stairs_climbed: null, body_weight_kg: null,
                sleep_score: null, total_sleep_minutes: null, deep_minutes: null,
                light_minutes: null, rem_minutes: null, awake_minutes: null,
                sleep_start: null, sleep_end: null, kilder: {}, day_form: v,
              })
              dager.sort((a, b) => a.date.localeCompare(b.date))
              return { ...s, data: { ...s.data, dager } }
            })} />

          {/* ── Handlingsrad ── */}
          <div className="flex gap-2.5 flex-wrap" style={{ padding: '18px 22px' }}>
            <button type="button" onClick={() => setVisDybde(true)} style={btnPrimar}>VIS MER</button>
            <Link href={`/app/health/${foring}`} style={btnGhost}>✎ FØR MANUELT</Link>
          </div>
        </>
      )}
    </div>
  )
}

function sisteDatoer(n: number, tilDato: string): string[] {
  const ut: string[] = []
  for (let i = n - 1; i >= 0; i--) ut.push(dagerSidenAnker(i, tilDato))
  return ut
}

function FolelseRad({ dager, foringsDato, snitt, kanFore, sisteDato, onFort }: {
  dager: HelseDag[]
  foringsDato: string
  snitt: number | null
  /** Trener-visning er lese-only — helse føres bare av utøveren selv. */
  kanFore: boolean
  sisteDato: string
  onFort: (verdi: number | null) => void
}) {
  const [lagrer, setLagrer] = useState(false)
  const foringsVerdi = dager.find(x => x.date === foringsDato)?.day_form ?? null

  const lagre = async (v: number | null) => {
    if (lagrer) return
    setLagrer(true)
    const res = await settDagsform(foringsDato, v)
    setLagrer(false)
    if (!res.error) onFort(v)
  }

  return (
    <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
      <SeksjonsTittel tittel="FØLELSE" merknad="manuell · 1–5 · samme skala som øktene · siste 14 dager" />
      <div className="flex items-center gap-2 flex-wrap">
        {sisteDatoer(14, sisteDato).map(dato => {
          const v = dager.find(x => x.date === dato)?.day_form ?? null
          const erForing = dato === foringsDato
          return (
            <Link key={dato} href={`/app/health/${dato}`} title={`${dato}${v != null ? ` · ${v}` : ''}`}
              style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 11,
                textDecoration: 'none',
                background: v != null ? '#28A86E' : 'var(--card)',
                border: `1px solid ${v != null ? '#28A86E' : 'var(--line2)'}`,
                color: v != null ? '#08231a' : 'var(--tekst-8-app)',
                fontWeight: v != null ? 700 : 400,
                outline: erForing ? '2px solid #FF4500' : undefined,
                outlineOffset: 2,
              }}>
              {v != null ? v : '–'}
            </Link>
          )
        })}
        {snitt != null && (
          <span style={{ color: 'var(--tekst-8-app)', fontSize: 12, marginLeft: 8 }}>
            snitt {(Math.round(snitt * 10) / 10).toLocaleString('nb-NO')}
          </span>
        )}
      </div>
      {kanFore && (
        <div className="flex items-center gap-3 mt-2 flex-wrap" style={{ opacity: lagrer ? 0.6 : 1 }}>
          <span style={{ fontSize: 12, color: 'var(--tekst-8-app)', fontFamily: "'Barlow Condensed', sans-serif" }}>
            {foringsVerdi != null ? `Ført ${foringsDato === isoDato(new Date()) ? 'i dag' : foringsDato}:` : 'Før dagen:'}
          </span>
          <StarRating value={foringsVerdi} onChange={lagre} size={22} />
        </div>
      )}
    </div>
  )
}

export function SeksjonsTittel({ tittel, merknad }: { tittel: string; merknad?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3.5 gap-2 flex-wrap">
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.16em', fontSize: 13.5, color: 'var(--tekst-5-app)', margin: 0 }}>
        {tittel}
      </h3>
      {merknad && <span style={{ fontSize: 12, color: 'var(--tekst-8-app)' }}>{merknad}</span>}
    </div>
  )
}

function Flis({ navn, enhet, felt, sisteMed, snittAv, lavereErBedre = false, somTid = false }: {
  navn: string
  enhet: string
  felt: keyof HelseDag
  sisteMed: (f: keyof HelseDag) => HelseDag | null
  snittAv: (f: keyof HelseDag) => number | null
  lavereErBedre?: boolean
  somTid?: boolean
}) {
  const rad = sisteMed(felt)
  const verdi = rad?.[felt] as number | null | undefined
  const sn = snittAv(felt)
  const manuell = rad?.kilder?.[felt as string] === 'manual'
  const fmt = (v: number) => somTid ? formatTimer(v) : String(Math.round(v))
  const diff = verdi != null && sn != null ? verdi - sn : null
  const bedre = diff != null && (lavereErBedre ? diff < 0 : diff > 0)

  return (
    <div style={{ background: 'var(--card2)', padding: '18px 20px' }}>
      <div style={FLIS_L}>{navn}</div>
      <div style={FLIS_V}>
        {verdi != null ? fmt(verdi) : '–'}
        {verdi != null && enhet && <small style={{ fontSize: 19, color: 'var(--tekst-5-app)', letterSpacing: '0.04em' }}>{enhet}</small>}
        {manuell && (
          <span title="manuelt ført — vinner over klokka" style={{
            display: 'inline-block', fontSize: 10, border: '1px solid var(--line2)', borderRadius: 4,
            padding: '0 5px', color: 'var(--tekst-8-app)', marginLeft: 6, verticalAlign: 6,
            fontFamily: "'Inter', sans-serif",
          }}>M</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tekst-8-app)', marginTop: 2 }}>
        {sn != null ? <>
          <b style={{ color: 'var(--tekst-5-app)', fontWeight: 600 }}>snitt {somTid ? formatTimer(sn) : Math.round(sn)}</b>
          {diff != null && Math.round(Math.abs(somTid ? diff : diff)) !== 0 && (
            <span style={{ marginLeft: 6, color: bedre ? '#28A86E' : '#E23A5A' }}>
              {diff > 0 ? '▲' : '▼'} {somTid ? `${Math.round(Math.abs(diff))} min` : Math.round(Math.abs(diff))}
            </span>
          )}
        </> : 'for lite data'}
      </div>
    </div>
  )
}

export function TrendPanel({ navn, enhet, farge, dager, felt, ukesnitt }: {
  navn: string
  enhet: string
  farge: string
  dager: HelseDag[]
  felt: keyof HelseDag
  ukesnitt: boolean
}) {
  const punkter = useMemo(() => {
    const med = dager
      .filter(d => typeof d[felt] === 'number')
      .map(d => ({ dato: d.date, v: d[felt] as number }))
    if (!ukesnitt) return med
    // 1 år: aggreger til ukesnitt (mandag som nøkkel).
    const uker = new Map<string, number[]>()
    for (const p of med) {
      const d = new Date(`${p.dato}T12:00:00`)
      const man = new Date(d); man.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const key = isoDato(man)
      uker.set(key, [...(uker.get(key) ?? []), p.v])
    }
    return [...uker.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dato, v]) => ({ dato, v: Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 10) / 10 }))
  }, [dager, felt, ukesnitt])

  const siste = punkter.length > 0 ? punkter[punkter.length - 1].v : null

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 10, padding: '12px 14px' }}>
      <div className="flex justify-between items-baseline" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.12em', fontSize: 12, color: 'var(--tekst-5-app)' }}>
        <span>{navn}</span>
        <b style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: 'var(--tekst-1-app)', letterSpacing: 0 }}>
          {siste != null ? `${siste}${enhet ? ` ${enhet}` : ''}` : '–'}
        </b>
      </div>
      {punkter.length < 2 ? (
        <p style={{ fontSize: 12, color: 'var(--tekst-8-app)', margin: '18px 0' }}>for lite data</p>
      ) : (
        <div style={{ width: '100%', height: 72 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={punkter} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="dato" hide />
              <YAxis tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={CHART_AXIS_LINE}
                tickLine={false} width={30} domain={['auto', 'auto']} />
              <Tooltip content={<XpTooltip />} cursor={{ stroke: 'var(--line2)', strokeDasharray: '3 3' }}
                labelFormatter={(d) => String(d)}
                formatter={(value) => [`${value}${enhet ? ` ${enhet}` : ''}`, navn]} />
              <Line type="monotone" dataKey="v" stroke={farge} strokeWidth={2} dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 8,
  color: 'var(--tekst-1-app)', padding: '6px 10px', font: 'inherit',
}
const btnPrimar: React.CSSProperties = {
  borderRadius: 10, padding: '11px 22px', cursor: 'pointer',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.12em', fontSize: 14,
  background: '#FF4500', border: '1px solid #FF4500', color: 'var(--tekst-1-ren)',
}
const btnGhost: React.CSSProperties = {
  borderRadius: 10, padding: '11px 22px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.12em', fontSize: 14,
  background: 'transparent', border: '1px solid var(--line2)', color: 'var(--tekst-1-app)',
}
export { btnGhost as helseBtnGhost }
