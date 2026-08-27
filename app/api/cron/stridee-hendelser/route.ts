import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prosesserKontoHendelser } from '@/lib/stridee-prosessering'
import { prosesserDataHendelser, ryddGamleHendelser } from '@/lib/stridee-import'
import { STRIDEE_AKTIV } from '@/lib/stridee'

/**
 * Prosesserer ALLE ubehandlede hendelser fra stridee_events: først konto
 * (koblinger/frakoblinger/reauth), så data (aktiviteter + wellness), til
 * slutt opprydding av behandlede hendelser eldre enn 30 dager.
 *
 * Rekkefølgen er med vilje: en account.connected i samme bunke som utøverens
 * første activity.created må behandles først, ellers ville aktiviteten
 * hoppet over som «uten lenket bruker».
 *
 * SKILT FRA WEBHOOK-HANDLEREN MED VILJE: handleren har ti sekunders frist på
 * hele responsen og gjør bare verifiser/dekrypter/lagre/ekko. Koblingen mot
 * våre brukere skjer her, etterpå — feiler den, ligger hendelsen fortsatt
 * lagret og prøves igjen uten at Stridee må sende på nytt.
 *
 * (Erstattet /api/cron/stridee-konto før noe rakk å kalle den — én cron for
 * hele hendelsesstrømmen, én registrering i Netlify.)
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

  const konto = await prosesserKontoHendelser(db)
  const dataRes = await prosesserDataHendelser(db)
  const ryddet = await ryddGamleHendelser(db)

  console.log(
    `[stridee-hendelser] konto: behandlet=${konto.behandlet} feilet=${konto.feilet} · ` +
    `data: behandlet=${dataRes.behandlet} feilet=${dataRes.feilet} · ryddet=${ryddet}`,
  )
  if (dataRes.detaljer.length > 0) {
    console.log(`[stridee-hendelser] ${dataRes.detaljer.join(' | ')}`)
  }
  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    konto,
    data: dataRes,
    ryddet,
  })
}

export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }
