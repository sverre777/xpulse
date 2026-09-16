'use client'

// STILLESTAND TIL PAUSE - fase D: knappen (Sverre 15. sep 2026).
//
// ÉN komponent, to monteringspunkter (regel 11): verktøylinja i Øktbyggeren
// og AKTIVITETER-kortet på økta. All gating, alle tekster og hele angre-
// flyten bor her - ikke to kopier som kan gli fra hverandre.
//
// VISES KUN når økta er klokkesynket OG har fartsdata. Ellers ingenting -
// ingen grå, død knapp (regel 20). Fartsdataene leses fra klokkedata-lageret
// som flatene alt har fylt, så gatingen koster ingen ny henting.
// Eksistenssjekken går gjennom fartProver() - samme funksjon som serveren
// bruker til å velge kilde, så knappen og handlingen er aldri uenige.
//
// ANGRE: radene kjennes igjen på auto_pause (fase 127), aldri på navnet.
// Utøveren kan døpe raden om uten at angre mister den, og en rad han selv
// har kalt «Stillestand» røres aldri.

import { useState } from 'react'
import { useKlokkedata } from '@/components/workout/useKlokkedata'
import { fartProver, stillestandRader } from '@/lib/stillestand'
import {
  forhandsvisStillestand, gjorStillestandTilPause, angreStillestandPauser,
} from '@/app/actions/stillestand'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'
import { Ikon } from '@/components/ui/ikoner'
import type { ActivityRow } from '@/lib/types'

const FONT = "'Barlow Condensed', sans-serif"

/** Ordrett fra Sverre 15. sep - hva som faktisk endrer seg, verifisert mot
    kartleggingen av uketimer og årsplan-framdrift. Ikke skriv om denne uten
    å sjekke regnemåtene på nytt. */
const FOLGER =
  'Timene på økta står. Ren treningstid går ned, og det slår gjennom i uke- og '
  + 'månedstallene, plan mot faktisk, og årsplan-framdriften.'

const PILL: React.CSSProperties = {
  fontFamily: FONT, fontWeight: 700, letterSpacing: '0.08em', fontSize: 12,
  textTransform: 'uppercase', borderRadius: 999, padding: '7px 14px',
  cursor: 'pointer', minHeight: 36, background: 'transparent', whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}

