import type { SupabaseClient } from '@supabase/supabase-js'

// Lett-vekt Strava-API-helper. Holder OAuth-token-fornying, aktivitet-fetch
// og stream-fetch. Ingen state — alt kalles eksplisitt fra server-actions
// med en supabase-klient som har bruker-konteksten.

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_OAUTH = 'https://www.strava.com/oauth/token'

export interface StravaConnection {
  user_id: string
  strava_athlete_id: number
  access_token: string
  refresh_token: string
  token_expires_at: string
  scope: string | null
  auto_sync: boolean
  last_sync_at: string | null
}

// Generer OAuth-URL som brukeren omdirigeres til. Caller må selv håndtere
// 302-respons. State-parameter brukes til å hindre CSRF.
// Strava krever scope som rå komma-separert liste (ikke URL-encoded
// komma). URLSearchParams ville bli kodet til %2C og %3A som Strava
// håndterer dårlig — bygger scope-parameteren manuelt for å unngå det.
const STRAVA_SCOPE = 'read,activity:read_all'

export function buildStravaAuthUrl(state: string): string {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.STRAVA_REDIRECT_URI
  if (!clientId || !redirectUri) {
    throw new Error('STRAVA_CLIENT_ID/STRAVA_REDIRECT_URI mangler i env')
  }
  // Bygg URL manuelt: client_id/redirect_uri/state encodes med
  // encodeURIComponent, men scope holdes rå.
  const parts = [
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `response_type=code`,
    `approval_prompt=auto`,
    `scope=${STRAVA_SCOPE}`,
    `state=${encodeURIComponent(state)}`,
  ]
  return `https://www.strava.com/oauth/authorize?${parts.join('&')}`
}

// Sjekker om brukerens granted-scope gir noen form for aktivitets-lese.
// Vi BER om "activity:read_all" i OAuth-flyten, men brukeren kan velge
// å granted bare "activity:read" (offentlige aktiviteter) i Strava-
// dialogen. Begge gir adgang til /athlete/activities — _all gir bare
// tilgang til de markerte som private.
//
// Returnerer false kun hvis ingen activity-scope er granted (typisk
// når bruker autoriserte med kun "read" som er profile-info).
export function hasRequiredStravaScope(scope: string | null): boolean {
  if (!scope) return false
  // Strava skiller scope-elementer med komma OG mellomrom avhengig av
  // hvordan token-responsen er formatert. Splitt på begge.
  const granted = new Set(scope.split(/[,\s]+/).filter(Boolean))
  return granted.has('activity:read') || granted.has('activity:read_all')
}

// Bytt authorization-code mot token-par. Kalles fra /auth/strava/callback.
export async function exchangeCodeForTokens(code: string): Promise<{
  athlete_id: number
  access_token: string
  refresh_token: string
  expires_at: number
  scope?: string
}> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET mangler i env')
  }
  const res = await fetch(STRAVA_OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status}`)
  }
  const data = await res.json() as {
    athlete: { id: number }
    access_token: string
    refresh_token: string
    expires_at: number
    scope?: string
  }
  return {
    athlete_id: data.athlete.id,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    scope: data.scope,
  }
}

// Fornyer access_token hvis utløpt. Returnerer fersk token + oppdaterer DB.
async function refreshTokenIfExpired(
  supabase: SupabaseClient,
  conn: StravaConnection,
): Promise<string> {
  const expiresAt = new Date(conn.token_expires_at).getTime()
  // 5 min buffer så vi ikke treffer akkurat når token utløper.
  if (expiresAt - Date.now() > 5 * 60 * 1000) return conn.access_token

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET mangler i env')
  }
  const res = await fetch(STRAVA_OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)
  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_at: number
  }
  await supabase
    .from('strava_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    })
    .eq('user_id', conn.user_id)
  return data.access_token
}

// Hent en bruker's tilkobling. Returnerer null hvis ikke koblet.
export async function getStravaConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<StravaConnection | null> {
  const { data } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as StravaConnection | null
}

// Hent aktiviteter (sammendrag) i en tidsperiode. before/after er Unix-tid
// i sekunder per Strava-API.
export async function fetchStravaActivities(
  supabase: SupabaseClient,
  conn: StravaConnection,
  options: { after?: number; before?: number; per_page?: number; page?: number } = {},
): Promise<StravaActivitySummary[]> {
  const token = await refreshTokenIfExpired(supabase, conn)
  const params = new URLSearchParams()
  if (options.after) params.set('after', String(options.after))
  if (options.before) params.set('before', String(options.before))
  params.set('per_page', String(options.per_page ?? 30))
  if (options.page) params.set('page', String(options.page))

  const res = await fetch(`${STRAVA_API}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
  return await res.json() as StravaActivitySummary[]
}

