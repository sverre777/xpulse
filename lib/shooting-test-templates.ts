// Kø #47 bolk 4: SKYTETEST-MALER. Standardbiblioteket er LÅST og bor i kode
// (samme prinsipp som standard-øvelsene) — kan kopieres inn i en blokk, aldri
// endres. Egne maler lagres i shooting_test_templates (fase 85) og
// identifiseres med uuid; standardene med kodenøkkel ('nssf1', …) i
// shooting_test_ref. Samme mal-ref = sammenlignbar testserie over tid i
// skyting-analysens «Tester»-visning (bolk 6/9).
//
// NSSF Test 2 (testløp normalprogram) tas bevisst IKKE inn her — det er en
// hel økt-struktur, notert som fremtidig ØKT-mal-kandidat med 🧪.

export interface ShootingTestTemplateDef {
  ref: string
  name: string
  locked: boolean
  surface: 'papp' | 'metall' | 'issf'
  usePulse: boolean
  useTime: boolean
  // 'treff' = vanlig treff/skudd; 'ring' = poengføring (eget points-felt,
  // kan leses av skuddplottet).
  scoring: 'treff' | 'ring'
  // Kompakt serie-oppsett i rekkefølge.
  series: { position: 'L' | 'S'; shots: number; count: number }[]
  // Krav-/veiledningstekst (aldri alarm — ren referanse).
  guidance: string
}

export const STANDARD_SHOOTING_TESTS: ShootingTestTemplateDef[] = [
  {
    ref: 'nssf1',
    name: 'NSSF Test 1 — 80 skudd papp u/ belastning',
    locked: true,
    surface: 'papp',
    usePulse: false,
    useTime: true,
    scoring: 'ring',
    series: [
      { position: 'L', shots: 5, count: 8 },
      { position: 'S', shots: 5, count: 8 },
    ],
    guidance:
      'Ringsum per serie: 5 p innenfor stiplet linje / 3 p mellom (maks 25). '
      + 'Serietid valgfri — krav-ref 40 s L / 35 s S. '
      + 'Poengkrav-veiledning: YJ 330 · EJ 350 · Senior 380.',
  },
  {
    ref: 'nssf3',
    name: 'NSSF Test 3 — Kombinasjonstest 60 skudd',
    locked: true,
    surface: 'metall',
    usePulse: true,
    useTime: true,
    scoring: 'treff',
    series: [
      { position: 'L', shots: 5, count: 6 },
      { position: 'S', shots: 5, count: 6 },
    ],
    guidance:
      'Med belastning mellom seriene — før puls snitt/maks per serie. '
      + 'Måles på treff % + snitt skytetid. '
      + 'Krav-veiledning: 90/93/97 % · tid 35/35 · 30/25 · 25/20 s (YJ/EJ/Sr, L/S).',
  },
  {
    ref: 'nssf4',
    name: 'NSSF Test 4 — 30-30 presisjonstest',
    locked: true,
    surface: 'issf',
    usePulse: false,
    useTime: false,
    scoring: 'ring',
    series: [
      { position: 'L', shots: 1, count: 30 },
      { position: 'S', shots: 1, count: 30 },
    ],
    guidance:
      'Enkeltskudd på 10-delt ISSF 50 m-skive, uten tidspress/puls. '
      + '1–10 p per skudd — plott skuddet og les poeng fra plottet, '
      + 'eller før poeng manuelt.',
  },
  {
    ref: 'staaende200',
    name: '200 stående på metall',
    locked: true,
    surface: 'metall',
    usePulse: false,
    useTime: true,
    scoring: 'treff',
    series: [
      { position: 'S', shots: 5, count: 40 },
    ],
    guidance: 'Treff % + valgfri serietid per serie.',
  },
]

export function findStandardTest(ref: string | null | undefined): ShootingTestTemplateDef | null {
  if (!ref) return null
  return STANDARD_SHOOTING_TESTS.find(t => t.ref === ref) ?? null
}

// Flat liste av serier fra kompakt oppsett — brukes ved forhåndsutfylling.
export function expandTestSeries(t: ShootingTestTemplateDef): { position: 'L' | 'S'; shots: number }[] {
  const out: { position: 'L' | 'S'; shots: number }[] = []
  for (const grp of t.series) {
    for (let i = 0; i < grp.count; i++) out.push({ position: grp.position, shots: grp.shots })
  }
  return out
}
