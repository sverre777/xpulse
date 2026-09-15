'use client'

// Perioder og samlinger redigeres DER man planlegger (Sverre 14.-15. sep 2026).
//
// ÉN modal for samling/høyde (MarkingModal) og én for perioder (PeriodModal) -
// de samme som årsplanen bruker, uten egen skjema- eller lagringsvei her.
// Dag-popupens SAMLING-knapp, periodestripens «+ legg til periode» og klikk på
// en periode/markering går alle gjennom denne provideren.
//
// SESONGEN VELGES PER DATO, ikke én gang for hele kalenderen: samme oppslag
// som createMarkingForDates gjør på serveren (getActiveSeason(dato)). Dekker
// ingen sesong datoen, sier vi det - «Ingen sesong dekker 21. september» - og
// tilbyr å opprette sesongen med datoene ferdig utfylt. Etterpå står man der
// man var, med utkastet intakt.

import { createContext, useContext, useState } from 'react'
import { getActiveSeason, type Season, type SeasonMarking, type SeasonPeriod } from '@/app/actions/seasons'
import { PeriodModal } from '@/components/periodization/PeriodModal'
import { MarkingModal, sesongDatoerFor } from '@/components/periodization/MarkingModal'
import { SeasonModal } from '@/components/periodization/SeasonModal'
import { Ikon } from '@/components/ui/ikoner'
import { MARKERING_IKON, MARKERING_FARGE } from '@/lib/nokkeldato-ikoner'

interface PeriodeKontekst {
  /** Falsk uten årsplan-rett eller i read-only-visning. */
  kanRedigere: boolean
  /** «+ legg til periode»: spør først samling/høyde eller periode. */
  apneNy: (fraISO: string, tilISO: string) => void
  apnePeriode: (p: SeasonPeriod) => void
  /** SAMLING-knappen i dag-popupen: rett til samling/høyde-modalen. */
  apneMarkering: (fraISO: string, tilISO: string) => void
  apneMarkeringRediger: (m: SeasonMarking) => void
}

const K = createContext<PeriodeKontekst>({
  kanRedigere: false, apneNy: () => {}, apnePeriode: () => {}, apneMarkering: () => {}, apneMarkeringRediger: () => {},
})

export function usePeriodeRedigering(): PeriodeKontekst {
  return useContext(K)
}

const FONT = "'Barlow Condensed', sans-serif"

type Apen =
  | { slag: 'velg'; fra: string; til: string }
  | { slag: 'periode'; fra: string; til: string; sesong: Season | null; rediger: SeasonPeriod | null }
  | { slag: 'markering'; fra: string; til: string; sesong: Season | null; rediger: SeasonMarking | null }
  | { slag: 'ingen-sesong'; fra: string; til: string; neste: 'periode' | 'markering' }
  | null

