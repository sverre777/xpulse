import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prosesserKontoHendelser } from '@/lib/stridee-prosessering'
import { STRIDEE_AKTIV } from '@/lib/stridee'

/**
 * Prosesserer konto-hendelser fra stridee_events.
 *
 * SKILT FRA WEBHOOK-HANDLEREN MED VILJE: handleren har ti sekunders frist på
 * hele responsen og gjør bare verifiser/dekrypter/lagre/ekko. Koblingen mot
 * våre brukere skjer her, etterpå — feiler den, ligger hendelsen fortsatt
 * lagret og prøves igjen uten at Stridee må sende på nytt.
 */
async function handler(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Uautorisert' }, { status: 401 })
  }
  if (!STRIDEE_AKTIV) {
    return NextResponse.json({ ok: true, hoppet_over: 'STRIDEE_AKTIV er av' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Mangler Supabase-env' }, { status: 500 })
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  const res = await prosesserKontoHendelser(db)
  console.log(
    `[stridee-konto] behandlet=${res.behandlet} hoppet_over=${res.hoppet_over} feilet=${res.feilet}`,
  )
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...res })
}

export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }
