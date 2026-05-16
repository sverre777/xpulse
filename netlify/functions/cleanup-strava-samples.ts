import { schedule } from '@netlify/functions'

// Netlify Scheduled Function — kjøres daglig kl 03:00.
// Kaller den eksisterende Next.js API-ruten /api/cron/cleanup-strava-samples
// som inneholder selve sletting-logikken. Strava API Agreement § 7 krever
// at rå Strava-data (workout_samples) slettes etter 7 dager.
//
// Vi holder logikken i Next.js-ruten så den også kan trigges manuelt fra
// browser (GET) eller annet kall — denne funksjonen er bare cron-trigger.
//
// Påkrevde env-variabler i Netlify:
//   URL                  — fylles automatisk av Netlify til site-URL
//   CRON_SECRET          — matcher Bearer-tokenet API-ruten validerer mot
//
// Schedule-syntax er standard cron. "0 3 * * *" = hver dag kl 03:00 UTC.

export const handler = schedule('0 3 * * *', async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!baseUrl || !cronSecret) {
    console.error('cleanup-strava-samples: URL eller CRON_SECRET mangler i env')
    return { statusCode: 500, body: 'Missing env config' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/cleanup-strava-samples`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`cleanup-strava-samples: ${res.status} ${body}`)
      return { statusCode: 500, body }
    }
    console.log(`cleanup-strava-samples OK: ${body}`)
    return { statusCode: 200, body }
  } catch (e) {
    console.error('cleanup-strava-samples fetch failed:', e)
    return { statusCode: 500, body: String(e) }
  }
})
