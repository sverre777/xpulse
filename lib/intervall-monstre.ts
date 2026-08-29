// Kortintervall-mønstre — ÉN delt kilde (regel 18).
//
// Målt 29. aug: intervall-byggeren hadde INGEN mønsterliste, bare frie
// felt (antall/dragtid/pause). Kravet «samme liste begge steder» kunne
// derfor ikke oppfylles ved gjenbruk — lista opprettes her og tas i bruk
// BÅDE i hurtigoppsettet og i segment-editoren, aldri to lister som kan
// gå ut av takt.
//
// HURTIGVALGENE ER SNARVEIER, IKKE GRENSER: på/av settes fritt i
// sekunder (37/23, 90/30, 15/45 — hva som helst). Valgene FYLLER de frie
// feltene; de erstatter dem ikke.

export interface Kortintervall {
  /** Arbeidsperiode i sekunder. */
  paaSek: number
  /** Pause i sekunder. */
  avSek: number
}

export const KORTINTERVALL_HURTIGVALG: { etikett: string; verdi: Kortintervall }[] = [
  { etikett: '50/10', verdi: { paaSek: 50, avSek: 10 } },
  { etikett: '45/15', verdi: { paaSek: 45, avSek: 15 } },
  { etikett: '40/20', verdi: { paaSek: 40, avSek: 20 } },
  { etikett: '30/15', verdi: { paaSek: 30, avSek: 15 } },
  { etikett: '30/30', verdi: { paaSek: 30, avSek: 30 } },
  { etikett: '25/25', verdi: { paaSek: 25, avSek: 25 } },
]

/**
 * LENGDEN ER PRIMÆR, antallet avledes: segmentet finnes allerede som en
 * tid på kurven, så et antall som styrte lengden ville slåss med draget.
 * Skriver man «8 × 40/20» settes lengden i stedet (se lengdeFor).
 */
export function antallRepetisjoner(lengdeSek: number, m: Kortintervall): number {
  const syklus = m.paaSek + m.avSek
  if (syklus <= 0) return 0
  return Math.max(0, Math.floor(lengdeSek / syklus))
}

/** Tid som ikke går opp i hele repetisjoner — vises ÆRLIG, aldri skjult. */
export function restSek(lengdeSek: number, m: Kortintervall): number {
  const syklus = m.paaSek + m.avSek
  if (syklus <= 0) return lengdeSek
  return Math.max(0, Math.round(lengdeSek - antallRepetisjoner(lengdeSek, m) * syklus))
}

/** Lengden som trengs for et gitt antall repetisjoner. */
export function lengdeFor(antall: number, m: Kortintervall): number {
  return Math.max(0, antall) * (m.paaSek + m.avSek)
}

/** «8 × 40/20» eller «8 × 40/20 + 12 s rest» — aldri en klamme som lyver. */
export function kortintervallEtikett(lengdeSek: number, m: Kortintervall): string {
  const n = antallRepetisjoner(lengdeSek, m)
  if (n === 0) return `${m.paaSek}/${m.avSek} (for kort)`
  const rest = restSek(lengdeSek, m)
  return `${n} × ${m.paaSek}/${m.avSek}${rest > 0 ? ` + ${rest} s rest` : ''}`
}

/** Er mønsteret ført? (0/0 = av). */
export function harMonster(m: Kortintervall | null): m is Kortintervall {
  return !!m && m.paaSek > 0 && m.avSek >= 0 && m.paaSek + m.avSek > 0
}
