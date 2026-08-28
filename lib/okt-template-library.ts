// ØKTMAL-BIBLIOTEKET — LÅST, BOR I KODE.
//
// Samme prinsipp som lib/shooting-test-templates.ts og standard-øvelsene:
// biblioteket kan kopieres inn i en egen mal og endres der, men aldri endres
// på plass. Da når rettelser og utvidelser alle brukere, i stedet for å bli
// liggende som 51 frosne kopier per konto fra dagen de ble opprettet.
//
// ── HVORFOR BÅDE BLOKKER OG SONETOTALER ──────────────────────────────────
// ActivityRow har i dag ingen drag-/blokkmodell — en aktivitet har varighet
// og TOTALER per sone. Blokksekvensen kan derfor ikke lagres slik den står.
// Vi lagrer den likevel her som data, og UTLEDER sonetotalene fra den med
// blokkerTilSoner(). To følger:
//   1. Malene er brukbare i dag (totalene er alt modellen trenger).
//   2. Når dragmodellen kommer (#48 / SF-4) ligger strukturen allerede her,
//      og ingen mal må skrives om.
// Totalene skrives ALDRI for hånd. Da ville de kunne komme i utakt med
// blokkene, og det er nøyaktig den feilklassen som har bitt dette prosjektet
// flere ganger.
//
// ── GRUNNLAG ─────────────────────────────────────────────────────────────
// Draglengder og total effektiv tid følger Olympiatoppens intensitetsskala
// (2024): I3 8–20 min drag / 20–90 min totalt · I4 3–10 min / 20–50 min ·
// I5 30 s–5 min / 15–30 min. Selvtesten sjekker at hver mal holder seg
// innenfor, og advarer der den bevisst ikke gjør det.

// ── TYPER ────────────────────────────────────────────────────────────────

/** Sonene en blokk kan ligge i. Hurtighet føres manuelt, aldri fra puls.
 * I6–I8 (fase 111): anaerobe intensitetsmerker — tilbys i velgeren kun
 * når utøverens utvidede skala er på (lib/sonesprak). MERK: kun typen
 * og sonelista er utvidet — MALDATAENE i denne fila er urørt (SF-10). */
export type BlokkSone = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7' | 'I8' | 'Hurtighet'

/** Hva blokken er til for. Styrer visning, ikke beregning. */
export type BlokkRolle = 'oppvarming' | 'arbeid' | 'pause' | 'nedjogg'

export interface Blokk {
  /** Varighet i SEKUNDER. Sekunder og ikke minutter, så 20-sekunders
   *  hurtighetsdrag ikke blir flyttall som runder feil. */
  sek: number
  sone: BlokkSone
  rolle: BlokkRolle
}

/**
 * Økttypen malen sorteres på.
 *
 * VIKTIG: dette er FASITEN. Mal-fiksen som legger filtrering og sortering på
 * mal-flaten skal IMPORTERE denne lista, ikke definere sin egen. To sett
 * kategorier som nesten stemmer overens er verre enn ingen kategorier.
 *
 * Merk at `category` på WorkoutTemplate allerede er opptatt — den holder
 * SPORT-kategori for plan- og periodiseringsmaler. Økttypen trenger derfor
 * sitt eget felt.
 */
export type OktMalType =
  | 'rolig'
  | 'langkjoring'
  | 'terskel'
  | 'i4_intervall'
  | 'i5_intervall'
  | 'hurtighet'
  | 'motbakke'
  | 'fartslek'
  | 'lagtur'
  | 'komb_rolig'
  | 'komb_hard'
  | 'test'

export const OKT_MAL_TYPER: readonly { verdi: OktMalType; etikett: string }[] = [
  { verdi: 'rolig',        etikett: 'Rolig' },
  { verdi: 'langkjoring',  etikett: 'Langkjøring' },
  { verdi: 'terskel',      etikett: 'Terskel' },
  { verdi: 'i4_intervall', etikett: 'I4-intervall' },
  { verdi: 'i5_intervall', etikett: 'I5-intervall' },
  { verdi: 'hurtighet',    etikett: 'Hurtighet' },
  { verdi: 'motbakke',     etikett: 'Motbakke' },
  { verdi: 'fartslek',     etikett: 'Fartslek' },
  { verdi: 'lagtur',       etikett: 'Lagtur' },
  { verdi: 'komb_rolig',   etikett: 'Komb rolig' },
  { verdi: 'komb_hard',    etikett: 'Komb hard' },
  { verdi: 'test',         etikett: 'Test' },
] as const

