'use client'

import { useState } from 'react'
import { ACTIVITY_TYPES, type ActivityType, type Sport } from '@/lib/types'
import { SEGMENT_FARGER, segmentBakgrunn, fmtKlokkeSek, type SegmentType } from '@/lib/segmenter'
import type { KurveHjelpere } from './OktKurve'

// Tidslinje-redigering i «Legg til detaljer» (LTD-A).
// Fasit: design/xpulse-legg-til-detaljer-design.html.
//
// DEN GAMLE AVGRENSNINGEN ER OPPHEVET: alle aktivitetstyper kan
// plasseres og redigeres i tid, også når klokka har levert runder.
// Klokkerunder er et UTGANGSPUNKT, ikke en lås.
//
// To slags ting, to interaksjoner (fasiten):
//  · SEGMENTER fyller tid — legges der man slipper, håndtak i begge
//    ender, og GRENSEHÅNDTAK mellom naboer som flytter slutten på det
//    ene og starten på det neste samtidig (aldri hull).
//  · PUNKTER (laktat/ernæring) settes på ett tidspunkt — ingen
//    varighet, ingen håndtak. De bor fortsatt i punkt-laget.

export interface Utkast {
  /** Lokal id — stabil gjennom hele redigeringsøkten. */
  id: string
  dbId: string | null
  type: ActivityType
  navn: string
  bevegelsesform: string
  startSek: number
  varighetSek: number
  skytetidSek: number | null
  /** Feltene segment-editoren eier (bolk 2). Tomt = ikke ført. */
  distanseKm: string
  snittpuls: string
  makspuls: string
  sone: string
  beskrivelse: string
  /** Repetisjoner fra samme kortintervall deler gruppe (fase 117). */
  gruppeId: string | null
  /** Dragets snitt/maks vist som GRÅ PLASSHOLDER på repetisjoner uten
      klokkedata. Er ikke en verdi: den arves aldri, lagres aldri, og
      forsvinner i det brukeren fører sitt eget tall. Med klokkedata
      brukes det MÅLTE i repetisjonens eget vindu i stedet. */
  arvetPuls: { snitt: string; maks: string } | null
}

const STANDARD_LENGDE: Partial<Record<string, number>> = {
  oppvarming: 600, nedjogg: 300, aktivitet: 300,
  pause: 60, aktiv_pause: 120, veksling: 45,
  skyting_kombinert: 40, skyting_liggende: 40, skyting_staaende: 40,
  skyting_innskyting: 60, skyting_basis: 120, annet: 120,
}

const GRUPPER: { navn: string; typer: string[] }[] = [
  { navn: 'Arbeid', typer: ['oppvarming', 'aktivitet', 'nedjogg'] },
  { navn: 'Hvile', typer: ['pause', 'aktiv_pause', 'veksling'] },
  { navn: 'Skyting', typer: ['skyting_kombinert', 'skyting_liggende', 'skyting_staaende', 'skyting_innskyting', 'skyting_basis'] },
  { navn: 'Annet', typer: ['annet'] },
]

// PUNKT-verktøy: settes på ETT tidspunkt, har ingen varighet og ingen
// håndtak. De er ikke aktivitetstyper, så de bor ikke i ACTIVITY_TYPES —
// men de hører hjemme i samme palett (fasitens «Annet»-gruppe).
// «Notat» kommer i bolk 5, når tidspunkt_notater-migreringen er kjørt:
// en palett-knapp som ikke kan lagre ville vært en død knapp.
export type PunktVerktoy = 'bevform' | 'laktat' | 'ernaering'
export const PUNKT_VERKTOY: { id: PunktVerktoy; navn: string; ikon: string; farge: string }[] = [
  { id: 'bevform', navn: 'Bev.form-bytte', ikon: '⇄', farge: SEGMENT_FARGER.bevform },
  { id: 'laktat', navn: 'Laktat', ikon: '🩸', farge: '#E23A5A' },
  { id: 'ernaering', navn: 'Ernæring', ikon: '🍌', farge: '#FFB300' },
]

export function segmentTypeFor(type: string, bevegelsesform: string): SegmentType {
  if (type.startsWith('skyting')) {
    if (type === 'skyting_liggende') return 'skyting_ligg'
    if (type === 'skyting_staaende') return 'skyting_staa'
    return 'skyting_annet'
  }
  if (type === 'oppvarming') return 'oppvarming'
  if (type === 'nedjogg') return 'nedjogg'
  if (type === 'pause' || type === 'aktiv_pause') return 'pause'
  if (type === 'veksling') return 'veksling'
  if (type === 'annet') return 'annet'
  return bevegelsesform ? 'drag' : 'drag'
}

