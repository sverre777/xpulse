'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'
import {
  getWorkoutStats, getAnalysisOverview, getBelastningAnalysis,
  getMovementAnalysis, getHealthCorrelations, getCompetitionAnalysis,
  getPeriodizationOverview, getTestsAndPRs,
  type WorkoutStats, type AnalysisOverview, type BelastningAnalysis,
  type MovementAnalysis, type HealthCorrelations, type CompetitionAnalysis,
  type PeriodizationOverview, type TestsAndPRs,
} from './analysis'

// Sammenligning-actions leser flere utøvere i samme kall og sørger for at
// coachen har en aktiv relasjon til hver enkelt før data returneres.
// Data-fetcherne er de samme analyse-actionsene coach-view bruker (via
// resolveTargetUser). Det betyr at tilgangskontrollen allerede er håndhevet
// der; her gjør vi en tidlig short-circuit for å gi ryddig feilbeskjed
// hvis relasjonen mangler.
export type AthleteMeta = {
  id: string
  fullName: string | null
  avatarUrl: string | null
  primarySport: Sport | null
}

export type AthleteMetricsSnapshot = {
  athlete: AthleteMeta
  permissions: {
    can_view_analysis: boolean
    can_view_dagbok: boolean
    can_edit_plan: boolean
  }
  stats: WorkoutStats | null
  overview: AnalysisOverview | null
  belastning: BelastningAnalysis | null
  movement: MovementAnalysis | null
  health: HealthCorrelations | null
  competitions: CompetitionAnalysis | null
  periodization: PeriodizationOverview | null
  errors: string[]
}

export type MultipleAthletesAnalysis = {
  athletes: AthleteMetricsSnapshot[]
  range: { from: string; to: string }
  sportFilter: Sport | null
}

type RelationRow = {
  athlete_id: string
  status: string
  can_view_analysis: boolean
  can_view_dagbok: boolean
  can_edit_plan: boolean
}

async function loadAthleteAccess(athleteIds: string[]): Promise<{
  allowed: Map<string, RelationRow>
  metaById: Map<string, AthleteMeta>
  coachId: string
} | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (athleteIds.length === 0) {
    return { allowed: new Map(), metaById: new Map(), coachId: user.id }
  }

  const [{ data: rels, error: rErr }, { data: profs, error: pErr }] = await Promise.all([
    supabase
      .from('coach_athlete_relations')
      .select('athlete_id,status,can_view_analysis,can_view_dagbok,can_edit_plan')
      .eq('coach_id', user.id)
      .in('athlete_id', athleteIds)
      .eq('status', 'active'),
    supabase
      .from('profiles')
      .select('id,full_name,avatar_url,primary_sport')
      .in('id', athleteIds),
  ])
  if (rErr) return { error: rErr.message }
  if (pErr) return { error: pErr.message }

  const allowed = new Map<string, RelationRow>()
  for (const r of (rels ?? []) as RelationRow[]) allowed.set(r.athlete_id, r)

  const metaById = new Map<string, AthleteMeta>()
  for (const p of profs ?? []) {
    metaById.set(p.id as string, {
      id: p.id as string,
      fullName: (p.full_name as string | null) ?? null,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      primarySport: (p.primary_sport as Sport | null) ?? null,
    })
  }

  return { allowed, metaById, coachId: user.id }
}

export async function getMultipleAthletesAnalysis(
  athleteIds: string[],
  fromDate: string,
  toDate: string,
  sportFilter: Sport | null = null,
): Promise<MultipleAthletesAnalysis | { error: string }> {
  const access = await loadAthleteAccess(athleteIds)
  if ('error' in access) return access

  const results = await Promise.all(athleteIds.map(async (id): Promise<AthleteMetricsSnapshot> => {
    const rel = access.allowed.get(id)
    const meta = access.metaById.get(id) ?? { id, fullName: null, avatarUrl: null, primarySport: null }
    if (!rel) {
      return {
        athlete: meta,
        permissions: { can_view_analysis: false, can_view_dagbok: false, can_edit_plan: false },
        stats: null, overview: null, belastning: null, movement: null,
        health: null, competitions: null, periodization: null,
        errors: ['Ingen aktiv relasjon'],
      }
    }
    if (!rel.can_view_analysis) {
      return {
        athlete: meta,
        permissions: {
          can_view_analysis: rel.can_view_analysis,
          can_view_dagbok: rel.can_view_dagbok,
          can_edit_plan: rel.can_edit_plan,
        },
        stats: null, overview: null, belastning: null, movement: null,
        health: null, competitions: null, periodization: null,
        errors: ['Mangler analyse-tilgang'],
      }
    }

    const primary = meta.primarySport ?? 'running'
    const movementName = movementForSport(primary)

    const [statsRes, overviewRes, belastningRes, movementRes, healthRes, compRes, periodRes] = await Promise.all([
      getWorkoutStats(fromDate, toDate, id),
      getAnalysisOverview(fromDate, toDate, sportFilter, id),
      getBelastningAnalysis(fromDate, toDate, sportFilter, id),
      getMovementAnalysis(fromDate, toDate, movementName, id),
      getHealthCorrelations(fromDate, toDate, id),
      getCompetitionAnalysis(fromDate, toDate, sportFilter, null, id),
      getPeriodizationOverview(fromDate, toDate, sportFilter, id),
    ])

    const errors: string[] = []
    const safe = <T,>(r: T | { error: string }): T | null => {
      if (r && typeof r === 'object' && 'error' in r) {
        errors.push((r as { error: string }).error)
        return null
      }
      return r as T
    }

    return {
      athlete: meta,
      permissions: {
        can_view_analysis: rel.can_view_analysis,
        can_view_dagbok: rel.can_view_dagbok,
        can_edit_plan: rel.can_edit_plan,
      },
      stats: safe(statsRes),
      overview: safe(overviewRes),
      belastning: safe(belastningRes),
      movement: safe(movementRes),
      health: safe(healthRes),
      competitions: safe(compRes),
      periodization: safe(periodRes),
      errors,
    }
  }))

  return {
    athletes: results,
    range: { from: fromDate, to: toDate },
    sportFilter,
  }
}

export type AthleteTestsSnapshot = {
  athlete: AthleteMeta
  tests: TestsAndPRs | null
  errors: string[]
}

export async function getTestComparison(
  athleteIds: string[],
  sportFilter: Sport | null = null,
): Promise<{ athletes: AthleteTestsSnapshot[] } | { error: string }> {
  const access = await loadAthleteAccess(athleteIds)
  if ('error' in access) return access

  const results = await Promise.all(athleteIds.map(async (id): Promise<AthleteTestsSnapshot> => {
    const meta = access.metaById.get(id) ?? { id, fullName: null, avatarUrl: null, primarySport: null }
    const rel = access.allowed.get(id)
    if (!rel || !rel.can_view_analysis) {
      return { athlete: meta, tests: null, errors: [rel ? 'Mangler analyse-tilgang' : 'Ingen aktiv relasjon'] }
    }
    const res = await getTestsAndPRs(sportFilter, id)
    if ('error' in res) return { athlete: meta, tests: null, errors: [res.error] }
    return { athlete: meta, tests: res, errors: [] }
  }))

  return { athletes: results }
}

function movementForSport(sport: Sport): string {
  switch (sport) {
    case 'running': return 'Løping'
    case 'cross_country_skiing': return 'Langrenn'
    case 'biathlon': return 'Langrenn'
    case 'triathlon': return 'Løping'
    case 'cycling': return 'Sykling'
    case 'long_distance_skiing': return 'Langrenn'
    case 'endurance': return 'Løping'
  }
}
