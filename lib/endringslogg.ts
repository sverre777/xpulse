// HVA TRENEREN FAKTISK ENDRET (Sverre 16. sep 2026).
//
// «Erik endret økta 3. mars» hjelper ikke utøveren som lurer på hvorfor
// terskelen hans er fire slag høyere. Loggen skal si HVA som ble endret,
// med gammel og ny verdi - i det minste for tall.
//
// Ren logikk, ingen database: den som regner ut hva som faktisk endret seg
// skal testes, ikke bare kjøres. Skrivingen bor i lib/coach-audit.
//
// ────────────────────────────────────────────────────────────────────────
// ET VALG SOM ER TATT, IKKE OPPDAGET:
// coach_audit_log.coach_id har `on delete cascade` (phase26:305). Sletter
// en trener kontoen sin, forsvinner hele endringshistorikken hans fra
// utøverens logg. Det er trolig riktig etter GDPR - hvem som endret noe er
// persondata om treneren - men utøverens sporbarhet får da hull, og
// hjelpefeltet på økta (sist_endret_av_trener_id, fase 129) settes til
// NULL av samme grunn. Da står det «ingen trener har rørt denne» på en økt
// en trener faktisk rørte.
//
// Vi lar det stå: retten til å bli slettet veier tyngre enn et fullstendig
// revisjonsspor i en treningsdagbok. Men det er valgt, og den som en dag
// lurer på hvorfor et hull finnes, skal finne svaret her og ikke tro det
// er en feil.
// ────────────────────────────────────────────────────────────────────────

/** Én endring, slik utøveren skal få den lest opp. */
export interface Endring {
  /** Maskinnavnet - kolonnen. */
  felt: string
  /** Menneskenavnet - «Terskelpuls», «Varighet». */
  navn: string
  fra: string | number | null
  til: string | number | null
}

/** Feltene vi følger, med navnet utøveren kjenner dem under. */
export interface FeltNavn {
  felt: string
  navn: string
}

/**
 * Feltene på selve økta som er verdt å logge.
 *
 * Bevisst KORT. En logg som fanger alt blir ikke lest; en som fanger tallene
 * utøveren kjenner igjen, blir det. Notater og fritekst står utenfor - de
 * endres ofte og sier lite som et fra/til-par.
 */
export const OKT_FELTER: FeltNavn[] = [
  { felt: 'title', navn: 'Tittel' },
  { felt: 'date', navn: 'Dato' },
  { felt: 'duration_minutes', navn: 'Varighet (min)' },
  { felt: 'distance_km', navn: 'Distanse (km)' },
  { felt: 'avg_heart_rate', navn: 'Snittpuls' },
  { felt: 'max_heart_rate', navn: 'Makspuls' },
  { felt: 'rpe', navn: 'Opplevd belastning' },
  { felt: 'workout_type', navn: 'Økttype' },
  { felt: 'sport', navn: 'Idrett' },
  { felt: 'is_completed', navn: 'Gjennomført' },
]

/** Samme verdi? Tall sammenlignes som tall, så «60» og 60 er like. */
function likeVerdier(a: unknown, b: unknown): boolean {
  const tom = (v: unknown) => v === null || v === undefined || v === ''
  if (tom(a) && tom(b)) return true
  if (tom(a) || tom(b)) return false
  const na = Number(a), nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb
  return String(a) === String(b)
}

/** Verdien slik den skal stå i loggen: tall som tall, resten som tekst. */
function verdi(v: unknown): string | number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v ? 'ja' : 'nei'
  const n = Number(v)
  return Number.isFinite(n) && String(v).trim() !== '' ? n : String(v)
}

/**
 * Hva endret seg?
 *
 * Bare felt som FAKTISK har en annen verdi. En lagring der treneren rettet
 * én ting skal gi én linje, ikke ti med «uendret».
 */
export function finnEndringer(
  for_: Record<string, unknown> | null | undefined,
  etter: Record<string, unknown> | null | undefined,
  felter: FeltNavn[] = OKT_FELTER,
): Endring[] {
  if (!for_ || !etter) return []
  const ut: Endring[] = []
  for (const f of felter) {
    // Feltet var ikke med i lagringen: da har det ikke endret seg.
    if (!(f.felt in etter)) continue
    const a = for_[f.felt], b = etter[f.felt]
    if (likeVerdier(a, b)) continue
    ut.push({ felt: f.felt, navn: f.navn, fra: verdi(a), til: verdi(b) })
  }
  return ut
}

/** «Varighet (min) fra 60 til 75» - én linje, til visning og til e-post. */
export function endringTekst(e: Endring): string {
  const v = (x: string | number | null) => (x === null ? 'tomt' : String(x))
  return `${e.navn} fra ${v(e.fra)} til ${v(e.til)}`
}