export function etikettFor(u: Utkast, alle: Utkast[]): string {
  if (u.navn.trim()) return u.navn.trim()
  const meta = ACTIVITY_TYPES.find(t => t.value === u.type)
  if (u.type === 'aktivitet') {
    const drag = alle.filter(x => x.type === 'aktivitet').sort((a, b) => a.startSek - b.startSek)
    if (drag.length > 1) return `Drag ${drag.findIndex(x => x.id === u.id) + 1}`
    return u.bevegelsesform || 'Aktivitet'
  }
  if (u.type === 'veksling') return u.bevegelsesform || 'Veksling'
  return meta?.label ?? u.type
}

// ── Paletten ─────────────────────────────────────────────────

export function Verktoypalett({
  sport, userHasBiathlon, valgtType, onVelg, valgtPunkt, onVelgPunkt, onDraStart,
}: {
  sport: Sport | null
  userHasBiathlon: boolean
  valgtType: ActivityType | null
  onVelg: (t: ActivityType | null) => void
  valgtPunkt: PunktVerktoy | null
  onVelgPunkt: (p: PunktVerktoy | null) => void
  /** Paletten er noe man DRAR fra (fasiten); klikk-og-plasser er snarveien
      ved siden av — begge ender i samme «legg inn her»-handling. */
  onDraStart: (verktoy: { slag: 'segment'; type: ActivityType } | { slag: 'punkt'; type: PunktVerktoy }, e: React.PointerEvent) => void
}) {
  // GENERERT FRA ACTIVITY_TYPES (regel 11) — aldri en håndskrevet liste
  // som kan gå ut av takt med draglista. Typer som ikke gir mening for
  // øktas idrett SKJULES (aldri deaktiveres).
  const relevant = (t: typeof ACTIVITY_TYPES[number]) => {
    if (t.legacy) return false
    if (t.biathlonOnly && !(userHasBiathlon || sport === 'biathlon')) return false
    return true
  }
  return (
    <div style={{
      border: '1px solid var(--line2)', borderRadius: 11, background: 'var(--flate-12-alt)',
      padding: '11px 12px', marginBottom: 12,
    }}>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.15em',
        fontSize: 10.5, color: 'var(--tekst-8-alt)', marginBottom: 8, textTransform: 'uppercase',
      }}>
        Legg inn på tidslinja — velg type, og klikk på kurven
      </p>
      <div className="flex gap-4 flex-wrap">
        {GRUPPER.map(g => {
          const typer = g.typer
            .map(v => ACTIVITY_TYPES.find(t => t.value === v))
            .filter((t): t is typeof ACTIVITY_TYPES[number] => !!t && relevant(t))
          if (typer.length === 0) return null
          return (
            <div key={g.navn} className="flex items-center gap-1.5 flex-wrap">
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--mut)',
              }}>
                {g.navn}
              </span>
              {typer.map(t => {
                const farge = SEGMENT_FARGER[segmentTypeFor(t.value, '')]
                const valgt = valgtType === t.value
                return (
                  <button key={t.value} type="button"
                    onClick={() => onVelg(valgt ? null : t.value)}
                    onPointerDown={e => onDraStart({ slag: 'segment', type: t.value }, e)}
                    aria-pressed={valgt}
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: valgt ? 'var(--tekst-1-app)' : farge,
                      background: valgt ? farge : 'none',
                      border: `1px solid ${farge}`, borderRadius: 999,
                      padding: '6px 12px', minHeight: 36, cursor: 'pointer',
                    }}>
                    {t.icon} {t.label}
                  </button>
                )
              })}
            </div>
          )
        })}
        {/* Punkt-verktøyene — ett tidspunkt, ingen varighet. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--mut)',
          }}>
            Punkter
          </span>
          {PUNKT_VERKTOY.map(v => {
            const valgt = valgtPunkt === v.id
            return (
              <button key={v.id} type="button"
                onClick={() => onVelgPunkt(valgt ? null : v.id)}
                onPointerDown={e => onDraStart({ slag: 'punkt', type: v.id }, e)}
                aria-pressed={valgt}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: valgt ? 'var(--tekst-1-app)' : v.farge,
                  background: valgt ? v.farge : 'none',
                  border: `1px solid ${v.farge}`, borderRadius: 999,
                  padding: '6px 12px', minHeight: 36, cursor: 'grab',
                }}>
                {v.ikon} {v.navn}
              </button>
            )
          })}
        </div>
      </div>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, color: 'var(--mut)', marginTop: 8 }}>
        {valgtType || valgtPunkt
          ? 'Klikk på kurven der det skal inn — eller dra verktøyet ned på kurven.'
          : 'Dra et verktøy ned på kurven (eller klikk det først, så kurven). Segmenter fyller tid og kan dras i begge ender · punkter settes på ett tidspunkt · alt kan legges inn enten klokka har runder eller ikke.'}
      </p>
    </div>
  )
}

// ── Segmentene på kurven ─────────────────────────────────────

export function SegmentLag({
  utkast, valgtId, h, totalSek, onVelg, onEndre, onGrense, palettAktiv = false,
}: {
  utkast: Utkast[]
  valgtId: string | null
  /** Når en palett-type er valgt slipper segmentene klikket gjennom, slik
      at man kan legge inn et nytt segment OPPÅ et eksisterende område. */
  palettAktiv?: boolean
  h: KurveHjelpere
  totalSek: number
  onVelg: (id: string | null) => void
  onEndre: (id: string, patch: { startSek?: number; varighetSek?: number }) => void
  /** Flytter grensen mellom to naboer — begge endres samtidig, aldri hull. */
  onGrense: (venstreId: string, hoyreId: string, sek: number) => void
}) {
  const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
  return (
    <>
      {sortert.map((u, i) => {
        const type = segmentTypeFor(u.type, u.bevegelsesform)
        const farge = SEGMENT_FARGER[type]
        const valgt = valgtId === u.id
        const andel = u.varighetSek / Math.max(1, h.tilSek - h.fraSek)
        const smalt = andel < 0.03
        const nabo = sortert[i + 1]
        const grenseTett = nabo && Math.abs((u.startSek + u.varighetSek) - nabo.startSek) < 1.5
        return (
          <span key={u.id}>
            <button type="button"
              onClick={e => { e.stopPropagation(); onVelg(valgt ? null : u.id) }}
              onPointerDown={e => {
                e.stopPropagation()
                const el = e.currentTarget
                el.setPointerCapture?.(e.pointerId)
                const startX = e.clientX
                const start0 = u.startSek
                const flytt = (ev: PointerEvent) => {
                  const r = el.parentElement?.getBoundingClientRect()
                  if (!r) return
                  const dSek = ((ev.clientX - startX) / Math.max(1, r.width)) * (h.tilSek - h.fraSek)
                  onEndre(u.id, { startSek: Math.max(0, Math.min(totalSek - u.varighetSek, start0 + dSek)) })
                }
                const slipp = () => {
                  el.removeEventListener('pointermove', flytt)
                  el.removeEventListener('pointerup', slipp)
                }
                el.addEventListener('pointermove', flytt)
                el.addEventListener('pointerup', slipp)
              }}
              aria-label={`${etikettFor(u, utkast)} ${fmtKlokkeSek(u.startSek)}–${fmtKlokkeSek(u.startSek + u.varighetSek)}`}
              style={{
                position: 'absolute', left: h.pct(u.startSek),
                width: `calc(${h.pct(h.fraSek + u.varighetSek)} - 1px)`, minWidth: 10,
                top: 6, bottom: 26, padding: 0, borderRadius: 6,
                zIndex: smalt ? 4 : 2,
                background: `${segmentBakgrunn(type)}`, opacity: valgt ? 0.34 : 0.18,
                border: `1.5px solid ${farge}`,
                boxShadow: valgt ? `0 0 0 2px ${farge}66` : 'none',
                cursor: 'grab', touchAction: 'none',
                pointerEvents: palettAktiv ? 'none' : 'auto',
              }}>
              <span style={{
                position: 'absolute', top: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: farge,
              }}>
                {smalt ? '' : etikettFor(u, utkast)}
              </span>
            </button>

            {/* Enderhåndtak (endrer bare dette segmentet) — kun når naboen
                ikke ligger inntil; ellers eier GRENSEHÅNDTAKET punktet. */}
            {!grenseTett && (
              <Handtak av={palettAktiv} farge={farge} venstre={false} sek={u.startSek + u.varighetSek} h={h}
                onDra={sek => onEndre(u.id, { varighetSek: Math.max(5, sek - u.startSek) })} />
            )}
            {i === 0 && (
              <Handtak av={palettAktiv} farge={farge} venstre sek={u.startSek} h={h}
                onDra={sek => {
                  const slutt = u.startSek + u.varighetSek
                  const ny = Math.max(0, Math.min(slutt - 5, sek))
                  onEndre(u.id, { startSek: ny, varighetSek: slutt - ny })
                }} />
            )}

            {/* GRENSEHÅNDTAK: flytter slutten på dette og starten på neste
                samtidig, så det aldri oppstår hull mellom to segmenter. */}
            {nabo && grenseTett && (
              <Handtak av={palettAktiv} farge="var(--tekst-1-app)" venstre={false} sek={nabo.startSek} h={h} grense
                onDra={sek => onGrense(u.id, nabo.id, sek)} />
            )}
          </span>
        )
      })}
    </>
  )
}

