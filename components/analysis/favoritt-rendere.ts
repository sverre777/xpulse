// Bolk 1: Favoritter-fanen rendrer en favoritt med FANENS egen renderFavoritt
// — samme komponenter som fanen bruker, lastet lazy per fane (ingen statisk
// import av fanemodulene her, så første last av /app/analyse bærer ikke alle
// recharts-chunkene). Faner uten renderFavoritt (Sammenligning, Standard-
// økter, Mal-analyse, Konkurranser, Ski-tester) gir «Åpne i fane»-kortet —
// de bygges om i bolk 5/6 (favoritt = øktsett / serie + variabel).

import type { ReactNode } from 'react'
import type { FaneKey } from '@/lib/graf-register'
import type { DateRange } from './date-range'

export interface FavorittKontekst {
  range: DateRange
  targetUserId?: string
  canSeeHealthData: boolean
  /** Lagret oppsett for akkurat denne favoritten (fase 122) — custom-grafer starter med det. */
  config?: Record<string, unknown> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RenderFavoritt = (key: string, data: any, ctx: FavorittKontekst) => ReactNode | null

const LASTERE: Partial<Record<FaneKey, () => Promise<RenderFavoritt>>> = {
  oversikt: () => import('./OverviewTab').then(m => m.renderFavoritt as RenderFavoritt),
  klokkedata: () => import('./KlokkedataTrenderTab').then(m => m.renderFavoritt as RenderFavoritt),
  styrke: () => import('./StyrkeTab').then(m => m.renderFavoritt as RenderFavoritt),
  belastning: () => import('./BelastningTab').then(m => m.renderFavoritt as RenderFavoritt),
  prestasjon: () => import('./PrestasjonTab').then(m => m.renderFavoritt as RenderFavoritt),
  terskel: () => import('./TerskelTab').then(m => m.renderFavoritt as RenderFavoritt),
  skyting: () => import('./SkytingTab').then(m => m.renderFavoritt as RenderFavoritt),
  periodisering: () => import('./PeriodiseringTab').then(m => m.renderFavoritt as RenderFavoritt),
  tester_pr: () => import('./TesterPRTab').then(m => m.renderFavoritt as RenderFavoritt),
  helse: () => import('@/components/helse/helse-favoritter').then(m => m.renderFavoritt as RenderFavoritt),
  ernering: () => import('./ErneringTab').then(m => m.renderFavoritt as RenderFavoritt),
  vaer: () => import('./WeatherTab').then(m => m.renderFavoritt as RenderFavoritt),
  hoyde_varme: () => import('./AltitudeHeatTab').then(m => m.renderFavoritt as RenderFavoritt),
  per_bevegelsesform: () => import('./MovementTab').then(m => m.renderFavoritt as RenderFavoritt),
  intensitet: () => import('./IntensityTab').then(m => m.renderFavoritt as RenderFavoritt),
  sammenlign: () => import('./CompareWorkoutsTab').then(m => m.renderFavoritt as RenderFavoritt),
  standardokter: () => import('./StandardSessionsTab').then(m => m.renderFavoritt as RenderFavoritt),
}

// Korrelasjonsgrafene (helse_korrelasjon-data) ligger i HealthTab-resten.
const KORRELASJON = () => import('./HealthTab').then(m => m.renderFavoritt as RenderFavoritt)

const cache = new Map<string, Promise<RenderFavoritt>>()

/** null = fanen har ingen favoritt-rendring (→ «Åpne i fane»). */
export function hentRenderer(fane: FaneKey, dataKey: string | null): Promise<RenderFavoritt> | null {
  const nokkel = dataKey === 'helse_korrelasjon' ? 'helse_korrelasjon' : fane
  const laster = dataKey === 'helse_korrelasjon' ? KORRELASJON : LASTERE[fane]
  if (!laster) return null
  let p = cache.get(nokkel)
  if (!p) { p = laster(); cache.set(nokkel, p) }
  return p
}
