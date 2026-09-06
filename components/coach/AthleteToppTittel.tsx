'use client'

// NAVIGASJON v2 bolk 6: inne på en utøver setter drilldown-layouten toppen
// (tilbake-pil + utøverens navn · sport · gruppe) via topp-tittel-lageret.
import { useEffect } from 'react'
import { settToppTittel } from '@/lib/topp-tittel'

export function AthleteToppTittel({ navn, undertekst }: { navn: string; undertekst: string | null }) {
  useEffect(() => {
    settToppTittel({ tittel: navn, undertekst, tilbake: '/app/trener/utovere' })
    return () => settToppTittel(null)
  }, [navn, undertekst])
  return null
}
