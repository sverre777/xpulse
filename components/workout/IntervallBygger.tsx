'use client'

// INTERVALL-BYGGEREN (UI) — flaten over lib/intervall-generator.ts (SF-12).
// Fasit: design/xpulse-intervall-bygger-design.html. UI-en BRUKER generatoren,
// aldri reimplementerer regnestykket — blokkene til forhåndsvisningen kommer
// fra byggBlokker(), radene fra genererIntervalløkt().
//
// Tre steg: bygg → se hvordan den blir (samlet/splittet velges DER, hvor
// forskjellen faktisk vises) → ferdig (kollapset linje m/ stripe + «Endre»,
// samme mønster som konkurranse fellesstart).
//
// Reglene bor i generatoren: skyting erstatter pausen (totaltid uendret),
// mønsteret løper på tvers av radene, siste pause utgår, 5 skudd standard,
// skyterader uten bevegelsesform. INGENTING LÅSES — radene er vanlige
// aktivitetsrader etterpå, og økta husker ikke at den kom fra en bygger.

import { useEffect, useMemo, useState } from 'react'
import {
  byggBlokker, genererIntervalløkt,
  type GenerertBlokk, type IntervallKonfig, type SkyteMonster,
} from '@/lib/intervall-generator'
import type { BlokkSone } from '@/lib/okt-template-library'
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

interface Rad { antall: string; drag: string; sone: BlokkSone; pause: string }

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
  /** Malens navn — brukt som tittel i stedet for den genererte. */
  tittel?: string
}

