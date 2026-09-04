'use client'

import { getWorkoutForEdit } from '@/app/actions/workouts'
import type { WorkoutFormData } from '@/lib/types'

// ØKT-LAGERET (Sverre 4. sep: «økter tar litt lang tid å laste inn»):
// getWorkoutForEdit huskes i 60 s per økt × modus, og kan forhåndshentes
// når pekeren står over chipen i kalenderen. Modalen leser lageret først;
// alt som skriver (lagre, bygger, plott) bumper reloadTick → glemOkt.

const MAKS_ALDER = 60 * 1000
type Svar = Partial<WorkoutFormData> | null
const lager = new Map<string, { data: Svar; tid: number }>()
const underveis = new Map<string, Promise<Svar>>()

const nokkel = (id: string, mode: 'plan' | 'dagbok', target?: string) => `${id}|${mode}|${target ?? ''}`

export function hentOkt(id: string, mode: 'plan' | 'dagbok', target?: string): Promise<Svar> {
  const k = nokkel(id, mode, target)
  const l = lager.get(k)
  if (l && Date.now() - l.tid < MAKS_ALDER) return Promise.resolve(l.data)
  const p = underveis.get(k)
  if (p) return p
  const ny = getWorkoutForEdit(id, mode, target)
    .then(d => { lager.set(k, { data: d, tid: Date.now() }); return d })
    .finally(() => { underveis.delete(k) })
  underveis.set(k, ny)
  return ny
}

export function varmOkt(id: string, mode: 'plan' | 'dagbok', target?: string): void {
  const k = nokkel(id, mode, target)
  const l = lager.get(k)
  if ((l && Date.now() - l.tid < MAKS_ALDER) || underveis.has(k)) return
  void hentOkt(id, mode, target).catch(() => {})
}

export function glemOkt(id: string): void {
  for (const k of [...lager.keys()]) if (k.startsWith(`${id}|`)) lager.delete(k)
}
