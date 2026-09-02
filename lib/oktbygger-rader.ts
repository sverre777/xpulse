// Øktbyggerens radutkast — ren logikk, ingen react.
//
// Et utkast er én aktivitetsrad slik byggeren holder den mens man arbeider:
// plassering i tid (start/varighet i sekunder) pluss feltene lagringen
// (app/actions/tidsplassering.ts → lagreTidslinje) skriver tilbake. Radene
// er editoren — det finnes ingen egen segment-editor lenger.

import { ACTIVITY_TYPES, type ActivityType } from './types'

export interface Utkast {
  /** Lokal id — stabil gjennom hele redigeringsøkten. */
  id: string
  dbId: string | null
  type: ActivityType
  navn: string
  bevegelsesform: string
  startSek: number
  varighetSek: number
  skytetidSek: number | null
  /** Radens egne felter — tom streng = ikke ført. Passerer uendret gjennom
      byggeren og skrives tilbake av lagringen. */
  distanseKm: string
  snittpuls: string
  makspuls: string
  sone: string
  beskrivelse: string
  /** Repetisjoner fra samme kortintervall deler gruppe (fase 117). */
  gruppeId: string | null
}

/** Etiketten for en rad: eget navn først, ellers «Drag n» / bev.form / typen. */
export function etikettFor(u: Utkast, alle: Utkast[]): string {
  if (u.navn.trim()) return u.navn.trim()
  const meta = ACTIVITY_TYPES.find(t => t.value === u.type)
  if (u.type === 'aktivitet') {
    const drag = alle.filter(x => x.type === 'aktivitet').sort((a, b) => a.startSek - b.startSek)
    if (drag.length > 1) return `Drag ${drag.findIndex(x => x.id === u.id) + 1}`
    return u.bevegelsesform || 'Aktivitet'
  }
  if (u.type === 'veksling') return u.bevegelsesform || 'Veksling'
  return meta?.label ?? u.type
}
