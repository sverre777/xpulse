'use client'

// FORMKARTET bolk 2 - seks baner på ÉN tidsakse under «Status nå».
// Fasit: design/xpulse-formkart-design.html (tegn() + «Notat - regler»).
//
// INGEN DOBBEL Y-AKSE: hver bane har sin egen enhet og skala, stablet på en
// felles tidsakse. Det som sammenlignes er NÅR, aldri hvor mye på tvers.
//   Dagen       - dagstripe: sykdom/skade/konkurranse/samling/reise/hvile
//   Sonetid     - stablet per dag, 2 px mellomrom, alltid samme rekkefølge
//                 (I3 #E8B93C mot I4 #FF8C00 er ΔE 10,4 - mellomrommet er
//                 ikke pynt). Lav/Med/Høy er standard under 640 px.
//   Form        - CTL, ATL og TSB-areal, én akse, samme enhet
//   Restitusjon - AVVIK I PROSENT fra eget 60-dagers grunnivå, band ±1 SD;
//                 rå verdier i tooltip
//   Følelse     - nøytral blekkfarge med prikker (#A855F7 mot HRV #8B5CF6
//                 er ΔE 0,3 for protanopi - følelse får ingen egen farge)
//   Standplass  - liggende #38BDF8 / stående #FF4500, aldri slått sammen,
//                 prikk = antall skudd, 7-dagers snitt som linje
//
// Regel 20: skytebanen skjules på «har utøveren skyting», aldri på tom
// periode. Helsebanene faller bort uten rettighet - feltet finnes ikke i
// payloaden - og flaten SIER at de er skjult.
// Kontrollraden står over grafen og er alltid synlig. height="auto".

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getFormkart } from '@/app/actions/formkart'
import type { Formkart as FormkartData, FormkartDag } from '@/lib/formkart'
import { avvikProsent, sdProsent, treffPct } from '@/lib/formkart'
import { ZONE_COLORS_V2, hoyIntensitetSek } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import { HELSE_TREND_FARGER } from '@/lib/helse-farger'
import { STATUS_ROD, KONKURRANSE_GULL, TRENER_BLAA } from '@/lib/status-farger'
import type { DateRange } from './date-range'
import { StarButton } from './StarButton'

const FONT = "'Barlow Condensed', sans-serif"
const ORANSJE = '#FF4500'
const LIGGENDE = '#38BDF8'   // SkytingSummaryCards er kilden
const STAAENDE = '#FF4500'
const TSB_OVER = '#1A6FD4'
const TSB_UNDER = '#E23A5A'

type Sonemodus = 'fem' | 'tre'
type Serie = { id: string; navn: string; farge: string; sek: (d: FormkartDag) => number }
const FEM: Serie[] = (['I1', 'I2', 'I3', 'I4', 'I5'] as ExtendedZoneName[]).map(z => ({ id: z, navn: z, farge: ZONE_COLORS_V2[z], sek: d => d.soneSek[z] ?? 0 }))
// I6-I8 og Hurtighet inn i «I5+»-bøtta i fem-modus og i Høy i tre-modus (bolk 7: aldri håndskrevne summer).
const OVER_I5 = (d: FormkartDag) => hoyIntensitetSek(d.soneSek) - (d.soneSek.I4 ?? 0) - (d.soneSek.I5 ?? 0)
const FEM_MED_REST: Serie[] = [...FEM.slice(0, 4), { id: 'I5', navn: 'I5+', farge: ZONE_COLORS_V2.I5, sek: d => (d.soneSek.I5 ?? 0) + OVER_I5(d) }]
const TRE: Serie[] = [
  { id: 'lav', navn: 'Lav (I1+I2)', farge: ZONE_COLORS_V2.I1, sek: d => (d.soneSek.I1 ?? 0) + (d.soneSek.I2 ?? 0) },
  { id: 'med', navn: 'Medium (I3)', farge: ZONE_COLORS_V2.I3, sek: d => d.soneSek.I3 ?? 0 },
  { id: 'hoy', navn: 'Høy (I4+)', farge: ZONE_COLORS_V2.I5, sek: d => (d.soneSek.I4 ?? 0) + (d.soneSek.I5 ?? 0) + OVER_I5(d) },
]
const treningSek = (d: FormkartDag) => ALL_ZONE_NAMES.reduce((s, z) => s + (d.soneSek[z] ?? 0), 0) || d.treningSek

