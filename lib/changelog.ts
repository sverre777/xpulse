// «Hva er nytt» — redaksjonell liste over det utøveren faktisk merker.
//
// ══ TESTEN FØR DU LEGGER INN ET PUNKT ══════════════════════
//
// Ville en utøver som brukte appen i går, merket forskjellen uten at noen
// fortalte det? Nei → ingen oppføring.
//
//   JA:  ny funksjon eller nytt felt utøveren kan bruke
//        ny klokke- eller tjenestekobling
//        noe som var utilgjengelig og nå finnes
//
//   NEI: refaktorering, opprydding, død kode
//        feilrettinger ingen har merket
//        farger, marginer, layout-finpuss
//        migreringer uten synlig effekt
//        alt som bare gjør koden bedre å jobbe i
//
// Ved tvil: ikke legg det inn.
//
// ETT PUNKT PER LEVERING, IKKE PER COMMIT. En bestilling som gikk over seks
// bolker blir ÉN linje her — utøveren fikk én ny ting, ikke seks.
//
// ══ VEDLIKEHOLD ════════════════════════════════════════════
//
// Nyeste ØVERST. Gamle punkter slettes aldri — sida viser kun de nyeste
// CHANGELOG_VISIBLE, resten blir liggende som historikk i denne fila.
// `date` er datoen funksjonen ble tilgjengelig for utøveren (levert i prod),
// ikke datoen koden ble skrevet.

export type ChangelogEntry = {
  /** YYYY-MM-DD — dagen funksjonen ble tilgjengelig i appen. */
  date: string
  title: string
  body: string
}

/** Vises som diskret merkelapp øverst på /nytt. Løftes ved større leveranser. */
export const CHANGELOG_VERSION = '1.2'

/** Hvor mange av de nyeste punktene sida viser. */
export const CHANGELOG_VISIBLE = 12

export const CHANGELOG: ChangelogEntry[] = [
  // V1.2 (2026-08-20): ÉN oppføring for hele leveringen («ett punkt per
  // levering») — utvidet etter hvert som delene gikk live samme dag:
  // forside + øktmal-bibliotek + standardøkt + sammenligning + intervall-
  // byggeren.
  {
    date: '2026-08-20',
    title: 'X-PULSE V1.2',
    body: 'Ny forside — og planlegging på sekunder: intervall-byggeren lager hele økta fra antall × dragtid × sone / pause (skiskyttere velger skyting i pausene), 58 ferdige øktmaler fra OLT-skalaen med søk («6x6»), standardøkt-merking og full sammenligning av standardøkter i analysen.',
  },
  {
    date: '2026-08-20',
    title: 'Reisedag i dagboka',
    body: 'Planlegg og før reisedager med timer og notat — og tren samme dag som vanlig.',
  },
  {
    date: '2026-08-15',
    title: 'Polar-synk er live',
    body: 'Koble Polar direkte, så kommer øktene inn av seg selv.',
  },
  {
    date: '2026-08-15',
    title: 'Helse og søvn fra klokka',
    body: 'Søvn, hvilepuls, HRV og skritt hentes automatisk — og kan føres manuelt.',
  },
  {
    date: '2026-08-15',
    title: 'Vind og sikt per skyteserie',
    body: 'Før vimpelstilling og sikt for hver serie, og se det igjen i analysen.',
  },
  {
    date: '2026-08-15',
    title: 'Skuddplotting på blink',
    body: 'Plott hvert skudd der det traff. Treffprosenten regnes ut av seg selv.',
  },
  {
    date: '2026-08-15',
    title: 'Skytetest-maler',
    body: 'NSSF-testene ligger klare i biblioteket, og du kan lage dine egne.',
  },
  {
    date: '2026-08-15',
    title: 'Testmaler for alle idretter',
    body: 'Merk en øktmal som test, uansett om det er løping, styrke eller skyting.',
  },
  {
    date: '2026-08-15',
    title: 'Standardøkter',
    body: 'Samle økter du gjentar i en serie, og finn dem igjen i analysen.',
  },
  {
    date: '2026-08-15',
    title: '287 øvelser i biblioteket',
    body: 'Utvidet fra 127, med en ny kategori for bæring og grep.',
  },
]

const MANEDER = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
] as const

/**
 * «2026-08-15» → «15. august 2026».
 *
 * Månedsnavnene er hardkodet med vilje: `toLocaleDateString('nb-NO')` er
 * avhengig av at ICU-dataene følger med kjøretidsmiljøet, og en side som
 * bygges statisk skal ikke kunne endre språk fordi byggemiljøet gjør det.
 * Ukjent format returneres uendret framfor å bli «NaN. undefined».
 */
export function formatChangelogDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const [, aar, mnd, dag] = m
  const navn = MANEDER[Number(mnd) - 1]
  if (!navn) return date
  return `${Number(dag)}. ${navn} ${aar}`
}

/**
 * Grupperer oppføringene under datoen sin, i den rekkefølgen de står.
 * Datoen skal skrives som overskrift kun når den endrer seg nedover, så åtte
 * punkter fra samme dag gir én overskrift — ikke åtte.
 */
export function groupChangelogByDate(
  entries: readonly ChangelogEntry[],
): { date: string; entries: ChangelogEntry[] }[] {
  const grupper: { date: string; entries: ChangelogEntry[] }[] = []
  for (const entry of entries) {
    const forrige = grupper[grupper.length - 1]
    if (forrige && forrige.date === entry.date) forrige.entries.push(entry)
    else grupper.push({ date: entry.date, entries: [entry] })
  }
  return grupper
}
