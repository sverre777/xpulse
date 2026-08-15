import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchPolarNotifications,
  PolarRateLimitError,
  type PolarConnection,
} from '@/lib/polar'
import { importPolarExercises } from '@/lib/polar-import'

// Cron-fallback for Polar. Webhooken (/api/polar/webhook) er PRIMÆRKANALEN —
// denne ruta er sikkerhetsnett og kjøres derfor sjeldnere enn Strava-cronen
// (hver 6. time mot Stravas hvert 15. min, se netlify/functions/polar-sync.ts).
//
// Hva den gjør:
//  1. Spør GET /v3/notifications (klient-auth) om hvilke av VÅRE brukere som
//     har ventende data. Det er den billigste måten å finne ut hvem som
//     trenger en sjekk.
//  2. Synker de flaggede brukerne, PLUSS alle der webhooken ser død ut
//     (ingen leveranse siste 24t) — det er nettopp da fallbacken har verdi.
//     Brukere med fersk webhook-leveranse og ingen notification hoppes over,
//     så vi ikke brenner rate limit på folk som allerede er ajour.
//  3. Flagger webhook-helse: Polar deaktiverer webhooken automatisk etter 7
//     døgn med feilende leveranser, så vi varsler i loggen og i svaret før
//     det skjer.
//
// Rate limits: alle Polar-kall går gjennom polarGet i lib/polar.ts, som leser
// RateLimit-headerne, backer av og kaster PolarRateLimitError i stedet for å
// hamre videre. Vi fanger den per bruker og lar resten vente til neste kjøring.
//
// Beskyttet med CRON_SECRET som de andre cron-rutene. Service-role fordi det
// ikke finnes noen bruker-session her.

// Regnes webhooken som stille? Da tar cronen over for den brukeren.
const WEBHOOK_STALE_HOURS = 24
// Polar deaktiverer webhooken etter 7 døgn. Vi varsler i god tid før.
const WEBHOOK_WARN_DAYS = 5

interface UserResult {
  user_id: string
  polar_user_id: number
  reason: 'notification' | 'webhook-stille' | 'hoppet-over'
  imported?: number
  duplicates?: number
  conflicts?: number
  failed?: number
  error?: string
  notes?: string[]
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: connections, error } = await supabase
    .from('polar_connections')
    .select('*')
    .eq('auto_sync', true)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const conns = (connections ?? []) as PolarConnection[]
  if (conns.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, connections: 0 })
  }

  // 1. Hvem har ventende data? Best effort — feiler kallet, faller vi tilbake
  // til å sjekke alle (det er tross alt sikkerhetsnettet).
  let flagged = new Set<number>()
  let notificationsError: string | null = null
  try {
    const notifications = await fetchPolarNotifications()
    flagged = new Set(
      notifications
        .filter(n => n['data-type'] === 'EXERCISE')
        .map(n => n['user-id']),
    )
  } catch (e) {
    notificationsError = e instanceof Error ? e.message : String(e)
    console.warn('[polar-cron] notifications feilet, sjekker alle tilkoblinger:', notificationsError)
  }

  const now = Date.now()
  const results: UserResult[] = []
  const webhookHealth: { user_id: string; polar_user_id: number; last_webhook_at: string | null; days_since: number | null; warn: boolean }[] = []

  for (const conn of conns) {
    const lastWebhookMs = conn.last_webhook_at ? new Date(conn.last_webhook_at).getTime() : null
    const hoursSinceWebhook = lastWebhookMs != null ? (now - lastWebhookMs) / 3600_000 : null
    const daysSince = hoursSinceWebhook != null ? Math.floor(hoursSinceWebhook / 24) : null
    const warn = hoursSinceWebhook == null || hoursSinceWebhook / 24 >= WEBHOOK_WARN_DAYS
    webhookHealth.push({
      user_id: conn.user_id,
      polar_user_id: conn.polar_user_id,
      last_webhook_at: conn.last_webhook_at,
      days_since: daysSince,
      warn,
    })
    if (warn && conn.registered_at) {
      console.warn(
        `[polar-cron] webhook stille for polar-bruker ${conn.polar_user_id} ` +
        `(sist: ${conn.last_webhook_at ?? 'aldri'}) — Polar deaktiverer webhooken etter 7 døgn med feil`,
      )
    }

    // Ikke ferdig registrert → Polar nekter datatilgang uansett.
    if (!conn.registered_at) {
      results.push({
        user_id: conn.user_id, polar_user_id: conn.polar_user_id,
        reason: 'hoppet-over', error: 'registrering hos Polar ikke fullført',
      })
      continue
    }

    const isFlagged = flagged.has(conn.polar_user_id)
    const webhookSilent = hoursSinceWebhook == null || hoursSinceWebhook >= WEBHOOK_STALE_HOURS
    const shouldSync = isFlagged || webhookSilent || notificationsError != null
    if (!shouldSync) {
      results.push({
        user_id: conn.user_id, polar_user_id: conn.polar_user_id, reason: 'hoppet-over',
      })
      continue
    }

    const reason: UserResult['reason'] = isFlagged ? 'notification' : 'webhook-stille'
    try {
      const summary = await importPolarExercises(supabase, conn)
      results.push({
        user_id: conn.user_id,
        polar_user_id: conn.polar_user_id,
        reason,
        imported: summary.imported,
        duplicates: summary.duplicates,
        conflicts: summary.conflicts,
        failed: summary.failed,
        notes: summary.notes.length > 0 ? summary.notes : undefined,
      })
    } catch (e) {
      if (e instanceof PolarRateLimitError) {
        console.warn(`[polar-cron] rate limit for polar-bruker ${conn.polar_user_id} — resten tas ved neste kjøring`)
        results.push({
          user_id: conn.user_id, polar_user_id: conn.polar_user_id, reason,
          error: `rate limit — prøver igjen senere (reset ${e.resetSeconds ?? '?'}s)`,
        })
        break  // Ingen vits i å presse videre denne kjøringen.
      }
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[polar-cron] synk feilet for polar-bruker ${conn.polar_user_id}:`, msg)
      results.push({
        user_id: conn.user_id, polar_user_id: conn.polar_user_id, reason, error: msg,
      })
    }
  }

  const totalImported = results.reduce((n, r) => n + (r.imported ?? 0), 0)
  return NextResponse.json({
    ok: true,
    connections: conns.length,
    processed: results.filter(r => r.reason !== 'hoppet-over').length,
    total_imported: totalImported,
    notifications_error: notificationsError,
    webhook_health: webhookHealth,
    results,
  })
}
