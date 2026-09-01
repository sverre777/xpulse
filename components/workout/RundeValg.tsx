'use client'

// ØKTBYGGEREN BOLK 4 — rundevalget over kurven.
// Fasit: design/xpulse-oktbyggeren-design.html (★ planens runder på
// klokkas kurve).
//
// Tre TILSTANDER, ikke tre brytere: raden sier hva rundene ER nå, og
// tilbyr bare de overgangene som faktisk finnes. Har økta ingen plan å
// hente fra, står raden ikke der i det hele tatt — aldri en død knapp.
//
// Valget er alltid angrbart: «tilbakestill til klokka» har ingen frist,
// og klokkas runder ligger ordrett i backupen til de hentes hjem.

import { useEffect, useState } from 'react'
import { hentRundeValg, beholdPlanensRunder, tilbakestillTilKlokka } from '@/app/actions/runder'

interface Valg {
  kilde: 'klokke' | 'plan' | 'ingen'
  antallNa: number
  kanVelgePlan: boolean
  antallPlanRunder: number
  kanTilbakestille: boolean
  antallIBackup: number
  resynkVarsel: boolean
  venterPaaMigrering: boolean
}

const PILL: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
  fontSize: 12, textTransform: 'uppercase', borderRadius: 999, padding: '7px 14px',
  cursor: 'pointer', minHeight: 36, background: 'transparent', whiteSpace: 'nowrap',
}

export function RundeValg({ workoutId, onEndret }: { workoutId: string; onEndret: () => void }) {
  const [valg, setValg] = useState<Valg | null>(null)
  const [jobber, setJobber] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  useEffect(() => {
    let avbrutt = false
    hentRundeValg(workoutId).then(v => { if (!avbrutt) setValg(v as Valg | null) }).catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId])

  if (!valg) return null
  const noeAaVise = valg.kanVelgePlan || valg.kanTilbakestille || valg.resynkVarsel || valg.venterPaaMigrering
  if (!noeAaVise) return null

  const kjor = async (f: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setJobber(true); setFeil(null)
    const r = await f()
    setJobber(false)
    if (!r.ok) { setFeil(r.error); return }
    const nytt = await hentRundeValg(workoutId)
    setValg(nytt as Valg | null)
    onEndret()
  }

  return (
    <div data-rundevalg style={{
      border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 12px',
      background: 'var(--flate-12-alt)', display: 'flex', gap: 10,
      alignItems: 'center', flexWrap: 'wrap',
    }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 10.5,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)',
      }}>
        Runder
      </span>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)' }}>
        {valg.kilde === 'klokke'
          ? `⌚ Fra klokka · ${valg.antallNa}`
          : valg.kilde === 'plan'
            ? `📋 Planens runder · ${valg.antallNa}`
            : 'Ingen runder ennå'}
      </span>

      {valg.kanVelgePlan && (
        <button type="button" disabled={jobber}
          onClick={() => kjor(() => beholdPlanensRunder(workoutId))}
          style={{ ...PILL, border: '1.5px solid var(--accent)', color: 'var(--accent)',
                   opacity: jobber ? 0.5 : 1 }}>
          📋 Behold planens runder ({valg.antallPlanRunder})
        </button>
      )}
      {valg.kanTilbakestille && (
        <button type="button" disabled={jobber}
          onClick={() => kjor(() => tilbakestillTilKlokka(workoutId))}
          style={{ ...PILL, border: '1.5px solid var(--line2)', color: 'var(--tekst-1-app)',
                   opacity: jobber ? 0.5 : 1 }}>
          ↩ Tilbakestill til klokka ({valg.antallIBackup})
        </button>
      )}

      {valg.resynkVarsel && (
        <p style={{ flexBasis: '100%', margin: 0, fontSize: 12.5, color: '#E8B93C',
                    fontFamily: "'Barlow Condensed', sans-serif" }}>
          ⚠ Klokka har levert runder på nytt. Backupen fra forrige gang står urørt —
          ingenting er overskrevet, og du velger selv hva som skal gjelde.
        </p>
      )}
      {valg.venterPaaMigrering && (
        <p style={{ flexBasis: '100%', margin: 0, fontSize: 12.5, color: 'var(--tekst-8-alt)',
                    fontFamily: "'Barlow Condensed', sans-serif" }}>
          Planens {valg.antallPlanRunder} runder ligger klare, men valget åpnes først når
          klokkas runder har et sted å ligge (fase 116).
        </p>
      )}
      {feil && (
        <p style={{ flexBasis: '100%', margin: 0, fontSize: 12.5, color: '#E23A5A',
                    fontFamily: "'Barlow Condensed', sans-serif" }}>{feil}</p>
      )}
    </div>
  )
}
