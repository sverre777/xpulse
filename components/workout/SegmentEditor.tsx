'use client'

import { useState } from 'react'
import { ACTIVITY_TYPES, MOVEMENT_CATEGORIES, type ActivityType, type Sport } from '@/lib/types'
import { SEGMENT_FARGER, fmtKlokkeSek } from '@/lib/segmenter'
import {
  KORTINTERVALL_HURTIGVALG, antallRepetisjoner, kortintervallEtikett,
  harMonster, type Kortintervall,
} from '@/lib/intervall-monstre'
import { segmentTypeFor, etikettFor, type Utkast } from './TidslinjeRedigering'

// Segment-editoren (Øktbyggeren bolk 2). Klikker man et segment — på
// lerretet ELLER på raden — åpnes alle feltene her.
//
// TRE LERRET, SAMME FLATE: med klokke viser feltene det MÅLTE og kan
// overstyres (manuelt vinner og merkes M — konvensjonen); uten klokke ER
// de førte tallene kilden; i plan er de planlagte verdiene. Felter som
// ikke gir mening står TOMME med forklaring — aldri skjult, så flaten ser
// lik ut i alle tre lerret.

export interface SegmentFelter {
  distanseKm: string
  snittpuls: string
  makspuls: string
  sone: string
  beskrivelse: string
  bevegelsesform: string
  /** null = av. Frie sekundverdier, ikke en lukket liste. */
  kortintervall: Kortintervall | null
}

const SONER = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8'] as const

