import { NextRequest, NextResponse } from 'next/server'
import {
  createPolarWebhook, deletePolarWebhook, getPolarWebhook, updatePolarWebhook,
  POLAR_WEBHOOK_EVENTS,
} from '@/lib/polar'

// Administrasjon av Polar-webhooken. Polar har ÉN webhook per klient (ikke
// per bruker), så dette er en klient-operasjon — ikke noe en vanlig bruker
// skal kunne trigge. Beskyttet med CRON_SECRET, samme mønster som
// /api/cron/*-rutene.
//
//   GET    — hva er registrert nå?
//   POST   — opprett webhook mot /api/polar/webhook på vår egen base-URL
//   DELETE — fjern webhook (?id=<webhookId>)
//
// VIKTIG: signature_secret_key returneres KUN i svaret på POST — det er
// eneste sjanse til å få den. Den må lagres som POLAR_WEBHOOK_SECRET i
// Netlify. Vi logger den aldri.
//
// Rekkefølge ved oppsett:
//   1. POST hit → Polar sender en PING til /api/polar/webhook, som alltid
//      svarer 200 (også uten hemmelighet — den finnes jo ikke ennå)
//   2. Kopier signature_secret_key inn i POLAR_WEBHOOK_SECRET i Netlify
//   3. Redeploy. Fra da av verifiseres alle EXERCISE-events.

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return (req.headers.get('authorization') ?? '') === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { status, body } = await getPolarWebhook()
    return NextResponse.json({ ok: status === 200, status, webhook: body })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL
  if (!baseUrl) {
    return NextResponse.json({
      ok: false, error: 'NEXT_PUBLIC_BASE_URL/URL mangler i env',
    }, { status: 500 })
  }
  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/polar/webhook`

  try {
    const res = await createPolarWebhook(webhookUrl)
    if (res.status === 409) {
      return NextResponse.json({
        ok: false, status: 409, url: webhookUrl,
        error: 'Det finnes allerede en webhook for denne klienten. Slett den først (DELETE) hvis du vil lage en ny.',
        body: res.body,
      })
    }
    if (res.status !== 201) {
      return NextResponse.json({
        ok: false, status: res.status, url: webhookUrl,
        error: 'Polar opprettet ikke webhooken. Vanligste årsak: PING-en nådde ikke fram, eller url-en svarte ikke 200.',
        body: res.body,
      })
    }
    console.log(`[polar-webhook-admin] webhook opprettet (id ${res.id}) mot ${webhookUrl}`)
    return NextResponse.json({
      ok: true,
      status: res.status,
      id: res.id,
      url: webhookUrl,
      signature_secret_key: res.signature_secret_key,
      note: 'Lagre signature_secret_key som POLAR_WEBHOOK_SECRET i Netlify og redeploy. ' +
        'Dette er eneste gang Polar viser den.',
    })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}

// PATCH ?id=<webhookId> — oppdaterer event-typene på en EKSISTERENDE webhook.
// Brukes til å legge til SLEEP (kø #52) uten å opprette webhooken på nytt.
// Viktig: signature_secret_key beholdes, så POLAR_WEBHOOK_SECRET i Netlify
// forblir gyldig og ingen redeploy er nødvendig.
export async function PATCH(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Mangler ?id=<webhookId>' }, { status: 400 })
  }
  try {
    const res = await updatePolarWebhook(id, [...POLAR_WEBHOOK_EVENTS])
    const ok = res.status >= 200 && res.status < 300
    return NextResponse.json({
      ok,
      status: res.status,
      events: POLAR_WEBHOOK_EVENTS,
      body: res.body,
      note: ok
        ? 'Webhooken abonnerer nå på EXERCISE og SLEEP. Hemmeligheten er uendret — ingen redeploy nødvendig.'
        : 'Oppdateringen gikk ikke igjennom. Sjekk id-en med GET på samme rute.',
    })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Mangler ?id=<webhookId>' }, { status: 400 })
  }
  try {
    const { status } = await deletePolarWebhook(id)
    return NextResponse.json({ ok: status === 204 || status === 200, status })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}
