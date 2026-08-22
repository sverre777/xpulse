// Km/tid-telling per utstyr (utstyr bolk 4) — ren logikk, delt mellom
// utøver- og trener-actions, voktet av scripts/utstyr-usage-selftest.ts.
//
// Fasit (design seksjon 5 + presisering):
// - «Hele økta»-arv (activity_id null) er standard: utstyret telles på hver
//   aktivitet automatisk. For økter UTEN overstyringer telles arven fra øktas
//   totaler — nøyaktig som før bolk 4, så migreringspariteten holder.
// - Overstyring (⇄, activity_id satt) betyr faktisk BYTTE: den aktiviteten
//   telles på det valgte utstyret (radens km + varighet), og arv-utstyr i
//   SAMME kategori mister den aktiviteten fra sin telling.
// - Både KM og TID følger aktivitetene: tid fra radens varighet, km fra
//   radens distanse.
// - PLANLAGT UTSTYR TELLER IKKE: km og tid registreres først når økta er
//   markert gjennomført. Et utstyrsvalg på en planlagt økt er en intensjon
//   (hvilke ski økta SKAL gjøres på), ikke bruk. `tellerSomGjennomfort` er
//   ÉN kilde for den regelen — importér den, ikke gjenskap testen.

import type { EquipmentUsage } from './equipment-types'

export interface UsageLink {
  equipment_id: string
  workout_id: string
  activity_id: string | null
}

export interface UsageWorkout {
  distance_km: number | null
  duration_minutes: number | null
  // workouts.is_completed (not null i skjemaet) — planlagte økter teller 0.
  is_completed: boolean | null
}

// Fasit for «har denne økta faktisk vært brukt?». Brukes både av tellingen
// under og av km-siden-siste-slip i app/actions/equipment.ts — ingenting er
// fullført før brukeren markerer det.
export function tellerSomGjennomfort(w: { is_completed: boolean | null }): boolean {
  return w.is_completed === true
}

export interface UsageActivity {
  workout_id: string
  distance_meters: number | null
  duration_seconds: number | null
}

export function beregnEquipmentUsage(
  equipmentIds: string[],
  links: UsageLink[],
  workoutById: Map<string, UsageWorkout>,
  activityById: Map<string, UsageActivity>,
  categoryByEquipment: Map<string, string>,
): Map<string, EquipmentUsage> {
  const usage = new Map<string, EquipmentUsage>()
  for (const id of equipmentIds) {
    usage.set(id, { equipment_id: id, total_km: 0, total_minutes: 0, workout_count: 0 })
  }

  // Grupper koblingene per økt.
  const perWorkout = new Map<string, UsageLink[]>()
  for (const l of links) {
    const arr = perWorkout.get(l.workout_id)
    if (arr) arr.push(l)
    else perWorkout.set(l.workout_id, [l])
  }

  for (const [workoutId, wLinks] of perWorkout) {
    const w = workoutById.get(workoutId)
    if (!w) continue
    // Planlagt økt: utstyret er valgt, men ingen km/tid er registrert ennå.
    if (!tellerSomGjennomfort(w)) continue

    const overrides = wLinks.filter(l => l.activity_id !== null)

    // Aktiviteter som er overstyrt, per kategori — arv-utstyr i samme
    // kategori mister disse aktivitetene fra tellingen sin.
    const overstyrtePerKategori = new Map<string, Set<string>>()
    for (const o of overrides) {
      const kat = categoryByEquipment.get(o.equipment_id)
      if (!kat || !o.activity_id) continue
      const s = overstyrtePerKategori.get(kat)
      if (s) s.add(o.activity_id)
      else overstyrtePerKategori.set(kat, new Set([o.activity_id]))
    }

    // Hvilke utstyr er med i økta (for workout_count — én per økt uansett
    // hvor mange rader/aktiviteter utstyret står på).
    const utstyrIOkta = new Set(wLinks.map(l => l.equipment_id))

    for (const link of wLinks) {
      const u = usage.get(link.equipment_id)
      if (!u) continue

      if (link.activity_id !== null) {
        // Overstyring: radens egne tall.
        const a = activityById.get(link.activity_id)
        if (!a) continue
        if (typeof a.distance_meters === 'number') u.total_km += a.distance_meters / 1000
        if (typeof a.duration_seconds === 'number') u.total_minutes += a.duration_seconds / 60
        continue
      }

      // Arv: øktas totaler — minus overstyrte aktiviteter i samme kategori.
      // Uten overstyringer er dette identisk med tellingen før bolk 4 (paritet).
      let km = typeof w.distance_km === 'number' ? w.distance_km : 0
      let min = typeof w.duration_minutes === 'number' ? w.duration_minutes : 0
      const kat = categoryByEquipment.get(link.equipment_id)
      const overstyrte = kat ? overstyrtePerKategori.get(kat) : undefined
      if (overstyrte) {
        for (const aktId of overstyrte) {
          const a = activityById.get(aktId)
          if (!a) continue
          if (typeof a.distance_meters === 'number') km -= a.distance_meters / 1000
          if (typeof a.duration_seconds === 'number') min -= a.duration_seconds / 60
        }
      }
      u.total_km += Math.max(km, 0)
      u.total_minutes += Math.max(min, 0)
    }

    for (const id of utstyrIOkta) {
      const u = usage.get(id)
      if (u) u.workout_count += 1
    }
  }

  return usage
}