export function PeriodeRedigeringProvider({ kanRedigere, targetUserId, children }: {
  kanRedigere: boolean
  targetUserId?: string
  children: React.ReactNode
}) {
  const [apen, setApen] = useState<Apen>(null)
  const [nySesong, setNySesong] = useState<{ fra: string; til: string; neste: 'periode' | 'markering' } | null>(null)
  const [henter, setHenter] = useState(false)

  /** Sesongen som dekker datoen - samme oppslag som serveren gjør ved lagring. */
  const finnSesong = async (fra: string): Promise<Season | null> => {
    setHenter(true)
    try {
      const s = await getActiveSeason(fra, targetUserId)
      return s && !('error' in s) ? s : null
    } finally { setHenter(false) }
  }

  const gaaTil = async (neste: 'periode' | 'markering', fra: string, til: string) => {
    const sesong = await finnSesong(fra)
    // Markeringen kan la serveren finne sesongen selv; perioden trenger den nå.
    if (!sesong && neste === 'periode') { setApen({ slag: 'ingen-sesong', fra, til, neste }); return }
    setApen({ slag: neste, fra, til, sesong, rediger: null })
  }

  const verdi: PeriodeKontekst = {
    kanRedigere,
    apneNy: (fra, til) => { if (kanRedigere) setApen({ slag: 'velg', fra, til }) },
    apnePeriode: p => { if (kanRedigere) setApen({ slag: 'periode', fra: p.start_date, til: p.end_date, sesong: null, rediger: p }) },
    apneMarkering: (fra, til) => { if (kanRedigere) void gaaTil('markering', fra, til) },
    apneMarkeringRediger: m => { if (kanRedigere) setApen({ slag: 'markering', fra: m.start_date, til: m.end_date, sesong: null, rediger: m }) },
  }

  const sesongIdFor = (a: Extract<Apen, { slag: 'periode' }>) => a.rediger?.season_id ?? a.sesong?.id ?? ''
  const opprettSesong = (fra: string, til: string, neste: 'periode' | 'markering') => setNySesong({ fra, til, neste })

  return (
    <K.Provider value={verdi}>
      {children}
      {henter && <div data-periode-henter aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 129, pointerEvents: 'none' }} />}
      {apen?.slag === 'velg' && (
        <Velger fra={apen.fra} til={apen.til}
          onPeriode={() => void gaaTil('periode', apen.fra, apen.til)}
          onMarkering={() => void gaaTil('markering', apen.fra, apen.til)}
          onLukk={() => setApen(null)} />
      )}
      {apen?.slag === 'periode' && (
        <PeriodModal open onClose={() => setApen(null)}
          key={apen.rediger?.id ?? `ny-${apen.fra}`}
          seasonId={sesongIdFor(apen)}
          seasonStart={apen.sesong?.start_date ?? apen.rediger?.start_date ?? apen.fra}
          seasonEnd={apen.sesong?.end_date ?? apen.rediger?.end_date ?? apen.til}
          initialStart={apen.fra} initialEnd={apen.til}
          editing={apen.rediger} targetUserId={targetUserId} />
      )}
      {apen?.slag === 'markering' && (
        <MarkingModal open onClose={() => setApen(null)}
          key={apen.rediger?.id ?? `ny-${apen.fra}`}
          seasonId={apen.sesong?.id ?? null}
          seasonStart={apen.sesong?.start_date} seasonEnd={apen.sesong?.end_date}
          initialStart={apen.fra} initialEnd={apen.til}
          editing={apen.rediger} targetUserId={targetUserId}
          onIngenSesong={(fra, til) => opprettSesong(fra, til, 'markering')} />
      )}
      {apen?.slag === 'ingen-sesong' && (
        <IngenSesong fra={apen.fra} til={apen.til}
          onOpprett={() => opprettSesong(apen.fra, apen.til, apen.neste)}
          onLukk={() => setApen(null)} />
      )}
      {nySesong && (() => {
        const forslag = sesongDatoerFor(nySesong.fra)
        return (
          <SeasonModal open targetUserId={targetUserId}
            initialName={forslag.navn} initialStart={forslag.start} initialEnd={forslag.end}
            onClose={() => setNySesong(null)}
            // Tilbake dit man var: perioden får den nye sesongen; markeringen
            // ligger fortsatt åpen under med utkastet intakt.
            onCreated={() => {
              const { fra, til, neste } = nySesong
              setNySesong(null)
              if (neste === 'periode' || apen?.slag !== 'markering') void gaaTil(neste, fra, til)
            }} />
        )
      })()}
    </K.Provider>
  )
}

function Ramme({ tittel, onLukk, children, dataAttr }: { tittel: string; onLukk: () => void; children: React.ReactNode; dataAttr: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={tittel} onClick={onLukk} {...{ [dataAttr]: true }}
      style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'var(--scrim-70)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 420 }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ width: 20, height: 2, background: 'var(--accent)', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.08em' }}>{tittel}</h2>
        </div>
        {children}
      </div>
    </div>
  )
}

const datoNO = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })

/** Steget før popupen: samling/høyde eller periode? */
function Velger({ fra, til, onPeriode, onMarkering, onLukk }: {
  fra: string; til: string; onPeriode: () => void; onMarkering: () => void; onLukk: () => void
}) {
  const knapp: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    fontFamily: FONT, fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase',
    padding: '14px 16px', borderRadius: 999, cursor: 'pointer',
    background: 'none', border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)',
  }
  return (
    <Ramme tittel="Legg til" onLukk={onLukk} dataAttr="data-periode-velger">
      <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-8-app)', margin: '0 0 16px' }}>
        {fra === til ? datoNO(fra) : `${datoNO(fra)} - ${datoNO(til)}`}
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
    </Ramme>
  )
}

/** Ingen sesong dekker datoen - tilby å opprette den, med datoene ferdig utfylt. */
function IngenSesong({ fra, til, onOpprett, onLukk }: { fra: string; til: string; onOpprett: () => void; onLukk: () => void }) {
  const forslag = sesongDatoerFor(fra)
  return (
    <Ramme tittel="Ingen sesong" onLukk={onLukk} dataAttr="data-ingen-sesong-dialog">
      <p role="alert" style={{ fontFamily: FONT, fontSize: 15, color: 'var(--tekst-1-app)', margin: '0 0 6px' }}>
        Ingen sesong dekker {fra === til ? datoNO(fra) : `${datoNO(fra)} - ${datoNO(til)}`}.
      </p>
      <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-8-app)', margin: '0 0 16px' }}>
        Perioder og samlinger hører til en sesong i årsplanen. Opprett sesongen først - så kommer du rett tilbake hit.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onLukk} className="xp-pill xp-pill-ghost xp-pill-sm">Avbryt</button>
        <button type="button" onClick={onOpprett} data-opprett-sesong className="xp-pill xp-pill-primary xp-pill-sm">
          Opprett sesong {forslag.navn.replace('Sesong ', '')}
        </button>
      </div>
    </Ramme>
  )
}
