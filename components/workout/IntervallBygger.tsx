'use client'

// INTERVALL-BYGGEREN (UI) — flaten over lib/intervall-generator.ts (SF-12).
// Fasit: design/xpulse-intervall-bygger-design.html. UI-en BRUKER generatoren,
// aldri reimplementerer regnestykket — blokkene til forhåndsvisningen kommer
// fra byggBlokker(), radene fra genererIntervalløkt().
//
// Tre steg: bygg → se hvordan den blir → ferdig (kollapset linje m/ stripe
// + «Endre»). Samlet/splittet velges IKKE her lenger (bolk 4): radene
// legges alltid splittet, og bryteren over radene samler i visningen.
//
// Reglene bor i generatoren: skyting erstatter pausen (totaltid uendret),
// mønsteret løper på tvers av radene, siste pause utgår, 5 skudd standard,
// skyterader uten bevegelsesform. INGENTING LÅSES — radene er vanlige
// aktivitetsrader etterpå, og økta husker ikke at den kom fra en bygger.

import { useEffect, useMemo, useState } from 'react'
import {
  byggBlokker, genererIntervalløkt,
  type GenerertBlokk, type IntervallKonfig, type SkyteMonster, SKYTETID_STANDARD_SEK, SKYTETID_MAKS_SEK, dragSekFraKm } from '@/lib/intervall-generator'
import type { BlokkSone } from '@/lib/okt-template-library'
import { KORTINTERVALL_HURTIGVALG, antallRepetisjoner, kortintervallEtikett } from '@/lib/intervall-monstre'
import { foringsSoner } from '@/lib/sonesprak'
import { useUtvidetSkala } from '@/lib/sonesprak-klient'
import {
  MOVEMENT_CATEGORIES, getSubcategories, DEFAULT_MOVEMENTS_BY_SPORT,
  type ActivityRow, type Sport,
} from '@/lib/types'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES } from '@/lib/heart-zones'

// L/S-markørfargene — samme konvensjon som skytedelen (liggende blå, stående oransje).
const LIGG = '#1A6FD4'
const STAA = '#FF8C00'
const FONT = "'Barlow Condensed', sans-serif"

const CAP: React.CSSProperties = {
  fontFamily: FONT, fontSize: 11, letterSpacing: '0.16em',
  textTransform: 'uppercase', color: 'var(--tekst-8-alt)',
}
const FELT: React.CSSProperties = {
  backgroundColor: 'var(--flate-3-b)', border: '1px solid var(--line2)', borderRadius: 8,
  color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 15, padding: '8px 9px',
  outline: 'none', width: '100%', minWidth: 0, minHeight: 40,
}

interface Rad {
  antall: string; drag: string; sone: BlokkSone; pause: string
  // Kortintervaller INNI draget (Øktbyggeren bolk 2). Frie sekundverdier
  // — hurtigvalgene under fyller dem bare inn.
  kortPaa: string; kortAv: string
  // Sverre 5. sep: draget kan planlegges i KILOMETER i stedet for tid —
  // km + planlagt fart gir dragtida.
  modus: 'tid' | 'km'
  km: string
  fart: string
}
type FartEnhet = 'min_per_km' | 'km_per_h'
/** «4:30» (min/km) → 270 s/km; «13,3» (km/t) → 270 s/km. */
function fartTilSekPerKm(fart: string, enhet: FartEnhet): number {
  const t = fart.trim().replace(',', '.')
  if (!t) return 0
  if (enhet === 'km_per_h') { const kmh = parseFloat(t); return kmh > 0 ? 3600 / kmh : 0 }
  const d = t.split(':').map(Number)
  if (d.length >= 2 && !d.some(Number.isNaN)) return d[0] * 60 + d[1]
  const m = parseFloat(t); return m > 0 ? m * 60 : 0
}
function fmtFart(sekPerKm: number, enhet: FartEnhet): string {
  if (!(sekPerKm > 0)) return ''
  if (enhet === 'km_per_h') return `${(3600 / sekPerKm).toFixed(1).replace('.', ',')} km/t`
  return `${Math.floor(sekPerKm / 60)}:${String(Math.round(sekPerKm % 60)).padStart(2, '0')}/km`
}

