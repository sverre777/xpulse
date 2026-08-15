import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchPolarSleep,
  fetchPolarSleepForDate,
  fetchPolarNightlyRecharge,
  fetchPolarNightlyRechargeForDate,
  parsePolarSleep,
  parsePolarRecharge,
  type PolarConnection,
} from '@/lib/polar'
import { planManualWinsUpdate } from '@/lib/health-source-rules'

// ENESTE importvei for Polar HELSE og SØVN. Både webhooken (SLEEP-event) og
// cron-fallbacken kaller denne — ingen parallell implementasjon, samme
// prinsipp som lib/polar-import.ts for øktene.
//
// Skriver til fase 91-modellen:
//   sleep_records        fellesfelt per natt      (kilde per verdi i `sources`)
//   health_metrics       fellesfelt per dag       (kilde per verdi i `sources`)
//   health_brand_metrics Polars egne skårer       (jsonb, slettes ved frakobling)
//
// RØRER IKKE daily_health. Den er brukerens manuelle føring og leses av dagens
// dagbok, oversikt og analyse. «Manuell verdi vinner» løses ved LESING (bolk 4),
// ikke ved at importen skriver over noe.
//
// TO REGLER SOM STYRER ALT HER:
//  1. IDEMPOTENS: samme natt importert to ganger gir ÉN rad. Unik (user_id,
//     date) + upsert, ingen insert-og-håp.
//  2. MANUELL VINNER: har brukeren ført en verdi selv (sources[felt] ===
//     'manual'), rører importen den ALDRI. Den importerte verdien lagres ikke
//     oppå — feltet hoppes over, og resten av raden oppdateres som normalt.

const SOURCE = 'polar'
const BRAND = 'polar'

export interface PolarHealthSummary {
  user_id: string
  polar_user_id: number
  sleep_nights: number
  sleep_rows_written: number
  recharge_days: number
  recharge_rows_written: number
  brand_rows_written: number
  kept_manual: string[]
  failed: number
  notes: string[]
}

