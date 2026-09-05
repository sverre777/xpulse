// YTELSE bolk 0 (Sverre 5. sep 2026): måling FØR fiks. `medTid` tar tida på
// et stykke serverarbeid (layout, side, action) og logger én linje
// «[xp-tid] …» som havner i dev-terminalen og i Netlify function logs.
// Regionen (process.env.AWS_REGION i Netlify-funksjonen) logges med, så
// avstanden til Supabase kan leses rett ut av loggen. Ingen oppførsel
// endres — bare tid og logg.
const region = () => process.env.AWS_REGION ?? process.env.NETLIFY_REGION ?? process.env.VERCEL_REGION ?? 'lokal'

export async function medTid<T>(navn: string, fn: () => Promise<T>, ekstra?: Record<string, string | number | null | undefined>): Promise<T> {
  const t0 = Date.now()
  try {
    return await fn()
  } finally {
    const dur = Date.now() - t0
    const felt = Object.entries(ekstra ?? {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => ` ${k}=${v}`).join('')
    console.log(`[xp-tid] ${navn} dur=${dur}ms region=${region()}${felt}`)
  }
}

/** Server-Timing-verdi for en HTTP-respons (middleware): «navn;dur=ms». */
export function serverTiming(deler: Array<[string, number]>): string {
  return deler.map(([n, ms]) => `${n};dur=${Math.max(0, Math.round(ms))}`).join(', ')
}
