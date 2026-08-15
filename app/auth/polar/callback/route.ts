import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeCodeForTokens,
  expiresAtFrom,
  registerPolarUser,
} from '@/lib/polar'

// Polar omdirigerer hit etter brukerens samtykke. Flyten har ETT steg mer enn
// Strava: etter token-utvekslingen MÅ brukeren registreres hos Polar
// (POST /v3/users), ellers gis ingen datatilgang.
//
// Rekkefølge (bevisst valgt):
//   1. Verifiser CSRF-state + innlogget bruker
//   2. Veksle auth-code → token (koden varer 10 min og kan brukes én gang)
//   3. LAGRE raden FØR registrering. Da fanges «denne Polar-kontoen er
//      allerede koblet til en annen X-PULSE-bruker» (unik polar_user_id) FØR
//      vi registrerer noe hos Polar, og et token vi har hentet blir aldri
//      liggende usporet — frakoblingen (bolk 3) kan alltid revokere det.
//   4. Registrer hos Polar. Feiler den, BEHOLDES raden med registered_at=null
//      («tilkoblet, men ikke ferdig registrert») slik datamodellen i fase 89
//      ble godkjent — brukeren kan fullføre registreringen fra klokkesync-
//      siden uten ny OAuth-runde. Ingen halv-tilstand er utilsiktet.
//
// Alle utfall ender som ?polar=<status>&detail=<kort tekst> på klokkesync-
// siden, som viser dem som lesbare meldinger. Vi feilsøker i prod, så hver
// feiltilstand har sin egen status.

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const polarError = url.searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin
  const settingsUrl = (status: string, detail?: string) => {
    const u = new URL('/app/innstillinger/klokkesync', baseUrl)
    u.searchParams.set('polar', status)
    if (detail) u.searchParams.set('detail', detail.slice(0, 160))
    return u
  }

  console.log('[polar-callback] start', {
    hasCode: !!code, hasState: !!state, polarError,
    cookiePresent: !!req.cookies.get('polar_oauth_state')?.value,
  })

  if (polarError) {
    // Brukeren avviste, eller Polar avbrøt (f.eks. access_denied).
    return NextResponse.redirect(settingsUrl('avbrutt', `polar=${polarError}`))
  }
  if (!code || !state) {
    return NextResponse.redirect(settingsUrl('avbrutt', 'mangler code eller state'))
  }

  // Verifiser CSRF-state. Format: csrf:userId
  const [csrfFromUrl, userIdFromState] = state.split(':')
  const csrfFromCookie = req.cookies.get('polar_oauth_state')?.value
  if (!csrfFromUrl || !userIdFromState) {
    return NextResponse.redirect(settingsUrl('feil-state', 'state-format'))
  }
  if (!csrfFromCookie) {
    return NextResponse.redirect(settingsUrl('feil-state', 'cookie mangler — sjekk SameSite/Secure'))
  }
  if (csrfFromCookie !== csrfFromUrl) {
    return NextResponse.redirect(settingsUrl('feil-state', 'csrf-mismatch'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(settingsUrl('ikke-innlogget', 'session mangler i callback'))
  }
  if (user.id !== userIdFromState) {
    return NextResponse.redirect(settingsUrl('ikke-innlogget', 'user-id mismatch'))
  }

  // 2. Token-utveksling (BASIC auth — client_secret aldri i body).
  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[polar-callback] token exchange feilet:', msg)
    return NextResponse.redirect(settingsUrl('token-feilet', msg))
  }

  // 3. Lagre tilkoblingen. member_id = vår Supabase-user_id, som er det vi
  // sender til Polar som «member-id».
  const { error: upsertErr } = await supabase
    .from('polar_connections')
    .upsert({
      user_id: user.id,
      polar_user_id: tokens.x_user_id,
      member_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAtFrom(tokens.expires_in),
      auto_sync: true,
      // Nullstilles eksplisitt: ved re-tilkobling (særlig til en ANNEN
      // Polar-konto) ville et gammelt registered_at ellers blitt stående og
      // vist «registrert» for en registrering som ikke gjelder lenger.
      // Settes igjen rett under når registreringen er bekreftet.
      registered_at: null,
    }, { onConflict: 'user_id' })
  if (upsertErr) {
    // 23505 = unique_violation. Eneste unike felt utenom pk-en er
    // polar_user_id → Polar-kontoen tilhører allerede en annen X-PULSE-bruker.
    if (upsertErr.code === '23505') {
      console.warn(`[polar-callback] polar_user_id ${tokens.x_user_id} er allerede koblet til en annen bruker`)
      return NextResponse.redirect(settingsUrl('allerede-koblet', `polar-bruker ${tokens.x_user_id}`))
    }
    console.error('[polar-callback] upsert feilet:', upsertErr.message)
    return NextResponse.redirect(settingsUrl('lagring-feilet', upsertErr.message))
  }

  // 4. Registrer brukeren hos Polar. 409 (allerede registrert) = suksess.
  const reg = await registerPolarUser(tokens.access_token, user.id, tokens.x_user_id)
  if (!reg.ok) {
    if (reg.reason === 'consents') {
      console.warn(`[polar-callback] 403 fra /v3/users for user ${user.id} — manglende samtykker`)
      return NextResponse.redirect(settingsUrl('samtykke-mangler'))
    }
    if (reg.reason === 'member_id_conflict') {
      return NextResponse.redirect(settingsUrl('registrering-konflikt', `polar-bruker ${tokens.x_user_id}`))
    }
    console.error(`[polar-callback] registrering feilet (${reg.status}): ${reg.message}`)
    return NextResponse.redirect(settingsUrl('registrering-feilet', reg.message))
  }

  const { error: regErr } = await supabase
    .from('polar_connections')
    .update({ registered_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (regErr) {
    // Registreringen hos Polar gikk igjennom, men vi klarte ikke å notere det.
    // Tilkoblingen fungerer; UI tilbyr «fullfør registrering» som er idempotent
    // (Polar svarer 409 → suksess) og setter feltet ved neste forsøk.
    console.error('[polar-callback] kunne ikke sette registered_at:', regErr.message)
    return NextResponse.redirect(settingsUrl('registrering-feilet', `lagring av registrering: ${regErr.message}`))
  }

  console.log(`[polar-callback] suksess for user ${user.id} (polar-bruker ${tokens.x_user_id}, allerede registrert: ${reg.alreadyRegistered})`)
  const response = NextResponse.redirect(settingsUrl('koblet'))
  response.cookies.delete('polar_oauth_state')
  return response
}
