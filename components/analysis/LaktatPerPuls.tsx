'use client'

// FORMKARTET bolk 6 - LAKTAT PER PULS (Terskel, ved siden av «Laktat ved
// samme fart / watt»). Samme spørsmål, annen akse: pulsen er den eneste
// felles aksen for langrenn og skiskyting, der watt mangler og terrenget
// varierer. terskel_laktat_vs_intensitet står uendret.
//
//   x = puls i PROSENT av terskelen som gjaldt den dagen (lib/terskel-oppslag
//       via getFormkart) - standard. Rå puls er en bryter, og valgt akse er
//       synlig. y = mmol.
//   Tre tredjedeler av økt-rekkefølgen: eldst og midtre dempet, siste i
//   aksentfargen - samme språk som dempet fjorår i sesongsammenligningen.
//   Referanselinjer: terskel (100 %) og 4 mmol, tynne og stiplet. 4 mmol er
//   en konvensjon, ikke en sannhet om utøveren - ingenting farges etter den.
//   Filter på bevegelsesform med «Alle» som standard, skjult når utøveren
//   bare har én form med laktat (regel 20).
//   Nøkkeltall: laktat ved 90 og 100 % av terskel, siste tredjedel mot
//   eldste. Mangler målinger nær nivået i BEGGE: «for lite data», aldri en
//   differanse regnet på ett punkt. Kun MÅLTE verdier (planlagt laktat teller
//   aldri - payloaden bærer bare workout_activity_lactate_measurements).

import { useEffect, useState } from 'react'
import { getFormkart } from '@/app/actions/formkart'
import { tredel, bolkKurve, laktatVed, type Formkart as FormkartData, type LaktatPunkt } from '@/lib/formkart'
import type { DateRange } from './date-range'
import { ChartWrapper } from './ChartWrapper'
import { KortGruppe } from './KortGruppe'
import { MetricCard } from './MetricCard'

const FONT = "'Barlow Condensed', sans-serif"
const ORANSJE = '#FF4500'
const BOLKER = [{ navn: 'Eldst', farge: 'var(--tekst-8-app)' }, { navn: 'Midtre', farge: 'var(--tekst-5-app)' }, { navn: 'Siste', farge: ORANSJE }]
const FOR_LITE = 'for lite data'
const k = (v: number, d = 1) => v.toFixed(d).replace('.', ',')
type Akse = 'pct' | 'puls'

