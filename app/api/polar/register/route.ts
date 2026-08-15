import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPolarConnection, registerPolarUser } from '@/lib/polar'

// Fullfør/gjenta Polar-registreringen (POST /v3/users) for en tilkobling som
// finnes, men som mangler registered_at.
//
// Trengs fordi OAuth kan lykkes mens registreringen feiler — typisk 403 «user
// has not accepted all mandatory consents». Da beholder callbacken tokenet
// (fase 89: registered_at nullable) og brukeren kan fullføre herfra etter å ha
// godtatt samtykkene i Polar Flow, uten en ny OAuth-runde.
//
// Idempotent: Polar svarer 409 hvis brukeren allerede er registrert, og det
// behandles som suksess. Returnerer detaljert status i JSON slik Strava-
// disconnect gjør, så vi kan diagnostisere uten serverlogger.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Ikke innlogget' }, { status: 401 })
  }

  const conn = await getPolarConnection(supabase, user.id)
  if (!conn) {
    return NextResponse.json({
      ok: false,
      error: 'Ingen Polar-tilkobling funnet. Koble til Polar på nytt.',
    }, { status: 404 })
  }
  if (conn.registered_at) {
    return NextResponse.json({
      ok: true,
      already_registered: true,
      registered_at: conn.registered_at,
      note: 'Allerede registrert hos Polar.',
    })
  }

  const reg = await registerPolarUser(conn.access_token, conn.member_id, conn.polar_user_id)
  if (!reg.ok) {
    const note = reg.reason === 'consents'
      ? 'Polar nekter datatilgang til obligatoriske samtykker er godtatt. Logg inn på flow.polar.com, godta samtykkene, og prøv igjen.'
      : reg.reason === 'member_id_conflict'
      ? 'Polar har en eldre registrering på kontoen din som blokkerer den nye. Koble fra Polar (som avregistrerer oss hos Polar) og koble til på nytt.'
      : 'Registreringen hos Polar gikk ikke igjennom. Tilkoblingen er beholdt — prøv igjen, eller koble til på nytt.'
    return NextResponse.json({
      ok: false,
      reason: reg.reason,
      polar_status: reg.status,
      error: reg.message,
      note,
    }, { status: 200 })
  }

  const registeredAt = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('polar_connections')
    .update({ registered_at: registeredAt })
    .eq('user_id', user.id)
  if (updErr) {
    return NextResponse.json({
      ok: false,
      reason: 'lagring',
      error: `Registrert hos Polar, men kunne ikke lagre tidspunktet: ${updErr.message}`,
    }, { status: 500 })
  }

  revalidatePath('/app/innstillinger/klokkesync')
  return NextResponse.json({
    ok: true,
    already_registered: reg.alreadyRegistered,
    polar_status: reg.status,
    registered_at: registeredAt,
    note: reg.alreadyRegistered
      ? 'Brukeren var allerede registrert hos Polar (409) — behandlet som suksess.'
      : 'Registrert hos Polar. Kun økter lastet opp etter dette tidspunktet er tilgjengelige.',
  })
}
