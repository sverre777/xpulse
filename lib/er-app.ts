'use client'

// NAVIGASJON v2 (Sverre 6. sep): ÉN bryter for «app-navigasjon» — glass-linje
// nederst, glass-topplinje, Mer-side, Synk-ark, ＋-knapp. Sann når appen kjører
// i Capacitor, når viewporten er ≤ 1024 px (telefon + iPad i begge retninger —
// Sverre 6. sep: «på iPad kjører vi mobil-oppsett»), eller når enheten styres
// med finger og er ≤ 1366 px (iPad Pro liggende). Alt over det er PC-toppmenyen.

import { useSyncExternalStore } from 'react'

export const MOBIL_NAV_MAKS_BREDDE = 1024
export const MOBIL_NAV_MAKS_BREDDE_TOUCH = 1366

type CapacitorVindu = Window & { Capacitor?: { isNativePlatform?: () => boolean } }

export function erCapacitor(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!(window as CapacitorVindu).Capacitor?.isNativePlatform?.() } catch { return false }
}

const Q_BREDDE = `(max-width: ${MOBIL_NAV_MAKS_BREDDE}px)`
const Q_TOUCH = `(pointer: coarse) and (max-width: ${MOBIL_NAV_MAKS_BREDDE_TOUCH}px)`

export function erMobilNav(): boolean {
  if (typeof window === 'undefined') return false
  return erCapacitor() || window.matchMedia(Q_BREDDE).matches || window.matchMedia(Q_TOUCH).matches
}

function abonner(varsle: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mqs = [window.matchMedia(Q_BREDDE), window.matchMedia(Q_TOUCH)]
  mqs.forEach(mq => mq.addEventListener('change', varsle))
  return () => mqs.forEach(mq => mq.removeEventListener('change', varsle))
}

/** Sann når app-navigasjonen skal vises. Server-HTML: false (toppmenyen tegnes først, glasset kommer på klienten). */
export function useErMobilNav(): boolean {
  return useSyncExternalStore(abonner, erMobilNav, () => false)
}
