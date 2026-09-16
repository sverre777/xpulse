'use client'

// FORMKARTET bolk 5 - STANDPLASSFORM (Skyting, ny bolk under SkytingBolk8).
// Kun for skiskyttere: seksjonen skjules på «har utøveren skyting i det hele
// tatt», aldri på «er valgt periode tom» (regel 20).
//
// Nøkkeltall over de siste sju dagene med skyting: treff stående · treff
// liggende · puls inn · skytetid per serie. Under fem: «for lite data».
// Korrelasjonskort: form (TSB) mot treff stående · puls inn mot treff
// stående. Under ti: «for lite data» - samme grense som bolk 4 (KORR_MIN_N).
// IKKE KOPIER: HRV mot treff % og søvn mot treff % finnes i Belastning
// (belastning_korr_hrv_treff, belastning_korr_sovn_treff) - vi lenker dit.
// Stående og liggende slås aldri sammen til ett treff-tall.
//
// Datagrunnlaget er formkartets dager (én henting, samme lager): en dag med
// skyting teller som én «økt» her.

import { useEffect, useState } from 'react'
import { getFormkart } from '@/app/actions/formkart'
import { treffPct, type Formkart as FormkartData } from '@/lib/formkart'
import { korrelasjon, KORR_MIN_N } from '@/lib/korrelasjon'
import type { DateRange } from './date-range'
import { KortGruppe } from './KortGruppe'
import { MetricCard } from './MetricCard'
import { KorrKort } from './BelastningBolk4'
import { COLOR_PRONE, COLOR_STANDING } from './SkytingSummaryCards'

const MIN_OKTER_TALL = 5
const FOR_LITE = 'for lite data'
const FONT = "'Barlow Condensed', sans-serif"
const k = (v: number, d = 1) => v.toFixed(d).replace('.', ',')

