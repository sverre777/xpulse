'use client'

import { useEffect } from 'react'

// Beskyttelses-tekst brukt på tvers av modal-bekreftelser. Holdes likt slik at
// brukeren får en gjenkjennbar dialog uavhengig av hvor i appen det skjer.
export const DIRTY_DISCARD_MESSAGE =
  'Du har ulagrede endringer. Lukke uten å lagre?'

// Spør bruker om de virkelig vil forkaste — returnerer true hvis de bekrefter.
// Trygg å kalle uten dirty-state også (returnerer true direkte).
export function confirmDiscardIfDirty(dirty: boolean): boolean {
  if (!dirty) return true
  return typeof window !== 'undefined' && window.confirm(DIRTY_DISCARD_MESSAGE)
}

// Beskytter mot tab-lukking/refresh mens dirty=true. Aktiveres bare så lenge
// hooket er montert og dirty=true.
export function useBeforeUnloadGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = DIRTY_DISCARD_MESSAGE
      return DIRTY_DISCARD_MESSAGE
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