export async function importPolarHealth(
  supabase: SupabaseClient,
  conn: PolarConnection,
  opts: { onlyDate?: string } = {},
): Promise<PolarHealthSummary> {
  const summary: PolarHealthSummary = {
    user_id: conn.user_id,
    polar_user_id: conn.polar_user_id,
    sleep_nights: 0, sleep_rows_written: 0,
    recharge_days: 0, recharge_rows_written: 0,
    brand_rows_written: 0,
    kept_manual: [], failed: 0, notes: [],
  }

  // ── Søvn ──────────────────────────────────────────────────
  let nights: Awaited<ReturnType<typeof fetchPolarSleep>> = []
  try {
    if (opts.onlyDate) {
      const one = await fetchPolarSleepForDate(supabase, conn, opts.onlyDate)
      nights = one ? [one] : []
    } else {
      nights = await fetchPolarSleep(supabase, conn)
    }
  } catch (e) {
    summary.notes.push(`søvn-henting feilet: ${e instanceof Error ? e.message : String(e)}`)
  }
  summary.sleep_nights = nights.length

  for (const night of nights) {
    try {
      const parsed = parsePolarSleep(night)
      if (!parsed.date) {
        summary.failed++
        continue
      }
      if (parsed.notes.length > 0) {
        console.log(`[polar-health] ${parsed.date} søvn: ${parsed.notes.join(' · ')}`)
        summary.notes.push(...parsed.notes.map(n => `${parsed.date}: ${n}`))
      }
      const res = await upsertWithManualWins(
        supabase, 'sleep_records', conn.user_id, parsed.date, parsed.common,
      )
      if (res.error) {
        summary.failed++
        summary.notes.push(`${parsed.date} søvn-lagring: ${res.error}`)
      } else {
        if (res.written > 0) summary.sleep_rows_written++
        summary.kept_manual.push(...res.keptManual.map(f => `${parsed.date}.${f}`))
      }

      if (Object.keys(parsed.brand).length > 0) {
        const bErr = await mergeBrandMetrics(supabase, conn.user_id, parsed.date, parsed.brand)
        if (bErr) summary.notes.push(`${parsed.date} merkeverdier: ${bErr}`)
        else summary.brand_rows_written++
      }
    } catch (e) {
      summary.failed++
      summary.notes.push(`søvn ${night.date}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Nightly Recharge ──────────────────────────────────────
  let recharges: Awaited<ReturnType<typeof fetchPolarNightlyRecharge>> = []
  try {
    if (opts.onlyDate) {
      const one = await fetchPolarNightlyRechargeForDate(supabase, conn, opts.onlyDate)
      recharges = one ? [one] : []
    } else {
      recharges = await fetchPolarNightlyRecharge(supabase, conn)
    }
  } catch (e) {
    summary.notes.push(`nightly-recharge-henting feilet: ${e instanceof Error ? e.message : String(e)}`)
  }
  summary.recharge_days = recharges.length

  for (const r of recharges) {
    try {
      const parsed = parsePolarRecharge(r)
      if (!parsed.date) {
        summary.failed++
        continue
      }
      if (parsed.notes.length > 0) {
        console.log(`[polar-health] ${parsed.date} recharge: ${parsed.notes.join(' · ')}`)
        summary.notes.push(...parsed.notes.map(n => `${parsed.date}: ${n}`))
      }
      const res = await upsertWithManualWins(
        supabase, 'health_metrics', conn.user_id, parsed.date, parsed.common,
      )
      if (res.error) {
        summary.failed++
        summary.notes.push(`${parsed.date} helse-lagring: ${res.error}`)
      } else {
        if (res.written > 0) summary.recharge_rows_written++
        summary.kept_manual.push(...res.keptManual.map(f => `${parsed.date}.${f}`))
      }

      if (Object.keys(parsed.brand).length > 0) {
        const bErr = await mergeBrandMetrics(supabase, conn.user_id, parsed.date, parsed.brand)
        if (bErr) summary.notes.push(`${parsed.date} merkeverdier: ${bErr}`)
        else summary.brand_rows_written++
      }
    } catch (e) {
      summary.failed++
      summary.notes.push(`recharge ${r.date}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (summary.sleep_rows_written > 0 || summary.recharge_rows_written > 0) {
    await supabase
      .from('polar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', conn.user_id)
  }

  return summary
}

// Skriver fellesfelt med kilde per verdi, og lar ALLTID en manuelt ført verdi
// stå. Returnerer hvor mange felter som faktisk ble skrevet, og hvilke som ble
// beholdt fordi brukeren hadde ført dem selv.
// Generisk over innkommende form, så kallerne beholder sine presise typer
// (ParsedSleepCommon / recharge-fellesfeltene) i stedet for å måtte kastes til
// Record. Den ene castingen ligger inne i helperen, ikke hos hver kaller.
export async function upsertWithManualWins<T extends object>(
  supabase: SupabaseClient,
  table: 'sleep_records' | 'health_metrics',
  userId: string,
  date: string,
  incoming: T,
  source: string = SOURCE,
): Promise<{ written: number; keptManual: string[]; error?: string }> {
  const { data: existing, error: readErr } = await supabase
    .from(table)
    .select('id, sources')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  if (readErr) return { written: 0, keptManual: [], error: readErr.message }

  // Regelen «manuell vinner» ligger i lib/health-source-rules.ts som en ren
  // funksjon, slik at den kan testes med assertions uten database.
  const { patch, sources, keptManual } = planManualWinsUpdate(
    existing?.sources as Record<string, string> | null,
    incoming as Record<string, unknown>,
    source,
  )

  if (Object.keys(patch).length === 0) {
    return { written: 0, keptManual }
  }

  const { error: writeErr } = await supabase
    .from(table)
    .upsert({
      user_id: userId,
      date,
      ...patch,
      sources,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
  if (writeErr) return { written: 0, keptManual, error: writeErr.message }

  return { written: Object.keys(patch).length, keptManual }
}

// Merkespesifikke skårer. Slås sammen med det som allerede ligger der for
// samme dato og merke, så en delvis import ikke sletter felter fra en tidligere.
async function mergeBrandMetrics(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  metrics: Record<string, unknown>,
): Promise<string | null> {
  const { data: existing, error: readErr } = await supabase
    .from('health_brand_metrics')
    .select('metrics')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('brand', BRAND)
    .maybeSingle()
  if (readErr) return readErr.message

  const merged = {
    ...((existing?.metrics as Record<string, unknown> | null) ?? {}),
    ...metrics,
  }

  const { error: writeErr } = await supabase
    .from('health_brand_metrics')
    .upsert({
      user_id: userId,
      date,
      brand: BRAND,
      metrics: merged,
      imported_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,brand' })
  return writeErr ? writeErr.message : null
}
