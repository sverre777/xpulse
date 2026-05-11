import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Diagnose-endepunkt — sjekker at klokkesync-infrastrukturen er på plass.
// Krever innlogget bruker. Returnerer JSON med status på env-vars, DB-
// tabeller, fase 51-kolonner, brukerens heart zones, og kvalitet på
// nyeste Strava-import (laps, samples, zones populated).
//
// Brukes av "Diagnose"-knappen i KlokkesyncView for å avdekke vanlige
// årsaker til at importer ikke får komplett data.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  // Env-vars vi trenger.
  const env = {
    STRAVA_CLIENT_ID: !!process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: !!process.env.STRAVA_CLIENT_SECRET,
    STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI ?? null,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? null,
    URL: process.env.URL ?? null,
  }

  // ── Tabell-sjekk: prøver en HEAD-query mot hver kritisk tabell.
  const tables = {
    strava_connections: false,
    imported_activities: false,
    workout_samples: false,
    workout_activities: false,
    workouts: false,
  }
  for (const t of Object.keys(tables) as (keyof typeof tables)[]) {
    const { error } = await supabase.from(t).select('*', { count: 'exact', head: true }).limit(0)
    tables[t] = !error
  }

  // ── Fase 51-kolonner: prøver en select på hver ny kolonne. Hvis
  // kolonnen mangler returnerer PostgREST en feil "column does not exist"
  // som vi kan plukke opp for å vite at migrasjonen ikke er kjørt.
  const phase51Columns = await checkColumns(supabase, [
    { table: 'workouts', column: 'suffer_score' },
    { table: 'workouts', column: 'calories' },
    { table: 'workout_activities', column: 'max_hr' },
    { table: 'workout_activities', column: 'avg_watts' },
    { table: 'workout_activities', column: 'max_watts' },
    { table: 'workout_activities', column: 'avg_speed_ms' },
    { table: 'workout_activities', column: 'max_speed_ms' },
    { table: 'workout_activities', column: 'avg_cadence' },
    { table: 'workout_activities', column: 'max_cadence' },
    { table: 'workout_activities', column: 'rpe' },
    { table: 'workout_activities', column: 'lap_notes' },
    { table: 'workout_samples', column: 'temperature_samples' },
    { table: 'workout_samples', column: 'distance_samples' },
  ])

  const missingColumns = phase51Columns.filter(c => !c.exists)
  const phase51Migrated = missingColumns.length === 0

  // ── Strava-tilkobling.
  const { data: conn } = await supabase
    .from('strava_connections')
    .select('strava_athlete_id, token_expires_at, last_sync_at, auto_sync, scope')
    .eq('user_id', user.id)
    .maybeSingle()

  // ── Heart zones — brukes for sone-beregning. Hvis ingen rader OG
  // verken max_heart_rate eller birth_year er satt, faller vi tilbake til
  // 190 bpm og resultatet kan se rart ut.
  const { data: zoneRows } = await supabase
    .from('user_heart_zones')
    .select('zone_name')
    .eq('user_id', user.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_heart_rate, birth_year')
    .eq('id', user.id)
    .maybeSingle()
  const heartZones = {
    rows_in_user_heart_zones: zoneRows?.length ?? 0,
    profile_max_heart_rate: profile?.max_heart_rate ?? null,
    profile_birth_year: profile?.birth_year ?? null,
    fallback_active: (zoneRows?.length ?? 0) === 0
      && !profile?.max_heart_rate && !profile?.birth_year,
  }

  // ── Kvalitet på siste 10 Strava-importer: hvor mange har lap-rows og
  // hvor mange har samples. Avslører silent failures der workout-rad ble
  // opprettet men lap/samples-insert feilet.
  const { data: recentImports } = await supabase
    .from('imported_activities')
    .select('workout_id, external_id, imported_at')
    .eq('user_id', user.id)
    .eq('source', 'strava')
    .not('workout_id', 'is', null)
    .order('imported_at', { ascending: false })
    .limit(10)

  const importStats: Array<{
    workout_id: string
    external_id: string | null
    imported_at: string
    lap_count: number
    has_samples: boolean
    has_zones: boolean
  }> = []

  for (const imp of recentImports ?? []) {
    if (!imp.workout_id) continue
    const [{ count: lapCount }, { count: sampleCount }, { data: actsWithZones }] = await Promise.all([
      supabase.from('workout_activities')
        .select('*', { count: 'exact', head: true })
        .eq('workout_id', imp.workout_id),
      supabase.from('workout_samples')
        .select('*', { count: 'exact', head: true })
        .eq('workout_id', imp.workout_id),
      supabase.from('workout_activities')
        .select('zones')
        .eq('workout_id', imp.workout_id),
    ])

    const hasZones = (actsWithZones ?? []).some(a => {
      const z = a.zones as Record<string, unknown> | null
      if (!z) return false
      const total = ['I1','I2','I3','I4','I5'].reduce((s, k) => s + (Number(z[k]) || 0), 0)
      return total > 0
    })

    importStats.push({
      workout_id: imp.workout_id,
      external_id: imp.external_id,
      imported_at: imp.imported_at,
      lap_count: lapCount ?? 0,
      has_samples: (sampleCount ?? 0) > 0,
      has_zones: hasZones,
    })
  }

  const importedWithoutLaps = importStats.filter(s => s.lap_count === 0).length
  const importedWithoutSamples = importStats.filter(s => !s.has_samples).length
  const importedWithoutZones = importStats.filter(s => !s.has_zones).length

  return NextResponse.json({
    user_id: user.id,
    env,
    tables,
    phase51: {
      migrated: phase51Migrated,
      missing_columns: missingColumns,
    },
    user_strava_connection: conn ? {
      has_athlete_id: !!conn.strava_athlete_id,
      scope: conn.scope ?? null,
      token_expires_at: conn.token_expires_at,
      token_expired: conn.token_expires_at
        ? new Date(conn.token_expires_at).getTime() < Date.now()
        : null,
      last_sync_at: conn.last_sync_at,
      auto_sync: conn.auto_sync,
    } : null,
    heart_zones: heartZones,
    recent_imports: {
      checked: importStats.length,
      without_laps: importedWithoutLaps,
      without_samples: importedWithoutSamples,
      without_zones: importedWithoutZones,
      details: importStats,
    },
  })
}

// Sjekk om en kolonne finnes ved å prøve en select(column).limit(0).
// PostgREST returnerer 42703-feil hvis kolonnen ikke finnes.
async function checkColumns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cols: Array<{ table: string; column: string }>,
): Promise<Array<{ table: string; column: string; exists: boolean }>> {
  const results: Array<{ table: string; column: string; exists: boolean }> = []
  for (const c of cols) {
    const { error } = await supabase.from(c.table).select(c.column).limit(0)
    // Kolonne mangler → typisk feil med code "42703" eller melding
    // som inneholder "column ... does not exist".
    const exists = !error || !(error.message?.toLowerCase().includes('does not exist') ?? false)
    results.push({ table: c.table, column: c.column, exists })
  }
  return results
}
