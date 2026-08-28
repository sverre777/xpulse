'use client'

// Klient-cache for sonespråk-flagget: mange komponenter (føring,
// sonefordelinger) trenger det, men det skal hentes ÉN gang per økt i
// nettleseren. Togglen kaller nullstill() så flatene ser endringen.

import { hentUtvidetSkala } from '@/app/actions/sonesprak'

const cache = new Map<string, Promise<boolean>>()

export function hentUtvidetSkalaCached(targetUserId?: string): Promise<boolean> {
  const key = targetUserId ?? 'selv'
  let p = cache.get(key)
  if (!p) {
    p = hentUtvidetSkala(targetUserId).catch(() => false)
    cache.set(key, p)
  }
  return p
}

export function nullstillSonesprakCache() {
  cache.clear()
}
