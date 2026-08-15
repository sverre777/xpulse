import type { SupabaseClient } from '@supabase/supabase-js'

// Lett-vekt Polar AccessLink-helper. Speiler lib/strava.ts: ingen state — alt
// kalles eksplisitt fra ruter/actions med en supabase-klient som allerede har
// bruker-konteksten (eller admin-klienten fra cron/webhook).
//
// VERIFISERT MOT POLARS EGEN DOKUMENTASJON + swagger (polar.com/accesslink-api):
//  · Autorisering : https://flow.polar.com/oauth2/authorization
//                   (response_type=code, client_id, redirect_uri, scope, state).
//                   Auth-koden varer 10 min og kan brukes ÉN gang.
//  · Token        : POST https://polarremote.com/v2/oauth2/token med BASIC auth
//                   (base64 av client_id:client_secret). client_secret skal
//                   ALDRI ligge i body.
//  · Token-svar   : { access_token, token_type, expires_in, x_user_id } —
//                   INGEN refresh_token. Polar: «Access tokens will not expire
//                   unless explicitly revoked by partners or users.» Vi leser
//                   likevel faktisk expires_in og håndterer fornying defensivt.
//  · API-base     : https://www.polaraccesslink.com/v3
//  · Registrering : POST /v3/users { "member-id": … } MÅ kalles etter OAuth.
//                   200 = ok · 409 = allerede registrert/duplikat member-id
//                   (behandles som suksess) · 403 = manglende obligatoriske
//                   samtykker · 204 = bruker ikke funnet.
//  · Økter        : GET /v3/exercises — KUN siste 30 dager, og kun økter lastet
//                   opp ETTER registreringen. Historikk må gå via .fit-opplasting.
//  · JSON-nøkler i økt-objektet bruker BINDESTREK (start-time, heart-rate,
//    detailed-sport-info …) og varighet er ISO-8601 ("PT2H44M45S") — ikke
//    sekunder. Derfor de siterte feltnavnene og parseIsoDuration under.

const POLAR_API = 'https://www.polaraccesslink.com/v3'
const POLAR_TOKEN_URL = 'https://polarremote.com/v2/oauth2/token'
const POLAR_AUTH_URL = 'https://flow.polar.com/oauth2/authorization'
const POLAR_SCOPE = 'accesslink.read_all'

export interface PolarConnection {
  user_id: string
  polar_user_id: number
  member_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  auto_sync: boolean
  registered_at: string | null
  last_sync_at: string | null
  last_webhook_at: string | null
}

// ── Env-lesing (server-side kun — aldri NEXT_PUBLIC_) ─────────

function polarCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.POLAR_CLIENT_ID
  const clientSecret = process.env.POLAR_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('POLAR_CLIENT_ID/POLAR_CLIENT_SECRET mangler i env')
  }
  return { clientId, clientSecret }
}

// Basic-auth-header for token- og klient-autentiserte kall.
export function polarBasicAuthHeader(): string {
  const { clientId, clientSecret } = polarCredentials()
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

function polarRedirectUri(): string {
  const uri = process.env.POLAR_REDIRECT_URI
  if (!uri) throw new Error('POLAR_REDIRECT_URI mangler i env')
  return uri
}

// ── OAuth ────────────────────────────────────────────────────

// Genererer autorisering-URL brukeren omdirigeres til. state = CSRF-token.
// Polar tåler vanlig URL-encoding (i motsetning til Stravas scope-særegenhet),
// så URLSearchParams brukes rett fram.
export function buildPolarAuthUrl(state: string): string {
  const { clientId } = polarCredentials()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: polarRedirectUri(),
    scope: POLAR_SCOPE,
    state,
  })
  return `${POLAR_AUTH_URL}?${params.toString()}`
}

export interface PolarTokenResponse {
  x_user_id: number
  access_token: string
  // expires_in kan mangle/være urimelig — null betyr «ingen kjent utløpstid».
  expires_in: number | null
  // Polar returnerer i dag ingen refresh_token. Leses likevel defensivt.
  refresh_token: string | null
}

