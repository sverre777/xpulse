import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifiserLevering, forGammel, dekrypterHendelse, lesPrivateNokler,
  stirdeeJwks, kvittering, kreverKonto, STRIDEE_AKTIV,
  type StrideeKropp,
} from '@/lib/stridee'

/**
 * Stridee webhook — https://x-pulse.no/api/klokkesync/stridee/webhook
 *
 * TI SEKUNDERS FRIST på HELE responsen. Handleren gjør derfor nøyaktig dette
 * og ikke mer: verifiser, dekrypter, lagre hendelsen rå, ekko nonce.
 * FIT-nedlasting og import skjer ETTERPÅ, asynkront, fra den lagrede
 * hendelsen (bolk 4). Det gir også gratis robusthet — feiler nedlastingen,
 * har vi fortsatt hendelsen og kan prøve igjen uten å be Stridee sende på
 * nytt.
 *
 * REKKEFØLGEN ER IKKE VALGFRI. Den er spesifisert av Stridee, og hvert steg
 * er en forutsetning for det neste:
 *   1. Verifiser detached JWS over RÅ kropp mot JWKS-en (EdDSA).
 *   2. Avvis alt eldre enn 5 minutter.
 *   3. Dedupe på webhook-id.
 *   4. Dekrypter JWE (ECDH-ES X25519, A256GCM), velg nøkkel på kid.
 *   5. FØRST NÅ: sjekk account_id — den ligger inne i ciphertext.
 *   6. Lagre.
 *   7. Svar 2xx med { "nonce": "..." } på TOPPNIVÅ.
 *
 * Om nonce-ekkoet: bare noe som holder vår private nøkkel kan produsere
 * verdien. Et bart 200, {"ok":true}, eller nonce nestet i et annet objekt
 * teller som INTET ekko. Vi ekker også på dedupe-veien — hvert forsøk får ny
 * nonce, så en cachet verdi ville ikke virket uansett.
 *
 * DEDUPE OG NONCE HENGER SAMMEN: dedupen avgjør om vi LAGRER, men vi må
 * dekryptere uansett for å finne DENNE leveringens nonce. Derfor gjør vi
 * eksistens-sjekken tidlig (så vi slipper skrivingen), men dekrypterer i
 * begge tilfeller.
 *
 * Ingen bruker-session: service-role-klienten, og account_id → user_id
 * kobles i bolk 2.
 */

/** Alt vi svarer med utenom kvitteringen. Aldri detaljer til avsender. */
function avvis(status: number, grunn: string) {
  console.warn(`[stridee-webhook] avvist (${status}): ${grunn}`)
  return NextResponse.json({ ok: false }, { status })
}