// Hent full detalj for én aktivitet (inkluderer laps).
export async function fetchStravaActivityDetail(
  supabase: SupabaseClient,
  conn: StravaConnection,
  activityId: number,
): Promise<StravaActivityDetail> {
  const token = await refreshTokenIfExpired(supabase, conn)
  const res = await fetch(`${STRAVA_API}/activities/${activityId}?include_all_efforts=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Strava detail fetch failed: ${res.status}`)
  return await res.json() as StravaActivityDetail
}

// Hent streams (puls/watt/pace osv) for en aktivitet. Returnerer kun
// keys som faktisk har data — Strava utelater rest.
export async function fetchStravaStreams(
  supabase: SupabaseClient,
  conn: StravaConnection,
  activityId: number,
  keys: string[] = ['time','heartrate','watts','velocity_smooth','altitude','cadence'],
): Promise<StravaStreamSet> {
  const token = await refreshTokenIfExpired(supabase, conn)
  const params = new URLSearchParams({
    keys: keys.join(','),
    key_by_type: 'true',
  })
  const res = await fetch(`${STRAVA_API}/activities/${activityId}/streams?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    // Streams er ikke tilgjengelig for alle aktiviteter — return tom.
    return {}
  }
  return await res.json() as StravaStreamSet
}

// ── Type-shapes for Strava-respons ────────────────────────────

export interface StravaActivitySummary {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  elapsed_time: number
  moving_time: number
  distance: number
  total_elevation_gain: number
  average_heartrate: number | null
  max_heartrate: number | null
  average_watts: number | null
  max_watts: number | null
  average_speed: number
  max_speed: number
  perceived_exertion: number | null
}

export interface StravaActivityDetail extends StravaActivitySummary {
  description: string | null
  laps: StravaLap[]
}

export interface StravaLap {
  id: number
  name: string
  lap_index: number
  elapsed_time: number
  moving_time: number
  distance: number
  total_elevation_gain: number
  average_heartrate: number | null
  max_heartrate: number | null
  average_watts: number | null
  average_speed: number
}

export interface StravaStream {
  data: number[]
  series_type: string
  original_size: number
  resolution: string
}

export interface StravaStreamSet {
  time?: StravaStream
  heartrate?: StravaStream
  watts?: StravaStream
  velocity_smooth?: StravaStream
  altitude?: StravaStream
  cadence?: StravaStream
}

// ── Sport-mapping Strava → X-PULSE bevegelsesform/underkategori ──
//
// Strava-feltet `sport_type` er det moderne, presise feltet (skiller f.eks.
// MountainBikeRide vs Ride). Mapping nedenfor peker EKSKLUSIVT til
// EKSISTERENDE bevegelsesformer + underkategorier i lib/types.ts.
//
// VIKTIG: Mapping påvirker IKKE workouts.sport. Sport hentes fra brukerens
// primary_sport i profilen — en langrennsutøver som synker en sykkeltur er
// fortsatt en langrennsutøver, sykkelen er krysstrening for hovedsporten.
// Mappingen styrer kun activity-radenes movement_name + movement_subcategory.

export interface StravaMovementMapping {
  movement: string                      // matcher MOVEMENT_CATEGORIES.name
  subcategory: string | null            // matcher subkategori i MOVEMENT_CATEGORIES, eller null
}

const STRAVA_SPORT_MAP: Record<string, StravaMovementMapping> = {
  // ── LØPE-RELATERT ──
  Run:                { movement: 'Løping',                  subcategory: null },
  TrailRun:           { movement: 'Løping',                  subcategory: 'Terreng' },
  VirtualRun:         { movement: 'Løping',                  subcategory: 'Tredemølle' },

  // ── SYKLING ──
  Ride:               { movement: 'Sykling',                 subcategory: 'Landevei' },
  MountainBikeRide:   { movement: 'Sykling',                 subcategory: 'Terreng/MTB' },
  GravelRide:         { movement: 'Sykling',                 subcategory: 'Gravel' },
  VirtualRide:        { movement: 'Sykling',                 subcategory: 'Indoors/Ergo' },
  EBikeRide:          { movement: 'Sykling',                 subcategory: 'Landevei' },
  EMountainBikeRide:  { movement: 'Sykling',                 subcategory: 'Terreng/MTB' },
  Velomobile:         { movement: 'Sykling',                 subcategory: 'Landevei' },
  Handcycle:          { movement: 'Sykling',                 subcategory: null },

  // ── LANGRENN / SKI ──
  NordicSki:          { movement: 'Langrenn',                subcategory: null },
  RollerSki:          { movement: 'Rulleski',                subcategory: null },
  BackcountrySki:     { movement: 'Fjellsport',              subcategory: 'Topptur' },
  AlpineSki:          { movement: 'Alpint',                  subcategory: null },
  Snowboard:          { movement: 'Snowboard',               subcategory: null },
  Snowshoe:           { movement: 'Tur',                     subcategory: 'Snøskotur' },

  // ── SVØMMING (default basseng 25m — bruker kan endre etter import) ──
  Swim:               { movement: 'Svømming basseng 25m',    subcategory: null },

  // ── VANN ──
  Rowing:             { movement: 'Roing',                   subcategory: 'På vann' },
  VirtualRow:         { movement: 'Roing',                   subcategory: 'Romaskin' },
  Canoeing:           { movement: 'Kajak/Padling',           subcategory: null },
  Kayaking:           { movement: 'Kajak/Padling',           subcategory: null },
  StandUpPaddling:    { movement: 'Kajak/Padling',           subcategory: null },
  Surfing:            { movement: 'Annet',                   subcategory: null },
  Sail:               { movement: 'Annet',                   subcategory: null },
  Kitesurf:           { movement: 'Annet',                   subcategory: null },
  Windsurf:           { movement: 'Annet',                   subcategory: null },

  // ── GANG / TUR ──
  Walk:               { movement: 'Tur',                     subcategory: 'Skogstur' },
  Hike:               { movement: 'Tur',                     subcategory: 'Fjelltur' },

  // ── STYRKE / FITNESS ──
  WeightTraining:     { movement: 'Styrke',                  subcategory: null },
  Workout:            { movement: 'Styrke',                  subcategory: null },
  Crossfit:           { movement: 'Crossfit',                subcategory: null },
  Yoga:               { movement: 'Yoga',                    subcategory: null },
  // Pilates er ikke yoga (brukeren presisert) — fall tilbake til Annet
  // i stedet for å mappe feil. Egen Pilates-bevegelsesform finnes ikke.
  Pilates:            { movement: 'Annet',                   subcategory: null },

  // ── INNENDØRS ──
  StairStepper:       { movement: 'Stairmaster',             subcategory: null },
  Elliptical:         { movement: 'Ellipsemaskin',           subcategory: null },

  // ── ANNET (eksisterende-match) ──
  IceSkate:           { movement: 'Skøyter',                 subcategory: null },
  InlineSkate:        { movement: 'Skøyter',                 subcategory: null },
  RockClimbing:       { movement: 'Klatring',                subcategory: null },
  Dance:              { movement: 'Dans',                    subcategory: null },

  // ── ANNET (catch-all — Strava-typer uten matchende bevegelsesform) ──
  Skateboard:         { movement: 'Annet',                   subcategory: null },
  Soccer:             { movement: 'Annet',                   subcategory: null },
  Golf:               { movement: 'Annet',                   subcategory: null },
  Wheelchair:         { movement: 'Annet',                   subcategory: null },
  Basketball:         { movement: 'Annet',                   subcategory: null },
  Volleyball:         { movement: 'Annet',                   subcategory: null },
  Cricket:            { movement: 'Annet',                   subcategory: null },
  Padel:              { movement: 'Annet',                   subcategory: null },
  PhysicalTherapy:    { movement: 'Annet',                   subcategory: null },
}

// Returnerer { movement, subcategory } for en Strava sport_type-verdi.
// Logger ukjente Strava-typer til konsollen så vi kan oppdage nye verdier.
// Fallback: { movement: 'Annet', subcategory: null }.
export function mapStravaSportToXpulse(stravaType: string): StravaMovementMapping {
  const hit = STRAVA_SPORT_MAP[stravaType]
  if (hit) return hit
  if (stravaType) {
    console.warn(`[strava-sync] ukjent sport_type "${stravaType}" — bruker fallback Annet`)
  }
  return { movement: 'Annet', subcategory: null }
}