// Bytt authorization-code mot token. Kalles fra /auth/polar/callback.
// redirect_uri sendes med fordi den ble brukt i autorisering-steget (Polar:
// «required if provided during authorization»).
export async function exchangeCodeForTokens(code: string): Promise<PolarTokenResponse> {
  const res = await fetch(POLAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: polarBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json;charset=UTF-8',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: polarRedirectUri(),
    }).toString(),
  })
  const raw = await res.text()
  if (!res.ok) {
    // Polar svarer { "error": "invalid_grant" | "invalid_client" | … }.
    // Ingen hemmeligheter i denne teksten — trygt å vise i feilmelding.
    throw new Error(`Polar token exchange feilet (${res.status}): ${raw.slice(0, 200)}`)
  }
  let data: { access_token?: string; expires_in?: number; x_user_id?: number; refresh_token?: string }
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Polar token-svar var ikke JSON: ${raw.slice(0, 200)}`)
  }
  if (!data.access_token || typeof data.x_user_id !== 'number') {
    throw new Error('Polar token-svar mangler access_token eller x_user_id')
  }
  return {
    x_user_id: data.x_user_id,
    access_token: data.access_token,
    expires_in: typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : null,
    refresh_token: data.refresh_token ?? null,
  }
}

// expires_in → ISO-tidspunkt, eller null når Polar ikke oppgir levetid.
export function expiresAtFrom(expiresIn: number | null): string | null {
  if (expiresIn == null) return null
  return new Date(Date.now() + expiresIn * 1000).toISOString()
}

// ── Brukerregistrering (finnes ikke hos Strava) ──────────────

export type PolarRegisterResult =
  | { ok: true; alreadyRegistered: boolean; polarUserId: number | null; status: number }
  | {
      ok: false
      reason: 'consents' | 'not_found' | 'member_id_conflict' | 'error'
      status: number
      message: string
    }

// Er DENNE Polar-brukeren registrert hos oss? GET /v3/users/{user-id} svarer
// 200 med brukerens basisinfo når registreringen finnes, 204 når den ikke gjør
// det. Brukes til å tolke 409 riktig (se registerPolarUser).
async function verifyPolarRegistration(
  accessToken: string,
  polarUserId: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${POLAR_API}/users/${polarUserId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    return res.status === 200
  } catch (e) {
    console.warn('[polar-register] verifisering av registrering feilet:', e)
    return false
  }
}

// POST /v3/users — MÅ kalles etter OAuth, ellers gis ingen datatilgang.
// member-id er vår Supabase-user_id.
//
// 409 betyr enten «allerede registrert» (normalt ved re-tilkobling — skal
// behandles som SUKSESS) ELLER «duplikat member-id». Det siste treffer oss
// hvis en gammel registrering på samme member-id henger igjen for en ANNEN
// Polar-konto (f.eks. hvis DELETE /v3/users feilet ved en tidligere
// frakobling). Vi skiller dem ved å slå opp registreringen for denne
// polar-brukeren — ellers ville vi trodd alt var i orden mens datahentingen
// senere feilet uforklarlig.
export async function registerPolarUser(
  accessToken: string,
  memberId: string,
  polarUserId: number,
): Promise<PolarRegisterResult> {
  let res: Response
  try {
    res = await fetch(`${POLAR_API}/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ 'member-id': memberId }),
    })
  } catch (e) {
    return {
      ok: false, reason: 'error', status: 0,
      message: e instanceof Error ? e.message : String(e),
    }
  }

  if (res.status === 409) {
    const registered = await verifyPolarRegistration(accessToken, polarUserId)
    if (registered) {
      console.log(`[polar-register] 409 — polar-bruker ${polarUserId} allerede registrert, behandles som suksess`)
      return { ok: true, alreadyRegistered: true, polarUserId, status: 409 }
    }
    console.warn(`[polar-register] 409 for member-id ${memberId}, men polar-bruker ${polarUserId} er IKKE registrert — gammel registrering henger igjen`)
    return {
      ok: false, reason: 'member_id_conflict', status: 409,
      message: 'En tidligere Polar-registrering på denne kontoen henger igjen hos Polar',
    }
  }
  if (res.status === 403) {
    // Polar: «User has not accepted all mandatory consents.» Dette er en
    // forklarbar tilstand, ikke en krasj — brukeren må godta samtykkene i
    // Polar Flow og prøve igjen.
    return {
      ok: false, reason: 'consents', status: 403,
      message: 'Polar-kontoen mangler obligatoriske samtykker',
    }
  }
  if (res.status === 204) {
    return {
      ok: false, reason: 'not_found', status: 204,
      message: 'Polar fant ikke brukeren for dette tokenet',
    }
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 200)
    return {
      ok: false, reason: 'error', status: res.status,
      message: `Polar svarte ${res.status}${body ? `: ${body}` : ''}`,
    }
  }

  // 200: { polar-user-id, member-id, registration-date, … }. Vi bruker KUN
  // polar-user-id — navn, fødselsdato, kjønn og vekt i svaret lagres aldri.
  const data = await res.json().catch(() => null) as { 'polar-user-id'?: number } | null
  return {
    ok: true,
    alreadyRegistered: false,
    polarUserId: typeof data?.['polar-user-id'] === 'number' ? data['polar-user-id'] : null,
    status: res.status,
  }
}

