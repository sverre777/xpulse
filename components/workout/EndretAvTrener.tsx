'use client'

// «ENDRET AV ERIK JØRSTAD 3. MARS» - med lenke til hva (Sverre 16. sep 2026).
//
// En utøver som finner endrede tall uten å vite hvem som endret dem, mister
// tilliten til hele dagboka. Derfor står det PÅ økta, ikke gjemt i en logg
// han må lete etter - og samme prinsipp som angre-raden i fase E: aldri
// stille.
//
// TO FELT SOM LIGNER, MEN ER ULIKE:
//   created_by_coach_id        treneren OPPRETTET økta -> TrenerChip
//   sist_endret_av_trener_id   treneren RETTET i utøverens egen økt
// En økt utøveren laget selv og treneren siden rettet i, har bare den siste.
// TrenerChip kan IKKE erstatte denne: saveWorkout overskriver
// created_by_coach_id hver gang en trener lagrer, så chipens «lagt inn av»
// kan stå på en økt utøveren selv laget. Denne linja er den presise.
//
// Detaljene ligger i coach_audit_log, som utøveren allerede har leserett til
// («Athlete reads own logs», fase 26). Lenka henter dem ved klikk - ikke ved
// hver visning av en økt.

import { useState } from 'react'
import { hentEndringer } from '@/app/actions/endringer'
import { Ikon } from '@/components/ui/ikoner'

const FONT = "'Barlow Condensed', sans-serif"
const TRENER_BLAA = '#1A6FD4'

const datoNO = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
}

interface Linje { navn: string; fra: string | null; til: string | null }

export function EndretAvTrener({ workoutId, navn, nar }: {
  workoutId: string | null
  navn: string | null | undefined
  nar: string | null | undefined
}) {
  const [apen, setApen] = useState(false)
  const [linjer, setLinjer] = useState<Linje[] | null>(null)
  const [henter, setHenter] = useState(false)

  if (!nar) return null

  const vis = async () => {
    if (apen) { setApen(false); return }
    setApen(true)
    if (linjer || !workoutId) return
    setHenter(true)
    const r = await hentEndringer(workoutId).catch(() => null)
    setHenter(false)
    setLinjer(r && !('error' in r) ? r.endringer : [])
  }

  // Navnet står alltid. Spørsmålet utøveren har er «hvem rørte økta mi?»,
  // og et svar uten navn er ikke et svar.
  const hvem = ` av ${navn?.trim() || 'treneren din'}`
  return (
    <span data-endret-av-trener style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
      <span style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-app)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Ikon navn="trener" variant="strek" storrelse={14} style={{ color: TRENER_BLAA }} />
        Endret{hvem} {datoNO(nar)}
      </span>
      <button type="button" onClick={vis} data-endret-hva aria-expanded={apen}
        style={{
          fontFamily: FONT, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'none', border: 'none', padding: '4px 2px', minHeight: 24,
          color: TRENER_BLAA, cursor: 'pointer', textDecoration: 'underline',
        }}>
        {apen ? 'Skjul' : 'Hva ble endret?'}
      </button>
      {apen && (
        <span role="region" aria-label="Hva treneren endret" style={{
          flexBasis: '100%', display: 'block', marginTop: 4, padding: '10px 12px',
          border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--flate-12-alt)',
        }}>
          {henter && <span style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-app)' }}>Henter ...</span>}
          {!henter && linjer?.length === 0 && (
            <span style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-app)' }}>
              Endringen er ikke spesifisert. Vi begynte å føre detaljer 16. september -
              er økta endret før det, står bare tidspunktet.
            </span>
          )}
          {!henter && (linjer ?? []).map((l, i) => (
            <span key={i} style={{ display: 'block', fontFamily: FONT, fontSize: 12.5, lineHeight: 1.6, color: 'var(--tekst-5-app)' }}>
              <span style={{ color: 'var(--tekst-1-app)', fontWeight: 700 }}>{l.navn}</span>
              {' fra '}<span style={{ color: 'var(--tekst-1-app)' }}>{l.fra ?? 'tomt'}</span>
              {' til '}<span style={{ color: 'var(--tekst-1-app)' }}>{l.til ?? 'tomt'}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
