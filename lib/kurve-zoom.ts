// Delt zoom-nivå mellom økt-grafen og «Legg til detaljer» (fasiten:
// «zoom-nivået deles med pop-upen når man åpner den derfra»).
//
// Bevisst en enkel modul-lagret verdi per økt, ikke en React-context:
// de to flatene lever i ulike tregrener (grafen i klokkesync-seksjonen,
// pop-upen i en portal), og en provider måtte da ha ligget over hele
// øktmodalen bare for å bære to tall. Verdien er ren visningstilstand —
// går den tapt ved en full omlasting, er «hele økta» riktig utgangspunkt.
const vinduPerOkt = new Map<string, [number, number]>()

export function lagreVindu(workoutId: string, vindu: [number, number]): void {
  vinduPerOkt.set(workoutId, vindu)
}

export function hentVindu(workoutId: string): [number, number] | null {
  return vinduPerOkt.get(workoutId) ?? null
}

/**
 * Rydder zoom-nivået for en økt. Kalles når øktmodalen lukkes: en
 * modul-lagret verdi som blir liggende ville vist feil vindu neste gang
 * samme økt åpnes i en annen tilstand (f.eks. etter at segmentene er
 * endret, eller fra en annen flate).
 */
export function glemVindu(workoutId: string): void {
  vinduPerOkt.delete(workoutId)
}
