// Reglene for kilde per verdi, som rene funksjoner uten database.
//
// De to reglene i bestillingen er begge REGNESTYKKER, ikke SQL:
//   1. MANUELL VINNER   — en import skal aldri overskrive noe brukeren har ført
//   2. FRAKOBLING       — importerte verdier fra ett merke slettes, manuelle
//                         verdier slettes aldri
//
// Ved å ha dem her, som funksjoner over (verdier, sources), kan de testes med
// assertions uten å røre en database — se scripts/health-source-selftest.ts.
// Import-veien og frakoblings-ruta bruker de samme funksjonene, så testen
// dekker den koden som faktisk kjører.

export type SourceMap = Record<string, string>

export interface ManualWinsPlan {
  /** Felter som skal skrives, med de nye verdiene. */
  patch: Record<string, unknown>
  /** Oppdatert kilde-kart som skal lagres sammen med raden. */
  sources: SourceMap
  /** Felter som ble stående urørt fordi brukeren hadde ført dem selv. */
  keptManual: string[]
}

// Hva skal skrives når en import kommer inn med nye verdier?
//
// · null/undefined i incoming = merket har ingen verdi → rør ingenting
// · sources[felt] === 'manual'  = brukerens egen verdi → rør ALDRI
// · ellers                      = skriv verdien og merk feltet med kilden
export function planManualWinsUpdate(
  existingSources: SourceMap | null | undefined,
  incoming: Record<string, unknown>,
  source: string,
): ManualWinsPlan {
  const sources: SourceMap = { ...(existingSources ?? {}) }
  const patch: Record<string, unknown> = {}
  const keptManual: string[] = []

  for (const [field, value] of Object.entries(incoming)) {
    if (value == null) continue
    if (sources[field] === 'manual') {
      keptManual.push(field)
      continue
    }
    patch[field] = value
    sources[field] = source
  }

  return { patch, sources, keptManual }
}

export interface BrandPurgePlan {
  /** Felter som skal nullstilles fordi de kom fra merket. */
  patch: Record<string, null>
  /** Kilde-kartet uten merkets felter. */
  sources: SourceMap
  /** Felter som beholdes (manuelle eller fra et annet merke). */
  kept: string[]
  /** Sant når raden ikke har noe igjen og kan slettes helt. */
  rowIsEmpty: boolean
}

// Hva skal skje med én rad når et merke kobles fra?
//
// Feltene merket med DETTE merket nullstilles og mister kilde-merkingen.
// Alt annet — manuelt ført, eller hentet fra et annet merke — står urørt.
// Har raden ingen verdier igjen etterpå, kan hele raden slettes.
//
// `fields` er kolonnene raden faktisk kan ha verdier i (uten id/user_id/date),
// slik at vi kan avgjøre om noe er igjen uten å gjette på kolonnenavn.
export function planBrandPurge(
  row: Record<string, unknown>,
  sources: SourceMap | null | undefined,
  brand: string,
  fields: readonly string[],
): BrandPurgePlan {
  const nySources: SourceMap = { ...(sources ?? {}) }
  const patch: Record<string, null> = {}
  const kept: string[] = []

  for (const field of fields) {
    const harVerdi = row[field] != null
    if (nySources[field] === brand) {
      if (harVerdi) patch[field] = null
      delete nySources[field]
      continue
    }
    if (harVerdi) kept.push(field)
  }

  return { patch, sources: nySources, kept, rowIsEmpty: kept.length === 0 }
}

// Kolonnene som holder verdier i de to fellesfelt-tabellene (fase 91).
// Brukes av frakoblingen til å avgjøre om en rad er tom etter opprydding.
export const SLEEP_VALUE_FIELDS = [
  'sleep_start', 'sleep_end', 'total_sleep_minutes', 'awake_minutes',
  'interruptions', 'deep_minutes', 'light_minutes', 'rem_minutes',
  'perceived_quality',
  // Manuell søvnscore (fase 103). MÅ stå her: uten den ville en rad som kun
  // inneholder brukerens egen score blitt regnet som tom ved frakobling av
  // et merke, og slettet.
  'sleep_score',
] as const

export const HEALTH_METRIC_VALUE_FIELDS = [
  'resting_hr', 'hrv_ms', 'max_hr', 'body_weight_kg', 'steps',
  'active_minutes', 'inactive_minutes', 'daily_distance_m',
  'stairs_climbed', 'daily_elevation_m',
] as const
