// Ærlige feiltekster for databasefeil som ellers slipper rått ut i UI.
//
// Bakgrunn (FEIL-4): en trener som planla en styrkeøkt fikk «new row
// violates row-level security policy for table
// "workout_activity_exercises"» midt på flaten. Det sier ingenting til
// den som bare ville lagre en økt, og det sier heller ikke hva man kan
// gjøre. Regel 22: si sant, si det på norsk, og si hva neste steg er —
// aldri finn på en årsak vi ikke vet.
//
// Teksten forteller HVA som ikke ble lagret, HVORFOR så langt vi vet, og
// HVA man kan gjøre. Den tekniske meldingen kastes ikke — den logges
// server-side så den fortsatt kan feilsøkes.

export interface DbFeil {
  message?: string
  code?: string
  details?: string | null
}

/**
 * @param feil  feilen fra Supabase/PostgREST
 * @param hva   hva som ikke ble lagret, i bestemt form: «øvelsene»,
 *              «settene», «aktivitetene»
 */
export function dbFeilTekst(feil: DbFeil | null | undefined, hva: string): string {
  const rå = feil?.message ?? ''
  const kode = feil?.code ?? ''
  console.error(`[db-feil] ${hva}: ${kode} ${rå}${feil?.details ? ` · ${feil.details}` : ''}`)

  // RLS: PostgREST gir 42501 + «row-level security policy».
  if (kode === '42501' || /row-level security/i.test(rå)) {
    return `Du har ikke rett til å lagre ${hva} på denne økta. `
      + 'Planlegger du for en utøver, må utøveren ha gitt deg redigeringsrett '
      + 'til planen sin. Har du nettopp fått den, prøv å laste siden på nytt.'
  }
  if (kode === '23505') return `${stor(hva)} finnes allerede på økta — last siden på nytt og prøv igjen.`
  if (kode === '23503') return `${stor(hva)} peker på noe som ikke finnes lenger — last siden på nytt og prøv igjen.`
  if (kode === '23502') return `${stor(hva)} mangler et felt som må fylles ut.`
  if (kode === '23514') return `${stor(hva)} har en verdi databasen ikke godtar — sjekk tallene og prøv igjen.`
  return `${stor(hva)} ble ikke lagret. Prøv igjen — står det seg, ta kontakt så ser vi på det.`
}

function stor(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
