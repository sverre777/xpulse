'use client'

// Perioder redigeres DER man planlegger (Sverre 14. sep 2026).
//
// Periodestripen i plan og dagbok er nå en inngang: klikk på en periode
// åpner årsplanens egen popup i redigering, og klikk på den grå stiplede
// «+ legg til periode» spør først om det er en SAMLING/HØYDE eller en
// PERIODE - og åpner så nøyaktig samme popup som årsplanen bruker.
//
// ÉN KILDE: det finnes ingen egen skjema- eller lagringsvei her. PeriodModal
// og MarkingModal er de samme komponentene som components/periodization
// bruker, og de skriver gjennom createPeriod/updatePeriod og
// createMarking/updateMarking som før. Denne fila gjør bare to ting: holder
// rede på hva som er åpent, og gir kalenderen en kontekst å kalle inn i.

import { createContext, useContext, useState } from 'react'
import type { Season, SeasonPeriod } from '@/app/actions/seasons'
import { PeriodModal } from '@/components/periodization/PeriodModal'
import { MarkingModal } from '@/components/periodization/MarkingModal'
import { Ikon } from '@/components/ui/ikoner'
import { MARKERING_IKON, MARKERING_FARGE } from '@/lib/nokkeldato-ikoner'

interface PeriodeKontekst {
  /** Falsk når det ikke finnes sesong, eller når visningen er read-only. */
  kanRedigere: boolean
  apnePeriode: (p: SeasonPeriod) => void
  apneNy: (fraISO: string, tilISO: string) => void
}

const K = createContext<PeriodeKontekst>({ kanRedigere: false, apnePeriode: () => {}, apneNy: () => {} })

export function usePeriodeRedigering(): PeriodeKontekst {
  return useContext(K)
}

const FONT = "'Barlow Condensed', sans-serif"

type Apen =
  | { slag: 'velg'; fra: string; til: string }
  | { slag: 'periode'; fra: string; til: string; rediger: SeasonPeriod | null }
  | { slag: 'markering'; fra: string; til: string }
  | null

export function PeriodeRedigeringProvider({ season, readOnly = false, targetUserId, children }: {
  season: Season | null
  readOnly?: boolean
  targetUserId?: string
  children: React.ReactNode
}) {
  const [apen, setApen] = useState<Apen>(null)
  const kanRedigere = !!season && !readOnly
  const verdi: PeriodeKontekst = {
    kanRedigere,
    apnePeriode: p => { if (kanRedigere) setApen({ slag: 'periode', fra: p.start_date, til: p.end_date, rediger: p }) },
    apneNy: (fra, til) => { if (kanRedigere) setApen({ slag: 'velg', fra, til }) },
  }

  return (
    <K.Provider value={verdi}>
      {children}
      {season && apen?.slag === 'velg' && (
        <Velger fra={apen.fra} til={apen.til}
          onPeriode={() => setApen({ slag: 'periode', fra: apen.fra, til: apen.til, rediger: null })}
          onMarkering={() => setApen({ slag: 'markering', fra: apen.fra, til: apen.til })}
          onLukk={() => setApen(null)} />
      )}
      {season && apen?.slag === 'periode' && (
        <PeriodModal open onClose={() => setApen(null)}
          seasonId={season.id} seasonStart={season.start_date} seasonEnd={season.end_date}
          initialStart={apen.fra} initialEnd={apen.til}
          editing={apen.rediger} targetUserId={targetUserId} />
      )}
      {season && apen?.slag === 'markering' && (
        <MarkingModal open onClose={() => setApen(null)}
          seasonId={season.id} seasonStart={season.start_date} seasonEnd={season.end_date}
          initialStart={apen.fra} initialEnd={apen.til} targetUserId={targetUserId} />
      )}
    </K.Provider>
  )
}

/** Steget før popupen: samling/høyde eller periode? */
function Velger({ fra, til, onPeriode, onMarkering, onLukk }: {
  fra: string; til: string
  onPeriode: () => void
  onMarkering: () => void
  onLukk: () => void
}) {
  const knapp: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    fontFamily: FONT, fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase',
    padding: '14px 16px', borderRadius: 999, cursor: 'pointer',
    background: 'none', border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)',
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Legg til i årsplanen" onClick={onLukk}
      data-periode-velger
      style={{
        position: 'fixed', inset: 0, zIndex: 130, background: 'var(--scrim-70)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 420 }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ width: 20, height: 2, background: 'var(--accent)', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.08em' }}>
            Legg til
          </h2>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-8-app)', margin: '0 0 16px' }}>
          {fra === til ? fra : `${fra} - ${til}`}
        </p>
        <div className="flex flex-col gap-2.5">
          <button type="button" onClick={onMarkering} data-velg-markering style={knapp}>
            <Ikon navn={MARKERING_IKON.samling} variant="fyll" storrelse={18} style={{ color: MARKERING_FARGE.samling }} />
            <Ikon navn={MARKERING_IKON.hoyde} variant="fyll" storrelse={18} style={{ color: MARKERING_FARGE.hoyde }} />
            Samling / høyde
          </button>
          <button type="button" onClick={onPeriode} data-velg-periode style={knapp}>
            <Ikon navn="arsplan" variant="strek" storrelse={18} style={{ color: 'var(--accent)' }} />
            Periode
          </button>
        </div>
        <div className="flex justify-end mt-4">
          <button type="button" onClick={onLukk} className="xp-pill xp-pill-ghost xp-pill-sm">Avbryt</button>
        </div>
      </div>
    </div>
  )
}