export function SegmentEditor({
  segment, alle, felter, maalt, sport, userHasBiathlon,
  onFelt, onTid, onType, onNavn, onDelIRepetisjoner,
}: {
  segment: Utkast
  alle: Utkast[]
  felter: SegmentFelter
  /** Verdier lest fra klokka for dette vinduet (null uten klokkedata). */
  maalt: { snittpuls: number | null; makspuls: number | null; distanseKm: number | null } | null
  sport: Sport | null
  userHasBiathlon: boolean
  onFelt: (patch: Partial<SegmentFelter>) => void
  onTid: (patch: { startSek?: number; varighetSek?: number }) => void
  onType: (t: ActivityType) => void
  onNavn: (navn: string) => void
  /** Deler segmentet i repetisjoner etter mønsteret (bærer gruppe_id). */
  onDelIRepetisjoner: (m: Kortintervall) => void
}) {
  const [kortPaa, setKortPaa] = useState(felter.kortintervall ? String(felter.kortintervall.paaSek) : '')
  const [kortAv, setKortAv] = useState(felter.kortintervall ? String(felter.kortintervall.avSek) : '')
  const farge = SEGMENT_FARGER[segmentTypeFor(segment.type, segment.bevegelsesform)]
  const erSkyting = segment.type.startsWith('skyting')
  const erHvile = segment.type === 'pause' || segment.type === 'aktiv_pause' || segment.type === 'veksling'

  const monster: Kortintervall | null =
    Number(kortPaa) > 0 ? { paaSek: Number(kortPaa) || 0, avSek: Number(kortAv) || 0 } : null

  return (
    <div className="mt-2 space-y-3" style={{
      border: `1px solid ${farge}55`, borderLeft: `3px solid ${farge}`,
      borderRadius: 10, padding: '12px 14px', background: 'var(--flate-12-alt)',
    }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-5-app)' }}>
        <b style={{ color: farge }}>{etikettFor(segment, alle)}</b>
        {' · '}{fmtKlokkeSek(segment.startSek)}–{fmtKlokkeSek(segment.startSek + segment.varighetSek)}
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Felt navn="Start">
          <TidFelt sek={segment.startSek} onSek={s => onTid({ startSek: s })} />
        </Felt>
        <Felt navn="Varighet">
          <TidFelt sek={segment.varighetSek} onSek={s => onTid({ varighetSek: s })} />
        </Felt>
        <Felt navn="Distanse (km)"
          tom={erHvile || erSkyting ? 'gjelder ikke for denne typen' : undefined}>
          <TallFelt verdi={felter.distanseKm} plassholder={maalt?.distanseKm != null ? String(maalt.distanseKm) : '—'}
            maalt={maalt?.distanseKm != null} onEndre={v => onFelt({ distanseKm: v })} />
        </Felt>
        <Felt navn="Snittpuls">
          <TallFelt verdi={felter.snittpuls}
            plassholder={maalt?.snittpuls != null ? String(maalt.snittpuls) : (segment.arvetPuls?.snitt || '—')}
            maalt={maalt?.snittpuls != null}
            arvet={maalt?.snittpuls == null && !!segment.arvetPuls?.snitt}
            onEndre={v => onFelt({ snittpuls: v })} />
        </Felt>
        <Felt navn="Makspuls">
          <TallFelt verdi={felter.makspuls}
            plassholder={maalt?.makspuls != null ? String(maalt.makspuls) : (segment.arvetPuls?.maks || '—')}
            maalt={maalt?.makspuls != null}
            arvet={maalt?.makspuls == null && !!segment.arvetPuls?.maks}
            onEndre={v => onFelt({ makspuls: v })} />
        </Felt>
        <Felt navn="Sone" tom={erHvile ? 'hvile har ingen sone' : undefined}>
          <select value={felter.sone} onChange={e => onFelt({ sone: e.target.value })}
            style={inputStil}>
            <option value="">—</option>
            {SONER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Felt>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Felt navn="Navn" bred>
          <input value={segment.navn} onChange={e => onNavn(e.target.value)}
            placeholder={etikettFor(segment, alle)} style={{ ...inputStil, width: 170 }} />
        </Felt>
        <Felt navn="Type">
          <select value={segment.type} onChange={e => onType(e.target.value as ActivityType)}
            style={inputStil}>
            {ACTIVITY_TYPES.filter(t => !t.legacy && (!t.biathlonOnly || userHasBiathlon || sport === 'biathlon'))
              .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Felt>
        <Felt navn="Bevegelsesform" tom={erSkyting ? 'skyting har ingen bevegelsesform' : undefined}>
          <select value={felter.bevegelsesform} onChange={e => onFelt({ bevegelsesform: e.target.value })}
            style={inputStil}>
            <option value="">—</option>
            {MOVEMENT_CATEGORIES.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </Felt>
      </div>

      <Felt navn="Beskrivelse" bred>
        <input value={felter.beskrivelse} onChange={e => onFelt({ beskrivelse: e.target.value })}
          placeholder="F.eks. «motbakke, kontrollert»"
          style={{ ...inputStil, width: '100%', textAlign: 'left', padding: '8px 10px' }} />
      </Felt>

      {/* KORTINTERVALLER — frie sekundfelter, ALLTID synlige. */}
      <div className="space-y-1.5" style={{ borderTop: '1px solid var(--kant-3)', paddingTop: 10 }}>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: 'var(--tekst-8-alt)',
        }}>
          Kortintervaller inni draget
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={kortPaa} onChange={e => setKortPaa(e.target.value)} inputMode="numeric"
            placeholder="på (s)" aria-label="Arbeid i sekunder" style={{ ...inputStil, width: 72 }} />
          <span style={{ color: 'var(--tekst-8-alt)' }}>/</span>
          <input value={kortAv} onChange={e => setKortAv(e.target.value)} inputMode="numeric"
            placeholder="av (s)" aria-label="Pause i sekunder" style={{ ...inputStil, width: 72 }} />
          {KORTINTERVALL_HURTIGVALG.map(h => (
            <button key={h.etikett} type="button"
              onClick={() => { setKortPaa(String(h.verdi.paaSek)); setKortAv(String(h.verdi.avSek)) }}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, fontWeight: 700,
                color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--kant-3)',
                borderRadius: 999, padding: '5px 10px', minHeight: 32, cursor: 'pointer',
              }}>
              {h.etikett}
            </button>
          ))}
          <button type="button"
            onClick={() => { setKortPaa(''); setKortAv('') }}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, fontWeight: 700,
              color: 'var(--tekst-8-alt)', background: 'none', border: '1px solid var(--kant-3)',
              borderRadius: 999, padding: '5px 10px', minHeight: 32, cursor: 'pointer',
            }}>
            Av
          </button>
        </div>
        {harMonster(monster) && (
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-5-app)' }}>
              Blir <b style={{ color: 'var(--tekst-1-app)' }}>{kortintervallEtikett(segment.varighetSek, monster)}</b>
              {' — lengden bestemmer antallet'}
            </span>
            <button type="button"
              disabled={antallRepetisjoner(segment.varighetSek, monster) < 1}
              onClick={() => onDelIRepetisjoner(monster)}
              className="xp-pill xp-pill-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
              Del draget i repetisjoner
            </button>
          </div>
        )}
        {/* Hurtigvalgene er snarveier — feltene tar hvilke som helst tall. */}
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, color: 'var(--tekst-8-alt)' }}>
          Feltene tar hvilke som helst sekundverdier (37/23, 90/30) — knappene fyller dem bare inn.
        </p>
      </div>
    </div>
  )
}

