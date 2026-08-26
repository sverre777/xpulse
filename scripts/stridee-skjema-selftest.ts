/**
 * Sømtest mot det FAKTISKE prod-skjemaet.
 * Kjør: npx tsx scripts/stridee-skjema-selftest.ts
 *
 * SKJEMA-REGELEN: migreringsfilene i repoet er ikke fasit for prod. Denne
 * skriver en ekte rad med nøyaktig den formen webhook-ruta bruker, sjekker at
 * dedupe-nøkkelen gir 23505 slik koden forventer, og rydder etter seg.
 *
 * Den beviser altså at koden og tabellen passer sammen — noe verken tsc eller
 * build kan se, fordi Supabase-kall er utypede mot skjemaet.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function lesEnv(navn: string): string {
  const fil = readFileSync('.env.local', 'utf8')
  const m = new RegExp(`^${navn}=(.*)$`, 'm').exec(fil)
  const v = m?.[1]?.trim()
  if (!v) throw new Error(`${navn} mangler i .env.local`)
  return v
}

const db = createClient(lesEnv('NEXT_PUBLIC_SUPABASE_URL'), lesEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

const ID = 'selftest-' + Date.now()
let feil = 0
function sjekk(n: string, f: unknown, v: unknown) {
  const ok = f === v
  if (!ok) feil++
  console.log(`${ok ? 'OK  ' : 'FEIL'}  ${n}: ${String(f)}${ok ? '' : ` (ventet ${String(v)})`}`)
}

async function main() {
  // Nøyaktig samme felt-sett som app/api/klokkesync/stridee/webhook/route.ts
  const rad = {
    webhook_id: ID,
    event_type: 'selftest.ping',
    account_id: 'acct_selftest',
    payload: { nonce: 'n1', account_id: 'acct_selftest', type: 'selftest.ping', nested: { a: 1 } },
  }

  const { error: e1 } = await db.from('stridee_events').insert(rad)
  sjekk('innsetting med rutas felt-sett', e1?.message ?? 'ok', 'ok')

  const { data, error: e2 } = await db
    .from('stridee_events')
    .select('webhook_id, event_type, account_id, payload, received_at, processed_at, attempts')
    .eq('webhook_id', ID)
    .single()
  sjekk('raden kan leses tilbake', e2?.message ?? 'ok', 'ok')
  sjekk('jsonb bevarer nostet struktur',
    (data?.payload as { nested?: { a?: number } } | undefined)?.nested?.a, 1)
  sjekk('processed_at er null (ubehandlet)', data?.processed_at, null)
  sjekk('attempts starter paa 0', data?.attempts, 0)

  // Dedupe: ruta behandler 23505 som suksess, ikke feil. Feiler denne, ville
  // en parallell retry gitt 500 i stedet for ekko.
  const { error: e3 } = await db.from('stridee_events').insert(rad)
  sjekk('duplikat gir unik-brudd 23505', e3?.code, '23505')

  const { error: e4 } = await db.from('stridee_events').delete().eq('webhook_id', ID)
  sjekk('opprydding', e4?.message ?? 'ok', 'ok')
  const { count } = await db
    .from('stridee_events').select('*', { count: 'exact', head: true }).eq('webhook_id', ID)
  sjekk('testraden er borte', count, 0)

  const { count: total } = await db
    .from('stridee_events').select('*', { count: 'exact', head: true })
  console.log(`\nRader i stridee_events etter test: ${total}`)
  console.log(feil === 0 ? 'Alle tester grønne.' : `${feil} feil.`)
  process.exit(feil === 0 ? 0 : 1)
}
void main()
