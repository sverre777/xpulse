'use client'

import { useEffect, useState } from 'react'
import { CustomCursor } from './CustomCursor'
import { musepekerPaa, MUSEPEKER_HENDELSE } from '@/lib/musepeker'

/**
 * Bestemmer om den tilpassede musepekeren i det hele tatt skal MONTERES.
 *
 * Skrudd av betyr at CustomCursor aldri rendres — ikke at den er skjult med
 * CSS. Da kjører effekten aldri, og document.body.style.cursor røres ikke.
 * Slås den av mens den står montert, avmonteres den her, og CustomCursor sin
 * egen opprydding setter body.style.cursor tilbake til det den var.
 *
 * Serveren vet ikke hva som er valgt, så vi starter på null og leser først
 * etter montering — samme grep som TemaBryter, av samme grunn.
 */
export function MusepekerVert({ color }: { color: string }) {
  const [paa, setPaa] = useState<boolean | null>(null)

  useEffect(() => {
    setPaa(musepekerPaa())
    const oppdater = () => setPaa(musepekerPaa())
    window.addEventListener(MUSEPEKER_HENDELSE, oppdater)
    // Endres valget i en annen fane, skal denne følge etter.
    window.addEventListener('storage', oppdater)
    return () => {
      window.removeEventListener(MUSEPEKER_HENDELSE, oppdater)
      window.removeEventListener('storage', oppdater)
    }
  }, [])

  if (paa !== true) return null
  return <CustomCursor color={color} />
}