export interface OktMalDef {
  /** Stabil kodenøkkel. Samme ref = sammenlignbar over tid, som skytetestene. */
  ref: string
  navn: string
  type: OktMalType
  /** Alltid true her. Kopier er ikke låst. */
  locked: true
  blokker: Blokk[]
  notat: string
  /** Kun komb-øktene: hvor mange skyteserier og hvilken type. */
  skyting?: { serier: number; type: 'basisskyting' | 'rolig_komb' | 'hard_komb' | 'hurtighet_komb' }
}

// ── BYGGERE ──────────────────────────────────────────────────────────────
// Malene bygges med disse i stedet for håndskrevne blokk-arrays. 51 maler
// med håndskrevne arrays ville garantert inneholdt minst én tastefeil.

const m = (minutter: number): number => Math.round(minutter * 60)

const B = (sek: number, sone: BlokkSone, rolle: BlokkRolle): Blokk => ({ sek, sone, rolle })

const opp = (minutter = 30): Blokk => B(m(minutter), 'I1', 'oppvarming')
const ned = (minutter = 10): Blokk => B(m(minutter), 'I1', 'nedjogg')

/**
 * n drag med pause imellom. SISTE PAUSE UTGÅR — etter siste drag går man rett
 * på nedjogg. Det er regelen for hele biblioteket.
 */
function serie(
  n: number,
  dragSek: number,
  dragSone: BlokkSone,
  pauseSek: number,
  pauseSone: BlokkSone = 'I1',
): Blokk[] {
  const ut: Blokk[] = []
  for (let i = 0; i < n; i++) {
    ut.push(B(dragSek, dragSone, 'arbeid'))
    if (i < n - 1) ut.push(B(pauseSek, pauseSone, 'pause'))
  }
  return ut
}

/** Standardøkta: oppvarming, n drag med pause, nedjogg. */
function intervalløkt(
  n: number,
  dragMin: number,
  dragSone: BlokkSone,
  pauseMin: number,
  oppMin = 30,
  nedMin = 10,
): Blokk[] {
  return [opp(oppMin), ...serie(n, m(dragMin), dragSone, m(pauseMin)), ned(nedMin)]
}

// ── AVLEDNING ────────────────────────────────────────────────────────────

/** Total varighet i sekunder. */
export function totalSekunder(blokker: readonly Blokk[]): number {
  return blokker.reduce((s, b) => s + b.sek, 0)
}

/** Sekunder i én sone, uansett rolle. */
export function sekunderISone(blokker: readonly Blokk[], sone: BlokkSone): number {
  return blokker.reduce((s, b) => (b.sone === sone ? s + b.sek : s), 0)
}

/** Effektivt arbeid i en sone — kun blokker med rolle 'arbeid'. */
export function arbeidISone(blokker: readonly Blokk[], sone: BlokkSone): number {
  return blokker.reduce((s, b) => (b.sone === sone && b.rolle === 'arbeid' ? s + b.sek : s), 0)
}