export function LaktatPerPuls({ range, targetUserId, bare }: { range: DateRange; targetUserId?: string; bare?: string }) {
  const nokkel = `${range.from}|${range.to}|${targetUserId ?? ''}`
  const [svar, setSvar] = useState<{ nokkel: string; data: FormkartData | null } | null>(null)
  const [akse, setAkse] = useState<Akse>('pct')
  const [form, setForm] = useState<string>('alle')
  useEffect(() => {
    let live = true
    const n = `${range.from}|${range.to}|${targetUserId ?? ''}`
    getFormkart(range.from, range.to, targetUserId).then(r => { if (live) setSvar({ nokkel: n, data: 'error' in r ? null : r }) }).catch(() => { if (live) setSvar({ nokkel: n, data: null }) })
    return () => { live = false }
  }, [range.from, range.to, targetUserId])
  const data = svar?.nokkel === nokkel ? svar.data : null

  // Én rad per økt med målinger, i tid - tredelingen er på økter, ikke målinger.
  const okter = (data?.dager ?? []).flatMap(d => {
    const perOkt = new Map<string, LaktatPunkt[]>()
    for (const m of d.laktat) {
      const x = akse === 'pct' ? m.pctAvTerskel : m.puls
      if (x == null) continue
      if (!perOkt.has(m.workoutId)) perOkt.set(m.workoutId, [])
      perOkt.get(m.workoutId)!.push({ x, y: m.mmol, dato: d.dato, bevegelse: m.bevegelse })
    }
    return Array.from(perOkt.values())
  })
  const former = Array.from(new Set(okter.flat().map(p => p.bevegelse).filter(Boolean))).sort()
  const valgte = form === 'alle' ? okter : okter.map(o => o.filter(p => p.bevegelse === form)).filter(o => o.length > 0)
  const harLaktat = (data?.dager ?? []).some(d => d.laktat.length > 0)
  const terskler = Array.from(new Set((data?.dager ?? []).filter(d => d.laktat.length > 0).map(d => d.terskelHr).filter((t): t is number => t != null)))
  const terskelSnitt = terskler.length ? Math.round(terskler.reduce((a, b) => a + b, 0) / terskler.length) : null
  const [eldst, midtre, siste] = tredel(valgte).map(t => t.flat()) as [LaktatPunkt[], LaktatPunkt[], LaktatPunkt[]]
  const bolkPunkter = [eldst, midtre, siste]
  const alle = bolkPunkter.flat()

  // Regel 20: seksjonen skjules på «har utøveren laktat», aldri på tom periode - men
  // det er perioden som hentes; uten laktat i perioden sier vi det i stedet for å tegne tomt.
  const tilPct = (p: { x: number; y: number }) => akse === 'pct' ? p : { x: terskelSnitt ? p.x / terskelSnitt * 100 : NaN, y: p.y }
  const ved = (maal: number) => ({ f: laktatVed(eldst.map(tilPct), maal), n: laktatVed(siste.map(tilPct), maal) })
  const tallKort = [90, 100].map(maal => {
    const { f, n } = ved(maal)
    const nok = f != null && n != null
    return <MetricCard key={maal} chartKey={`terskel_laktat_ved_${maal}`} label={`Laktat ved ${maal} % av terskel`} accent={ORANSJE}
      value={data == null ? '…' : nok ? `${k(n)} mmol` : FOR_LITE} valueSize={nok ? 40 : 22}
      sublabel={nok ? `mot ${k(f)} mmol i eldste tredjedel - ${n < f ? 'ned' : 'opp'} ${k(Math.abs(n - f))} mmol ved samme relative puls` : 'mangler målinger nær dette pulsnivået i begge tredjedeler'} />
  })
  tallKort.push(<MetricCard key="m" chartKey="terskel_laktat_malinger" label="Målinger i perioden" accent="var(--tekst-5-app)" value={data == null ? '…' : String(alle.length)} sublabel={`fordelt på ${valgte.length} økter · kun målte verdier`} />)
  const visTall = bare ? tallKort.filter(c => (c.props as { chartKey: string }).chartKey === bare) : tallKort
  const visGraf = !bare || bare === 'terskel_laktat_per_puls'

  // Geometri (fasit tegnLaktat)
  const W = 1100, H = 340, mv = 54, mh = 20, mt = 16, mb = 38
  const xs = alle.map(p => p.x), ys = alle.map(p => p.y)
  const x0 = xs.length ? Math.min(...xs) - 2 : 0, x1 = xs.length ? Math.max(...xs) + 2 : 1, y1 = Math.max(4, ...ys) + 0.5
  const px = (v: number) => mv + ((v - x0) / (x1 - x0)) * (W - mv - mh)
  const py = (v: number) => H - mb - (v / y1) * (H - mt - mb)
  const steg = akse === 'pct' ? 5 : 10
  const tx = akse === 'pct' ? 100 : terskelSnitt
  const el: React.ReactNode[] = []
  if (alle.length) {
    for (let v = 0; v <= y1; v += 1) { el.push(<line key={`g${v}`} x1={mv} x2={W - mh} y1={py(v)} y2={py(v)} stroke="var(--line)" />); el.push(<text key={`gt${v}`} x={mv - 8} y={py(v) + 3.5} textAnchor="end" style={aks}>{v}{v === 0 ? ' mmol' : ''}</text>) }
    for (let v = Math.ceil(x0 / steg) * steg; v <= x1; v += steg) el.push(<text key={`x${v}`} x={px(v)} y={H - 14} textAnchor="middle" style={aks}>{v}{akse === 'pct' ? ' %' : ''}</text>)
    if (tx != null && tx > x0 && tx < x1) { el.push(<line key="t" x1={px(tx)} x2={px(tx)} y1={mt} y2={H - mb} stroke="var(--kant-3)" strokeDasharray="4 3" data-ref="terskel" />); el.push(<text key="tt" x={px(tx) + 6} y={mt + 12} style={aks}>Terskel</text>) }
    if (y1 >= 4) { el.push(<line key="4" x1={mv} x2={W - mh} y1={py(4)} y2={py(4)} stroke="var(--kant-3)" strokeDasharray="4 3" data-ref="4mmol" />); el.push(<text key="4t" x={W - mh - 4} y={py(4) - 5} textAnchor="end" style={aks}>4 mmol</text>) }
    bolkPunkter.forEach((pt, b) => {
      const farge = BOLKER[b].farge
      const kurve = bolkKurve(pt, akse === 'pct' ? 2 : 4)
      if (kurve.length) el.push(<path key={`k${b}`} d={kurve.map((p, i) => `${i ? 'L' : 'M'} ${px(p.x)} ${py(p.y)}`).join(' ')} fill="none" stroke={farge} strokeWidth={b === 2 ? 2.4 : 1.8} strokeLinejoin="round" strokeOpacity={b === 2 ? 1 : .75} data-kurve={b} />)
      pt.forEach((p, i) => el.push(<circle key={`p${b}-${i}`} cx={px(p.x)} cy={py(p.y)} r={b === 2 ? 3.4 : 2.8} fill={farge} fillOpacity={b === 2 ? .85 : .5} stroke="var(--card)" strokeWidth={1} data-maaling={b}><title>{`${p.dato} · ${k(p.y)} mmol ved ${k(p.x, 0)}${akse === 'pct' ? ' % av terskel' : ' bpm'}${p.bevegelse ? ` · ${p.bevegelse}` : ''}`}</title></circle>))
    })
  }

  return (
    <KortGruppe chartKey="terskel_laktat_puls" tittel="Laktat per puls · % av terskelen som gjaldt den dagen">
      <div data-laktat-per-puls data-malinger={alle.length}>
        {visGraf && (
          <ChartWrapper chartKey="terskel_laktat_per_puls" title="Laktat per puls" height="auto"
            subtitle="Hver måling på pulsen i prosent av terskelen som gjaldt den dagen - da kan målinger fra ulike terskelperioder legges i samme bilde. Flytter kurven seg ned og til høyre, tåler du mer arbeid før laktatet stiger. Kun målte verdier.">
            {/* Kontrollraden - alltid synlig, valgt akse synlig. */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 8px' }}>
              <div role="group" aria-label="Akse" style={{ display: 'inline-flex', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 999, padding: 3 }}>
                {([['pct', '% av terskel'], ['puls', 'Rå puls']] as [Akse, string][]).map(([a, navn]) => (
                  <button key={a} type="button" aria-pressed={akse === a} onClick={() => setAkse(a)} data-laktat-akse={a}
                    style={{ minHeight: 36, padding: '0 14px', border: 0, borderRadius: 999, background: akse === a ? 'var(--kant-3)' : 'transparent', color: akse === a ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)', fontFamily: FONT, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer' }}>{navn}</button>
                ))}
              </div>
              {former.length > 1 && (
                <div role="group" aria-label="Bevegelsesform" style={{ display: 'inline-flex', flexWrap: 'wrap', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 999, padding: 3 }} data-laktat-former>
                  {['alle', ...former].map(f => (
                    <button key={f} type="button" aria-pressed={form === f} onClick={() => setForm(f)}
                      style={{ minHeight: 36, padding: '0 12px', border: 0, borderRadius: 999, background: form === f ? 'var(--kant-3)' : 'transparent', color: form === f ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)', fontFamily: FONT, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer' }}>{f === 'alle' ? 'Alle' : f}</button>
                  ))}
                </div>
              )}
              <span data-laktat-terskel style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--line2)', fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)' }}>
                Terskelpuls i perioden: <b style={{ color: 'var(--tekst-1-app)' }}>{terskler.length === 0 ? '-' : terskler.length === 1 ? `${terskler[0]} bpm` : `${Math.min(...terskler)}-${Math.max(...terskler)} bpm`}</b>
              </span>
              <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>Akse: <b style={{ color: 'var(--tekst-3-app)' }}>{akse === 'pct' ? '% av terskel' : 'rå puls'}</b></span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '0 0 6px', fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }}>
              {BOLKER.map((b, i) => <span key={b.navn} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 16, height: 3, borderRadius: 2, background: b.farge, display: 'inline-block' }} />{b.navn} tredjedel ({bolkPunkter[i].length} målinger)</span>)}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 16, height: 3, borderRadius: 2, background: 'var(--kant-3)', display: 'inline-block' }} />Terskel og 4 mmol</span>
            </div>
            {data == null ? <p style={tom}>Henter målinger …</p>
              : !harLaktat ? <p style={tom} data-laktat-tom>Ingen målte laktatverdier i perioden.</p>
              : alle.length === 0 ? <p style={tom} data-laktat-tom>{akse === 'pct' ? 'Målingene mangler puls eller terskel for dagen - bytt til rå puls, eller sett terskel under Terskler.' : 'Målingene mangler puls.'}</p>
              : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg data-laktat-graf viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Laktat mot puls i prosent av terskel, delt i tre perioder" style={{ display: 'block', width: '100%', minWidth: 560, height: 'auto' }}>{el}</svg>
                </div>
              )}
          </ChartWrapper>
        )}
        {visTall.length > 0 && <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: visGraf ? 16 : 0 }} data-laktat-tall>{visTall}</div>}
      </div>
    </KortGruppe>
  )
}

const aks: React.CSSProperties = { fontSize: 10, fill: 'var(--tekst-8-app)', fontFamily: FONT }
const tom: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)', padding: '28px 0', textAlign: 'center', margin: 0 }