const SKYTEVALG: { verdi: '' | SkyteMonster; etikett: string }[] = [
  { verdi: '', etikett: 'Ingen skyting' },
  { verdi: 'LS', etikett: 'L–S–L–S' },
  { verdi: 'LLSS', etikett: 'L,L → S,S' },
  { verdi: 'PAR', etikett: 'L,L,S,S…' },
  { verdi: 'L', etikett: 'Kun liggende' },
  { verdi: 'S', etikett: 'Kun stående' },
]

/** «10:00» / «3:00» / «10» (= minutter) → sekunder. Samme parse som utkastet. */
function pSek(s: string): number {
  const d = String(s || '').trim().split(':').map(Number)
  if (d.some(n => !Number.isFinite(n))) return 0
  return d.length === 3 ? d[0] * 3600 + d[1] * 60 + d[2]
    : d.length === 2 ? d[0] * 60 + d[1]
    : d[0] * 60
}
function fTid(sek: number): string {
  if (sek <= 0) return '0:00'
  const t = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60
  const z = (n: number) => String(n).padStart(2, '0')
  return t > 0 ? `${t}:${z(m)}:${z(s)}` : `${m}:${z(s)}`
}
/** «3:00» → «3 min» i tittelen, ellers rå tekst. */
function tMin(s: string): string {
  return s.replace(/:00$/, ' min')
}

export interface IntervallForhandsutfylling {
  rader: { antall: number; dragSek: number; sone: BlokkSone; pauseSek: number }[]
  oppvarmingSek: number
  nedjoggSek: number
  skyting: SkyteMonster | null
  skytetidSek?: number
  /** Malens navn — brukt som tittel i stedet for den genererte. */
  tittel?: string
}

