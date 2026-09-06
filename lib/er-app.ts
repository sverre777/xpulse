'use client'

// NAVIGASJON v2 (Sverre 6. sep): ÉN bryter for «app-navigasjon» — glass-linje
// nederst, glass-topplinje, Mer-side, Synk-ark. Sann når viewporten er ≤ 620 px
// ELLER appen kjører i Capacitor (window.Capacitor finnes ikke ennå — sjekkes
// trygt). Alt annet (PC > 620) beholder toppmenyen (bolk 7).

import { useSyncExternalStore } from 'react'

export const MOBIL_NAV_MAKS_BREDDE = 620

type CapacitorVindu = Window & { Capacitor?: { isNativePlatform?: () => boolean } }

export function erCapacitor(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!(window as CapacitorVindu).Capacitor?.isNativePlatform?.() } catch { return false }
}

export function erMobilNav(): boolean {
  if (typeof window === 'undefined') return false
  return erCapacitor() || window.matchMedia(`(max-width: ${MOBIL_NAV_MAKS_BREDDE}px)`).matches
}

function abonner(varsle: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(`(max-width: ${MOBIL_NAV_MAKS_BREDDE}px)`)
  mq.addEventListener('change', varsle)
  return () => mq.removeEventListener('change', varsle)
}

/** Sann når app-navigasjonen skal vises. Server-HTML: false (toppmenyen tegnes først, glasset kommer på klienten). */
export function useErMobilNav(): boolean {
  return useSyncExternalStore(abonner, erMobilNav, () => false)
}
