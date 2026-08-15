import { schedule } from '@netlify/functions'

// Netlify Scheduled Function — Polar-fallback. Kjøres hver 6. time, altså
// MYE sjeldnere enn Strava-cronen (*/15), fordi webhooken er primærkanalen
// for Polar. Denne fanger opp det webhooken måtte ha mistet, og oppdager at
// webhooken har blitt stille før Polar deaktiverer den (7 døgn med feilende
// leveranser).
//
// All logikk ligger i Next.js-ruten /api/cron/polar-sync så den også kan
// trigges manuelt — funksjonen her er bare cron-triggeren.
//
// Påkrevde env-variabler i Netlify:
//   URL         — fylles automatisk av Netlify til site-URL
//   CRON_SECRET — matcher Bearer-tokenet API-ruten validerer mot

export const handler = schedule('17 */6 * * *', async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!baseUrl || !cronSecret) {
    console.error('polar-sync: URL eller CRON_SECRET mangler i env')
    return { statusCode: 500, body: 'Missing env config' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/polar-sync`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`polar-sync: ${res.status} ${body}`)
      return { statusCode: 500, body }
    }
    return { statusCode: 200, body }
  } catch (e) {
    console.error('polar-sync fetch failed:', e)
    return { statusCode: 500, body: String(e) }
  }
})
