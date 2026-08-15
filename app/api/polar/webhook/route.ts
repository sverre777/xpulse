import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPolarWebhookSignature, type PolarConnection } from '@/lib/polar'
import { importPolarExercises } from '@/lib/polar-import'
import { importPolarHealth } from '@/lib/polar-health-import'

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
  /** Ikke dokumentert for SLEEP, men leses hvis Polar sender den. */
  date?: string
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

  const polarUserId = payload.user_id
  if (typeof polarUserId !== 'number') {
    console.warn(`[polar-webhook] ${event} uten user_id:`, raw.slice(0, 200))
    return NextResponse.json({ ok: true, ignored: 'mangler user_id' })
  }

  if (event === 'EXERCISE') {
    const entityId = payload.entity_id
    if (!entityId) {
      console.warn('[polar-webhook] EXERCISE uten entity_id:', raw.slice(0, 200))
      return NextResponse.json({ ok: true, ignored: 'mangler entity_id' })
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

  if (event === 'SLEEP') {
    // Polar dokumenterer entity_id + url for SLEEP, ikke et eget date-felt.
    // Vi leser datoen fra det som finnes, og faller tilbake til å hente hele
    // 28-dagers-lista hvis ingen dato lar seg utlede — heller en runde for mye
    // enn en natt som aldri kommer inn.
    const date = sleepDateFromPayload(payload)
    if (!date) {
      console.warn('[polar-webhook] SLEEP uten utledbar dato — henter siste 28 dager:', raw.slice(0, 200))
    }
    after(async () => {
      try {
        await processSleepEvent(polarUserId, date)
      } catch (e) {
        console.error(`[polar-webhook] søvn-prosessering feilet for polar-bruker ${polarUserId}:`, e)
      }
    })
    return NextResponse.json({ ok: true })
  }

  // CONTINUOUS_HEART_RATE o.l. — vi abonnerer ikke på dem, men svarer 200 så
  // Polar ikke teller leveransen som mislykket.
  console.log(`[polar-webhook] ignorerer event ${event}`)
  return NextResponse.json({ ok: true, ignored: event })
}

// SLEEP-payloaden har entity_id og url. Datoen ligger i url-en
// (…/v3/users/sleep/2026-08-15) og noen ganger i entity_id.
function sleepDateFromPayload(p: PolarWebhookPayload): string | null {
  const iso = /(\d{4}-\d{2}-\d{2})/
  if (typeof p.date === 'string' && iso.test(p.date)) return iso.exec(p.date)![1]
  if (typeof p.url === 'string') {
    const m = iso.exec(p.url)
    if (m) return m[1]
  }
  if (typeof p.entity_id === 'string') {
    const m = iso.exec(p.entity_id)
    if (m) return m[1]
  }
  return null
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

  // Auto-synk avslått = ingen automatisk import. Webhook-tidsstempelet over
  // settes likevel, for det er overvåkningsdata: leveransen KOM fram.
  if (!(conn as PolarConnection).auto_sync) {
    console.log(`[polar-webhook] auto_sync er av for polar-bruker ${polarUserId} — importerer ikke`)
    return
  }

  const summary = await importPolarExercises(supabase, conn as PolarConnection, {
    onlyExerciseId: entityId,
  })
  console.log(
    `[polar-webhook] polar-bruker ${polarUserId} · økt ${entityId}: ` +
    `${summary.imported} importert, ${summary.duplicates} duplikat, ` +
    `${summary.conflicts} konflikt, ${summary.failed} feilet`,
  )
}

// SLEEP → søvn + Nightly Recharge for den natta. Samme oppslag, samme
// auto_sync-regel og samme kvittering som økt-veien.
async function processSleepEvent(polarUserId: number, date: string | null) {
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
    console.warn(`[polar-webhook] ingen tilkobling for polar-bruker ${polarUserId} — hopper over søvn`)
    return
  }

  await supabase
    .from('polar_connections')
    .update({ last_webhook_at: new Date().toISOString() })
    .eq('user_id', (conn as PolarConnection).user_id)

  if (!(conn as PolarConnection).auto_sync) {
    console.log(`[polar-webhook] auto_sync er av for polar-bruker ${polarUserId} — importerer ikke søvn`)
    return
  }

  const summary = await importPolarHealth(supabase, conn as PolarConnection,
    date ? { onlyDate: date } : {})
  console.log(
    `[polar-webhook] polar-bruker ${polarUserId} · søvn ${date ?? '(siste 28 d)'}: ` +
    `${summary.sleep_rows_written} netter skrevet, ${summary.recharge_rows_written} recharge-dager, ` +
    `${summary.brand_rows_written} merkerader, ${summary.kept_manual.length} manuelle verdier beholdt, ` +
    `${summary.failed} feilet`,
  )
}
