import type { CalendarWorkoutSummary } from './types'

// Bygg en kompakt etikett for en økt i samme-dag-listen.
//
// Regler:
// - Hvis økten har klokkeslett (start_time): vis det som "06:30".
// - Ellers: vis "Økt N" basert på posisjon i sortert rekkefølge (sort_order asc, så created_at).
// - Hvis flere økter på samme dag har LIK sort_order behandles de som "samme
//   økt" og nummereres "Økt N.M" (f.eks. "Økt 1.1", "Økt 1.2").
//
// `dayWorkouts` må være alle økter på den dagen (begge moduser samlet, ikke
// filtrert) — etikett-numreringen skal være stabil uavhengig av Plan/Dagbok-
// filteret.

type Labelable = Pick<CalendarWorkoutSummary, 'id' | 'start_time' | 'sort_order'>

export function workoutLabel(w: Labelable, dayWorkouts: Labelable[]): string | null {
  if (w.start_time) return w.start_time.slice(0, 5)

  // Sorter dagens økter etter sort_order, så ID som tiebreaker (deterministisk).
  const sorted = [...dayWorkouts].sort((a, b) => {
    const sa = a.sort_order ?? 0
    const sb = b.sort_order ?? 0
    if (sa !== sb) return sa - sb
    return a.id.localeCompare(b.id)
  })

  // Grupper etter sort_order så like sort_order-verdier deler hovednummer.
  const groups: Labelable[][] = []
  for (const x of sorted) {
    const last = groups[groups.length - 1]
    if (last && (last[0].sort_order ?? 0) === (x.sort_order ?? 0)) {
      last.push(x)
    } else {
      groups.push([x])
    }
  }

  // Finn hvilken gruppe (og posisjon i gruppe) `w` tilhører.
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const idx = group.findIndex(x => x.id === w.id)
    if (idx === -1) continue
    const main = gi + 1
    if (group.length > 1) return `Økt ${main}.${idx + 1}`
    return `Økt ${main}`
  }
  return null
}
