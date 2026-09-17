// Styrke bolk 8 (a, b, g): ÉN hjelper for rekkefølge, supersett og «nytt sett
// arver» - delt av plan/dagbok (ActivitiesSection) og live (LiveSessionView),
// regel 11. Ren logikk, ingen React, ingen DB. Rekkefølgen lagres som
// sort_order = indeks i lista (saveWorkout og saveLiveStrength gjør det alt).

import { arrayMove } from '@dnd-kit/sortable'
import type { StrengthExerciseRow, StrengthSetRow } from './types'

/** Dra-og-slipp: flytt øvelsen med aktivId til plassen til overId. Slipp der den startet (eller ukjent id) gir SAMME array tilbake - ingenting endres. */
export function flyttOvelse<T extends { id: string }>(liste: T[], aktivId: string, overId: string | null | undefined): T[] {
  if (!overId || aktivId === overId) return liste
  const fra = liste.findIndex(e => e.id === aktivId), til = liste.findIndex(e => e.id === overId)
  if (fra < 0 || til < 0 || fra === til) return liste
  return arrayMove(liste, fra, til)
}

/** Bokstav per supersett-gruppe i rekkefølgen gruppene først dukker opp (A, B, C …). */
export function supersettBokstaver(ovelser: { superset_group?: number | null }[]): Map<number, string> {
  const map = new Map<number, string>(); let n = 0
  for (const e of ovelser) if (e.superset_group != null && !map.has(e.superset_group)) { map.set(e.superset_group, String.fromCharCode(65 + n)); n++ }
  return map
}

/** «Supersett»-knappen: kobler øvelsen med den NESTE (én trykk). Er en av dem alt i en gruppe, brukes den; ellers ny gruppe. Siste øvelse: ingenting skjer. */
export function kobleMedNeste(ovelser: StrengthExerciseRow[], id: string): StrengthExerciseRow[] {
  const i = ovelser.findIndex(e => e.id === id)
  if (i < 0 || i >= ovelser.length - 1) return ovelser
  const eksisterende = ovelser.map(e => e.superset_group).filter((g): g is number => g != null)
  const g = ovelser[i].superset_group ?? ovelser[i + 1].superset_group ?? ((eksisterende.length ? Math.max(...eksisterende) : 0) + 1)
  return ovelser.map((e, idx) => (idx === i || idx === i + 1) ? { ...e, superset_group: g } : e)
}

/** Løs opp: øvelsen ut av gruppa. Står én igjen alene i gruppa, løses den også (et supersett er minst to). */
export function losOppSupersett(ovelser: StrengthExerciseRow[], id: string): StrengthExerciseRow[] {
  const meg = ovelser.find(e => e.id === id)
  if (!meg || meg.superset_group == null) return ovelser
  const g = meg.superset_group
  const ut = ovelser.map(e => e.id === id ? { ...e, superset_group: null } : e)
  const igjen = ut.filter(e => e.superset_group === g)
  return igjen.length >= 2 ? ut : ut.map(e => e.superset_group === g ? { ...e, superset_group: null } : e)
}

/** «Legg til supersett»: to tomme, koblede øvelser nederst i ett trykk. */
export function leggTilSupersett(ovelser: StrengthExerciseRow[], lagOvelse: () => StrengthExerciseRow): StrengthExerciseRow[] {
  const eksisterende = ovelser.map(e => e.superset_group).filter((g): g is number => g != null)
  const g = (eksisterende.length ? Math.max(...eksisterende) : 0) + 1
  return [...ovelser, { ...lagOvelse(), superset_group: g }, { ...lagOvelse(), superset_group: g }]
}

/** Nytt sett i plan/dagbok: arver reps, kg og RPE fra settet rett over i SAMME øvelse. Første sett: tomt (forrige økt grått / bibliotekets default, som før). */
export function nyttSettArver(sett: StrengthSetRow[], lagSett: (n: number) => StrengthSetRow): StrengthSetRow[] {
  const nytt = lagSett(sett.length + 1)
  const forrige = sett[sett.length - 1]
  if (!forrige) return [...sett, nytt]
  return [...sett, { ...nytt, reps: forrige.reps, weight_kg: forrige.weight_kg, rpe: forrige.rpe }]
}

/** Live: startverdi for tastaturet når sett i velges og ikke er ført - settet over i samme øvelse, hvis det har tall. Ellers null (da gjelder forrige økt grått). Settet er IKKE ført før «Logg sett». */
export function startverdiFraForrige(ovelse: StrengthExerciseRow, i: number): { reps: string; kg: string } | null {
  if (i <= 0) return null
  const f = ovelse.sets[i - 1]
  if (!f || (!f.reps.trim() && !f.weight_kg.trim())) return null
  return { reps: f.reps, kg: f.weight_kg }
}