export async function POST(req: NextRequest) {
  // Bryteren. Hele integrasjonen skal kunne skrus av uten at noe annet faller.
  if (!STRIDEE_AKTIV) return avvis(503, 'STRIDEE_AKTIV er av')

  // RÅ kropp. IKKE req.json() — signaturen dekker nøyaktig disse bytene, og
  // reserialisering ville gitt andre bytes som ikke verifiserer.
  const raBody = await req.text()

  // ── 1. Signaturen
  const sig = await verifiserLevering(
    raBody,
    req.headers.get('webhook-signature'),
    stirdeeJwks(),
  )
  if (!sig.ok || !sig.id || !sig.timestamp) {
    return avvis(401, sig.grunn ?? 'signatur avvist')
  }

  // ── 2. Alderen. Id og timestamp kommer fra det SIGNERTE headeret; HTTP-
  //      kopiene er de eneste ingenting har signert.
  if (forGammel(sig.timestamp)) {
    return avvis(400, `levering for gammel (${sig.timestamp})`)
  }

  const db = createAdminClient()

  // ── 3. Dedupe
  const { data: finnes, error: oppslagFeil } = await db
    .from('stridee_events')
    .select('id')
    .eq('webhook_id', sig.id)
    .maybeSingle()
  if (oppslagFeil) return avvis(500, `dedupe-oppslag feilet: ${oppslagFeil.message}`)

  // ── 4. Dekrypteringen. Skjer også på dedupe-veien, fordi nonce er ny per
  //      forsøk og bare finnes i DENNE leveringens ciphertext.
  let kropp: StrideeKropp
  try {
    kropp = JSON.parse(raBody) as StrideeKropp
  } catch {
    return avvis(400, 'kroppen var ikke JSON')
  }
  if (!kropp.enc) return avvis(400, 'kroppen mangler enc')

  // To ULIKE feil, som skal hete to ulike ting: «mangler» sendte oss en time
  // inn i Netlify-UI-et etter en variabel som HELE TIDEN var satt — den var
  // bare ikke JSON. Skill årsakene, alltid.
  const raaNokkel = process.env.STRIDEE_WEBHOOK_PRIVATE_KEY
  if (!raaNokkel || !raaNokkel.trim()) {
    return avvis(500, 'STRIDEE_WEBHOOK_PRIVATE_KEY er ikke satt')
  }
  const nokler = lesPrivateNokler(raaNokkel)
  if (nokler.length === 0) {
    // Nok til å kjenne igjen formatet, for lite til å rekonstruere noe:
    // lengden og FØRSTE tegn. Aldri verdien, aldri et utsnitt av den.
    const trimmet = raaNokkel.trim()
    console.warn(
      `[stridee-webhook] STRIDEE_WEBHOOK_PRIVATE_KEY: ${trimmet.length} tegn, ` +
      `første tegn '${trimmet[0]}'`,
    )
    return avvis(500,
      'STRIDEE_WEBHOOK_PRIVATE_KEY kunne ikke tolkes ' +
      '(verken JWK-JSON, PKCS#8 som PEM eller bar base64, eller rå 32 byte)')
  }

  const klar = await dekrypterHendelse(kropp.enc, nokler)
  if (!klar.ok || !klar.data) return avvis(400, klar.grunn ?? 'dekryptering feilet')

  // ── 5. FØRST NÅ account_id. Den ligger inne i ciphertext, og det er hele
  //      poenget: en avsender uten nøkkelen kan ikke påstå hvem den er.
  //
  //      TYPEN LESES OGSÅ FRA KLARTEKSTEN, ikke fra kropp.type — ellers
  //      kunne hvem som helst merket en levering som kontoløs ping utenpå
  //      konvolutten og sluppet unna konto-kravet.
  const type = typeof klar.data.type === 'string' ? klar.data.type : null
  const accountId = typeof klar.data.account_id === 'string' ? klar.data.account_id : null
  // En ping tilhører ingen bruker. Alt annet — inkludert ukjente typer —
  // krever konto (se KONTOLOSE_HENDELSER).
  if (!accountId && kreverKonto(type)) {
    return avvis(400, `klarteksten mangler account_id (type=${type ?? 'ukjent'})`)
  }

  const nonce = typeof klar.data.nonce === 'string' ? klar.data.nonce : null
  if (!nonce) return avvis(400, 'klarteksten mangler nonce')

  // ── 6. Lagring. ALLE hendelsestyper treffer samme endepunkt, så vi lagrer
  //      alt og filtrerer ved prosessering (bolk 4). Ikke anta at alt er
  //      aktiviteter.
  if (!finnes) {
    const { error: skrivFeil } = await db.from('stridee_events').insert({
      webhook_id: sig.id,
      event_type: type ?? kropp.type ?? null,
      account_id: accountId,
      payload: klar.data,
    })
    // Unik-brudd her betyr at en parallell retry vant kappløpet. Det er ikke
    // en feil — hendelsen ER lagret, og vi skal fortsatt ekko.
    if (skrivFeil && skrivFeil.code !== '23505') {
      return avvis(500, `lagring feilet: ${skrivFeil.message}`)
    }
  }

  console.log(
    `[stridee-webhook] ${finnes ? 'retry' : 'ny'} ${sig.id} ` +
    `type=${type ?? 'ukjent'} konto=${accountId ?? 'ingen (kontolos hendelse)'}`,
  )

  // ── 7. Kvitteringen. nonce på TOPPNIVÅ.
  return NextResponse.json(kvittering(nonce), { status: 200 })
}
