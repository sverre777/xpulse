import { schedule } from '@netlify/functions'

// Daglig cron som POSTer til /api/cron/cleanup-expired-subscriptions for
// permanent sletting av brukere etter 90-dagers grace-period. Cron-routen
// gjør selve slettingen — denne funksjonen er bare scheduler.

export const handler = schedule('0 4 * * *', async () => {
  const baseUrl = process.env.URL ?? process.env.NEXT_PUBLIC_BASE_URL
  const cronSecret = process.env.CRON_SECRET
  if (!baseUrl || !cronSecret) {
    console.error('cleanup-expired-subscriptions: URL eller CRON_SECRET mangler')
    return { statusCode: 500, body: 'Missing env config' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/cleanup-expired-subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`cleanup-expired-subscriptions: ${res.status} ${body}`)
      return { statusCode: 500, body }
    }
    console.log(`cleanup-expired-subscriptions OK: ${body}`)
    return { statusCode: 200, body }
  } catch (e) {
    console.error('cleanup-expired-subscriptions fetch failed:', e)
    return { statusCode: 500, body: String(e) }
  }
})