const inputStil: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, minHeight: 36,
  background: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderRadius: 6,
  color: 'var(--tekst-1-app)', padding: '6px 8px', textAlign: 'center', width: 96,
}

function Felt({ navn, children, tom, bred = false }: {
  navn: string; children: React.ReactNode; tom?: string; bred?: boolean
}) {
  return (
    <label className={bred ? 'w-full' : ''} style={{ display: 'block' }}>
      <span style={{
        display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', marginBottom: 3,
      }}>
        {navn}
      </span>
      {/* Feltet står TOMT med forklaring i stedet for å forsvinne — flaten
          skal se lik ut i alle tre lerret. */}
      {tom
        ? <span style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 36, fontSize: 12,
            fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)',
          }}>— {tom}</span>
        : children}
    </label>
  )
}

function TidFelt({ sek, onSek }: { sek: number; onSek: (s: number) => void }) {
  const [tekst, setTekst] = useState<string | null>(null)
  const bruk = () => {
    if (tekst == null) return
    const d = tekst.trim().split(':').map(Number)
    if (d.length >= 2 && d.every(x => Number.isFinite(x) && x >= 0)) {
      onSek(d.length === 3 ? d[0] * 3600 + d[1] * 60 + d[2] : d[0] * 60 + d[1])
    }
    setTekst(null)
  }
  return (
    <input type="text" inputMode="numeric" value={tekst ?? fmtKlokkeSek(sek)}
      onFocus={e => { setTekst(fmtKlokkeSek(sek)); e.currentTarget.select() }}
      onChange={e => setTekst(e.target.value)} onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      style={{ ...inputStil, width: 78 }} />
  )
}

/** Måltverdi vises som plassholder; skriver brukeren, merkes det M. */
function TallFelt({ verdi, plassholder, maalt, arvet = false, onEndre }: {
  verdi: string; plassholder: string; maalt: boolean
  /** Plassholderen kommer fra DRAGET, ikke fra klokka: den vises grå og
      får aldri MÅLT-merket. Et hint om hva draget var — ikke et tall som
      utgir seg for å være målt på denne repetisjonen. */
  arvet?: boolean
  onEndre: (v: string) => void
}) {
  const overstyrt = verdi.trim() !== ''
  return (
    <span className="inline-flex items-center gap-1">
      <input value={verdi} onChange={e => onEndre(e.target.value)} inputMode="decimal"
        placeholder={plassholder}
        title={arvet ? 'Dragets snitt — vises som hint, lagres ikke' : undefined}
        style={{ ...inputStil, width: 78 }} />
      {overstyrt
        ? <span title="Manuelt ført — vinner over det målte" style={merke('#E8B93C')}>M</span>
        : maalt
          ? <span title="Lest fra klokka" style={merke('#1A6FD4')}>MÅLT</span>
          : null}
    </span>
  )
}

function merke(farge: string): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
    fontSize: 10, color: farge, border: `1px solid ${farge}88`, borderRadius: 5,
    padding: '2px 5px', flexShrink: 0,
  }
}
