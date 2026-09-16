'use client'

// STILLESTAND TIL PAUSE - fase E: kroken (Sverre 16. sep 2026, valg A).
//
// Denne komponenten tegner INGENTING. Den gjør én ting: kaller auto-steget
// én gang etter at appen er tegnet, for den innloggede utøveren.
//
// KRAV 3 (Sverre): aldri i render, aldri før første tegning.
//   - kallet ligger i en useEffect, som per definisjon kjører etter
//     tegningen
//   - requestIdleCallback (med setTimeout som reserve) venter til nettleseren
//     er ferdig med det som haster, så steget aldri kappes om hovedtråden
//     med innholdet brukeren kom for
//   - en modul-flagg sørger for ÉN kjøring per fane, ikke én per
//     navigasjon: layouten remonterer ved rollebytte og språkbytte
//
// Serveren gjør den egentlige sikringen (merk-før-behandling med
// RETURNING), så flagget her er høflighet, ikke vern. To faner som starter
// samtidig er fortsatt trygt.

import { useEffect } from 'react'
import { kjorAutoStillestand } from '@/app/actions/auto-stillestand'

/** Én kjøring per fane. Ikke en lås - serveren eier låsen. */
let kjort = false

export function AutoStillestand() {
  useEffect(() => {
    if (kjort) return
    kjort = true

    let avbrutt = false
    const start = () => {
      if (avbrutt) return
      // Feiler den, skal ingenting skje på skjermen: knappen på økta er
      // fortsatt veien inn, og en utøver som ikke har slått på
      // innstillingen merker ingenting uansett.
      void kjorAutoStillestand().catch(() => {})
    }

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(start, { timeout: 4000 })
      return () => { avbrutt = true; w.cancelIdleCallback?.(id) }
    }
    const t = window.setTimeout(start, 1500)
    return () => { avbrutt = true; window.clearTimeout(t) }
  }, [])

  return null
}