export function IntervallBygger({ sport, onOpprett, forhandsutfylt, onAvbryt, onStegChange, apneSignal, kompakt = false }: {
  sport: Sport
  /** Forsidens eksport (regel 11): bare dragradene, oppvarming/nedjogg og
      Opprett — ikke bev.form/underkategori/skyting-feltene. */
  kompakt?: boolean
  // Leverer genererte rader + forslags-tittel. WorkoutForm eier innsettingen
  // (og bekreftelsen hvis lista alt har innhold) — samme som fellesstart.
  onOpprett: (rader: ActivityRow[], tittel: string) => void | Promise<void>
  // Bibliotekmal-flyten: byggeren forhåndsutfylles fra malens blokker
  // (oktMalTilIntervallOppsett) og kjører som DIALOG — Avbryt setter
  // ingenting inn, og Ferdig lukker i stedet for å kollapse.
  forhandsutfylt?: IntervallForhandsutfylling
  onAvbryt?: () => void
  // Pop-up-flyten (WorkoutForm): varsler steg-skiftene så skjemaet kan vise
  // bygg/vis i overlay og ferdig-linja inline — komponenten forblir montert
  // hele veien, så oppsettet overlever «Endre».
  onStegChange?: (steg: 'bygg' | 'vis' | 'ferdig') => void
  /** Bump for å gjenåpne byggeren fra kollapset tilstand. */
  apneSignal?: number
}) {
  // Sonespråket (5b): velgeren tilbyr I6–I8 ELLER Hurtighet — aldri begge.
  const utvidetSkala = useUtvidetSkala()
  const [steg, settStegIntern] = useState<'bygg' | 'vis' | 'ferdig'>('bygg')
  const setSteg = (st: 'bygg' | 'vis' | 'ferdig') => { settStegIntern(st); onStegChange?.(st) }
  const [rader, setRader] = useState<Rad[]>(() =>
    forhandsutfylt
      ? forhandsutfylt.rader.map(r => ({
          antall: String(r.antall), drag: fTid(r.dragSek), sone: r.sone, pause: fTid(r.pauseSek),
          kortPaa: '', kortAv: '', modus: 'tid' as const, km: '', fart: '',
        }))
      // Rettelse 8 (4. sep): ÉN standardrad — 3 × 10 min I3 · 2 min pause.
      : [{ antall: '3', drag: '10:00', sone: 'I3', pause: '2:00', kortPaa: '', kortAv: '', modus: 'tid', km: '', fart: '' }])
  const [fartEnhet, setFartEnhet] = useState<FartEnhet>('min_per_km')
  const [bev, setBev] = useState<string>(() => DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping')
  const [sub, setSub] = useState('')
  const [skyting, setSkyting] = useState<'' | SkyteMonster>(() => forhandsutfylt?.skyting ?? '')
  // Pkt 16: skytetid inni pausen — standard 45 s, fritt (maks 60 s).
  const [skytetid, setSkytetid] = useState(() => String(forhandsutfylt?.skytetidSek ?? SKYTETID_STANDARD_SEK))
  const [opp, setOpp] = useState(() => forhandsutfylt ? fTid(forhandsutfylt.oppvarmingSek) : '20:00')
  const [ned, setNed] = useState(() => forhandsutfylt ? fTid(forhandsutfylt.nedjoggSek) : '15:00')

  useEffect(() => {
    if (apneSignal != null && apneSignal > 0) setSteg('bygg')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apneSignal])

  // Bevegelsesformer: brukerens sport-defaults først, så resten av fasiten.
  const bevValg = useMemo(() => {
    const egne = DEFAULT_MOVEMENTS_BY_SPORT[sport] ?? []
    const alle = MOVEMENT_CATEGORIES.map(c => c.name)
    return [...egne, ...alle.filter(n => !egne.includes(n))]
  }, [sport])
  const subValg = useMemo(() => getSubcategories(bev), [bev])

  const konfig: IntervallKonfig = useMemo(() => ({
    oppvarmingSek: pSek(opp),
    nedjoggSek: pSek(ned),
    rader: rader.map(r => {
      const km = parseFloat(r.km.replace(',', '.'))
      const fartSek = fartTilSekPerKm(r.fart, fartEnhet)
      const iKm = r.modus === 'km'
      return {
        antall: Math.max(1, parseInt(r.antall) || 1),
        dragSek: iKm ? dragSekFraKm(km, fartSek) : pSek(r.drag),
        sone: r.sone,
        pauseSek: pSek(r.pause),
        dragKm: iKm && km > 0 ? km : null,
        fartSekPerKm: iKm && fartSek > 0 ? fartSek : null,
        kort: Number(r.kortPaa) > 0 ? { paaSek: Number(r.kortPaa) || 0, avSek: Number(r.kortAv) || 0 } : null,
      }
    }),
    bevegelsesform: bev,
    underkategori: sub,
    skyting: skyting || null,
    skytetidSek: Math.max(1, Math.min(SKYTETID_MAKS_SEK, parseInt(skytetid) || SKYTETID_STANDARD_SEK)),
  }), [opp, ned, rader, bev, sub, skyting, skytetid, fartEnhet])

  const blokker: GenerertBlokk[] = useMemo(() => byggBlokker(konfig), [konfig])
  const total = blokker.reduce((s, b) => s + b.sek, 0)
  const serier = blokker.filter(b => b.posisjon).length
  const antallL = blokker.filter(b => b.posisjon === 'L').length
  const antallS = blokker.filter(b => b.posisjon === 'S').length

  const generertTittel = rader
    .map(r => {
      const n = Math.max(1, parseInt(r.antall) || 1)
      const drag = r.modus === 'km'
        ? `${r.km.replace('.', ',')} km${fartTilSekPerKm(r.fart, fartEnhet) > 0 ? ` (${fmtFart(fartTilSekPerKm(r.fart, fartEnhet), fartEnhet)})` : ''}`
        : tMin(r.drag)
      // Kortintervallet står i tittelen (Sverre 5. sep): «3 × 10 min I3 · 50/10 / 2 min».
      const kort = Number(r.kortPaa) > 0 ? ` · ${Number(r.kortPaa)}/${Number(r.kortAv) || 0}` : ''
      return `${n} × ${drag} ${r.sone}${kort} / ${tMin(r.pause)}`
    })
    .join('  +  ') + (serier > 0 ? '  ·  komb' : '')
  const tittel = forhandsutfylt?.tittel ?? generertTittel

  const oppdater = (i: number, felt: keyof Rad, verdi: string) =>
    setRader(rs => rs.map((r, ri) => ri === i ? { ...r, [felt]: verdi } as Rad : r))

  const opprett = async () => {
    await onOpprett(genererIntervalløkt(konfig), tittel)
    if (forhandsutfylt && onAvbryt) onAvbryt()   // dialog: lukk — ingen kollaps-linje
    else setSteg('ferdig')
  }

  // ── Fordelingsstripa m/ L/S-markering OVER (aldri egen farge i stripa) ──
  const Stripe = ({ hoyde = 26, medMarks = false }: { hoyde?: number; medMarks?: boolean }) => {
    let lopt = 0
    const marks = blokker.map(b => {
      const midt = total > 0 ? ((lopt + b.sek / 2) / total) * 100 : 0
      lopt += b.sek
      return b.posisjon ? { midt, pos: b.posisjon } : null
    })
    return (
      <div style={{ position: 'relative', paddingTop: medMarks && serier > 0 ? 26 : 0, minWidth: 0, flex: 1 }}>
        {medMarks && serier > 0 && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26 }}>
            {marks.map((m, i) => m && (
              <span key={i} style={{ position: 'absolute', top: 0, left: `${m.midt}%`, transform: 'translateX(-50%)', textAlign: 'center', lineHeight: 1, color: m.pos === 'L' ? LIGG : STAA }}>
                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: 'var(--tekst-1-ren)', borderRadius: 3, width: 16, height: 16, lineHeight: '16px', background: m.pos === 'L' ? LIGG : STAA }}>{m.pos}</span>
                <span style={{ display: 'block', width: 1.5, height: 10, margin: '0 auto', background: 'currentColor', opacity: 0.6 }} />
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', height: hoyde, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line2)' }}>
          {blokker.map((b, i) => (
            <div key={i} style={{ width: `${total > 0 ? (b.sek / total) * 100 : 0}%`, background: ZONE_COLORS_V2[b.sone] }} />
          ))}
        </div>
      </div>
    )
  }

  const kort: React.CSSProperties = {
    border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 12,
    padding: 14, marginBottom: 12,
  }

  // ── FERDIG: kollapset linje — stripe + sammendrag + Endre ──
  if (steg === 'ferdig') {
    return (
      <div style={kort} className="flex items-center gap-3 flex-wrap">
        <div style={{ flex: '0 0 150px', minWidth: 110 }}><Stripe hoyde={16} /></div>
        <div style={{ flex: 1, minWidth: 160, fontFamily: FONT, fontSize: 14 }}>
          <b style={{ display: 'block', color: 'var(--tekst-1-app)', fontWeight: 700 }}>{tittel}</b>
          <span style={{ color: 'var(--tekst-8-alt)', fontSize: 13 }}>
            {fTid(total)} · {blokker.length} rader{serier > 0 ? ` · ${serier} skyteserier` : ''}
          </span>
        </div>
        <button type="button" onClick={() => setSteg('bygg')}
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 16px', cursor: 'pointer' }}>
          Endre
        </button>
      </div>
    )
  }

  // ── STEG 2: se hvordan den blir ──
  if (steg === 'vis') {
    const NAVN: Record<string, string> = {
      oppvarming: 'Oppvarming', aktivitet: 'Aktivitet', aktiv_pause: 'Aktiv pause', veksling: 'Veksling',
      nedjogg: 'Nedjogg', skyting_kombinert: 'Skyting',
    }
    return (
      <div style={kort}>
        <div style={CAP}>Fordeling</div>
        <div className="mt-1"><Stripe medMarks /></div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {ALL_ZONE_NAMES.map(z => {
            const sek = blokker.filter(b => b.sone === z).reduce((s, b) => s + b.sek, 0)
            if (sek <= 0) return null
            return (
              <span key={z} style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-3)' }}>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: ZONE_COLORS_V2[z], marginRight: 5 }} />
                {z} <b style={{ color: 'var(--tekst-1-app)' }}>{fTid(sek)}</b>
              </span>
            )
          })}
        </div>

        <div className="flex items-baseline gap-3 mt-3">
          <span style={CAP}>Total varighet</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: '0.04em', color: 'var(--tekst-1-app)' }}>{fTid(total)}</span>
        </div>

        <div className="mt-3">
          <div style={{ ...CAP, marginBottom: 5 }}>Tittel — fylles inn, fritt redigerbar</div>
          <div style={{ fontFamily: FONT, fontSize: 15, color: 'var(--tekst-1-app)' }}>{tittel}</div>
        </div>

        <div className="mt-4" style={CAP}>Generert i aktivitetslista</div>
        {/* Rad-forhåndsvisning: nøyaktig det som legges i aktivitetslista. */}
        <div className="mt-2 flex flex-col gap-1">
          {blokker.map((b, i) => (
            <div key={i} className="flex items-center gap-2"
              style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-3-app)', background: b.posisjon ? 'rgba(226,58,90,.06)' : 'transparent', borderRadius: 6, padding: '3px 6px' }}>
              <span style={{ color: 'var(--tekst-10)', width: 20, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.posisjon && <span style={{ display: 'inline-block', width: 17, height: 17, lineHeight: '17px', textAlign: 'center', borderRadius: 4, fontSize: 10.5, fontWeight: 800, color: 'var(--tekst-1-ren)', marginRight: 7, background: b.posisjon === 'L' ? LIGG : STAA }}>{b.posisjon}</span>}
                {NAVN[b.type] ?? b.type}{b.posisjon ? ' · 5 skudd' : ''}
                {!b.posisjon && <span style={{ color: 'var(--tekst-8-alt)' }}> {bev}{sub ? ` · ${sub}` : ''}</span>}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tekst-1-app)', fontSize: 13 }}>{fTid(b.sek)}</span>
              <span style={{ color: ZONE_COLORS_V2[b.sone], fontWeight: 700, fontSize: 12, width: 60, textAlign: 'right', flexShrink: 0 }}>{b.sone}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={() => setSteg('bygg')}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 9, padding: '10px 18px', cursor: 'pointer' }}>
            ← Tilbake
          </button>
          <button type="button" onClick={() => { void opprett() }}
            style={{ fontFamily: "'Inter', 'Barlow', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--tekst-1-ren)', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '12px 32px', cursor: 'pointer' }}>
            Ferdig
          </button>
        </div>
      </div>
    )
  }

  // ── STEG 1: bygg ──
  return (
    <div style={kort} data-hurtigoppsett={kompakt ? 'kompakt' : 'full'}>
      {!kompakt && <><div style={CAP}>Gjelder hele økta</div>
      <div className="grid grid-cols-2 gap-3 mt-1.5">
        <div>
          <div style={{ ...CAP, marginBottom: 5 }}>Bevegelsesform</div>
          <select value={bev} onChange={e => { setBev(e.target.value); setSub('') }} style={FELT}>
            {bevValg.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...CAP, marginBottom: 5 }}>Underkategori</div>
          <select value={sub} onChange={e => setSub(e.target.value)} style={FELT} disabled={subValg.length === 0}>
            <option value="">{subValg.length === 0 ? '—' : 'Velg…'}</option>
            {subValg.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className={skyting ? '' : 'col-span-2'}>
          <div style={{ ...CAP, marginBottom: 5 }}>Skyting i pausene</div>
          <select value={skyting} onChange={e => setSkyting(e.target.value as '' | SkyteMonster)} style={FELT}>
            {SKYTEVALG.map(v => <option key={v.verdi} value={v.verdi}>{v.etikett}</option>)}
          </select>
        </div>
        {skyting && (
          <div>
            <div style={{ ...CAP, marginBottom: 5 }}>Skytetid (s, maks 60)</div>
            <input value={skytetid} onChange={e => setSkytetid(e.target.value)} inputMode="numeric" aria-label="Skytetid i sekunder"
              data-skytetid style={FELT} />
          </div>
        )}
      </div></>}

      <div style={{ ...CAP, marginTop: kompakt ? 0 : 16 }}>Drag</div>
      <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: kompakt ? '44px 10px 1fr 64px 10px 1fr' : '52px 12px 1fr 74px 12px 1fr 32px', fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>
        <span>Antall</span><span /><span>Dragtid / km · fart{rader.some(r => r.modus === 'km') && (
          <button type="button" data-fart-enhet={fartEnhet} onClick={() => setFartEnhet(v => (v === 'min_per_km' ? 'km_per_h' : 'min_per_km'))}
            style={{ marginLeft: 6, fontFamily: FONT, fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 999, padding: '1px 6px', cursor: 'pointer', textTransform: 'none' }}>
            {fartEnhet === 'min_per_km' ? 'min/km' : 'km/t'}
          </button>
        )}</span><span>Sone</span><span /><span>Pause</span>{!kompakt && <span />}
      </div>
      {rader.map((r, i) => (
        <div key={i} className="grid gap-2 items-center mt-1.5" style={{ gridTemplateColumns: kompakt ? '44px 10px 1fr 64px 10px 1fr' : '52px 12px 1fr 74px 12px 1fr 32px' }}>
          <input value={r.antall} onChange={e => oppdater(i, 'antall', e.target.value)} inputMode="numeric" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14 }} />
          <span style={{ color: 'var(--tekst-8-alt)', textAlign: 'center' }}>×</span>
          {r.modus === 'km' ? (
            <div className="flex items-center gap-1" style={{ minWidth: 0 }}>
              <input value={r.km} onChange={e => oppdater(i, 'km', e.target.value)} inputMode="decimal" placeholder="km" aria-label="Drag i km" data-drag-km
                style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14, minWidth: 0 }} />
              <input value={r.fart} onChange={e => oppdater(i, 'fart', e.target.value)} inputMode="text" placeholder={fartEnhet === 'km_per_h' ? 'km/t' : 'min/km'} aria-label="Planlagt fart" data-drag-fart
                style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14, minWidth: 0 }} />
              <button type="button" data-drag-modus="km" onClick={() => oppdater(i, 'modus', 'tid')} title="Bytt til dragtid"
                style={{ fontFamily: FONT, fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 999, padding: '3px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>KM</button>
            </div>
          ) : (
            <div className="flex items-center gap-1" style={{ minWidth: 0 }}>
              <input value={r.drag} onChange={e => oppdater(i, 'drag', e.target.value)} inputMode="text" placeholder="MM:SS" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14, minWidth: 0 }} />
              <button type="button" data-drag-modus="tid" onClick={() => oppdater(i, 'modus', 'km')} title="Planlegg draget i kilometer i stedet"
                style={{ fontFamily: FONT, fontSize: 10, letterSpacing: '0.08em', color: 'var(--tekst-8-alt)', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>TID</button>
            </div>
          )}
          <select value={r.sone} onChange={e => oppdater(i, 'sone', e.target.value)}
            style={{ ...FELT, fontWeight: 700, color: ZONE_COLORS_V2[r.sone], padding: '8px 2px', fontSize: 14 }}>
            {foringsSoner(utvidetSkala === true).map(z => <option key={z} value={z}>{z}</option>)}
            {/* Radens egen sone beholdes i lista selv om språket ikke
                tilbyr den (eldre Hurtighet-rad m/ utvidet skala). */}
            {!foringsSoner(utvidetSkala === true).includes(r.sone) && (
              <option value={r.sone}>{r.sone} (eldre)</option>
            )}
          </select>
          <span style={{ color: 'var(--tekst-8-alt)', textAlign: 'center' }}>/</span>
          <input value={r.pause} onChange={e => oppdater(i, 'pause', e.target.value)} inputMode="text" placeholder="MM:SS" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14 }} />
          {!kompakt && <button type="button" onClick={() => rader.length > 1 && setRader(rs => rs.filter((_, ri) => ri !== i))}
            aria-label="Fjern rad"
            style={{ height: 38, borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tekst-8-alt)', cursor: 'pointer', fontSize: 16 }}>
            ×
          </button>}
          {/* KORTINTERVALLER inni draget — frie sekundfelter, alltid
              synlige (ikke i forsidens kompakte variant). Hurtigvalgene
              deles med segment-editoren (lib/intervall-monstre, regel 18). */}
          {!kompakt && <div className="col-span-full flex items-center gap-1.5 flex-wrap"
            style={{ marginTop: -2, marginBottom: 4 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>
              Kort
            </span>
            <input value={r.kortPaa} onChange={e => oppdater(i, 'kortPaa', e.target.value)}
              inputMode="numeric" placeholder="på s" aria-label="Kortintervall arbeid (sekunder)"
              style={{ ...FELT, width: 58, textAlign: 'center', padding: '6px 2px', fontSize: 13 }} />
            <span style={{ color: 'var(--tekst-8-alt)' }}>/</span>
            <input value={r.kortAv} onChange={e => oppdater(i, 'kortAv', e.target.value)}
              inputMode="numeric" placeholder="av s" aria-label="Kortintervall pause (sekunder)"
              style={{ ...FELT, width: 58, textAlign: 'center', padding: '6px 2px', fontSize: 13 }} />
            {KORTINTERVALL_HURTIGVALG.map(h => (
              <button key={h.etikett} type="button"
                onClick={() => { oppdater(i, 'kortPaa', String(h.verdi.paaSek)); oppdater(i, 'kortAv', String(h.verdi.avSek)) }}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
                  color: 'var(--tekst-8-alt)', background: 'none', border: '1px solid var(--line2)',
                  borderRadius: 999, padding: '4px 8px', minHeight: 30, cursor: 'pointer',
                }}>
                {h.etikett}
              </button>
            ))}
            {Number(r.kortPaa) > 0 && (() => {
              const m = { paaSek: Number(r.kortPaa) || 0, avSek: Number(r.kortAv) || 0 }
              const dragSek = (() => {
                const d = r.drag.split(':').map(Number)
                return d.length >= 2 ? d[0] * 60 + d[1] : 0
              })()
              return (
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, color: 'var(--tekst-5-app)' }}>
                  {antallRepetisjoner(dragSek, m) > 0
                    ? kortintervallEtikett(dragSek, m)
                    : 'draget er kortere enn én repetisjon'}
                </span>
              )
            })()}
          </div>}
        </div>
      ))}
      {!kompakt && <button type="button" onClick={() => setRader(rs => [...rs, { antall: '4', drag: '4:00', sone: 'I5', pause: '3:00', kortPaa: '', kortAv: '' , modus: 'tid', km: '', fart: '' }])}
        className="w-full mt-2"
        style={{ fontFamily: FONT, fontSize: 14, color: 'var(--tekst-5-app)', background: 'transparent', border: '1.3px dashed var(--line2)', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
        + Legg til rad
      </button>}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div><div style={{ ...CAP, marginBottom: 5 }}>Oppvarming</div>
          <input value={opp} onChange={e => setOpp(e.target.value)} inputMode="text" style={FELT} /></div>
        <div><div style={{ ...CAP, marginBottom: 5 }}>Nedjogg</div>
          <input value={ned} onChange={e => setNed(e.target.value)} inputMode="text" style={FELT} /></div>
      </div>

      {!kompakt && <p className="mt-3" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {serier > 0
          ? `${serier} serier · ${antallL} liggende, ${antallS} stående · ${serier * 5} skudd — skytinga tar ${konfig.skytetidSek} s av pausen, resten er pause; totaltiden er uendret.`
          : 'Pausene blir vanlige aktive pauser.'}
      </p>}

      <div className="flex gap-2 mt-2">
        {onAvbryt && (
          <button type="button" onClick={onAvbryt}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}>
            Avbryt
          </button>
        )}
        <button type="button" onClick={() => setSteg('vis')}
          className="flex-1"
          style={{ fontFamily: "'Inter', 'Barlow', sans-serif", fontWeight: 800, fontSize: 14.5, color: 'var(--tekst-1-ren)', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: 13, cursor: 'pointer' }}>
          Opprett
        </button>
      </div>
    </div>
  )
}