function Handtak({ farge, sek, h, onDra, venstre, grense = false, av = false }: {
  farge: string; sek: number; h: KurveHjelpere; venstre: boolean; grense?: boolean
  av?: boolean
  onDra: (sek: number) => void
}) {
  if (av) return null
  return (
    <span
      onPointerDown={e => {
        e.stopPropagation()
        const el = e.currentTarget
        el.setPointerCapture?.(e.pointerId)
        const flytt = (ev: PointerEvent) => {
          const r = el.parentElement?.parentElement?.getBoundingClientRect()
          if (!r) return
          const andel = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width)))
          onDra(h.sekFraAndel(andel))
        }
        const slipp = () => {
          el.removeEventListener('pointermove', flytt)
          el.removeEventListener('pointerup', slipp)
        }
        el.addEventListener('pointermove', flytt)
        el.addEventListener('pointerup', slipp)
      }}
      role="separator"
      aria-label={grense ? `Grense ved ${fmtKlokkeSek(sek)}` : `${venstre ? 'Start' : 'Slutt'} ved ${fmtKlokkeSek(sek)}`}
      style={{
        position: 'absolute', left: h.pct(sek), top: 0, bottom: 20,
        width: 36, transform: 'translateX(-50%)', zIndex: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'ew-resize', touchAction: 'none',
        pointerEvents: 'auto',
      }}>
      <span style={{
        width: grense ? 3 : 2, height: grense ? 30 : 22, borderRadius: 2,
        background: farge, opacity: grense ? 0.9 : 0.7,
      }} />
    </span>
  )
}

