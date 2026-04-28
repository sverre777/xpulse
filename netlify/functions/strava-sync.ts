import { schedule } from '@netlify/functions'

// Netlify Scheduled Function — kjøres hvert 15. min. Kaller den eksister-
// ende Next.js API-ruten /api/cron/strava-sync som inneholder all logikk
// (henter alle auto_sync-brukere, importerer ikke-konflikterende fra
// Strava, lager innboks-varsel).
//
// Vi holder logikken i Next.js-ruten så den også kan trigges manuelt fra
// browser eller annet — Netlify-funksjonen er bare en cron-trigger.
//
// Påkrevde env-variabler i Netlify:
//   URL                  — fylles automatisk av Netlify til site-URL
//   CRON_SECRET          — matcher Bearer-tokenet API-ruten validerer mot
//
// Schedule-syntax er standard cron. Netlify minimum-interval er 1 min.

export const handler = schedule('*/15 * * * *', async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!baseUrl || !cronSecret) {
    console.error('strava-sync: URL eller CRON_SECRET mangler i env')
    return { statusCode: 500, body: 'Missing env config' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/strava-sync`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`strava-sync: ${res.status} ${body}`)
      return { statusCode: 500, body }
    }
    return { statusCode: 200, body }
  } catch (e) {
    console.error('strava-sync fetch failed:', e)
    return { statusCode: 500, body: String(e) }
  }
})
