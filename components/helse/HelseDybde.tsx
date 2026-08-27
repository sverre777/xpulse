'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getHelseOversikt, type HelseOversiktData, type HelseDag } from '@/app/actions/helse-oversikt'
import { HELSE_TREND_FARGER } from '@/lib/helse-farger'
import { Hypnogram, FallbackStripe, formatTimer } from './SovnGrafikk'
import { TrendPanel } from './HelseOversikt'
import { SeksjonsTittel } from './HelseOversikt'

// HELSE — DETALJER (visning B fra design/xpulse-helse-oversikt-design.html).
// Rendres INNE i HelseOversikt-kortet når «VIS MER» er valgt — samme kort,
// aldri en kopi. Siste natt vises som hypnogram NÅR stadie-tidslinja finnes
// (serie-data fra klokka, målt form: intervaller per stadium) — ellers
// fallback-stripa, automatisk per natt.
//
// Garmins skala-verdier (Body Battery, stress, kondisjonsalder, delskårer)
// står KUN i egen gruppe med forklaringstekst — aldri i trendene.
// Kalorier vises aldri.

export function HelseDybde({ data, targetUserId, onTilbake }: {
  data: HelseOversiktData
  targetUserId?: string
  onTilbake: () => void
}) {
  const natt = data.sisteNatt
  const nattDag = natt ? data.dager.find(d => d.date === natt.date) ?? null : null
  const idag = new Date()
  const idagIso = `${idag.getFullYear()}-${String(idag.getMonth() + 1).padStart(2, '0')}-${String(idag.getDate()).padStart(2, '0')}`

  // 1-års-trenden henter sitt eget spenn — uavhengig av valgt periode.
  const [aarsdata, setAarsdata] = useState<HelseDag[] | null>(null)
  useEffect(() => {
    let avbrutt = false
    const fra = new Date(); fra.setFullYear(fra.getFullYear() - 1)
    const fraIso = `${fra.getFullYear()}-${String(fra.getMonth() + 1).padStart(2, '0')}-${String(fra.getDate()).padStart(2, '0')}`
    getHelseOversikt(fraIso, idagIso, targetUserId).then(res => {
      if (!avbrutt && !('error' in res)) setAarsdata(res.dager)
    })
    return () => { avbrutt = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  const merke = data.merke
  const merkeNavn = merke ? merke.brand.charAt(0).toUpperCase() + merke.brand.slice(1) : null
  const mv = (merke?.verdier ?? {}) as Record<string, unknown>
  const tall = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null

  const sistePuls = sisteVerdi(data.dager, 'resting_hr')
  const sisteHrv = sisteVerdi(data.dager, 'hrv_ms')
  const sisteAktivitet = [...data.dager].reverse().find(d => d.steps != null) ?? null

  const dypAndel = nattDag?.deep_minutes != null && nattDag.total_sleep_minutes
    ? Math.round((nattDag.deep_minutes / nattDag.total_sleep_minutes) * 100) : null
  const remAndel = nattDag?.rem_minutes != null && nattDag.total_sleep_minutes
    ? Math.round((nattDag.rem_minutes / nattDag.total_sleep_minutes) * 100) : null
  const sovnKval = (mv.sleep_scores ?? null) as Record<string, { qualifierKey?: string }> | null
  const kval = (nokkel: string): string | null => {
    const k = sovnKval?.[nokkel]?.qualifierKey
    if (!k) return null
    return ({ EXCELLENT: 'svært god', GOOD: 'god', FAIR: 'middels', POOR: 'svak' } as Record<string, string>)[k] ?? k.toLowerCase()
  }

  const nattTidspunkt = (iso: string | null): string | null => {
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* ── Siste natt ── */}
      <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
        <SeksjonsTittel
          tittel={natt?.stadier?.length ? 'SISTE NATT — HYPNOGRAM' : 'SISTE NATT'}
          merknad={nattDag ? [
            nattTidspunkt(nattDag.sleep_start) ? `leggetid ${nattTidspunkt(nattDag.sleep_start)}` : null,
            nattTidspunkt(nattDag.sleep_end) ? `våknet ${nattTidspunkt(nattDag.sleep_end)}` : null,
          ].filter(Boolean).join(' · ') || nattDag.date : undefined}
        />
        {!nattDag ? (
          <p style={tomTekst}>For lite data — ingen netter i perioden.</p>
        ) : (
          <>
            {natt?.stadier?.length ? (
              <Hypnogram stadier={natt.stadier} />
            ) : (
              <FallbackStripe natt={nattDag} />
            )}
            <div className="flex justify-between flex-wrap gap-2 mt-1.5" style={{ color: 'var(--tekst-8-app)', fontSize: 11.5 }}>
              <span>Dyp {formatTimer(nattDag.deep_minutes)}</span>
              <span>Lett {formatTimer(nattDag.light_minutes)}</span>
              <span>REM {formatTimer(nattDag.rem_minutes)}</span>
              <span>Våken {formatTimer(nattDag.awake_minutes)}</span>
              {natt?.nap_minutes != null && natt.nap_minutes > 0 && (
                <span>Høneblund: {natt.nap_minutes} min</span>
              )}
            </div>
            {!natt?.stadier?.length && (
              <p style={{ ...tomTekst, marginTop: 8 }}>
                Stadie-tidslinja (hypnogram) krever serie-data fra klokka — vises automatisk når natta har det.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Grupper: viktigst for utholdenhet øverst ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
        <Gruppe tittel="RESTITUSJON" fotnote="Manuelt førte verdier (M) vinner alltid over klokka.">
          <Rad k="Natt-HRV (snitt)" v={sisteHrv.verdi != null ? `${Math.round(sisteHrv.verdi)} ms` : null} manuell={sisteHrv.manuell} />
          <Rad k="HRV 5-min høyeste" v={tall(mv.hrv_5min_high) != null ? `${tall(mv.hrv_5min_high)} ms` : null} />
          <Rad k="Hvilepuls" v={sistePuls.verdi != null ? String(Math.round(sistePuls.verdi)) : null} manuell={sistePuls.manuell} />
        </Gruppe>
        <Gruppe tittel="SØVN">
          <Rad k="Total søvn" v={nattDag?.total_sleep_minutes != null ? formatTimer(nattDag.total_sleep_minutes) : null} />
          <Rad k="Søvnscore" v={nattDag?.sleep_score != null ? String(nattDag.sleep_score) : null} />
          <Rad k="Dypsøvn-andel" v={dypAndel != null ? `${dypAndel} %${kval('deepPercentage') ? ` — «${kval('deepPercentage')}»` : ''}` : null} />
          <Rad k="REM-andel" v={remAndel != null ? `${remAndel} %${kval('remPercentage') ? ` — «${kval('remPercentage')}»` : ''}` : null} />
        </Gruppe>
        <Gruppe tittel="AKTIVITET" fotnote="Kalorier vises ikke — estimatene spriker for mye mellom merker.">
          <Rad k="Skritt" v={sisteAktivitet?.steps != null ? sisteAktivitet.steps.toLocaleString('nb-NO') : null} />
          <Rad k="Daglig distanse" v={sisteAktivitet?.daily_distance_m != null ? `${(sisteAktivitet.daily_distance_m / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : null} />
          <Rad k="Etasjer" v={sisteAktivitet?.stairs_climbed != null ? String(sisteAktivitet.stairs_climbed) : null} />
        </Gruppe>
        {merkeNavn && (
          <Gruppe tittel={`FRA ${merkeNavn.toUpperCase()} — DERES SKALA`}
            fotnote={`${merkeNavn}s egne skårer, på ${merkeNavn}s skala. Regnes ikke inn i trendene, som bruker verdier som er sammenlignbare på tvers av kilder.`}>
            <Rad k="Body Battery ladet / tappet"
              v={tall(mv.body_battery_charged) != null || tall(mv.body_battery_drained) != null
                ? `${tall(mv.body_battery_charged) ?? '–'} / ${tall(mv.body_battery_drained) ?? '–'}` : null} />
            <Rad k="Stress (snitt / maks)"
              v={tall(mv.avg_stress) != null || tall(mv.max_stress) != null
                ? `${tall(mv.avg_stress) ?? '–'} / ${tall(mv.max_stress) ?? '–'}` : null} />
            <Rad k="Kondisjonsalder" v={tall(mv.fitness_age) != null ? String(tall(mv.fitness_age)) : null} />
            <Rad k="VO₂maks" v={tall(mv.vo2max) != null ? String(tall(mv.vo2max)) : null} />
          </Gruppe>
        )}
      </div>

      {/* ── Vekt — reddet fra det gamle helse-fanen (Sverres beslutning
             27. aug): klokker og manuell føring leverer den, og stien
             føring → health_metrics → visning er hel igjen her. ── */}
      {data.dager.some(d => d.body_weight_kg != null) && (
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
          <SeksjonsTittel tittel="VEKT" merknad="kg · valgt periode" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TrendPanel navn="VEKT" enhet="kg" farge="#E8B93C" dager={data.dager}
              felt="body_weight_kg" ukesnitt={false} />
          </div>
        </div>
      )}

      {/* ── Lang trend — HRV, 1 år, ukesnitt ── */}
      <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
        <SeksjonsTittel tittel="LANG TREND — HRV" merknad="1 år · ukesnitt" />
        <AarsTrend dager={aarsdata} felt="hrv_ms" farge={HELSE_TREND_FARGER.hrv} />
      </div>

      <div className="flex gap-2.5 flex-wrap" style={{ padding: '18px 22px' }}>
        <button type="button" onClick={onTilbake} style={btnGhost}>← TILBAKE</button>
        <Link href={`/app/health/${idagIso}`} style={btnGhost}>✎ FØR MANUELT</Link>
      </div>
    </>
  )
}

function sisteVerdi(dager: HelseDag[], felt: 'resting_hr' | 'hrv_ms'): { verdi: number | null; manuell: boolean } {
  const rad = [...dager].reverse().find(d => d[felt] != null) ?? null
  return { verdi: (rad?.[felt] as number | null) ?? null, manuell: rad?.kilder?.[felt] === 'manual' }
}

function Gruppe({ tittel, fotnote, children }: { tittel: string; fotnote?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 10, padding: 16 }}>
      <h4 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.16em', fontSize: 12.5, color: 'var(--tekst-5-app)', margin: '0 0 10px' }}>
        {tittel}
      </h4>
      {children}
      {fotnote && <p style={{ fontSize: 11.5, color: 'var(--tekst-8-app)', marginTop: 10, lineHeight: 1.45 }}>{fotnote}</p>}
    </div>
  )
}

// Tomme rader rendres ikke — visningen ser komplett ut uansett føringsgrad.
function Rad({ k, v, manuell = false }: { k: string; v: string | null; manuell?: boolean }) {
  if (v == null) return null
  return (
    <div className="flex justify-between" style={{ padding: '5px 0', fontSize: 13.5, borderBottom: '1px dashed var(--line)' }}>
      <span style={{ color: 'var(--tekst-5-app)' }}>{k}</span>
      <span style={{ fontWeight: 600, color: 'var(--tekst-1-app)' }}>
        {v}
        {manuell && (
          <span title="manuelt ført — vinner over klokka" style={{
            display: 'inline-block', fontSize: 10, border: '1px solid var(--line2)', borderRadius: 4,
            padding: '0 5px', color: 'var(--tekst-8-app)', marginLeft: 6, verticalAlign: 2,
          }}>M</span>
        )}
      </span>
    </div>
  )
}

function AarsTrend({ dager, felt, farge }: { dager: HelseDag[] | null; felt: 'hrv_ms'; farge: string }) {
  const punkter = useMemo(() => {
    if (!dager) return []
    const uker = new Map<string, number[]>()
    for (const d of dager) {
      const v = d[felt]
      if (typeof v !== 'number') continue
      const dt = new Date(`${d.date}T12:00:00`)
      const man = new Date(dt); man.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
      const key = man.toISOString().slice(0, 10)
      uker.set(key, [...(uker.get(key) ?? []), v])
    }
    return [...uker.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([uke, v]) => ({ uke, v: v.reduce((a, b) => a + b, 0) / v.length }))
  }, [dager, felt])

  if (!dager) return <p style={tomTekst}>Laster …</p>
  if (punkter.length < 3) return <p style={tomTekst}>For lite data til en årstrend ennå.</p>

  const B = 640, H = 90
  const min = Math.min(...punkter.map(p => p.v)), maks = Math.max(...punkter.map(p => p.v))
  const spenn = maks - min || 1
  const x = (i: number) => 4 + (i / (punkter.length - 1)) * (B - 8)
  const y = (v: number) => 12 + (1 - (v - min) / spenn) * 58
  const sti = punkter.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const fmtMnd = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })

  return (
    <svg viewBox={`0 0 ${B} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
      <line x1={0} y1={78} x2={B} y2={78} stroke="var(--kant-3)" strokeWidth={1} />
      <path d={sti} fill="none" stroke={farge} strokeWidth={2} />
      <text x={4} y={88} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{fmtMnd(punkter[0].uke)}</text>
      <text x={B - 44} y={88} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{fmtMnd(punkter[punkter.length - 1].uke)}</text>
    </svg>
  )
}

const tomTekst: React.CSSProperties = {
  color: 'var(--tekst-8-app)', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif",
}
const btnGhost: React.CSSProperties = {
  borderRadius: 10, padding: '11px 22px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.12em', fontSize: 14,
  background: 'transparent', border: '1px solid var(--line2)', color: 'var(--tekst-1-app)',
}