/** «12 min», «1t 05m» - samme korte form som resten av øktflatene. */
export function varighetKort(sek: number): string {
  const m = Math.round(sek / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}t ${String(m % 60).padStart(2, '0')}m`
}

export function StillestandKnapp({ workoutId, erKlokkeokt, rader, onEndret, kompakt = false }: {
  /** null = utkast som ikke er lagret: handlingen har ingen økt å skrive til. */
  workoutId: string | null
  /** workouts.imported_from || merged_source - økta kommer fra en klokke. */
  erKlokkeokt: boolean
  /** Radene slik flaten ser dem. Brukes bare til å telle våre egne pauser. */
  rader: ActivityRow[]
  /** Radene er endret i basen - flaten må hente dem inn på nytt. */
  onEndret: () => void | Promise<void>
  /** Mindre pille, til verktøylinja i byggeren. */
  kompakt?: boolean
}) {
  const [jobber, setJobber] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [visInfo, setVisInfo] = useState(false)
  const klokke = useKlokkedata(workoutId)

  const antallAuto = stillestandRader(rader).length
  const harFart = fartProver(klokke.data?.samples ?? null) != null

  // ══════════════════════════════════════════════════════════════════
  // SKJULT INNTIL SPLITTEN VIRKER (Sverre 16. sep 2026).
  //
  // Knappen lover i dialogen at ren treningstid går ned. Det gjør den
  // ikke. gjorStillestandTilPause LEGGER pause-raden OPPÅ aktiviteten i
  // stedet for å SPLITTE den, så radene summerer mer enn økta varte, og
  // computeActivityTotals - som summerer per rad og trekker fra pausen -
  // lander på samme tall som før.
  //
  // Målt med den ekte funksjonen: økt 3600 s, stopp 60 s.
  //   uten splitt   3600 -> 3600   (uendret)
  //   med splitt    3600 -> 3540   (som lovet)
  // Og den virker ikke når stoppet faller mellom to rader heller: den
  // tida var aldri talt som treningstid, så 3540 -> 3540.
  //
  // Prod hadde ÉN auto_pause-rad da dette ble funnet, og den var CCs egen
  // test - ingen ekte bruker mister noe på at knappen forsvinner.
  //
  // SKJULT ETT STED, med vilje: monteringspunktene i Oktbygger og
  // WorkoutOverview står urørt, og handlingen, angre-flyten og fase E
  // virker som før. Fjern denne ene linja når splitten er inne.
  // ══════════════════════════════════════════════════════════════════
  const SPLITT_VIRKER = false
  if (!SPLITT_VIRKER) return null

  // Ingenting å tilby: ikke tegn noe som helst.
  if (!workoutId || !erKlokkeokt) return null
  if (klokke.loading) return null
  if (!harFart && antallAuto === 0) return null
  // ØKT UTEN AKTIVITETSRADER: aldri. Uke- og månedstallene leser radene når
  // økta HAR rader, og faller tilbake til duration_minutes bare når den ikke
  // har noen (lib/calendar-summary). La vi pauser på en tom økt, ville den
  // gått fra «hele varigheten teller» til «bare pausene finnes» - altså nær
  // null treningstid. Rader først, så pauser.
  if (rader.length === 0 && antallAuto === 0) return null

  const kjor = async (f: () => Promise<unknown>) => {
    setJobber(true); setFeil(null)
    try { await f() } finally { setJobber(false) }
  }

  const lagPauser = () => kjor(async () => {
    const f = await forhandsvisStillestand(workoutId)
    if ('error' in f) { setFeil(f.error); return }

    if (f.antall === 0) {
      await xpAlert(
        'Ingen stillestand funnet',
        f.hoppetOverSkyting > 0
          ? `Klokka har trolig auto-pause på. ${f.hoppetOverSkyting} ${f.hoppetOverSkyting === 1 ? 'periode lå' : 'perioder lå'} på standplass, og den tida er allerede utenfor treningstida.`
          : 'Klokka har trolig auto-pause på.',
      )
      return
    }

    const skyting = f.hoppetOverSkyting > 0
      ? `\n\n${f.hoppetOverSkyting} ${f.hoppetOverSkyting === 1 ? 'periode ligger' : 'perioder ligger'} på standplass og hoppes over - den tida er allerede utenfor treningstida.`
      : ''
    const ok = await xpConfirm({
      title: `Fant ${f.antall} ${f.antall === 1 ? 'periode' : 'perioder'}, til sammen ${varighetKort(f.sumSek)}.`,
      body: `${FOLGER}${skyting}\n\nDu kan angre, og du kan endre en rad til aktiv pause hvis du var i bevegelse.`,
      confirmLabel: 'Lag pausene',
    })
    if (!ok) return

    const r = await gjorStillestandTilPause(workoutId)
    if ('error' in r) { setFeil(r.error); return }
    await onEndret()
  })

  const angre = () => kjor(async () => {
    const r = await angreStillestandPauser(workoutId)
    if ('error' in r) { setFeil(r.error); return }
    await onEndret()
  })

  const pilleStil: React.CSSProperties = kompakt
    ? { ...PILL, fontSize: 11.5, padding: '5px 12px', minHeight: 30 }
    : PILL

  return (
    <span data-stillestand style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
      {antallAuto > 0 ? (
        <>
          <span style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Ikon navn="pause" variant="strek" storrelse={14} />
            {antallAuto} {antallAuto === 1 ? 'periode' : 'perioder'} gjort om til pause
          </span>
          <button type="button" disabled={jobber} onClick={angre} data-stillestand-angre
            style={{ ...pilleStil, border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)', opacity: jobber ? 0.5 : 1 }}>
            <Ikon navn="angre" variant="strek" storrelse={14} />Angre
          </button>
        </>
      ) : (
        <button type="button" disabled={jobber} onClick={lagPauser} data-stillestand-kjor
          style={{ ...pilleStil, border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)', opacity: jobber ? 0.5 : 1 }}>
          <Ikon navn="pause" variant="strek" storrelse={14} />
          {jobber ? 'Regner ...' : 'Gjør stillestand til pause'}
        </button>
      )}

      <InfoBoble apen={visInfo} onApen={setVisInfo} />

      {feil && (
        <span role="alert" style={{ fontFamily: FONT, fontSize: 12.5, color: '#E23A5A' }}>{feil}</span>
      )}
    </span>
  )
}

/**
 * Hva er forskjellen? (Sverre: «litt info på forskjellene», på hover.)
 *
 * Åpner på peker OG på klikk - på touch finnes ingen hover, og da ville
 * ikonet vært et pyntemerke.
 */
function InfoBoble({ apen, onApen }: { apen: boolean; onApen: (v: boolean) => void }) {
  // Bobla ligger inne i en <span>, så radene er block-spans - ikke <p>.
  const rad = (tittel: string, tekst: string, sist = false) => (
    <span style={{ display: 'block', marginBottom: sist ? 0 : 8, fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5, color: 'var(--tekst-5-app)' }}>
      <span style={{ color: 'var(--tekst-1-app)', fontWeight: 700, letterSpacing: '0.06em' }}>{tittel}</span>{' - '}{tekst}
    </span>
  )
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => onApen(true)} onMouseLeave={() => onApen(false)}>
      <button type="button" data-stillestand-info aria-label="Hva er forskjellen på elapsed, pause og aktiv pause?"
        aria-expanded={apen} onClick={() => onApen(!apen)}
        style={{ background: 'none', border: 'none', padding: 2, cursor: 'help', color: 'var(--tekst-8-app)', display: 'inline-flex' }}>
        <Ikon navn="hjelp" variant="strek" storrelse={14} />
      </button>
      {apen && (
        <span role="tooltip" style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          width: 'min(300px, 78vw)', zIndex: 420, background: 'var(--card)',
          border: '1px solid var(--line2)', borderRadius: 10, padding: '12px 14px',
          boxShadow: '0 10px 28px var(--scrim-40, rgba(0,0,0,0.35))', display: 'block',
        }}>
          {rad('Elapsed', 'klokka ble stoppet og startet igjen. Den tida finnes ikke i opptaket, og regnes aldri inn i totaltid.')}
          {rad('Stillestand', 'klokka gikk, men du sto stille. Det er dette knappen finner.')}
          {rad('Pause', 'teller ikke som treningstid.')}
          {rad('Aktiv pause', 'teller MED. Gikk du rundt og ventet, endrer du raden til aktiv pause, og tida er med igjen.', true)}
        </span>
      )}
    </span>
  )
}
