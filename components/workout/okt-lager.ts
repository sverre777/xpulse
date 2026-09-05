'use client'

import { hentOktPakke } from '@/app/actions/okt-pakke'
import type { OktPakke } from '@/lib/okt-pakke-type'
import { listEquipmentWithUsage } from '@/app/actions/equipment'
import type { WorkoutFormData } from '@/lib/types'
import type { Equipment } from '@/lib/equipment-types'

// ØKT-LAGERET (Sverre 4. sep: «økter tar litt lang tid å laste inn»):
// øktpakka (økt + utstyr + utstyrsvalg, bolk 4) huskes i 60 s per økt ×
// modus, og kan forhåndshentes når pekeren står over chipen i kalenderen.
// Modalen leser lageret først; alt som skriver (lagre, bygger, plott)
// bumper reloadTick → glemOkt.

const MAKS_ALDER = 60 * 1000
type Svar = Partial<WorkoutFormData> | null
// Bolk 4: lageret holder hele PAKKA (økt + utstyr + utstyrsvalg) i 60 s.
const lager = new Map<string, { data: OktPakke; tid: number }>()
const underveis = new Map<string, Promise<OktPakke>>()

const nokkel = (id: string, mode: 'plan' | 'dagbok', target?: string) => `${id}|${mode}|${target ?? ''}`

export function hentPakke(id: string, mode: 'plan' | 'dagbok', target?: string): Promise<OktPakke> {
  const k = nokkel(id, mode, target)
  const l = lager.get(k)
  if (l && Date.now() - l.tid < MAKS_ALDER) return Promise.resolve(l.data)
  const p = underveis.get(k)
  if (p) return p
  const ny = hentOktPakke(id, mode, target)
    .then(d => { lager.set(k, { data: d, tid: Date.now() }); if (d.utstyr) settUtstyrListe(d.utstyr); return d })
    .finally(() => { underveis.delete(k) })
  underveis.set(k, ny)
  return ny
}

/** Bakoverkompatibel: bare øktdataene fra pakka. */
export function hentOkt(id: string, mode: 'plan' | 'dagbok', target?: string): Promise<Svar> {
  return hentPakke(id, mode, target).then(p => p.okt)
}

// ── Utstyrslista er bruker-global: huskes i minnet til noe skriver ──
let utstyrListe: { data: Equipment[]; tid: number } | null = null
let utstyrUnderveis: Promise<Equipment[]> | null = null
const UTSTYR_MAKS_ALDER = 10 * 60 * 1000
function settUtstyrListe(liste: Equipment[]) { utstyrListe = { data: liste, tid: Date.now() } }
export function hentUtstyrListe(): Promise<Equipment[]> {
  if (utstyrListe && Date.now() - utstyrListe.tid < UTSTYR_MAKS_ALDER) return Promise.resolve(utstyrListe.data)
  if (utstyrUnderveis) return utstyrUnderveis
  utstyrUnderveis = listEquipmentWithUsage({ status: 'active' })
    .then(l => { settUtstyrListe(l); return l })
    .finally(() => { utstyrUnderveis = null })
  return utstyrUnderveis
}
/** Kalles når utstyr eller utstyrsvalg skrives — neste åpning leser basen. */
export function glemUtstyr(): void { utstyrListe = null }

export function varmOkt(id: string, mode: 'plan' | 'dagbok', target?: string): void {
  const k = nokkel(id, mode, target)
  const l = lager.get(k)
  if ((l && Date.now() - l.tid < MAKS_ALDER) || underveis.has(k)) return
  void hentPakke(id, mode, target).catch(() => {})
}

export function glemOkt(id: string): void {
  for (const k of [...lager.keys()]) if (k.startsWith(`${id}|`)) lager.delete(k)
}