// ── Handlingsraden for valgt segment ─────────────────────────

export function SegmentHandlinger({
  valgt, alle, onDel, onSlaaSammen, onNavn, onType, onSlett, userHasBiathlon, sport,
}: {
  valgt: Utkast
  alle: Utkast[]
  onDel: () => void
  onSlaaSammen: (() => void) | null
  onNavn: (navn: string) => void
  onType: (t: ActivityType) => void
  onSlett: () => void
  userHasBiathlon: boolean
  sport: Sport | null
}) {
  const [navnAapent, setNavnAapent] = useState(false)
  const [utkastNavn, setUtkastNavn] = useState(valgt.navn)
  const knapp: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11.5,
    letterSpacing: '0.08em', textTransform: 'uppercase', background: 'none',
    border: '1px solid var(--line2)', color: 'var(--tekst-1-app)',
    borderRadius: 999, padding: '6px 12px', minHeight: 36, cursor: 'pointer',
  }
  return (
    <div className="mt-2 space-y-2">
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-5-app)' }}>
        Valgt: <b style={{ color: SEGMENT_FARGER[segmentTypeFor(valgt.type, valgt.bevegelsesform)] }}>
          {etikettFor(valgt, alle)}
        </b>
        {' · '}{fmtKlokkeSek(valgt.startSek)}–{fmtKlokkeSek(valgt.startSek + valgt.varighetSek)}
        {' · varighet '}<b>{fmtKlokkeSek(valgt.varighetSek)}</b>
      </p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" style={knapp} onClick={onDel}>Del segmentet her</button>
        {onSlaaSammen && <button type="button" style={knapp} onClick={onSlaaSammen}>Slå sammen med neste</button>}
        <button type="button" style={knapp} onClick={() => setNavnAapent(v => !v)}>Gi nytt navn</button>
        <select value={valgt.type}
          onChange={e => onType(e.target.value as ActivityType)}
          aria-label="Endre type"
          style={{ ...knapp, cursor: 'pointer', paddingRight: 8 }}>
          {ACTIVITY_TYPES.filter(t => !t.legacy && (!t.biathlonOnly || userHasBiathlon || sport === 'biathlon'))
            .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" style={{ ...knapp, color: '#E23A5A', borderColor: '#E23A5A55' }}
          onClick={onSlett}>
          Slett
        </button>
      </div>
      {navnAapent && (
        <div className="flex gap-2 items-center">
          <input value={utkastNavn} onChange={e => setUtkastNavn(e.target.value)}
            placeholder="F.eks. «Drag 1» eller «Motbakke»"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, minHeight: 36,
              background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)',
              borderRadius: 8, color: 'var(--tekst-1-app)', padding: '6px 10px', flex: 1,
            }} />
          <button type="button" style={knapp}
            onClick={() => { onNavn(utkastNavn); setNavnAapent(false) }}>
            Lagre navnet
          </button>
        </div>
      )}
    </div>
  )
}

export { STANDARD_LENGDE }