export function IntervallBygger({ sport, onOpprett, forhandsutfylt, onAvbryt, onStegChange, apneSignal }: {
  sport: Sport
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
        }))
      : [
          { antall: '2', drag: '10:00', sone: 'I3', pause: '3:00' },
          { antall: '3', drag: '5:00', sone: 'I4', pause: '2:00' },
        ])
  const [bev, setBev] = useState<string>(() => DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping')
  const [sub, setSub] = useState('')
  const [skyting, setSkyting] = useState<'' | SkyteMonster>(() => forhandsutfylt?.skyting ?? '')
  const [opp, setOpp] = useState(() => forhandsutfylt ? fTid(forhandsutfylt.oppvarmingSek) : '30:00')
  const [ned, setNed] = useState(() => forhandsutfylt ? fTid(forhandsutfylt.nedjoggSek) : '10:00')
  const [genForm, setGenForm] = useState<'splittet' | 'samlet'>('splittet')

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
    rader: rader.map(r => ({
      antall: Math.max(1, parseInt(r.antall) || 1),
      dragSek: pSek(r.drag),
      sone: r.sone,
      pauseSek: pSek(r.pause),
    })),
    bevegelsesform: bev,
    underkategori: sub,
    skyting: skyting || null,
    form: genForm,
  }), [opp, ned, rader, bev, sub, skyting, genForm])

  const blokker: GenerertBlokk[] = useMemo(() => byggBlokker(konfig), [konfig])
  const total = blokker.reduce((s, b) => s + b.sek, 0)
  const serier = blokker.filter(b => b.posisjon).length
  const antallL = blokker.filter(b => b.posisjon === 'L').length
  const antallS = blokker.filter(b => b.posisjon === 'S').length

  const generertTittel = rader
    .map(r => `${Math.max(1, parseInt(r.antall) || 1)} × ${tMin(r.drag)} ${r.sone} / ${tMin(r.pause)}`)
    .join('  +  ') + (serier > 0 ? '  ·  komb' : '')
  const tittel = forhandsutfylt?.tittel ?? generertTittel

  const oppdater = (i: number, felt: keyof Rad, verdi: string) =>
    setRader(rs => rs.map((r, ri) => ri === i ? { ...r, [felt]: verdi } : r))

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
    const bevBlokker = blokker.filter(b => !b.posisjon)
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

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span style={{ ...CAP, marginRight: 'auto' }}>Generert i aktivitetslista</span>
          {(['splittet', 'samlet'] as const).map(v => (
            <button key={v} type="button" onClick={() => setGenForm(v)}
              style={{
                fontFamily: FONT, fontSize: 13.5, borderRadius: 9, padding: '8px 15px', cursor: 'pointer',
                color: genForm === v ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)', fontWeight: genForm === v ? 700 : 400,
                background: genForm === v ? 'rgba(255,69,0,.10)' : 'var(--card2)',
                border: `1px solid ${genForm === v ? 'var(--accent)' : 'var(--line2)'}`,
              }}>
              {v === 'splittet' ? 'Splittet' : 'Samlet'}
            </button>
          ))}
        </div>

        {/* Rad-forhåndsvisning: nøyaktig det som legges i aktivitetslista. */}
        <div className="mt-2 flex flex-col gap-1">
          {genForm === 'splittet' ? blokker.map((b, i) => (
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
          )) : (
            <>
              <div className="flex items-center gap-2" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-3-app)', padding: '3px 6px' }}>
                <span style={{ color: 'var(--tekst-10)', width: 20 }}>1</span>
                <span style={{ flex: 1 }}>Aktivitet <span style={{ color: 'var(--tekst-8-alt)' }}>{bev}{sub ? ` · ${sub}` : ''} · sonetotaler</span></span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tekst-1-app)', fontSize: 13 }}>{fTid(bevBlokker.reduce((s, b) => s + b.sek, 0))}</span>
              </div>
              {serier > 0 && (
                <div className="flex items-center gap-2" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-3-app)', background: 'rgba(226,58,90,.06)', borderRadius: 6, padding: '3px 6px' }}>
                  <span style={{ color: 'var(--tekst-10)', width: 20 }}>2</span>
                  <span style={{ flex: 1 }}>Skyting · {serier} serier · {serier * 5} skudd <span style={{ color: 'var(--tekst-8-alt)' }}>{antallL} liggende, {antallS} stående</span></span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tekst-1-app)', fontSize: 13 }}>{fTid(blokker.filter(b => b.posisjon).reduce((s, b) => s + b.sek, 0))}</span>
                </div>
              )}
            </>
          )}
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
    <div style={kort}>
      <div style={CAP}>Gjelder hele økta</div>
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
        <div className="col-span-2">
          <div style={{ ...CAP, marginBottom: 5 }}>Skyting i pausene</div>
          <select value={skyting} onChange={e => setSkyting(e.target.value as '' | SkyteMonster)} style={FELT}>
            {SKYTEVALG.map(v => <option key={v.verdi} value={v.verdi}>{v.etikett}</option>)}
          </select>
        </div>
      </div>

      <div style={{ ...CAP, marginTop: 16 }}>Drag</div>
      <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: '52px 12px 1fr 74px 12px 1fr 32px', fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>
        <span>Antall</span><span /><span>Dragtid</span><span>Sone</span><span /><span>Pause</span><span />
      </div>
      {rader.map((r, i) => (
        <div key={i} className="grid gap-2 items-center mt-1.5" style={{ gridTemplateColumns: '52px 12px 1fr 74px 12px 1fr 32px' }}>
          <input value={r.antall} onChange={e => oppdater(i, 'antall', e.target.value)} inputMode="numeric" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14 }} />
          <span style={{ color: 'var(--tekst-8-alt)', textAlign: 'center' }}>×</span>
          <input value={r.drag} onChange={e => oppdater(i, 'drag', e.target.value)} inputMode="text" placeholder="MM:SS" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14 }} />
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
          <button type="button" onClick={() => rader.length > 1 && setRader(rs => rs.filter((_, ri) => ri !== i))}
            aria-label="Fjern rad"
            style={{ height: 38, borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tekst-8-alt)', cursor: 'pointer', fontSize: 16 }}>
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRader(rs => [...rs, { antall: '4', drag: '4:00', sone: 'I5', pause: '3:00' }])}
        className="w-full mt-2"
        style={{ fontFamily: FONT, fontSize: 14, color: 'var(--tekst-5-app)', background: 'transparent', border: '1.3px dashed var(--line2)', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
        + Legg til rad
      </button>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div><div style={{ ...CAP, marginBottom: 5 }}>Oppvarming</div>
          <input value={opp} onChange={e => setOpp(e.target.value)} inputMode="text" style={FELT} /></div>
        <div><div style={{ ...CAP, marginBottom: 5 }}>Nedjogg</div>
          <input value={ned} onChange={e => setNed(e.target.value)} inputMode="text" style={FELT} /></div>
      </div>

      <p className="mt-3" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {serier > 0
          ? `${serier} serier · ${antallL} liggende, ${antallS} stående · ${serier * 5} skudd — skytingen erstatter pausen, totaltiden er uendret.`
          : 'Pausene blir vanlige aktive pauser.'}
      </p>

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
