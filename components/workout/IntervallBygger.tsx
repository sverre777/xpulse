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

import { bevFelterFor, bevValgForBygger, wattMidt, wattTekst, parseDesimal, splitTilSekPerKm } from '@/lib/bevform-felter'
import { useEffect, useMemo, useState } from 'react'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import {
  byggBlokker, genererIntervalløkt,
  type GenerertBlokk, type IntervallKonfig, type SkyteMonster, SKYTETID_STANDARD_SEK, SKYTETID_MAKS_SEK, dragSekFraKm } from '@/lib/intervall-generator'
import type { BlokkSone } from '@/lib/okt-template-library'
import { KORTINTERVALL_HURTIGVALG, antallRepetisjoner, kortintervallEtikett } from '@/lib/intervall-monstre'
import { foringsSoner } from '@/lib/sonesprak'
import { useUtvidetSkala } from '@/lib/sonesprak-klient'
import { lesHurtigLager, skrivHurtigLager } from '@/lib/hurtig-lager'
import {
  getSubcategories, DEFAULT_MOVEMENTS_BY_SPORT,
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
// BOLK 27: småfelt på bev.form-linja.
const LITEN: React.CSSProperties = { fontFamily: FONT, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }
const SMAL: React.CSSProperties = { ...FELT, width: 76, textAlign: 'center', padding: '6px 2px', fontSize: 13 }

interface Rad {
  antall: string; drag: string; sone: BlokkSone; pause: string
  // Kortintervaller INNI draget (Øktbyggeren bolk 2). Frie sekundverdier
  // — hurtigvalgene under fyller dem bare inn.
  kortPaa: string; kortAv: string
  // Sverre 5. sep: draget kan planlegges i KILOMETER i stedet for tid —
  // km + planlagt fart gir dragtida.
  modus: 'tid' | 'km'
  km: string
  /** Planlagt fart fra–til (i valgt enhet). Bare «fra» = én fart. */
  fartFra: string
  fartTil: string
  /** BOLK 27: bev.form-spesifikke mål (lib/bevform-felter) — vises bare
      der bev.formen har feltet; verdiene beholdes ved bytte. */
  wattFra: string
  wattTil: string
  stigning: string
  motstand: string
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
/** «4:00–3:30/km» / «14–16 km/t» — fra–til, eller én fart. Tom uten fart. */
function fartTekstFor(fra: string, til: string, enhet: FartEnhet): string {
  const a = fartTilSekPerKm(fra, enhet), b = fartTilSekPerKm(til, enhet)
  if (!(a > 0) && !(b > 0)) return ''
  if (a > 0 && b > 0 && a !== b) {
    if (enhet === 'km_per_h') return `${fra.trim().replace('.', ',')}–${til.trim().replace('.', ',')} km/t`
    const m = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`
    return `${m(a)}–${m(b)}/km`
  }
  return fmtFart(a > 0 ? a : b, enhet)
}
/** Snittfarten (sek/km) av fra–til — til utregning av tid/distanse. */
function fartSnittSekPerKm(fra: string, til: string, enhet: FartEnhet): number {
  const a = fartTilSekPerKm(fra, enhet), b = fartTilSekPerKm(til, enhet)
  if (a > 0 && b > 0) return (a + b) / 2
  return a > 0 ? a : b
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

export function IntervallBygger({ sport, onOpprett, forhandsutfylt, onAvbryt, onStegChange, apneSignal, kompakt = false, onFerdig, lagerNokkel, onLeggTil }: {
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
  /** Sverre 5. sep: «Ferdig» ved siden av «Opprett» — lukker byggeren.
      Opprett holder deg i byggeren med økta opprettet. */
  onFerdig?: () => void
  /** Sverre 5. sep: oppsettet huskes PER ØKT (localStorage), så man kan
      endre og opprette på nytt — også etter at byggeren har vært lukket. */
  lagerNokkel?: string
  /** «+ Legg til bolk» (Sverre 5. sep): en bolk til (f.eks. svømming først,
      så løping) — bare aktivitetene, uten ny oppvarming/nedjogg, lagt UNDER
      radene som finnes. Oversikten viser det som én økt. */
  onLeggTil?: (rader: ActivityRow[], tittel: string) => void | Promise<void>
}) {
  const husket = useMemo(() => (lagerNokkel && !forhandsutfylt ? lesHurtigLager<Rad>(lagerNokkel) : null), [lagerNokkel, forhandsutfylt])
  // Sonespråket (5b): velgeren tilbyr I6–I8 ELLER Hurtighet — aldri begge.
  const utvidetSkala = useUtvidetSkala()
  const harSki = useHarSkiskyting()
  // Sverre 5. sep: hurtigoppsettet kollapser ALDRI av seg selv — bare
  // «Opprett» gjør det. Et husket oppsett fyller feltene, men steget er
  // alltid «bygg» ved åpning (tom økt i dagbok skal vise oppsettet).
  const [steg, settStegIntern] = useState<'bygg' | 'ferdig'>('bygg')
  // «Legg til bolk»-modus: oppsettet bygges som en bolk til (uten oppv/nedjogg).
  const [leggTil, setLeggTil] = useState(false)
  const setSteg = (st: 'bygg' | 'ferdig') => { settStegIntern(st); onStegChange?.(st) }
  const [rader, setRader] = useState<Rad[]>(() =>
    husket ? (husket.rader as Partial<Rad>[]).map(r => ({ wattFra: '', wattTil: '', stigning: '', motstand: '', ...r }) as Rad) :
    forhandsutfylt
      ? forhandsutfylt.rader.map(r => ({
          antall: String(r.antall), drag: fTid(r.dragSek), sone: r.sone, pause: fTid(r.pauseSek),
          kortPaa: '', kortAv: '', modus: 'tid' as const, km: '', fartFra: '', fartTil: '', wattFra: '', wattTil: '', stigning: '', motstand: '',
        }))
      // Rettelse 8 (4. sep): ÉN standardrad — 3 × 10 min I3 · 2 min pause.
      : [{ antall: '3', drag: '10:00', sone: 'I3', pause: '2:00', kortPaa: '', kortAv: '', modus: 'tid', km: '', fartFra: '', fartTil: '', wattFra: '', wattTil: '', stigning: '', motstand: '' }])
  const [fartEnhet, setFartEnhet] = useState<FartEnhet>(() => (husket?.fartEnhet as FartEnhet | undefined) ?? 'min_per_km')
  const [bev, setBev] = useState<string>(() => husket?.bev ?? DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping')
  const [sub, setSub] = useState(() => husket?.sub ?? '')
  const [skyting, setSkyting] = useState<'' | SkyteMonster>(() => (husket?.skyting as '' | SkyteMonster | undefined) ?? forhandsutfylt?.skyting ?? '')
  // Pkt 16: skytetid inni pausen — standard 45 s, fritt (maks 60 s).
  const [skytetid, setSkytetid] = useState(() => husket?.skytetid ?? String(forhandsutfylt?.skytetidSek ?? SKYTETID_STANDARD_SEK))
  const [opp, setOpp] = useState(() => husket?.opp ?? (forhandsutfylt ? fTid(forhandsutfylt.oppvarmingSek) : '20:00'))
  const [ned, setNed] = useState(() => husket?.ned ?? (forhandsutfylt ? fTid(forhandsutfylt.nedjoggSek) : '15:00'))

  useEffect(() => {
    if (apneSignal != null && apneSignal > 0) setSteg('bygg')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apneSignal])

  // Bevegelsesformer: brukerens sport-defaults først, så resten av fasiten.
  // BOLK 27: uten styrke — styrke føres i øvelsesradene, ikke i byggeren.
  const bevValg = useMemo(() => bevValgForBygger(sport), [sport])
  const subValg = useMemo(() => getSubcategories(bev), [bev])
  // BOLK 27: feltene som hører til bev.formen. Mølle fører fart i km/t.
  const felter = useMemo(() => bevFelterFor(bev, sub), [bev, sub])
  const fartEnhetEff: FartEnhet = felter.fart === 'kmt' ? 'km_per_h' : fartEnhet

  const konfig: IntervallKonfig = useMemo(() => ({
    oppvarmingSek: leggTil ? 0 : pSek(opp),
    nedjoggSek: leggTil ? 0 : pSek(ned),
    rader: rader.map(r => {
      const km = parseFloat(r.km.replace(',', '.'))
      // Roing: farten er split /500 m (lagres som s/km).
      const fartSek = felter.split500 ? (splitTilSekPerKm(r.fartFra) ?? 0) : fartSnittSekPerKm(r.fartFra, r.fartTil, fartEnhetEff)
      const iKm = r.modus === 'km'
      const dragSek = iKm ? dragSekFraKm(km, fartSek) : pSek(r.drag)
      // Fart i tid-visning gir distansen (Sverre 5. sep); km-visning gir tida.
      const dragKm = iKm ? (km > 0 ? km : null) : (fartSek > 0 && dragSek > 0 ? Math.round((dragSek / fartSek) * 100) / 100 : null)
      return {
        antall: Math.max(1, parseInt(r.antall) || 1),
        dragSek,
        sone: r.sone,
        pauseSek: pSek(r.pause),
        dragKm,
        fartSekPerKm: fartSek > 0 ? fartSek : null,
        fartTekst: felter.split500 ? (r.fartFra.trim() ? `${r.fartFra.trim()} /500 m` : null) : fartTekstFor(r.fartFra, r.fartTil, fartEnhetEff) || null,
        // BOLK 27: målene fra bev.form-feltene.
        wattMaal: felter.wattMaal ? wattMidt(r.wattFra, r.wattTil) : null,
        wattTekst: felter.wattMaal ? wattTekst(r.wattFra, r.wattTil) || null : null,
        stigning: felter.stigning ? parseDesimal(r.stigning) : null,
        motstand: felter.motstand && r.motstand ? r.motstand : null,
        kort: Number(r.kortPaa) > 0 ? { paaSek: Number(r.kortPaa) || 0, avSek: Number(r.kortAv) || 0 } : null,
      }
    }),
    bevegelsesform: bev,
    underkategori: sub,
    skyting: skyting || null,
    skytetidSek: Math.max(1, Math.min(SKYTETID_MAKS_SEK, parseInt(skytetid) || SKYTETID_STANDARD_SEK)),
  }), [opp, ned, rader, bev, sub, skyting, skytetid, fartEnhetEff, felter, leggTil])

  const blokker: GenerertBlokk[] = useMemo(() => byggBlokker(konfig), [konfig])
  const total = blokker.reduce((s, b) => s + b.sek, 0)
  const serier = blokker.filter(b => b.posisjon).length
  const antallL = blokker.filter(b => b.posisjon === 'L').length
  const antallS = blokker.filter(b => b.posisjon === 'S').length

  const generertTittel = rader
    .map(r => {
      const n = Math.max(1, parseInt(r.antall) || 1)
      const fart = felter.split500 ? (r.fartFra.trim() ? `${r.fartFra.trim()} /500 m` : '') : fartTekstFor(r.fartFra, r.fartTil, fartEnhetEff)
      // BOLK 27: «3 × 10 min · 220–240 W · I3 / 2 min».
      const spes = [felter.wattMaal ? wattTekst(r.wattFra, r.wattTil) : '', felter.stigning && (parseDesimal(r.stigning) ?? 0) > 0 ? `${r.stigning.trim().replace('.', ',')} %` : ''].filter(Boolean).join(' · ')
      const drag = `${r.modus === 'km' ? `${r.km.replace('.', ',')} km` : tMin(r.drag)}${fart ? ` (${fart})` : ''}`
      // Kortintervallet står i tittelen (Sverre 5. sep): «3 × 10 min I3 · 50/10 / 2 min».
      const kort = Number(r.kortPaa) > 0 ? ` · ${Number(r.kortPaa)}/${Number(r.kortAv) || 0}` : ''
      return `${n} × ${drag}${spes ? ` · ${spes}` : ''} ${r.sone}${kort} / ${tMin(r.pause)}`
    })
    .join('  +  ') + (serier > 0 ? '  ·  komb' : '')
  const tittel = forhandsutfylt?.tittel ?? generertTittel

  const oppdater = (i: number, felt: keyof Rad, verdi: string) =>
    setRader(rs => rs.map((r, ri) => ri === i ? { ...r, [felt]: verdi } as Rad : r))

  const opprett = async () => {
    if (leggTil && onLeggTil) {
      await onLeggTil(genererIntervalløkt(konfig), tittel)
      setLeggTil(false)
      setSteg('ferdig')
      return
    }
    await onOpprett(genererIntervalløkt(konfig), tittel)
    if (lagerNokkel) skrivHurtigLager(lagerNokkel, { rader, fartEnhet, bev, sub, skyting, skytetid, opp, ned })
    if (forhandsutfylt && onAvbryt) onAvbryt()   // dialog: lukk — ingen kollaps-linje
    else setSteg('ferdig')                        // i byggeren: bli, med økta opprettet
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
        {onLeggTil && (
          <button type="button" onClick={() => { setLeggTil(true); setSteg('bygg') }} data-legg-til-bolk
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', background: 'none', border: '1px dashed var(--line2)', borderRadius: 9, padding: '9px 16px', cursor: 'pointer' }}>
            + Legg til bolk
          </button>
        )}
        {onFerdig && (
          <button type="button" onClick={onFerdig} data-ferdig
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: 'var(--accent)', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 9, padding: '9px 16px', cursor: 'pointer' }}>
            Ferdig
          </button>
        )}
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
        {/* Skyting i pausene — bare for skiskyttere (rutenettet tetter seg uten). */}
        {harSki && <div className={skyting ? '' : 'col-span-2'}>
          <div style={{ ...CAP, marginBottom: 5 }}>Skyting i pausene</div>
          <select value={skyting} onChange={e => setSkyting(e.target.value as '' | SkyteMonster)} style={FELT}>
            {SKYTEVALG.map(v => <option key={v.verdi} value={v.verdi}>{v.etikett}</option>)}
          </select>
        </div>}
        {harSki && skyting && (
          <div>
            <div style={{ ...CAP, marginBottom: 5 }}>Skytetid (s, maks 60)</div>
            <input value={skytetid} onChange={e => setSkytetid(e.target.value)} inputMode="numeric" aria-label="Skytetid i sekunder"
              data-skytetid style={FELT} />
          </div>
        )}
      </div></>}

      <div style={{ ...CAP, marginTop: kompakt ? 0 : 16 }}>Drag</div>
      <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: kompakt ? '44px 10px 1fr 64px 10px 1fr' : '52px 12px 1fr 74px 12px 1fr 32px', fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>
        <span>Antall</span><span /><span>Dragtid / km</span><span>Sone</span><span /><span>Pause</span>{!kompakt && <span />}
      </div>
      {rader.map((r, i) => (
        <div key={i} className="grid gap-2 items-center mt-1.5" style={{ gridTemplateColumns: kompakt ? '44px 10px 1fr 64px 10px 1fr' : '52px 12px 1fr 74px 12px 1fr 32px' }}>
          <input value={r.antall} onChange={e => oppdater(i, 'antall', e.target.value)} inputMode="numeric" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14 }} />
          <span style={{ color: 'var(--tekst-8-alt)', textAlign: 'center' }}>×</span>
          <div className="flex items-center gap-1" style={{ minWidth: 0 }}>
            {/* Synlig TID | KM-bryter (Sverre 5. sep) — den aktive er fylt. */}
            <span role="group" aria-label="Dragtid eller kilometer" data-drag-bryter={r.modus}
              style={{ display: 'inline-flex', border: '1px solid var(--kant-3)', borderRadius: 999, overflow: 'hidden', flex: '0 0 auto' }}>
              {(['tid', 'km'] as const).map(m => (
                <button key={m} type="button" data-drag-modus={m} aria-pressed={r.modus === m} onClick={() => oppdater(i, 'modus', m)}
                  style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '5px 8px', minHeight: 30, cursor: 'pointer', border: 'none',
                    background: r.modus === m ? 'var(--accent)' : 'transparent', color: r.modus === m ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)' }}>
                  {m === 'tid' ? 'TID' : 'KM'}
                </button>
              ))}
            </span>
            {r.modus === 'km' ? (
              <input value={r.km} onChange={e => oppdater(i, 'km', e.target.value)} inputMode="decimal" placeholder="km" aria-label="Drag i km" data-drag-km
                style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14, minWidth: 0 }} />
            ) : (
              <input value={r.drag} onChange={e => oppdater(i, 'drag', e.target.value)} inputMode="text" placeholder="MM:SS" style={{ ...FELT, textAlign: 'center', padding: '8px 2px', fontSize: 14, minWidth: 0 }} />
            )}
          </div>
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
          {/* BOLK 27: bev.form-spesifikke mål på draget (lib/bevform-felter):
              watt fra–til · split /500 m · stigning % · motstand 1–10. */}
          {!kompakt && (felter.wattMaal || felter.stigning || felter.motstand || felter.split500) && (
            <div className="col-span-full flex items-center gap-1.5 flex-wrap" data-bevform-linje={bev} style={{ marginTop: -2 }}>
              {felter.wattMaal && <>
                <span style={LITEN}>Watt</span>
                <input value={r.wattFra} onChange={e => oppdater(i, 'wattFra', e.target.value)} inputMode="numeric" placeholder="fra 220" aria-label="Målwatt fra" data-watt-fra style={SMAL} />
                <span style={{ color: 'var(--tekst-8-alt)' }}>–</span>
                <input value={r.wattTil} onChange={e => oppdater(i, 'wattTil', e.target.value)} inputMode="numeric" placeholder="til 240" aria-label="Målwatt til" data-watt-til style={SMAL} />
                <span style={{ color: 'var(--tekst-8-alt)' }}>W</span>
              </>}
              {felter.split500 && <>
                <span style={LITEN}>Split</span>
                <input value={r.fartFra} onChange={e => oppdater(i, 'fartFra', e.target.value)} inputMode="text" placeholder="1:55" aria-label="Split per 500 m" data-split-500 style={SMAL} />
                <span style={{ color: 'var(--tekst-8-alt)' }}>/500 m</span>
              </>}
              {felter.stigning && <>
                <span style={LITEN}>Stigning</span>
                <input value={r.stigning} onChange={e => oppdater(i, 'stigning', e.target.value)} inputMode="decimal" placeholder="6" aria-label="Stigning i prosent" data-stigning style={{ ...SMAL, width: 56 }} />
                <span style={{ color: 'var(--tekst-8-alt)' }}>%</span>
              </>}
              {felter.motstand && <>
                <span style={LITEN}>Motstand</span>
                <select value={r.motstand} onChange={e => oppdater(i, 'motstand', e.target.value)} aria-label="Motstand 1–10" data-motstand style={{ ...FELT, width: 64, padding: '6px 4px', fontSize: 13 }}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={String(n)}>{n}</option>)}
                </select>
              </>}
            </div>
          )}
          {/* PLANLAGT FART fra–til (Sverre 5. sep) — i km-visning gir den tida,
              i tid-visning gir den distansen. Enhet: min/km eller km/t. */}
          {!kompakt && felter.fart !== false && <div className="col-span-full flex items-center gap-1.5 flex-wrap" data-fart-linje style={{ marginTop: -2 }}>
            <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>Fart</span>
            <input value={r.fartFra} onChange={e => oppdater(i, 'fartFra', e.target.value)} inputMode="text" placeholder={fartEnhetEff === 'km_per_h' ? 'fra km/t' : 'fra 4:30'} aria-label="Planlagt fart fra" data-drag-fart-fra
              style={{ ...FELT, width: 76, textAlign: 'center', padding: '6px 2px', fontSize: 13 }} />
            <span style={{ color: 'var(--tekst-8-alt)' }}>–</span>
            <input value={r.fartTil} onChange={e => oppdater(i, 'fartTil', e.target.value)} inputMode="text" placeholder={fartEnhetEff === 'km_per_h' ? 'til km/t' : 'til 4:00'} aria-label="Planlagt fart til" data-drag-fart-til
              style={{ ...FELT, width: 76, textAlign: 'center', padding: '6px 2px', fontSize: 13 }} />
            <span role="group" aria-label="Fartenhet" data-fart-enhet={fartEnhetEff} hidden={felter.fart === 'kmt'}
              style={{ display: 'inline-flex', border: '1px solid var(--kant-3)', borderRadius: 999, overflow: 'hidden' }}>
              {(['min_per_km', 'km_per_h'] as const).map(e2 => (
                <button key={e2} type="button" data-fart-enhet-valg={e2} aria-pressed={fartEnhet === e2} onClick={() => setFartEnhet(e2)}
                  style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 8px', minHeight: 28, cursor: 'pointer', border: 'none',
                    background: fartEnhet === e2 ? 'var(--accent)' : 'transparent', color: fartEnhet === e2 ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)' }}>
                  {e2 === 'min_per_km' ? 'min/km' : 'km/t'}
                </button>
              ))}
            </span>
            {(() => {
              const f = fartTekstFor(r.fartFra, r.fartTil, fartEnhetEff)
              const snitt = fartSnittSekPerKm(r.fartFra, r.fartTil, fartEnhetEff)
              if (!f) return null
              const dragSek = r.modus === 'km' ? dragSekFraKm(parseFloat(r.km.replace(',', '.')), snitt) : pSek(r.drag)
              const km = r.modus === 'km' ? parseFloat(r.km.replace(',', '.')) : (snitt > 0 && dragSek > 0 ? dragSek / snitt : 0)
              return <span style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-5-app)' }}>
                {f}{r.modus === 'km' && dragSek > 0 ? ` → ${fTid(dragSek)} per drag` : r.modus === 'tid' && km > 0 ? ` → ${(Math.round(km * 100) / 100).toFixed(2).replace('.', ',')} km per drag` : ''}
              </span>
            })()}
          </div>}
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
      {!kompakt && <button type="button" onClick={() => setRader(rs => [...rs, { antall: '4', drag: '4:00', sone: 'I5', pause: '3:00', kortPaa: '', kortAv: '' , modus: 'tid', km: '', fartFra: '', fartTil: '', wattFra: '', wattTil: '', stigning: '', motstand: '' }])}
        className="w-full mt-2"
        style={{ fontFamily: FONT, fontSize: 14, color: 'var(--tekst-5-app)', background: 'transparent', border: '1.3px dashed var(--line2)', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
        + Legg til rad
      </button>}

      {leggTil ? (
        <p data-legg-til-modus style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-alt)', marginTop: 10 }}>
          Bolken legges under radene som finnes — bare aktivitetene, uten ny oppvarming/nedjogg. Velg bevegelsesform for bolken over.
        </p>
      ) : (
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div><div style={{ ...CAP, marginBottom: 5 }}>Oppvarming</div>
          <input value={opp} onChange={e => setOpp(e.target.value)} inputMode="text" style={FELT} /></div>
        <div><div style={{ ...CAP, marginBottom: 5 }}>Nedjogg</div>
          <input value={ned} onChange={e => setNed(e.target.value)} inputMode="text" style={FELT} /></div>
      </div>
      )}

      {!kompakt && <p className="mt-3" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {serier > 0
          ? `${serier} serier · ${antallL} liggende, ${antallS} stående · ${serier * 5} skudd — skytinga tar ${konfig.skytetidSek} s av pausen, resten er pause; totaltiden er uendret.`
          : 'Pausene blir vanlige aktive pauser.'}
      </p>}

      <div className="flex gap-2 mt-2">
        {(onAvbryt || leggTil) && (
          <button type="button" onClick={leggTil ? () => { setLeggTil(false); setSteg('ferdig') } : onAvbryt}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}>
            Avbryt
          </button>
        )}
        <button type="button" onClick={() => { void opprett() }} data-hurtig-opprett
          className="flex-1"
          style={{ fontFamily: "'Inter', 'Barlow', sans-serif", fontWeight: 800, fontSize: 14.5, color: 'var(--tekst-1-ren)', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: 13, cursor: 'pointer' }}>
          {leggTil ? 'Legg til bolk' : 'Opprett'}
        </button>
        {onFerdig && !leggTil && (
          <button type="button" onClick={onFerdig} data-ferdig
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: 'var(--accent)', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}>
            Ferdig
          </button>
        )}
      </div>
    </div>
  )
}