// ── Avregistrering (frakobling) ──────────────────────────────

export interface PolarDeregisterAttempt {
  attempt: number
  status: number
  body: string
}

export interface PolarDeregisterResult {
  ok: boolean
  status: number
  attempts: PolarDeregisterAttempt[]
  message: string
}

// Statuser det er meningsfullt å prøve på nytt: nettverksfeil (0), rate limit
// og server-feil. En 401/403/409 blir ikke bedre av flere forsøk.
function isRetryableDeregisterStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}

// DELETE /v3/users/{user-id} — avregistrerer brukeren OG revokerer tokenet.
// Påkrevd av Polar API License Agreement ved frakobling.
//
// Prøver inntil maxAttempts ganger med kort backoff. Kalleren skal ALLTID
// fullføre brukerens frakobling uansett resultat — men resultatet (inkludert
// hvert forsøk) rapporteres, så en feilet avregistrering aldri forsvinner
// stille.
export async function deregisterPolarUser(
  accessToken: string,
  polarUserId: number,
  maxAttempts = 3,
): Promise<PolarDeregisterResult> {
  const attempts: PolarDeregisterAttempt[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let status = 0
    let body = ''
    try {
      const res = await fetch(`${POLAR_API}/users/${polarUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      status = res.status
      body = (await res.text().catch(() => '')).slice(0, 200)
    } catch (e) {
      status = 0
      body = e instanceof Error ? e.message : String(e)
    }
    attempts.push({ attempt, status, body })

    // 204 (dokumentert suksess) og 200 = avregistrert + token revokert.
    if (status === 204 || status === 200) {
      return {
        ok: true, status, attempts,
        message: 'Avregistrert hos Polar — tokenet er revokert.',
      }
    }
    // 404 = ingen registrering å fjerne (f.eks. registreringen feilet i sin tid,
    // eller den er allerede fjernet). Ingenting mer å rydde hos Polar.
    if (status === 404) {
      return {
        ok: true, status, attempts,
        message: 'Fant ingen registrering hos Polar å fjerne — ingenting å rydde der.',
      }
    }
    if (status === 401) {
      return {
        ok: false, status, attempts,
        message: 'Polar avviste tokenet (401). Tilgangen kan allerede være trukket tilbake, men vi fikk ikke bekreftet det.',
      }
    }
    if (!isRetryableDeregisterStatus(status)) {
      return {
        ok: false, status, attempts,
        message: `Polar svarte ${status} på avregistreringen.`,
      }
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, attempt * 400))
    }
  }

  const last = attempts[attempts.length - 1]
  return {
    ok: false,
    status: last?.status ?? 0,
    attempts,
    message: `Avregistrering hos Polar feilet etter ${attempts.length} forsøk.`,
  }
}

// Polar Flow-siden der brukeren selv kan fjerne X-PULSE hvis avregistreringen
// vår feilet. Vises i UI kun når deregisterPolarUser ikke lyktes.
export const POLAR_MANUAL_REVOKE_URL = 'https://flow.polar.com/settings/authorizations'

// ── Tilkobling + token-fornying ──────────────────────────────

export async function getPolarConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<PolarConnection | null> {
  const { data } = await supabase
    .from('polar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as PolarConnection | null
}

// Fornyer access_token hvis det er i ferd med å utløpe. Speiler
// refreshTokenIfExpired i lib/strava.ts, men defensivt fordi Polar i dag
// verken oppgir refresh_token eller reell utløpstid:
//   · token_expires_at null  → ingen kjent utløpstid, bruk tokenet som det er
//   · utløpt UTEN refresh_token → logg TYDELIG og returner tokenet; kallet vil
//     da svare 401 og UI ber brukeren koble til på nytt (eneste vei ut når
//     Polar ikke tilbyr fornying)
//   · utløpt MED refresh_token → forny via samme BASIC-auth-endepunkt
async function refreshTokenIfExpired(
  supabase: SupabaseClient,
  conn: PolarConnection,
): Promise<string> {
  if (!conn.token_expires_at) return conn.access_token

  const expiresAt = new Date(conn.token_expires_at).getTime()
  if (Number.isNaN(expiresAt)) return conn.access_token
  // 5 min buffer, som Strava-varianten.
  if (expiresAt - Date.now() > 5 * 60 * 1000) return conn.access_token

  if (!conn.refresh_token) {
    console.warn(
      `[polar] access_token for user ${conn.user_id} er utløpt (${conn.token_expires_at}) ` +
      'og Polar har ikke gitt oss refresh_token — fornying er ikke tilgjengelig. ' +
      'Brukeren må koble til Polar på nytt.',
    )
    return conn.access_token
  }

  const res = await fetch(POLAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: polarBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json;charset=UTF-8',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }).toString(),
  })
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 200)
    console.warn(`[polar] token-fornying feilet (${res.status}): ${body}`)
    return conn.access_token
  }
  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!data.access_token) return conn.access_token

  await supabase
    .from('polar_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? conn.refresh_token,
      token_expires_at: expiresAtFrom(
        typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : null,
      ),
    })
    .eq('user_id', conn.user_id)
  return data.access_token
}

// ── Rate limits ──────────────────────────────────────────────
//
// Polars grenser er DYNAMISKE og skalerer med antall registrerte brukere, så
// vi kan ikke hardkode et tak. Vi leser headerne på hvert svar, logger når vi
// nærmer oss, og håndterer 429 med å vente til reset — aldri i tett løkke.

export interface PolarRateLimit {
  usage: number | null
  limit: number | null
  resetSeconds: number | null
}

export class PolarRateLimitError extends Error {
  constructor(public resetSeconds: number | null) {
    super(
      `Polar rate limit nådd${resetSeconds != null ? ` — prøv igjen om ${resetSeconds}s` : ''}`,
    )
    this.name = 'PolarRateLimitError'
  }
}

// Polar sender f.eks. «RateLimit-Usage: 15,100», «RateLimit-Limit: 20,500».
// Vi tar første tall (kortest vindu) — det er det som treffer oss først.
function firstNumber(header: string | null): number | null {
  if (!header) return null
  const n = Number(header.split(',')[0]?.trim())
  return Number.isFinite(n) ? n : null
}

export function readRateLimit(res: Response): PolarRateLimit {
  return {
    usage: firstNumber(res.headers.get('RateLimit-Usage') ?? res.headers.get('ratelimit-usage')),
    limit: firstNumber(res.headers.get('RateLimit-Limit') ?? res.headers.get('ratelimit-limit')),
    resetSeconds: firstNumber(res.headers.get('RateLimit-Reset') ?? res.headers.get('ratelimit-reset'))
      ?? firstNumber(res.headers.get('Retry-After')),
  }
}

// Maks ventetid ved 429 før vi gir opp og lar kalleren prøve senere. Lange
// ventetider hører ikke hjemme i en request-handler.
const MAX_RATE_LIMIT_WAIT_MS = 20_000

// Autentisert GET mot AccessLink med rate-limit-oppfølging. Ett retry-forsøk
// ved 429 dersom reset er kort nok; ellers kastes PolarRateLimitError så
// kalleren (cron) kan ta resten ved neste kjøring.
async function polarGet(token: string, path: string, label: string): Promise<Response> {
  const doFetch = () => fetch(`${POLAR_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })

  let res = await doFetch()
  const rl = readRateLimit(res)
  if (rl.usage != null && rl.limit != null && rl.limit > 0 && rl.usage / rl.limit >= 0.8) {
    console.warn(`[polar] ${label}: nærmer seg rate limit (${rl.usage}/${rl.limit}, reset ${rl.resetSeconds ?? '?'}s)`)
  }

  if (res.status === 429) {
    const waitMs = (rl.resetSeconds ?? 0) * 1000
    if (waitMs <= 0 || waitMs > MAX_RATE_LIMIT_WAIT_MS) {
      throw new PolarRateLimitError(rl.resetSeconds)
    }
    console.warn(`[polar] ${label}: 429 — venter ${rl.resetSeconds}s og prøver én gang til`)
    await new Promise(r => setTimeout(r, waitMs + 500))
    res = await doFetch()
    if (res.status === 429) throw new PolarRateLimitError(readRateLimit(res).resetSeconds)
  }
  return res
}

// ── Økt-henting ──────────────────────────────────────────────

export interface PolarHeartRate {
  average?: number
  maximum?: number
}

// Feltnavnene er Polars egne (med bindestrek) — derfor siterte nøkler.
export interface PolarExercise {
  id: number | string
  'upload-time'?: string
  'polar-user'?: string
  'transaction-id'?: number
  device?: string
  'device-id'?: string
  'start-time': string
  'start-time-utc-offset'?: number
  duration?: string               // ISO-8601, f.eks. "PT2H44M45S"
  calories?: number
  distance?: number               // meter
  'heart-rate'?: PolarHeartRate
  'training-load'?: number
  sport?: string
  'has-route'?: boolean
  'detailed-sport-info'?: string
  'running-index'?: number
}

export interface PolarExerciseDetail extends PolarExercise {
  samples?: unknown
  zones?: unknown
  route?: unknown
}

// GET /v3/exercises — KUN økter fra siste 30 dager, og kun de som er lastet
// opp etter at brukeren ble registrert hos oss.
export async function fetchPolarExercises(
  supabase: SupabaseClient,
  conn: PolarConnection,
): Promise<PolarExercise[]> {
  const token = await refreshTokenIfExpired(supabase, conn)
  const res = await polarGet(token, '/exercises', 'exercises')
  if (res.status === 204) return []
  if (!res.ok) {
    throw new Error(`Polar exercises-henting feilet: ${res.status}`)
  }
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data as PolarExercise[] : []
}

// GET /v3/exercises/{id} med valgfrie samples/soner/rute.
export async function fetchPolarExerciseDetail(
  supabase: SupabaseClient,
  conn: PolarConnection,
  exerciseId: string | number,
  options: { samples?: boolean; zones?: boolean; route?: boolean } = {},
): Promise<PolarExerciseDetail | null> {
  const token = await refreshTokenIfExpired(supabase, conn)
  const params = new URLSearchParams()
  if (options.samples) params.set('samples', 'true')
  if (options.zones) params.set('zones', 'true')
  if (options.route) params.set('route', 'true')
  const qs = params.toString()
  const res = await polarGet(
    token,
    `/exercises/${encodeURIComponent(String(exerciseId))}${qs ? `?${qs}` : ''}`,
    `exercise ${exerciseId}`,
  )
  if (res.status === 204 || res.status === 404) return null
  if (!res.ok) throw new Error(`Polar exercise-detalj feilet: ${res.status}`)
  return await res.json() as PolarExerciseDetail
}

// ISO-8601-varighet ("PT2H44M45S", "PT45M", "PT30.5S") → sekunder.
// Polar oppgir aldri varighet i sekunder, så alle kallere må gå via denne.
export function parseIsoDuration(iso: string | undefined | null): number {
  if (!iso) return 0
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(iso.trim())
  if (!m) {
    console.warn(`[polar] kunne ikke tolke varighet "${iso}" — bruker 0`)
    return 0
  }
  const [, d, h, min, s] = m
  return (
    (d ? parseInt(d, 10) * 86400 : 0) +
    (h ? parseInt(h, 10) * 3600 : 0) +
    (min ? parseInt(min, 10) * 60 : 0) +
    (s ? Math.round(parseFloat(s)) : 0)
  )
}

// ── Sport-mapping Polar → X-PULSE bevegelsesform/underkategori ──
//
// Samme kontrakt som mapStravaSportToXpulse: peker EKSKLUSIVT til eksisterende
// bevegelsesformer + underkategorier i lib/types.ts (MOVEMENT_CATEGORIES), og
// påvirker IKKE workouts.sport (hovedidretten kommer fra profilen).
//
// Polar publiserer INGEN enum for `sport`/`detailed-sport-info` — swaggeren
// oppgir dem som frie strenger. Derfor: eksakt tabell for de kjente verdiene,
// deretter nøkkelord-heuristikk for Polars kategori-prefikser
// (WINTERSPORTS_*, WATERSPORTS_*, TEAMSPORTS_* …), og til slutt «Annet» med
// console.warn så vi fanger opp nye verdier i loggen.

export interface PolarMovementMapping {
  movement: string                      // matcher MOVEMENT_CATEGORIES.name
  subcategory: string | null            // matcher subkategori, eller null
}

const POLAR_SPORT_MAP: Record<string, PolarMovementMapping> = {
  // ── LØPING ──
  RUNNING:                  { movement: 'Løping',   subcategory: null },
  JOGGING:                  { movement: 'Løping',   subcategory: null },
  ROAD_RUNNING:             { movement: 'Løping',   subcategory: 'Asfalt' },
  TRAIL_RUNNING:            { movement: 'Løping',   subcategory: 'Terreng' },
  TREADMILL_RUNNING:        { movement: 'Løping',   subcategory: 'Tredemølle' },
  TRACK_AND_FIELD_RUNNING:  { movement: 'Løping',   subcategory: 'Bane' },
  ULTRA_RUNNING:            { movement: 'Løping',   subcategory: 'Terreng' },

  // ── SYKLING ──
  CYCLING:                  { movement: 'Sykling',  subcategory: null },
  ROAD_BIKING:              { movement: 'Sykling',  subcategory: 'Landevei' },
  ROAD_CYCLING:             { movement: 'Sykling',  subcategory: 'Landevei' },
  MOUNTAIN_BIKING:          { movement: 'Sykling',  subcategory: 'Terreng/MTB' },
  GRAVEL_CYCLING:           { movement: 'Sykling',  subcategory: 'Gravel' },
  INDOOR_CYCLING:           { movement: 'Sykling',  subcategory: 'Indoors/Ergo' },
  SPINNING:                 { movement: 'Sykling',  subcategory: 'Spinning' },
  E_BIKING:                 { movement: 'Sykling',  subcategory: 'Landevei' },

  // ── SKI ──
  SKIING:                   { movement: 'Langrenn', subcategory: null },
  CROSS_COUNTRY_SKIING:     { movement: 'Langrenn', subcategory: null },
  'CROSS-COUNTRY_SKIING':   { movement: 'Langrenn', subcategory: null },
  FREESTYLE_SKIING:         { movement: 'Langrenn', subcategory: 'Skøyting' },
  CLASSIC_SKIING:           { movement: 'Langrenn', subcategory: 'Klassisk' },
  ROLLER_SKIING:            { movement: 'Rulleski', subcategory: null },
  ROLLER_SKIING_FREESTYLE:  { movement: 'Rulleski', subcategory: 'Skøyting' },
  ROLLER_SKIING_CLASSIC:    { movement: 'Rulleski', subcategory: 'Klassisk' },
  BACKCOUNTRY_SKIING:       { movement: 'Fjellsport', subcategory: 'Topptur' },
  SKI_TOURING:              { movement: 'Fjellsport', subcategory: 'Rando/Skitour' },
  DOWNHILL_SKIING:          { movement: 'Alpint',   subcategory: null },
  ALPINE_SKIING:            { movement: 'Alpint',   subcategory: null },
  TELEMARK_SKIING:          { movement: 'Telemark', subcategory: null },
  SNOWBOARDING:             { movement: 'Snowboard', subcategory: null },
  SNOWSHOE_TREKKING:        { movement: 'Tur',      subcategory: 'Snøskotur' },
  SNOWSHOEING:              { movement: 'Tur',      subcategory: 'Snøskotur' },
  BIATHLON:                 { movement: 'Langrenn', subcategory: null },

  // ── SVØMMING (default basseng 25m — bruker kan endre etter import) ──
  SWIMMING:                 { movement: 'Svømming basseng 25m', subcategory: null },
  POOL_SWIMMING:            { movement: 'Svømming basseng 25m', subcategory: null },
  OPEN_WATER_SWIMMING:      { movement: 'Svømming åpent vann',  subcategory: null },

  // ── VANN ──
  ROWING:                   { movement: 'Roing',    subcategory: 'På vann' },
  INDOOR_ROWING:            { movement: 'Roing',    subcategory: 'Romaskin' },
  KAYAKING:                 { movement: 'Kajak/Padling', subcategory: null },
  CANOEING:                 { movement: 'Kajak/Padling', subcategory: null },
  PADDLING:                 { movement: 'Kajak/Padling', subcategory: null },
  STAND_UP_PADDLING:        { movement: 'Kajak/Padling', subcategory: null },

  // ── GANG / TUR ──
  WALKING:                  { movement: 'Tur',      subcategory: 'Skogstur' },
  NORDIC_WALKING:           { movement: 'Tur',      subcategory: 'Skogstur' },
  HIKING:                   { movement: 'Tur',      subcategory: 'Fjelltur' },
  TREKKING:                 { movement: 'Tur',      subcategory: 'Fjelltur' },
  MOUNTAIN_HIKING:          { movement: 'Fjellsport', subcategory: 'Fjellvandring' },

  // ── STYRKE / FITNESS ──
  STRENGTH_TRAINING:        { movement: 'Styrke',   subcategory: null },
  FUNCTIONAL_TRAINING:      { movement: 'Styrke',   subcategory: null },
  CIRCUIT_TRAINING:         { movement: 'Styrke',   subcategory: null },
  CORE:                     { movement: 'Styrke',   subcategory: null },
  CROSSFIT:                 { movement: 'Crossfit', subcategory: null },
  HIGH_INTENSITY_INTERVAL_TRAINING: { movement: 'HIIT', subcategory: null },
  YOGA:                     { movement: 'Yoga',     subcategory: null },
  // Pilates er ikke yoga (samme presisering som i Strava-mappingen) —
  // egen bevegelsesform finnes ikke, så «Annet» framfor feil mapping.
  PILATES:                  { movement: 'Annet',    subcategory: null },

  // ── INNENDØRS-MASKINER ──
  ELLIPTICAL:               { movement: 'Ellipsemaskin', subcategory: null },
  CROSS_TRAINER:            { movement: 'Ellipsemaskin', subcategory: null },
  STAIR_CLIMBING:           { movement: 'Stairmaster',   subcategory: null },
  SKI_ERGOMETER:            { movement: 'SkiErg',        subcategory: null },

  // ── ØVRIG MED EGEN BEVEGELSESFORM ──
  INLINE_SKATING:           { movement: 'Skøyter',  subcategory: null },
  ICE_SKATING:              { movement: 'Skøyter',  subcategory: null },
  SKATING:                  { movement: 'Skøyter',  subcategory: null },
  ORIENTEERING:             { movement: 'Orientering', subcategory: null },
  ORIENTEERING_SKI:         { movement: 'Orientering', subcategory: null },
  ORIENTEERING_MTB:         { movement: 'Orientering', subcategory: null },
  CLIMBING:                 { movement: 'Klatring', subcategory: null },
  INDOOR_CLIMBING:          { movement: 'Klatring', subcategory: null },
  ROCK_CLIMBING:            { movement: 'Klatring', subcategory: null },
  DANCING:                  { movement: 'Dans',     subcategory: null },
  DANCE:                    { movement: 'Dans',     subcategory: null },
  MARTIAL_ARTS:             { movement: 'Kampsport', subcategory: null },
  BOXING:                   { movement: 'Kampsport', subcategory: null },

  // ── CATCH-ALL ──
  OTHER:                    { movement: 'Annet',    subcategory: null },
  OTHER_INDOOR:             { movement: 'Annet',    subcategory: null },
  OTHER_OUTDOOR:            { movement: 'Annet',    subcategory: null },
}

// Nøkkelord-heuristikk for Polars kategori-prefikser og ukjente varianter.
// Rekkefølgen betyr noe: mest spesifikk først.
const POLAR_KEYWORD_RULES: { match: RegExp; mapping: PolarMovementMapping }[] = [
  { match: /ROLLER_?SKI/,        mapping: { movement: 'Rulleski', subcategory: null } },
  { match: /CROSS.?COUNTRY_?SKI/, mapping: { movement: 'Langrenn', subcategory: null } },
  { match: /SNOWBOARD/,          mapping: { movement: 'Snowboard', subcategory: null } },
  { match: /TELEMARK/,           mapping: { movement: 'Telemark', subcategory: null } },
  { match: /(DOWNHILL|ALPINE)/,  mapping: { movement: 'Alpint', subcategory: null } },
  { match: /SKAT(E|ING)/,        mapping: { movement: 'Skøyter', subcategory: null } },
  { match: /TREADMILL/,          mapping: { movement: 'Løping', subcategory: 'Tredemølle' } },
  { match: /TRAIL/,              mapping: { movement: 'Løping', subcategory: 'Terreng' } },
  { match: /RUNNING/,            mapping: { movement: 'Løping', subcategory: null } },
  { match: /(BIKING|CYCLING)/,   mapping: { movement: 'Sykling', subcategory: null } },
  { match: /OPEN_?WATER/,        mapping: { movement: 'Svømming åpent vann', subcategory: null } },
  { match: /SWIM/,               mapping: { movement: 'Svømming basseng 25m', subcategory: null } },
  { match: /(KAYAK|CANOE|PADDL)/, mapping: { movement: 'Kajak/Padling', subcategory: null } },
  { match: /ROWING/,             mapping: { movement: 'Roing', subcategory: null } },
  { match: /(HIKING|TREKKING)/,  mapping: { movement: 'Tur', subcategory: 'Fjelltur' } },
  { match: /WALKING/,            mapping: { movement: 'Tur', subcategory: 'Skogstur' } },
  { match: /CLIMBING/,           mapping: { movement: 'Klatring', subcategory: null } },
  { match: /(STRENGTH|WEIGHT)/,  mapping: { movement: 'Styrke', subcategory: null } },
  { match: /YOGA/,               mapping: { movement: 'Yoga', subcategory: null } },
  { match: /ORIENTEERING/,       mapping: { movement: 'Orientering', subcategory: null } },
]

// detailed-sport-info er mer presis enn sport og prøves først.
// Fallback: { movement: 'Annet', subcategory: null } + advarsel i loggen.
export function mapPolarSportToXpulse(
  sport?: string | null,
  detailedSportInfo?: string | null,
): PolarMovementMapping {
  const candidates = [detailedSportInfo, sport]
    .map(v => (v ?? '').trim().toUpperCase())
    .filter(Boolean)

  for (const value of candidates) {
    const hit = POLAR_SPORT_MAP[value]
    if (hit) return hit
  }
  for (const value of candidates) {
    const rule = POLAR_KEYWORD_RULES.find(r => r.match.test(value))
    if (rule) return rule.mapping
  }
  if (candidates.length > 0) {
    console.warn(`[polar-sync] ukjent sport "${candidates.join('/')}" — bruker fallback Annet`)
  }
  return { movement: 'Annet', subcategory: null }
}
