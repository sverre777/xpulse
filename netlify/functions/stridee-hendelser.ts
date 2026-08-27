import { schedule } from '@netlify/functions'

// Netlify Scheduled Function — klokkesynk-leverandørens hendelsesstrøm.
// Kjøres hvert kvarter (samme takt som Strava-cronen): webhooken LAGRER
// hendelsene med ti sekunders frist, denne prosesserer dem — kobler kontoer,
// importerer økter (FIT) og wellness-data, og rydder gamle hendelser.
// Minuttoffsetet (7) sprer oss fra de andre kvarters-cronene.
//
// All logikk ligger i Next.js-ruten /api/cron/stridee-hendelser så den også
// kan trigges manuelt — funksjonen her er bare cron-triggeren.
//
// Påkrevde env-variabler i Netlify:
//   URL         — fylles automatisk av Netlify til site-URL
//   CRON_SECRET — matcher Bearer-tokenet API-ruten validerer mot

export const handler = schedule('7,22,37,52 * * * *', async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!baseUrl || !cronSecret) {
    console.error('stridee-hendelser: URL eller CRON_SECRET mangler i env')
    return { statusCode: 500, body: 'Missing env config' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/stridee-hendelser`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`stridee-hendelser: ${res.status} ${body}`)
      return { statusCode: 500, body }
    }
    return { statusCode: 200, body }
  } catch (e) {
    console.error('stridee-hendelser fetch failed:', e)
    return { statusCode: 500, body: String(e) }
  }
})