const SONER: readonly BlokkSone[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']

/** Sekunder → "MM:SS" (eller "H:MM:SS" over en time), formatet ActivityRow bruker. */
export function sekTilKlokke(sek: number): string {
  if (sek <= 0) return ''
  const t = Math.floor(sek / 3600)
  const min = Math.floor((sek % 3600) / 60)
  const s = sek % 60
  const to = (n: number) => String(n).padStart(2, '0')
  return t > 0 ? `${t}:${to(min)}:${to(s)}` : `${min}:${to(s)}`
}

/**
 * Blokker → sonetotaler slik ActivityRow.zones vil ha dem.
 * Soner uten tid får tom streng, ikke "0:00" — tom betyr «ikke ført».
 */
export function blokkerTilSoner(blokker: readonly Blokk[]): Record<BlokkSone, string> {
  const ut = {} as Record<BlokkSone, string>
  for (const sone of SONER) ut[sone] = sekTilKlokke(sekunderISone(blokker, sone))
  return ut
}

/** Kort, lesbar beskrivelse av strukturen — til notat og forhåndsvisning. */
export function beskrivStruktur(blokker: readonly Blokk[]): string {
  return blokker
    .map(b => `${sekTilKlokke(b.sek)} ${b.sone}`)
    .join(' · ')
}

// ── BIBLIOTEKET ──────────────────────────────────────────────────────────

export const OKT_MAL_BIBLIOTEK: readonly OktMalDef[] = [

  // ══ A · ROLIG OG LANGKJØRING ═══════════════════════════════════════════
  { ref: 'a1', navn: 'Restitusjon 45 min', type: 'rolig', locked: true,
    blokker: [B(m(45), 'I1', 'arbeid')],
    notat: 'Rolig hele veien. Skal føles som hvile, ikke som trening.' },

  { ref: 'a2', navn: 'Rolig 60 min', type: 'rolig', locked: true,
    blokker: [B(m(60), 'I1', 'arbeid')],
    notat: 'Aerob grunntrening. Skal kunne snakke uanstrengt hele økta.' },

  { ref: 'a3', navn: 'Rolig 90 min', type: 'rolig', locked: true,
    blokker: [B(m(90), 'I1', 'arbeid')],
    notat: 'Aerob grunntrening.' },

  { ref: 'a4', navn: 'Langtur 2 t', type: 'langkjoring', locked: true,
    blokker: [B(m(120), 'I1', 'arbeid')],
    notat: 'Rolig langkjøring. Teknisk kvalitet hele veien.' },

  { ref: 'a5', navn: 'Langtur 3 t', type: 'langkjoring', locked: true,
    blokker: [B(m(180), 'I1', 'arbeid')],
    notat: 'Rolig langkjøring. Husk mat og drikke underveis.' },

  { ref: 'a6', navn: 'Langtur 4 t', type: 'langkjoring', locked: true,
    blokker: [B(m(240), 'I1', 'arbeid')],
    notat: 'Lang rolig økt. Passer best på ski, rulleski og sykkel.',
  },

  { ref: 'a7', navn: 'Rolig med fartsøkninger', type: 'rolig', locked: true,
    blokker: [
      opp(20),
      ...Array.from({ length: 6 }, (_, i): Blokk[] => (
        i < 5 ? [B(20, 'Hurtighet', 'arbeid'), B(m(4) + 40, 'I1', 'pause')]
              : [B(20, 'Hurtighet', 'arbeid')]
      )).flat(),
      B(m(12), 'I1', 'nedjogg'),
    ],
    notat: 'Rolig økt med seks korte fartsøkninger. Holder spensten ved like uten å belaste.' },

  { ref: 'a8', navn: 'I2-langkjøring 60 min', type: 'langkjoring', locked: true,
    blokker: [opp(15), B(m(60), 'I2', 'arbeid'), ned(10)],
    notat: 'Jevn I2 hele veien. Skal kunne si lengre setninger relativt uanstrengt.' },

  { ref: 'a9', navn: 'I2-langkjøring 90 min', type: 'langkjoring', locked: true,
    blokker: [opp(15), B(m(90), 'I2', 'arbeid'), ned(10)],
    notat: 'Jevn I2. Krevende økt selv om intensiteten er moderat.' },

  { ref: 'a10', navn: 'Progressiv 60 min', type: 'langkjoring', locked: true,
    blokker: [opp(15), B(m(20), 'I1', 'arbeid'), B(m(20), 'I2', 'arbeid'), B(m(20), 'I3', 'arbeid'), ned(10)],
    notat: 'Stigende intensitet gjennom økta. Siste tredjedel skal kjennes.' },

  // ══ B · TERSKEL / I3 ═══════════════════════════════════════════════════
  { ref: 'b1', navn: '6 × 6 min / 2 min', type: 'terskel', locked: true,
    blokker: intervalløkt(6, 6, 'I3', 2),
    notat: 'Klassisk terskeløkt. Du skal kunne jogge pausene, og siste drag skal være like godt som det første.' },

  { ref: 'b2', navn: '5 × 6 min / 1 min', type: 'terskel', locked: true,
    blokker: intervalløkt(5, 6, 'I3', 1),
    notat: 'Kort pause gjør at pulsen holder seg oppe. Litt tyngre enn den ser ut.' },

  { ref: 'b3', navn: '4 × 8 min / 2 min', type: 'terskel', locked: true,
    blokker: intervalløkt(4, 8, 'I3', 2),
    notat: 'Lengre drag, jevn og kontrollert fart.' },

  { ref: 'b4', navn: '5 × 8 min / 2 min', type: 'terskel', locked: true,
    blokker: intervalløkt(5, 8, 'I3', 2),
    notat: 'Solid terskeløkt. 40 minutter effektivt.' },

  { ref: 'b5', navn: '3 × 10 min / 3 min', type: 'terskel', locked: true,
    blokker: intervalløkt(3, 10, 'I3', 3),
    notat: 'Færre og lengre drag. Krever at farten holdes nede fra start.' },

  { ref: 'b6', navn: '4 × 10 min / 3 min', type: 'terskel', locked: true,
    blokker: intervalløkt(4, 10, 'I3', 3),
    notat: '40 minutter effektivt i I3.' },

  { ref: 'b7', navn: '3 × 12 min / 3 min', type: 'terskel', locked: true,
    blokker: intervalløkt(3, 12, 'I3', 3),
    notat: 'Lange drag. Godt utgangspunkt for å finne terskelfarten sin.' },

  { ref: 'b8', navn: '3 × 15 min / 4 min', type: 'terskel', locked: true,
    blokker: intervalløkt(3, 15, 'I3', 4),
    notat: '45 minutter effektivt. Tung terskeløkt.' },

  { ref: 'b9', navn: '2 × 20 min / 5 min', type: 'terskel', locked: true,
    blokker: intervalløkt(2, 20, 'I3', 5),
    notat: 'Maksimal draglengde i I3. Ren utholdenhet i tempoet.' },

  { ref: 'b10', navn: 'Hurtig langkjøring 45 min', type: 'terskel', locked: true,
    blokker: [opp(20), B(m(45), 'I3', 'arbeid'), ned(10)],
    notat: 'Sammenhengende I3 uten pauser. Krever disiplin på farten de første ti minuttene.' },

  // ══ C · I4-INTERVALL ═══════════════════════════════════════════════════
  { ref: 'c1', navn: '8 × 4 min / 2 min', type: 'i4_intervall', locked: true,
    blokker: intervalløkt(8, 4, 'I4', 2),
    notat: 'Mange drag, kort pause. 32 minutter effektivt.' },

  { ref: 'c2', navn: '6 × 5 min / 2 min', type: 'i4_intervall', locked: true,
    blokker: intervalløkt(6, 5, 'I4', 2),
    notat: 'Jevn fordeling. Skal kunne fullføres uten å tape fart på slutten.' },

  { ref: 'c3', navn: '5 × 6 min / 3 min', type: 'i4_intervall', locked: true,
    blokker: intervalløkt(5, 6, 'I4', 3),
    notat: 'Lengre pause gir mulighet til å holde farten oppe i dragene.' },

  { ref: 'c4', navn: '4 × 8 min / 3 min', type: 'i4_intervall', locked: true,
    blokker: intervalløkt(4, 8, 'I4', 3),
    notat: 'Maksimal draglengde i I4. Krevende.' },

  { ref: 'c5', navn: '10 × 3 min / 1 min', type: 'i4_intervall', locked: true,
    blokker: intervalløkt(10, 3, 'I4', 1),
    notat: 'Korte drag og korte pauser. Pulsen holder seg høy hele veien.' },

  { ref: 'c6', navn: '12 × 2 min / 1 min', type: 'i4_intervall', locked: true,
    blokker: intervalløkt(12, 2, 'I4', 1),
    notat: 'Mange korte drag. Egner seg godt i motbakke.' },

  { ref: 'c7', navn: '3 × 10 min 50/10 / 3 min', type: 'i4_intervall', locked: true,
    blokker: [
      opp(30),
      B(m(10), 'I3', 'arbeid'), B(m(3), 'I1', 'pause'),
      B(m(10), 'I4', 'arbeid'), B(m(3), 'I1', 'pause'),
      B(m(10), 'I4', 'arbeid'),
      ned(10),
    ],
    notat: '50 sekunder på, 10 sekunder av, ti ganger per drag. Progressiv: første drag i I3, de to siste i I4. Mikropausene føres ikke som egne blokker — pulsen rekker ikke å falle ut av sonen på ti sekunder.' },

  // ══ D · I5 / MAKSIMAL ══════════════════════════════════════════════════
  { ref: 'd1', navn: '4 × 4 min / 3 min', type: 'i5_intervall', locked: true,
    blokker: intervalløkt(4, 4, 'I5', 3),
    notat: 'Klassikeren. Fire harde drag, tre minutter rolig imellom.' },

  { ref: 'd2', navn: '5 × 4 min / 3 min', type: 'i5_intervall', locked: true,
    blokker: intervalløkt(5, 4, 'I5', 3),
    notat: '20 minutter effektivt i I5. Øvre grense for hva som er fornuftig.' },

  { ref: 'd3', navn: '6 × 3 min / 2 min', type: 'i5_intervall', locked: true,
    blokker: intervalløkt(6, 3, 'I5', 2),
    notat: 'Kortere drag gjør det mulig å holde høyere fart.' },

  { ref: 'd4', navn: '8 × 2 min / 2 min', type: 'i5_intervall', locked: true,
    blokker: intervalløkt(8, 2, 'I5', 2),
    notat: 'Like lang pause som drag. Høy kvalitet i hvert drag.' },

  { ref: 'd5', navn: '10 × 1 min / 1 min', type: 'i5_intervall', locked: true,
    blokker: intervalløkt(10, 1, 'I5', 1),
    notat: 'Korte, harde drag. Pulsen rekker aldri helt ned.' },

  { ref: 'd6', navn: '15 × 1 min / 1 min', type: 'i5_intervall', locked: true,
    blokker: intervalløkt(15, 1, 'I5', 1),
    notat: '15 minutter effektivt. Tung økt til tross for korte drag.' },

  { ref: 'd7', navn: '30/15 × 3 serier', type: 'i5_intervall', locked: true,
    blokker: [
      opp(30),
      ...Array.from({ length: 3 }, (_, s): Blokk[] => [
        ...serie(10, 30, 'I5', 15),
        ...(s < 2 ? [B(m(4), 'I1', 'pause')] : []),
      ]).flat(),
      ned(10),
    ],
    notat: 'Tre serier med ti ganger 30 sekunder på og 15 av, fire minutter mellom seriene. 15 minutter effektivt.' },

  // ══ E · HURTIGHET ══════════════════════════════════════════════════════
  // Føres i Hurtighet, ikke i pulssone — den beregnes ikke fra puls.
  { ref: 'e1', navn: '8 × 20 s / 3 min', type: 'hurtighet', locked: true,
    blokker: [opp(30), ...serie(8, 20, 'Hurtighet', m(3)), ned(10)],
    notat: 'Full fart i hvert drag. Lang pause så kvaliteten holder.' },

  { ref: 'e2', navn: '10 × 10 s / 2 min', type: 'hurtighet', locked: true,
    blokker: [opp(30), ...serie(10, 10, 'Hurtighet', m(2)), ned(10)],
    notat: 'Rene spurtdrag. Teknikk og frekvens, ikke utholdenhet.' },

  { ref: 'e3', navn: '6 × 30 s / 4 min', type: 'hurtighet', locked: true,
    blokker: [opp(30), ...serie(6, 30, 'Hurtighet', m(4)), ned(10)],
    notat: 'Lengre spurtdrag. Krever full pause mellom hvert.' },

  { ref: 'e4', navn: '10 × 15 s motbakke', type: 'hurtighet', locked: true,
    blokker: [opp(30), ...serie(10, 15, 'Hurtighet', m(2) + 45), ned(10)],
    notat: 'Full fart oppover, rolig ned igjen som pause. Bygger kraft.',
  },

  // ══ F · MOTBAKKE ═══════════════════════════════════════════════════════
  { ref: 'f1', navn: '8 × 2 min motbakke', type: 'motbakke', locked: true,
    blokker: intervalløkt(8, 2, 'I4', 2),
    notat: 'Opp i I4, rolig ned igjen som pause.',
  },

  { ref: 'f2', navn: '6 × 3 min motbakke', type: 'motbakke', locked: true,
    blokker: intervalløkt(6, 3, 'I4', 3),
    notat: 'Lengre motbakkedrag. Pausen er nedgangen.',
  },

  { ref: 'f3', navn: '10 × 1 min motbakke', type: 'motbakke', locked: true,
    blokker: intervalløkt(10, 1, 'I5', 2),
    notat: 'Harde, korte motbakkedrag. Rolig ned igjen.',
  },

  { ref: 'f4', navn: '5 × 5 min motbakke', type: 'motbakke', locked: true,
    blokker: intervalløkt(5, 5, 'I3', 4),
    notat: 'Lange motbakkedrag i terskelfart. Krever en lang nok bakke.',
  },

  // ══ G · FARTSLEK ═══════════════════════════════════════════════════════
  { ref: 'g1', navn: 'Fartslek pyramide 1-2-3-4-3-2-1', type: 'fartslek', locked: true,
    blokker: [
      opp(30),
      B(m(1), 'I4', 'arbeid'), B(m(1), 'I1', 'pause'),
      B(m(2), 'I4', 'arbeid'), B(m(2), 'I1', 'pause'),
      B(m(3), 'I4', 'arbeid'), B(m(3), 'I1', 'pause'),
      B(m(4), 'I4', 'arbeid'), B(m(4), 'I1', 'pause'),
      B(m(3), 'I4', 'arbeid'), B(m(3), 'I1', 'pause'),
      B(m(2), 'I4', 'arbeid'), B(m(2), 'I1', 'pause'),
      B(m(1), 'I4', 'arbeid'),
      ned(10),
    ],
    notat: 'Pausen er like lang som draget. Opp og ned igjen — siste drag skal være det raskeste.' },

  { ref: 'g2', navn: 'Fartslek 45 min variert', type: 'fartslek', locked: true,
    blokker: [
      opp(20),
      ...Array.from({ length: 5 }, (_, i): Blokk[] => [
        B(m(3), 'I3', 'arbeid'), B(m(2), 'I1', 'pause'),
        B(m(1), 'I4', 'arbeid'), ...(i < 4 ? [B(m(3), 'I1', 'pause')] : []),
      ]).flat(),
      ned(10),
    ],
    notat: 'Veksler mellom terskeldrag og korte harde drag. Fri fordeling — juster etter terrenget.' },

  { ref: 'g3', navn: 'Stigningsløp i langtur', type: 'fartslek', locked: true,
    blokker: [
      ...Array.from({ length: 4 }, (): Blokk[] => [
        B(m(25), 'I1', 'arbeid'), B(m(5), 'I3', 'arbeid'),
      ]).flat(),
      ned(10),
    ],
    notat: 'Rolig langtur med fire fem-minutters drag lagt inn. God måte å få kvalitet inn i en lang økt.' },

  // ══ H · LAGTUR ═════════════════════════════════════════════════════════
  { ref: 'h1', navn: 'Lagtur 2 t rolig', type: 'lagtur', locked: true,
    blokker: [B(m(120), 'I1', 'arbeid')],
    notat: 'Rolig sammen med laget. Sosial økt — hold farten nede.' },

  { ref: 'h2', navn: 'Lagtur 90 min I2', type: 'lagtur', locked: true,
    blokker: [opp(15), B(m(90), 'I2', 'arbeid'), ned(10)],
    notat: 'Jevn I2 i gruppe.' },

  { ref: 'h3', navn: 'Lagtur med fartsøkninger', type: 'lagtur', locked: true,
    blokker: [
      opp(20),
      ...Array.from({ length: 4 }, (): Blokk[] => [
        B(m(20), 'I2', 'arbeid'), B(m(4), 'I4', 'arbeid'),
      ]).flat(),
      ned(10),
    ],
    notat: 'I2 i gruppe med fire harde drag lagt inn. Dragene kan tas som rulleringer.' },

  // ══ I · KOMBINERT — SKISKYTING ═════════════════════════════════════════
  // Skytingen føres i skytedelen. Blokkene her er den fysiske strukturen,
  // og pausene er der skytingen skjer.
  { ref: 'i1', navn: 'Rolig komb 60 min', type: 'komb_rolig', locked: true,
    blokker: [
      ...Array.from({ length: 4 }, (_, i): Blokk[] => [
        B(m(15), 'I1', 'arbeid'), ...(i < 3 ? [B(m(3), 'I1', 'pause')] : []),
      ]).flat(),
      ned(10),
    ],
    notat: 'Fire skytinger lagt inn i en rolig økt. Fokus på teknikk og rutine, ikke på tid.',
    skyting: { serier: 4, type: 'rolig_komb' } },

  { ref: 'i2', navn: 'Komb terskel 6 × 6 min', type: 'komb_hard', locked: true,
    blokker: intervalløkt(6, 6, 'I3', 3),
    notat: 'Én skyteserie etter hvert drag. Terskelfart inn på standplass.',
    skyting: { serier: 6, type: 'rolig_komb' } },

  { ref: 'i3', navn: 'Hard komb 5 × 4 min', type: 'komb_hard', locked: true,
    blokker: intervalløkt(5, 4, 'I4', 3),
    notat: 'Én skyteserie etter hvert drag, med høy puls inn. Nærmest konkurransesituasjonen.',
    skyting: { serier: 5, type: 'hard_komb' } },

  { ref: 'i4', navn: 'Standhurtighet', type: 'komb_hard', locked: true,
    blokker: [opp(20), ...serie(8, m(1), 'I5', m(2)), ned(10)],
    notat: 'Åtte korte, harde drag inn på standplass. Trener rutinen fra ankomst til første skudd.',
    skyting: { serier: 8, type: 'hurtighet_komb' } },

  { ref: 'i5', navn: 'Konkurransesimulering', type: 'komb_hard', locked: true,
    blokker: intervalløkt(4, 8, 'I4', 3),
    notat: 'Fire runder med skyting liggende–stående–liggende–stående, som i et normalprogram.',
    skyting: { serier: 4, type: 'hard_komb' } },

  { ref: 'i6', navn: 'Komb rolig med mange serier', type: 'komb_rolig', locked: true,
    blokker: [
      ...Array.from({ length: 6 }, (_, i): Blokk[] => [
        B(m(10), 'I1', 'arbeid'), ...(i < 5 ? [B(m(3), 'I1', 'pause')] : []),
      ]).flat(),
      ned(10),
    ],
    notat: 'Seks skytinger med korte rolige drag imellom. Volumøkt for standplass.',
    skyting: { serier: 6, type: 'basisskyting' } },

  // ══ J · TEST ═══════════════════════════════════════════════════════════
  // Merkes som test (is_test) så de havner i test-biblioteket og kan
  // sammenlignes mot hverandre over tid.
  { ref: 'j1', navn: 'Melkesyreprofil 5 × 5 min', type: 'test', locked: true,
    blokker: [
      opp(20),
      B(m(5), 'I2', 'arbeid'), B(m(1), 'I1', 'pause'),
      B(m(5), 'I2', 'arbeid'), B(m(1), 'I1', 'pause'),
      B(m(5), 'I3', 'arbeid'), B(m(1), 'I1', 'pause'),
      B(m(5), 'I4', 'arbeid'), B(m(1), 'I1', 'pause'),
      B(m(5), 'I5', 'arbeid'),
      ned(10),
    ],
    notat: 'Stigende belastning. Laktat måles i pausen etter hvert drag. Samme løype og samme forhold hver gang, ellers kan ikke testene sammenlignes.' },

  { ref: 'j2', navn: 'Terskeltest 3 × 10 min', type: 'test', locked: true,
    blokker: intervalløkt(3, 10, 'I3', 2),
    notat: 'Stigende fart gjennom de tre dragene, laktat etter hvert. Brukes til å finne terskelfarten.' },

  { ref: 'j3', navn: 'Maksimaltest 5 min', type: 'test', locked: true,
    blokker: [opp(30), B(m(5), 'I5', 'arbeid'), ned(10)],
    notat: 'Fem minutter alt du har. Krever grundig oppvarming.' },

  { ref: 'j4', navn: '3000 m test', type: 'test', locked: true,
    blokker: [opp(30), B(m(12), 'I5', 'arbeid'), ned(10)],
    notat: 'Tiden er resultatet. Blokkvarigheten er et anslag — juster til faktisk tid etter gjennomføring.',
  },
] as const

// ── OPPSLAG ──────────────────────────────────────────────────────────────

export function finnOktMal(ref: string): OktMalDef | undefined {
  return OKT_MAL_BIBLIOTEK.find(mal => mal.ref === ref)
}

export function oktMalerAvType(type: OktMalType): OktMalDef[] {
  return OKT_MAL_BIBLIOTEK.filter(mal => mal.type === type)
}

/** Malene som er merket som test — skal opprettes med is_test = true. */
export function erTestMal(mal: OktMalDef): boolean {
  return mal.type === 'test'
}