export function Standplassform({ range, targetUserId, bare }: { range: DateRange; targetUserId?: string; bare?: string }) {
  const nokkel = `${range.from}|${range.to}|${targetUserId ?? ''}`
  const [svar, setSvar] = useState<{ nokkel: string; data: FormkartData | null } | null>(null)
  useEffect(() => {
    let live = true
    const n = `${range.from}|${range.to}|${targetUserId ?? ''}`
    getFormkart(range.from, range.to, targetUserId).then(r => { if (live) setSvar({ nokkel: n, data: 'error' in r ? null : r }) }).catch(() => { if (live) setSvar({ nokkel: n, data: null }) })
    return () => { live = false }
  }, [range.from, range.to, targetUserId])
  const data = svar?.nokkel === nokkel ? svar.data : null
  // Regel 20: «har utøveren skyting», aldri «er perioden tom».
  if (data && !data.harSkyting) return null

  const dager = (data?.dager ?? []).filter(d => d.skyting != null).map(d => ({ dato: d.dato, tsb: d.tsb, s: d.skyting! }))
  const siste = dager.slice(-7)
  const forLite = siste.length < MIN_OKTER_TALL
  const snitt = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const staa = (v: typeof dager) => snitt(v.map(d => treffPct(d.s.staaendeTreff, d.s.staaendeSkudd)).filter((x): x is number => x != null))
  const ligg = (v: typeof dager) => snitt(v.map(d => treffPct(d.s.liggendeTreff, d.s.liggendeSkudd)).filter((x): x is number => x != null))
  const puls = snitt(siste.map(d => d.s.pulsInn).filter((x): x is number => x != null))
  const tid = snitt(siste.map(d => d.s.skytetidSek).filter((x): x is number => x != null))
  const sub = (tekst: string) => forLite ? `${siste.length} av ${MIN_OKTER_TALL} økter med skyting` : tekst
  const verdi = (v: number | null, fmt: (x: number) => string) => data == null ? '…' : forLite || v == null ? FOR_LITE : fmt(v)
  const size = (v: number | null) => forLite || v == null ? 22 : 40
  const sS = staa(siste), sL = ligg(siste), aS = staa(dager), aL = ligg(dager)

  const kTsb = korrelasjon(dager.filter(d => d.tsb != null && d.s.staaendeSkudd > 0).map(d => ({ x: Math.round(d.tsb!), y: Math.round(treffPct(d.s.staaendeTreff, d.s.staaendeSkudd)!), date: d.dato })))
  const kPuls = korrelasjon(dager.filter(d => d.s.pulsInn != null && d.s.staaendeSkudd > 0).map(d => ({ x: d.s.pulsInn!, y: Math.round(treffPct(d.s.staaendeTreff, d.s.staaendeSkudd)!), date: d.dato })))

  const tall = [
    <MetricCard key="s" chartKey="skyting_standplass_staaende" label="Treff stående · 7 økter" accent={COLOR_STANDING} value={verdi(sS, v => `${Math.round(v)} %`)} valueSize={size(sS)} sublabel={sub(`mot ${aS != null ? Math.round(aS) : '-'} % i hele perioden`)} />,
    <MetricCard key="l" chartKey="skyting_standplass_liggende" label="Treff liggende · 7 økter" accent={COLOR_PRONE} value={verdi(sL, v => `${Math.round(v)} %`)} valueSize={size(sL)} sublabel={sub(`mot ${aL != null ? Math.round(aL) : '-'} % i hele perioden`)} />,
    <MetricCard key="p" chartKey="skyting_standplass_puls_inn" label="Puls inn på standplass" accent="var(--tekst-5-app)" value={verdi(puls, v => String(Math.round(v)))} valueSize={size(puls)} sublabel={sub('snitt av siste sju økter med skyting · kun førte verdier')} />,
    <MetricCard key="t" chartKey="skyting_standplass_skytetid" label="Skytetid per serie" accent="var(--tekst-5-app)" value={verdi(tid, v => `${k(v)} s`)} valueSize={size(tid)} sublabel={sub('snitt av siste sju økter med skyting')} />,
  ]
  const korr = [
    <KorrKort key="tsb" chartKey="skyting_korr_tsb_staaende" tittel="Form (TSB) mot treff stående" xNavn="TSB" yNavn="Treff stående" yEnhet=" %" k={kTsb} />,
    <KorrKort key="puls" chartKey="skyting_korr_pulsinn_staaende" tittel="Puls inn mot treff stående" xNavn="Puls inn" yNavn="Treff stående" yEnhet=" %" k={kPuls} />,
  ]
  const av = (liste: React.ReactElement[]) => bare ? liste.filter(c => (c.props as { chartKey: string }).chartKey === bare) : liste
  const visTall = av(tall), visKorr = av(korr)
  return (
    <KortGruppe chartKey="skyting_standplass" tittel="Standplassform mot fysisk form">
      <div data-standplassform data-okter={dager.length}>
        {!bare && (
          <p style={{ margin: '0 0 10px', fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', maxWidth: '74ch' }}>
            Stående er stillingen som faller først når tretthet stiger - derfor står liggende og stående alltid hver for seg, aldri som ett samletall. Under {MIN_OKTER_TALL} økter: for lite data.
          </p>
        )}
        {visTall.length > 0 && <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>{visTall}</div>}
        {visKorr.length > 0 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginTop: visTall.length ? 16 : 0 }} data-standplass-korr>{visKorr}</div>}
        {!bare && (
          <p style={{ margin: '10px 0 0', fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>
            HRV mot treff % og søvn mot treff % står i <a href="?tab=belastning" data-standplass-lenke style={{ color: 'var(--tekst-5-app)', textDecoration: 'underline' }}>Belastning</a> (korrelasjonskortene) - de kopieres ikke hit. Under {KORR_MIN_N} økter med skyting: for lite data.
          </p>
        )}
      </div>
    </KortGruppe>
  )
}
