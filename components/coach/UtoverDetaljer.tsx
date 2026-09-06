'use client'

// BOLK B1b (Trenerside v2, Sverre 6. sep): detaljpanelet som folder seg ut UNDER
// en utøverrad på trener-hjem — ikke ny side, ikke modal, og bare én åpen om gangen.
//
// Innholdet er NØYAKTIG de samme boksene som statuskortet i Analyse → Oversikt
// (StatusBokser, regel 11): siste hardøkt, neste hardøkt/neste økt, belastning,
// helse 30 dager, timer plan vs gjennomført, soner uke/måned/år og skyting.
// Panelet henter ÉN gang per utøver, og svaret caches i økta — åpner man raden
// igjen, går det ingen ny runde (regel 20).

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getOversiktStatus } from '@/app/actions/oversikt-status'
import type { OversiktStatus } from '@/lib/oversikt-status-type'
import { StatusBokser } from '@/components/analysis/StatusKort'
import { TRENER_BLAA } from '@/lib/status-farger'

const FONT = "'Barlow Condensed', sans-serif"

// Cache i økta: nøkkel = utøver + periode.
const cache = new Map<string, OversiktStatus>()

export function UtoverDetaljer({ athleteId, navn, fra, til, harSkiskyting, helseDelt }: {
  athleteId: string
  navn: string
  fra: string
  til: string
  harSkiskyting: boolean
  helseDelt: boolean
}) {
  const nokkel = `${athleteId}|${fra}|${til}`
  const [status, setStatus] = useState<OversiktStatus | null>(() => cache.get(nokkel) ?? null)
  const [feil, setFeil] = useState<string | null>(null)

  useEffect(() => {
    if (cache.has(nokkel)) return
    let live = true
    getOversiktStatus(fra, til, null, athleteId).then(r => {
      if (!live) return
      if ('error' in r) { setFeil(r.error); return }
      cache.set(nokkel, r)
      setStatus(r)
    }).catch(() => { if (live) setFeil('Kunne ikke hente tallene') })
    return () => { live = false }
  }, [nokkel, fra, til, athleteId])

  const knapp = {
    fontFamily: FONT, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase' as const,
    color: TRENER_BLAA, border: `1px solid ${TRENER_BLAA}`, borderRadius: 8, padding: '6px 12px', textDecoration: 'none', minHeight: 34,
    display: 'inline-flex', alignItems: 'center',
  }

  return (
    <div data-utover-detaljer={athleteId} style={{ padding: '0 20px 18px' }}>
      {feil ? (
        <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)' }}>{feil}</p>
      ) : !status ? (
        <p data-utover-detaljer-laster style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)' }}>Henter tall for {navn} …</p>
      ) : (
        <StatusBokser status={status} harSkiskyting={harSkiskyting} canSeeHealthData={helseDelt} visStjerner={false} />
      )}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 12 }}>
        <Link href={`/app/trener/${athleteId}/dagbok`} style={knapp}>Åpne dagbok</Link>
        <Link href={`/app/trener/${athleteId}/plan`} style={knapp}>Plan</Link>
        <Link href={`/app/trener/${athleteId}/analyse`} style={knapp}>Analyse</Link>
        <Link href={`/app/trener/${athleteId}/plan?push=1`} style={knapp}>Push økt</Link>
        <Link href={`/app/trener/${athleteId}`} style={{ ...knapp, background: TRENER_BLAA, color: 'var(--tekst-1-ren)' }}>Full profil</Link>
      </div>
    </div>
  )
}
