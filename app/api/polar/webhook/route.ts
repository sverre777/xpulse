import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPolarWebhookSignature, type PolarConnection } from '@/lib/polar'
import { importPolarExercises } from '@/lib/polar-import'

// Polar webhook — primærkanalen for nye økter. Cron-ruta
// (/api/cron/polar-sync) er kun sikkerhetsnett.
//
// Kontrakt fra Polars dokumentasjon:
//  · Vi MÅ svare 200. Feiler leveransene i 7 døgn, deaktiverer Polar
//    webhooken automatisk.
//  · Kroppen er signert med HMAC-SHA256 og hemmeligheten fra opprettelsen,
//    sendt i headeren Polar-Webhook-Signature. Vi verifiserer ALLTID før
//    prosessering og avviser med 401 ved mismatch.
//  · Ved opprettelse sender Polar en PING som må besvares 200 — den kommer
//    FØR vi kan ha lagret signature_secret_key (den fås jo i svaret på
//    opprettelsen). Derfor: PING besvares alltid 200, uansett signatur, og
//    behandles ikke videre. Det er trygt fordi PING ikke gjør noe.
//  · EXERCISE fører til import av den ene økta for riktig bruker, slått opp
//    på polar_user_id.
//
// Selve importen kjøres i after() — responsen går ut med én gang, og
// importen fortsetter etterpå i samme funksjons-kjøring.
//
// Ingen bruker-session her: vi bruker service-role-klienten og slår opp
// brukeren via polar_user_id.

interface PolarWebhookPayload {
  event?: string
  user_id?: number
  entity_id?: string
  timestamp?: string
  url?: string
}

export async function POST(req: NextRequest) {
  // Rå kropp MÅ leses som tekst — signaturen er regnet over nøyaktig disse
  // bytene. JSON.parse + re-stringify ville gitt en annen streng.
  const raw = await req.text()
  const signature = req.headers.get('Polar-Webhook-Signature')

  let payload: PolarWebhookPayload
  try {
    payload = JSON.parse(raw) as PolarWebhookPayload
  } catch {
    console.warn('[polar-webhook] kropp var ikke JSON')
    return NextResponse.json({ ok: false, error: 'ugyldig JSON' }, { status: 400 })
  }

  const event = (payload.event ?? '').toUpperCase()
  const check = verifyPolarWebhookSignature(raw, signature)

  // PING: alltid 200. Logger verifiseringsresultatet så vi ser om
  // hemmeligheten stemmer, men blokkerer aldri — ellers ville webhooken
  // verken kunne opprettes eller roteres.
  if (event === 'PING') {
    console.log(`[polar-webhook] PING mottatt (signatur ${check.ok ? 'OK' : `avvist: ${check.reason}`})`)
    return NextResponse.json({ ok: true })
  }

  if (!check.ok) {
    console.warn(`[polar-webhook] avvist ${event || 'ukjent event'}: ${check.reason}`)
    return NextResponse.json({ ok: false, error: 'ugyldig signatur' }, { status: 401 })
  }

  if (event !== 'EXERCISE') {
    // SLEEP/CONTINUOUS_HEART_RATE o.l. — vi abonnerer ikke på dem, men svarer
    // 200 så Polar ikke teller leveransen som mislykket.
    console.log(`[polar-webhook] ignorerer event ${event}`)
    return NextResponse.json({ ok: true, ignored: event })
  }

  const polarUserId = payload.user_id
  const entityId = payload.entity_id
  if (typeof polarUserId !== 'number' || !entityId) {
    console.warn('[polar-webhook] EXERCISE uten user_id/entity_id:', raw.slice(0, 200))
    return NextResponse.json({ ok: true, ignored: 'mangler user_id/entity_id' })
  }

  // Prosesser etter at responsen er sendt.
  after(async () => {
    try {
      await processExerciseEvent(polarUserId, entityId)
    } catch (e) {
      console.error(`[polar-webhook] prosessering feilet for polar-bruker ${polarUserId}:`, e)
    }
  })

  return NextResponse.json({ ok: true })
}

async function processExerciseEvent(polarUserId: number, entityId: string) {
  const supabase = createAdminClient()

  const { data: conn, error } = await supabase
    .from('polar_connections')
    .select('*')
    .eq('polar_user_id', polarUserId)
    .maybeSingle()
  if (error) {
    console.error(`[polar-webhook] oppslag på polar_user_id ${polarUserId} feilet:`, error.message)
    return
  }
  if (!conn) {
    // Kan skje like etter frakobling, før Polar har sluttet å sende.
    console.warn(`[polar-webhook] ingen tilkobling for polar-bruker ${polarUserId} — hopper over`)
    return
  }

  // Kvittér at webhooken lever — brukes til overvåkning på klokkesync-siden
  // (Polar deaktiverer webhooken etter 7 døgn med feilende leveranser).
  await supabase
    .from('polar_connections')
    .update({ last_webhook_at: new Date().toISOString() })
    .eq('user_id', (conn as PolarConnection).user_id)

  const summary = await importPolarExercises(supabase, conn as PolarConnection, {
    onlyExerciseId: entityId,
  })
  console.log(
    `[polar-webhook] polar-bruker ${polarUserId} · økt ${entityId}: ` +
    `${summary.imported} importert, ${summary.duplicates} duplikat, ` +
    `${summary.conflicts} konflikt, ${summary.failed} feilet`,
  )
}
