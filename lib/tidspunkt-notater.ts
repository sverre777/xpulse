// TIDSPUNKT-NOTATER — punktene på grafen (Øktbygger bolk 8).
// Bor i workouts.tidspunkt_notater (jsonb, fase 119):
//   { id, sek, type: 'laktat' | 'ernaering' | 'notat', tekst, planlagt,
//     ernaering?: { karbo_g, fett_g, protein_g, ketoner_g } }
//
// HVA SOM BOR HER OG HVA SOM IKKE GJØR DET:
//  · PLANLAGTE punkter (planlagt: true): «her skal du måle laktat», «ta
//    gel her», et notat — alle tre typer. En planlagt laktat har ALDRI en
//    verdi; den er ingen måling og skrives aldri til
//    workout_lactate_measurements.
//  · NOTAT-punkter i dagboka (planlagt: false, type 'notat').
//  · FØRT laktat bor i workout_lactate_measurements (measured_at_time), og
//    FØRT ernæring i workout_nutrition_entries (time_offset_minutes) — de
//    har tidspunkt fra før, og punktet på grafen LESER derfra. De
//    dupliseres aldri hit.
// Ren logikk, ingen react.

export type PunktType = 'laktat' | 'ernaering' | 'notat'

export interface PlanlagtErnaering {
  karbo_g?: number | null
  fett_g?: number | null
  protein_g?: number | null
  ketoner_g?: number | null
}

export interface TidspunktNotat {
  id: string
  /** Sekunder fra øktstart. */
  sek: number
  type: PunktType
  tekst: string
  planlagt: boolean
  ernaering?: PlanlagtErnaering
}

const TYPER = new Set<PunktType>(['laktat', 'ernaering', 'notat'])

function tall(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Leser jsonb-verdien fra basen — kaster aldri, hopper over rusk. */
export function lesTidspunktNotater(raw: unknown): TidspunktNotat[] {
  if (!Array.isArray(raw)) return []
  const ut: TidspunktNotat[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const type = o.type as PunktType
    const sek = tall(o.sek)
    if (!TYPER.has(type) || sek == null || sek < 0) continue
    const p: TidspunktNotat = {
      id: typeof o.id === 'string' && o.id ? o.id : `p-${ut.length}-${Math.round(sek)}`,
      sek: Math.round(sek),
      type,
      tekst: typeof o.tekst === 'string' ? o.tekst : '',
      planlagt: !!o.planlagt,
    }
    if (type === 'ernaering' && o.ernaering && typeof o.ernaering === 'object') {
      const e = o.ernaering as Record<string, unknown>
      p.ernaering = { karbo_g: tall(e.karbo_g), fett_g: tall(e.fett_g), protein_g: tall(e.protein_g), ketoner_g: tall(e.ketoner_g) }
    }
    ut.push(p)
  }
  return ut.sort((a, b) => a.sek - b.sek)
}

export function nyttTidspunktNotat(type: PunktType, sek: number, planlagt: boolean, tekst = ''): TidspunktNotat {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { id, sek: Math.max(0, Math.round(sek)), type, tekst, planlagt, ...(type === 'ernaering' ? { ernaering: {} } : {}) }
}

/** Det som skrives til basen — bare feltene modellen kjenner. */
export function tilJson(punkter: TidspunktNotat[]): TidspunktNotat[] {
  return punkter.map(p => ({
    id: p.id, sek: Math.round(p.sek), type: p.type, tekst: p.tekst ?? '', planlagt: !!p.planlagt,
    ...(p.type === 'ernaering' && p.ernaering ? { ernaering: p.ernaering } : {}),
  }))
}

export function fmtGram(e: PlanlagtErnaering | undefined): string {
  if (!e) return ''
  const deler: string[] = []
  if (e.karbo_g) deler.push(`${e.karbo_g} g karbo`)
  if (e.protein_g) deler.push(`${e.protein_g} g protein`)
  if (e.fett_g) deler.push(`${e.fett_g} g fett`)
  if (e.ketoner_g) deler.push(`${e.ketoner_g} g ketoner`)
  return deler.join(' · ')
}

/** Tittelen punktet får på grafen. */
export function punktTittel(p: TidspunktNotat): string {
  if (p.type === 'laktat') return p.planlagt ? `Laktat${p.tekst ? ` · ${p.tekst}` : ''}` : `Laktat ${p.tekst}`.trim()
  if (p.type === 'ernaering') {
    const g = fmtGram(p.ernaering)
    return `${p.tekst || 'Ernæring'}${g ? ` · ${g}` : ''}`
  }
  return p.tekst ? p.tekst : 'Notat'
}