// Smal skjerm = Lav/Med/Høy som standard (fasit pkt 3).
const smalQuery = () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)') : null)
const abonnerSmal = (cb: () => void) => { const q = smalQuery(); q?.addEventListener('change', cb); return () => q?.removeEventListener('change', cb) }
const lesSmal = () => smalQuery()?.matches ?? false

const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const fmtDato = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()}. ${MND[d.getMonth()]}` }
const fmtTid = (sek: number) => { const t = Math.floor(sek / 3600), m = Math.round((sek % 3600) / 60); return sek > 0 ? `${t ? `${t} t ` : ''}${m} min` : '-' }
const fmtPct = (v: number | null) => v == null ? '-' : `${v > 0 ? '+' : ''}${Math.round(v)} %`
const fmtTsb = (v: number | null) => v == null ? '-' : `${v > 0 ? '+' : ''}${Math.round(v)}`

interface Props {
  range: DateRange
  targetUserId?: string
  /** Bolk 3: dagvisningen monteres under kartet av OverviewTab. */
  onVelgDag?: (dag: FormkartDag | null) => void
  valgtDato?: string | null
}

export function Formkart({ range, targetUserId, onVelgDag, valgtDato = null }: Props) {
  // Svaret bærer nøkkelen det gjelder for - «laster» er at nøkkelen ikke
  // matcher, ikke en egen tilstand som må nullstilles i effekten.
  const nokkel = `${range.from}|${range.to}|${targetUserId ?? ''}`
  const [svar, setSvar] = useState<{ nokkel: string; data: FormkartData | null; feil: string | null } | null>(null)
  const data = svar?.nokkel === nokkel ? svar.data : null
  const feil = svar?.nokkel === nokkel ? svar.feil : null
  const smal = useSyncExternalStore(abonnerSmal, lesSmal, () => false)
  const [sonevalg, setSonevalg] = useState<Sonemodus | null>(null)
  const sonemodus: Sonemodus = sonevalg ?? (smal ? 'tre' : 'fem')
  const [visPlan, setVisPlan] = useState(true)
  const [visHard, setVisHard] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const [tipX, setTipX] = useState(0)
  const boksRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let live = true
    const n = `${range.from}|${range.to}|${targetUserId ?? ''}`
    getFormkart(range.from, range.to, targetUserId).then(r => {
      if (!live) return
      setSvar('error' in r ? { nokkel: n, data: null, feil: r.error } : { nokkel: n, data: r, feil: null })
    }).catch(e => { if (live) setSvar({ nokkel: n, data: null, feil: String(e) }) })
    return () => { live = false }
  }, [range.from, range.to, targetUserId])

  return (
    <section data-formkart style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 18px 16px' }}>
      <div className="flex items-start gap-3 flex-wrap" style={{ marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: FONT, fontWeight: 700, fontSize: 19, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--tekst-1-app)' }}>Formkartet</h3>
          <p style={{ margin: '3px 0 0', fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', maxWidth: '74ch' }}>
            Belastning, form, restitusjon, følelse og standplass på én tidsakse. Hver bane har sin egen skala - det er tidspunktene som sammenlignes, aldri tallene på tvers. Hold over for å lese en dag, klikk for å åpne den.
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}><StarButton chartKey="oversikt_formkart" title="Formkartet" /></div>
      </div>

      {/* Kontrollraden - ALLTID synlig over grafen. */}
      <div data-formkart-kontroller style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0 6px', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <div role="group" aria-label="Soneoppdeling" style={{ display: 'inline-flex', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 999, padding: 3 }}>
          {([['fem', 'I1-I5'], ['tre', 'Lav / Med / Høy']] as [Sonemodus, string][]).map(([m, navn]) => (
            <button key={m} type="button" aria-pressed={sonemodus === m} onClick={() => setSonevalg(m)} data-sonemodus={m}
              style={{ minHeight: 36, padding: '0 14px', border: 0, borderRadius: 999, background: sonemodus === m ? 'var(--kant-3)' : 'transparent', color: sonemodus === m ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)', fontFamily: FONT, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {navn}
            </button>
          ))}
        </div>
        <label style={lab}><input type="checkbox" checked={visPlan} onChange={e => setVisPlan(e.target.checked)} style={{ width: 16, height: 16, accentColor: ORANSJE }} /> Plan bak</label>
        <label style={lab}><input type="checkbox" checked={visHard} onChange={e => setVisHard(e.target.checked)} style={{ width: 16, height: 16, accentColor: ORANSJE }} /> Merk hardøkter</label>
        {data && !data.helseInkludert && (
          <span data-formkart-helse-skjult style={{ ...lapp, borderColor: 'var(--line2)', background: 'var(--card2)' }}>Helsebanene er skjult - {data.helseSkjultGrunn?.toLowerCase().includes('delt') ? 'utøveren har ikke delt helsedata' : 'ingen tilgang til helsedata'}</span>
        )}
        {data && data.importerteOkter > 0 && (
          <span data-formkart-import style={lapp}>{data.importerteOkter} importert{data.importerteOkter === 1 ? '' : 'e'} økt{data.importerteOkter === 1 ? '' : 'er'} er med</span>
        )}
      </div>

      {feil && <p style={{ fontFamily: FONT, color: STATUS_ROD, fontSize: 13 }}>{feil}</p>}
      {!data && !feil && <div style={{ display: 'grid', placeItems: 'center', minHeight: 220, fontFamily: FONT, color: 'var(--tekst-8-app)', fontSize: 13 }}>Henter formkartet …</div>}
      {data && (
        <Graf data={data} serier={sonemodus === 'fem' ? FEM_MED_REST : TRE} visPlan={visPlan} visHard={visHard}
          hover={hover} setHover={setHover} tipX={tipX} setTipX={setTipX} boksRef={boksRef} svgRef={svgRef}
          valgtDato={valgtDato} onVelgDag={onVelgDag} />
      )}
    </section>
  )
}

const lab: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 10px', color: 'var(--tekst-5-app)', fontFamily: FONT, fontSize: 12.5, cursor: 'pointer' }
const lapp: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', borderRadius: 999, border: `1px solid ${ORANSJE}`, background: 'rgba(255,69,0,.12)', color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 12.5 }

// ── Selve grafen ─────────────────────────────────────────

const M = { v: 56, h: 16, t: 30 }
const W = 1100

function Graf({ data, serier, visPlan, visHard, hover, setHover, tipX, setTipX, boksRef, svgRef, valgtDato, onVelgDag }: {
  data: FormkartData; serier: Serie[]; visPlan: boolean; visHard: boolean
  hover: number | null; setHover: (i: number | null) => void; tipX: number; setTipX: (x: number) => void
  boksRef: React.RefObject<HTMLDivElement | null>; svgRef: React.RefObject<SVGSVGElement | null>
  valgtDato: string | null; onVelgDag?: (dag: FormkartDag | null) => void
}) {
  const d = data.dager
  const helse = data.helseInkludert
  const baner: { id: string; navn: string; h: number; gap: number }[] = [
    { id: 'status', navn: 'Dagen', h: 26, gap: 30 },
    { id: 'soner', navn: 'Sonetid', h: 132, gap: 22 },
    { id: 'form', navn: 'Form', h: 104, gap: 22 },
    ...(helse ? [{ id: 'rest', navn: 'Restitusjon', h: 104, gap: 22 }, { id: 'fol', navn: 'Følelse', h: 62, gap: 22 }] : []),
    ...(data.harSkyting ? [{ id: 'skyt', navn: 'Standplass', h: 86, gap: 0 }] : []),
  ]
  const B: Record<string, { y: number; h: number; navn: string }> = {}
  let y = M.t
  for (const b of baner) { B[b.id] = { y, h: b.h, navn: b.navn }; y += b.h + b.gap }
  const total = y + 26
  const bredde = W - M.v - M.h
  const n = Math.max(1, d.length)
  const bw = bredde / n
  const x = (i: number) => M.v + i * bw
  const el: React.ReactNode[] = []
  const akse = (tx: number, ty: number, t: string, anchor: 'end' | 'middle' = 'end') => <text key={`a${tx}-${ty}-${t}`} x={tx} y={ty} textAnchor={anchor} style={{ fontSize: 10, fill: 'var(--tekst-8-app)', fontFamily: FONT }}>{t}</text>
  const rute = (ry: number, k: string) => <line key={k} x1={M.v} x2={W - M.h} y1={ry} y2={ry} stroke="var(--line)" strokeWidth={1} />

  for (const id in B) el.push(<text key={`n${id}`} x={M.v} y={B[id].y - 6} style={{ fontSize: 10.5, letterSpacing: '0.09em', textTransform: 'uppercase', fill: 'var(--tekst-5-app)', fontWeight: 700, fontFamily: FONT }}>{B[id].navn.toUpperCase()}</text>)

  // BANE 1: dagstripa
  const b1 = B.status
  d.forEach((dag, i) => {
    const s = dag.status
    let fyll = 'var(--line)', op = 1
    if (s.sykdom) fyll = STATUS_ROD
    else if (s.skade) { fyll = STATUS_ROD; op = .55 }
    else if (s.konkurranse) fyll = KONKURRANSE_GULL
    else if (s.samling) { fyll = TRENER_BLAA; op = .38 }
    else if (s.reise) { fyll = 'var(--tekst-8-app)'; op = .45 }
    else if (dag.treningSek > 0) fyll = 'var(--kant-3)'
    el.push(<rect key={`d${i}`} x={x(i) + .5} y={b1.y} width={Math.max(1, bw - 1.5)} height={b1.h} fill={fyll} fillOpacity={op} rx={3}
      stroke={s.planlagtIkkeGjort ? 'var(--tekst-8-app)' : 'none'} strokeDasharray={s.planlagtIkkeGjort ? '2 2' : undefined} data-dagstatus={s.sykdom ? 'sykdom' : s.skade ? 'skade' : s.konkurranse ? 'konkurranse' : s.samling ? 'samling' : s.reise ? 'reise' : s.hviledag ? 'hviledag' : s.planlagtIkkeGjort ? 'planlagt' : 'trening'} />)
  })

  // BANE 2: sonetid per dag (stablet, 2 px mellomrom)
  const b2 = B.soner
  const maksTid = Math.max(3600, ...d.map(dag => Math.max(treningSek(dag), dag.planlagtSek)))
  const hSone = (v: number) => (v / maksTid) * b2.h
  ;[0, .5, 1].forEach(f => {
    const ry = b2.y + b2.h - f * b2.h
    el.push(rute(ry, `r2${f}`)); el.push(akse(M.v - 8, ry + 3.5, `${(Math.round(f * maksTid / 360) / 10).toFixed(1).replace('.', ',')} t`))
  })
  d.forEach((dag, i) => {
    if (visPlan && dag.planlagtSek > 0) el.push(<rect key={`p${i}`} x={x(i) + .5} y={b2.y + b2.h - hSone(dag.planlagtSek)} width={Math.max(1, bw - 1.5)} height={hSone(dag.planlagtSek)} fill="none" stroke="var(--kant-3)" strokeWidth={1} strokeDasharray="2 2" rx={2} />)
    let yy = b2.y + b2.h
    serier.forEach(s => {
      const v = s.sek(dag); if (v <= 0) return
      const h = Math.max(1, hSone(v) - 2)
      yy -= h + 2
      el.push(<rect key={`s${i}${s.id}`} x={x(i) + .5} y={yy} width={Math.max(1, bw - 1.5)} height={h} fill={s.farge} rx={Math.min(2, bw / 3)} data-sone={s.id} />)
    })
    if (visHard && dag.hardOkt) el.push(<circle key={`h${i}`} cx={x(i) + bw / 2} cy={b2.y - 7} r={2.6} fill={ORANSJE} data-hard="1" />)
  })

  // BANE 3: form - CTL, ATL, TSB-areal, én akse
  const b3 = B.form
  const harForm = d.some(dag => dag.ctl != null)
  if (harForm) {
    const maksF = Math.max(10, ...d.map(dag => Math.max(dag.ctl ?? 0, dag.atl ?? 0))) * 1.15
    const minF = Math.min(0, ...d.map(dag => dag.tsb ?? 0)) * 1.3
    const yF = (v: number) => b3.y + b3.h - ((v - minF) / (maksF - minF)) * b3.h
    const y0 = yF(0)
    el.push(<line key="f0" x1={M.v} x2={W - M.h} y1={y0} y2={y0} stroke="var(--line2)" strokeWidth={1} />)
    el.push(akse(M.v - 8, y0 + 3.5, '0')); el.push(akse(M.v - 8, yF(maksF * .85) + 3.5, String(Math.round(maksF * .85))))
    ;(['over', 'under'] as const).forEach(del => {
      let p = `M ${x(0) + bw / 2} ${y0}`
      d.forEach((dag, i) => { const t = dag.tsb ?? 0; p += ` L ${x(i) + bw / 2} ${yF(del === 'over' ? Math.max(0, t) : Math.min(0, t))}` })
      p += ` L ${x(n - 1) + bw / 2} ${y0} Z`
      el.push(<path key={`tsb${del}`} d={p} fill={del === 'over' ? TSB_OVER : TSB_UNDER} fillOpacity={.3} stroke="none" />)
    })
    const linje = (k: 'ctl' | 'atl', farge: string, dash?: string) => {
      let p = ''
      d.forEach((dag, i) => { p += (i ? ' L ' : 'M ') + (x(i) + bw / 2) + ' ' + yF(dag[k] ?? 0) })
      el.push(<path key={k} d={p} fill="none" stroke={farge} strokeWidth={2} strokeLinejoin="round" strokeDasharray={dash} data-linje={k} />)
    }
    linje('ctl', 'var(--tekst-1-app)'); linje('atl', 'var(--tekst-5-app)', '4 3')
  } else {
    el.push(<text key="f-tom" x={M.v + bredde / 2} y={b3.y + b3.h / 2} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--tekst-8-app)', fontFamily: FONT }}>Ingen belastningsdata i perioden</text>)
  }

  // BANE 4: restitusjon - avvik i % fra 60-dagers grunnivå, band ±1 SD
  const avvik = d.map(dag => ({ hrv: helse ? avvikProsent(dag.helse?.hrv, data.grunnivaa?.hrv ?? null) : null, hp: helse ? avvikProsent(dag.helse?.hvilepuls, data.grunnivaa?.hvilepuls ?? null) : null }))
  if (helse && B.rest) {
    const b4 = B.rest
    const alle = avvik.flatMap(a => [a.hrv, a.hp]).filter((v): v is number => v != null)
    const maksA = Math.max(12, ...alle.map(Math.abs))
    const yA = (v: number) => b4.y + b4.h / 2 - (v / maksA) * (b4.h / 2)
    const sd = sdProsent(data.grunnivaa?.hrv ?? null)
    if (sd != null) el.push(<rect key="sd" x={M.v} y={yA(sd)} width={bredde} height={Math.max(0, yA(-sd) - yA(sd))} fill="var(--line)" fillOpacity={.55} rx={3} data-band="1" />)
    el.push(<line key="r0" x1={M.v} x2={W - M.h} y1={yA(0)} y2={yA(0)} stroke="var(--line2)" strokeWidth={1} />)
    el.push(akse(M.v - 8, yA(0) + 3.5, 'snitt')); el.push(akse(M.v - 8, yA(maksA * .8) + 3.5, `+${Math.round(maksA * .8)}%`)); el.push(akse(M.v - 8, yA(-maksA * .8) + 3.5, `-${Math.round(maksA * .8)}%`))
    if (alle.length === 0) el.push(<text key="r-tom" x={M.v + bredde / 2} y={b4.y + b4.h / 2 - 12} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--tekst-8-app)', fontFamily: FONT }}>Ingen HRV eller hvilepuls i perioden</text>)
    ;([['hrv', HELSE_TREND_FARGER.hrv], ['hp', HELSE_TREND_FARGER.hvilepuls]] as const).forEach(([k, farge]) => {
      let p = '', pen = false
      avvik.forEach((a, i) => { const v = a[k]; if (v == null) { pen = false; return } p += (pen ? ' L ' : ' M ') + (x(i) + bw / 2) + ' ' + yA(v); pen = true })
      if (p) el.push(<path key={`rl${k}`} d={p} fill="none" stroke={farge} strokeWidth={2} strokeLinejoin="round" data-linje={k} />)
    })
  }

  // BANE 5: følelse 1-5 (daglig dagsform), nøytral blekkfarge
  if (helse && B.fol) {
    const b5 = B.fol
    const yFol = (v: number) => b5.y + b5.h - ((v - 1) / 4) * b5.h
    ;[1, 3, 5].forEach(v => { el.push(rute(yFol(v), `r5${v}`)); el.push(akse(M.v - 8, yFol(v) + 3.5, v === 3 ? '' : String(v))) })
    let pf = '', pen = false
    d.forEach((dag, i) => { const v = dag.helse?.folelse; if (v == null) { pen = false; return } pf += (pen ? ' L ' : ' M ') + (x(i) + bw / 2) + ' ' + yFol(v); pen = true })
    if (pf) el.push(<path key="fol" d={pf} fill="none" stroke="var(--tekst-8-app)" strokeWidth={1.5} />)
    d.forEach((dag, i) => { const v = dag.helse?.folelse; if (v != null) el.push(<circle key={`fo${i}`} cx={x(i) + bw / 2} cy={yFol(v)} r={Math.min(3.2, Math.max(1.6, bw / 3))} fill="var(--tekst-3-app)" data-folelse={v} />) })
  }

  // BANE 6: standplass - liggende og stående hver for seg
  if (data.harSkyting && B.skyt) {
    const b6 = B.skyt
    const yT = (v: number) => b6.y + b6.h - ((Math.max(50, v) - 50) / 50) * b6.h
    ;[50, 75, 100].forEach(v => { el.push(rute(yT(v), `r6${v}`)); el.push(akse(M.v - 8, yT(v) + 3.5, `${v} %`)) })
    const skytedager = d.map((dag, i) => ({ i, s: dag.skyting })).filter((o): o is { i: number; s: NonNullable<FormkartDag['skyting']> } => !!o.s)
    if (skytedager.length === 0) el.push(<text key="sk-tom" x={M.v + bredde / 2} y={b6.y + b6.h / 2} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--tekst-8-app)', fontFamily: FONT }}>Ingen skyting i perioden</text>)
    ;([['L', LIGGENDE], ['S', STAAENDE]] as const).forEach(([st, farge]) => {
      const rad = skytedager.map(o => ({ i: o.i, treff: st === 'L' ? o.s.liggendeTreff : o.s.staaendeTreff, skudd: st === 'L' ? o.s.liggendeSkudd : o.s.staaendeSkudd })).filter(r => r.skudd > 0)
      let p = ''
      rad.forEach((r, k) => {
        const v = rad.slice(Math.max(0, k - 6), k + 1)
        const sn = treffPct(v.reduce((a, b) => a + b.treff, 0), v.reduce((a, b) => a + b.skudd, 0)) ?? 0
        p += (k ? ' L ' : 'M ') + (x(r.i) + bw / 2) + ' ' + yT(sn)
      })
      if (p) el.push(<path key={`sk${st}`} d={p} fill="none" stroke={farge} strokeWidth={2} strokeLinejoin="round" data-linje={`treff-${st}`} />)
      rad.forEach(r => el.push(<circle key={`skp${st}${r.i}`} cx={x(r.i) + bw / 2} cy={yT(treffPct(r.treff, r.skudd) ?? 0)} r={Math.max(1.8, Math.min(4, r.skudd / 12))} fill={farge} fillOpacity={.5} stroke="var(--card)" strokeWidth={1} data-skyting={st} />))
    })
  }

  // tidsakse
  const steg = Math.ceil(n / 9)
  d.forEach((dag, i) => { if (i % steg === 0) el.push(akse(x(i) + bw / 2, total - 8, fmtDato(dag.dato), 'middle')) })

  // valgt dag + krysshår gjennom ALLE baner
  const valgtI = valgtDato ? d.findIndex(dag => dag.dato === valgtDato) : -1
  if (valgtI >= 0) el.push(<rect key="valgt" x={x(valgtI)} y={M.t - 14} width={bw} height={total - 24 - (M.t - 14)} fill={ORANSJE} fillOpacity={.08} />)
  if (hover != null) el.push(<line key="kryss" x1={x(hover) + bw / 2} x2={x(hover) + bw / 2} y1={M.t} y2={total - 24} stroke="var(--tekst-1-app)" strokeWidth={1} strokeOpacity={.34} pointerEvents="none" data-krysshaar="1" />)

  const indeksFra = (e: React.PointerEvent | React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect(); if (!r) return 0
    const px = (e.clientX - r.left) / r.width * W
    return Math.max(0, Math.min(n - 1, Math.floor((px - M.v) / bw)))
  }
  const dag = hover != null ? d[hover] : null
  const a = hover != null ? avvik[hover] : null
  const merk = dag ? (dag.status.sykdom ? 'Sykdom' : dag.status.skade ? 'Skade' : dag.status.konkurranse ? 'Konkurranse' : dag.status.samling ? 'Samling' : dag.status.reise ? 'Reisedag' : dag.status.hviledag ? 'Hviledag' : dag.status.planlagtIkkeGjort ? 'Planlagt, ikke gjennomført' : '') : ''

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '10px 0 2px', fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }} data-formkart-legend>
        {serier.map(s => <Sw key={s.id} farge={s.farge} navn={s.navn} />)}
        <Sw farge="var(--tekst-1-app)" navn="Form (CTL)" linje /><Sw farge="var(--tekst-5-app)" navn="Tretthet (ATL)" linje />
        {helse && <><Sw farge={HELSE_TREND_FARGER.hrv} navn="HRV" linje /><Sw farge={HELSE_TREND_FARGER.hvilepuls} navn="Hvilepuls" linje /><Sw farge="var(--tekst-3-app)" navn="Følelse" rund /></>}
        <Sw farge={STATUS_ROD} navn="Sykdom" /><Sw farge={KONKURRANSE_GULL} navn="Konkurranse" /><Sw farge="var(--line)" navn="Hviledag" />
        {data.harSkyting && <><Sw farge={LIGGENDE} navn="Treff liggende" linje /><Sw farge={STAAENDE} navn="Treff stående" linje /></>}
      </div>
      <div ref={boksRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg ref={svgRef} data-formkart-graf viewBox={`0 0 ${W} ${total}`} preserveAspectRatio="xMidYMid meet" role="img" style={{ display: 'block', width: '100%', minWidth: 680, height: 'auto' }}
          aria-label="Formkartet: dagstatus, sonetid per dag, form, restitusjon, følelse og standplass på én tidsakse">
          {el}
          <rect x={M.v} y={0} width={bredde} height={total} fill="transparent" style={{ cursor: 'pointer' }}
            onPointerMove={e => { setHover(indeksFra(e)); const bx = e.clientX - (boksRef.current?.getBoundingClientRect().left ?? 0); setTipX(Math.min((boksRef.current?.clientWidth ?? 400) - 200, Math.max(4, bx + 14))) }}
            onPointerLeave={() => setHover(null)}
            onClick={e => { const i = indeksFra(e); onVelgDag?.(d[i].dato === valgtDato ? null : d[i]) }} />
        </svg>
        {dag && (
          <div data-formkart-tip style={{ position: 'absolute', left: tipX, top: 8, pointerEvents: 'none', background: 'var(--card2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 12px', fontFamily: FONT, fontSize: 12, minWidth: 186, zIndex: 5, boxShadow: 'var(--skygge-2, 0 8px 24px rgba(0,0,0,.4))', color: 'var(--tekst-5-app)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--tekst-1-app)' }}>{fmtDato(dag.dato)}</h4>
            <Rad n="Trening" v={fmtTid(treningSek(dag))} />
            {dag.planlagtSek > 0 && <Rad n="Planlagt" v={fmtTid(dag.planlagtSek)} />}
            <Rad n="Form (TSB)" v={fmtTsb(dag.tsb)} />
            {dag.ctl != null && <Rad n="CTL / ATL" v={`${Math.round(dag.ctl)} / ${Math.round(dag.atl ?? 0)}`} />}
            {helse && dag.helse && <>
              <Rad n="HRV" v={dag.helse.hrv != null ? `${dag.helse.hrv} ms` : '-'} ekstra={a?.hrv != null ? fmtPct(a.hrv) : undefined} ekstraFarge={a?.hrv != null && a.hrv < 0 ? STATUS_ROD : undefined} />
              <Rad n="Hvilepuls" v={dag.helse.hvilepuls != null ? String(dag.helse.hvilepuls) : '-'} ekstra={a?.hp != null ? fmtPct(a.hp) : undefined} ekstraFarge={a?.hp != null && a.hp > 0 ? STATUS_ROD : undefined} />
              <Rad n="Søvn" v={dag.helse.sovnTimer != null ? `${String(dag.helse.sovnTimer).replace('.', ',')} t` : '-'} />
              <Rad n="Følelse" v={dag.helse.folelse != null ? `${dag.helse.folelse} / 5` : '-'} />
            </>}
            {dag.skyting && <>
              <Rad n="Treff L / S" v={`${dag.skyting.liggendeSkudd ? Math.round(treffPct(dag.skyting.liggendeTreff, dag.skyting.liggendeSkudd) ?? 0) : '-'} / ${dag.skyting.staaendeSkudd ? Math.round(treffPct(dag.skyting.staaendeTreff, dag.skyting.staaendeSkudd) ?? 0) : '-'} %`} />
              <Rad n="Puls inn" v={dag.skyting.pulsInn != null ? String(dag.skyting.pulsInn) : '-'} />
            </>}
            {dag.laktat.length > 0 && <Rad n="Laktat" v={dag.laktat.map(l => `${String(l.mmol).replace('.', ',')}`).join(' · ') + ' mmol'} />}
            {merk && <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--line)', color: 'var(--tekst-3-app)', fontSize: 11.5 }}>{merk}</div>}
          </div>
        )}
      </div>
    </>
  )
}

function Sw({ farge, navn, linje = false, rund = false }: { farge: string; navn: string; linje?: boolean; rund?: boolean }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ display: 'inline-block', width: linje ? 16 : 11, height: linje ? 3 : 11, borderRadius: rund ? '50%' : linje ? 2 : 3, background: farge, flex: 'none' }} />{navn}</span>
}
function Rad({ n, v, ekstra, ekstraFarge }: { n: string; v: string; ekstra?: string; ekstraFarge?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, margin: '2px 0' }}><span>{n}</span><b style={{ color: 'var(--tekst-1-app)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}{ekstra && <span style={{ color: ekstraFarge ?? 'var(--st-gronn, #28A86E)', marginLeft: 6 }}>{ekstra}</span>}</b></div>
}
