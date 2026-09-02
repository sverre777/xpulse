'use client'

// Kompakte klokke-kurver til kalenderen — hentes i BATCH etter at
// kalenderen er tegnet, aldri i veien for første maling (regel 20).
// Én økt = ~2 KB (120 kolonner puls + segmentbånd).
//
// Kurvene bor i et modul-lager (ekstern kilde) som chip-ene abonnerer på
// med useSyncExternalStore. Da overlever de at kalenderen bytter måned og
// tilbake, at byDate erstattes av en re-henting midt i en pågående
// batch (målt: kurvene kom, men ble aldri vist fordi effekten som ventet
// på dem var avbrutt), og at provideren re-monteres.

import { useEffect, useSyncExternalStore } from 'react'
import type { CalendarWorkoutSummary } from '@/lib/types'
import { hentKompakteKurver, type KompaktKurve } from '@/app/actions/workout-klokkesync'

const lager = new Map<string, KompaktKurve | null>()
const underveis = new Set<string>()
const lyttere = new Set<() => void>()
const varsle = () => { for (const l of lyttere) l() }
const abonner = (l: () => void) => { lyttere.add(l); return () => { lyttere.delete(l) } }

export function harKlokkekurve(w: Pick<CalendarWorkoutSummary, 'is_completed' | 'imported_from' | 'merged_source'>): boolean {
  return !!w.is_completed && !!(w.imported_from || w.merged_source)
}

/** Henter kurvene som mangler for øktene i byDate — i bakgrunnen. */
export function KompaktKurverProvider({ byDate, children }: {
  byDate: Record<string, CalendarWorkoutSummary[]>
  children: React.ReactNode
}) {
  useEffect(() => {
    const ids: string[] = []
    for (const liste of Object.values(byDate)) {
      for (const w of liste) {
        if (harKlokkekurve(w) && !lager.has(w.id) && !underveis.has(w.id)) ids.push(w.id)
      }
    }
    if (ids.length === 0) return
    ids.forEach(id => underveis.add(id))
    // Etter første maling: la kalenderen stå ferdig før kurvene hentes.
    // Hentingen avbrytes IKKE om byDate byttes underveis — resultatet
    // hører til øktene, ikke til denne renderingen.
    let startet = false
    const t = window.setTimeout(() => {
      startet = true
      hentKompakteKurver(ids)
        .then(res => { for (const id of ids) lager.set(id, res[id] ?? null); varsle() })
        .catch(() => { /* prøves igjen ved neste byDate-endring */ })
        .finally(() => { ids.forEach(id => underveis.delete(id)) })
    }, 250)
    return () => {
      // Rakk ikke å starte: frigi id-ene så neste effekt tar dem.
      if (!startet) { window.clearTimeout(t); ids.forEach(id => underveis.delete(id)) }
    }
  }, [byDate])
  return <>{children}</>
}

export function useKompaktKurve(workoutId: string): KompaktKurve | null {
  return useSyncExternalStore(abonner, () => lager.get(workoutId) ?? null, () => null)
}
