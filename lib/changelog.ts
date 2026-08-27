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
  /**
   * Versjonsslippet punktet hører til (f.eks. '1.2'). Punkter UTEN version er
   * «nye ting» etter siste slipp og vises i egen seksjon øverst på /nytt —
   * nye oppføringer legges øverst uten version til neste versjon slippes.
   */
  version?: string
}

/** Vises som diskret merkelapp øverst på /nytt. Løftes ved større leveranser. */
export const CHANGELOG_VERSION = '1.2'

/** Hvor mange av de nyeste «nye ting»-punktene (uten version) sida viser.
 * Versjonsslipp (f.eks. v1.2-seksjonen) vises alltid i sin helhet. */
export const CHANGELOG_VISIBLE = 12

export const CHANGELOG: ChangelogEntry[] = [
  // ── NYE TING etter v1.2 legges HER (øverst, uten version) ──────────────
  {
    date: '2026-08-27',
    title: 'Ny helseoversikt fra klokka',
    body: 'Helse har fått en helt ny flate: søvnstadier per natt, hypnogram av siste natt (når klokka leverer stadie-tidslinja), HRV-, hvilepuls-, søvnscore- og vekt-trender, og en dybdevisning med restitusjon, søvn, aktivitet og klokkas egne skårer. Et kompakt helsekort ligger på hjem-skjermen og på dager med helsedata i kalenderen — klikk åpner hele oversikten. Du kan også føre dagens følelse (1–5, samme skala som øktene) rett fra kortet, og som alltid vinner det du fører selv over det klokka sier.',
  },
  {
    date: '2026-08-27',
    title: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta)',
    body: 'Koble klokka én gang under Innstillinger → Klokkesync, så kommer nye økter inn av seg selv — med full pulskurve, runder og sonefordeling fra originalfila. Tilkoblingen henter også rundt 90 dager historikk. Fra Garmin og COROS følger helsedata med: søvn med faser og score, natt-HRV, hvilepuls og skritt lander i helse-loggen hver natt — og det du fører selv vinner alltid over klokka. Hver importerte økt gir deg et varsel i innboksen.',
  },
  {
    date: '2026-08-27',
    title: 'Koble synket økt til planen',
    body: 'En synket økt kan knyttes til en planlagt økt — også når planen sa en annen dag (±3 dager). Da ser du plan mot gjennomført, og planen markeres som fullført uten å dupliseres i dagboka. Fra en planlagt økt velger du «Knytt til synket økt» i stedet for å markere manuelt.',
  },
  {
    date: '2026-08-26',
    title: 'Lys modus',
    body: 'Hele appen kan nå stå lyst. Bryteren ligger i topplinja — sol når du er i mørk modus, måne når du er i lys — og valget huskes til neste gang du logger inn. Fargene som betyr noe er urørt: sonefargene, skytefargene og periodiseringen er de samme i begge tema, så en graf leses likt uansett hva du har valgt.',
  },


  // ── X-PULSE V1.2 — alle punktene i slippet (Sverre 22. aug: siste
  //    endringer som egne punkter under v1.2) ───────────────────────────────
  {
    date: '2026-08-22',
    title: 'Utøverplasser for trenere',
    body: 'Trener Pro har 5 Athlete Pro-lisenser inkludert, og både Basic og Pro kan kjøpe flere utøverplasser for 29 kr/mnd. Del én invitasjonslenke fra trenerpanelet — utøveren registrerer seg og er koblet til deg med full tilgang på under et minutt, uten kort.',
    version: '1.2',
  },
  {
    date: '2026-08-22',
    title: 'Skitester kan åpnes og redigeres',
    body: 'Se hele resultatet av en skitest, rett feil og fyll inn i etterkant — fra skiparken, utstyrssiden og trenervisningen.',
    version: '1.2',
  },
  {
    date: '2026-08-22',
    title: 'Søvnscore i helse',
    body: 'Før søvnscore (0–100) sammen med resten av søvndataene.',
    version: '1.2',
  },
  {
    date: '2026-08-22',
    title: '.fit-importen henter alt',
    body: 'Aktiviteter, soner og totaler kommer nå riktig inn fra klokke-filer — og Strava-økter uten runder får også soner.',
    version: '1.2',
  },
  {
    date: '2026-08-21',
    title: 'Utstyr med egne felter per kategori',
    body: 'Ski, rulleski, skisko, løpesko, staver, sykkel og sykkelsko har hver sine felter — og start-km gjør at historisk utstyr ikke begynner på null.',
    version: '1.2',
  },
  {
    date: '2026-08-21',
    title: 'Sliphistorikk på ski',
    body: 'Ny slip legges oppå historikken, og «km siden siste slip» telles automatisk fra øktene.',
    version: '1.2',
  },
  {
    date: '2026-08-21',
    title: 'Skipark-tester med parallelltest',
    body: 'Tidtaker-glid, lengde-glid og parallelltest med utslagsrunder — ett trykk kårer vinneren, og forhold (vær, føre, temperatur, fukt) registreres på alle tester.',
    version: '1.2',
  },
  {
    date: '2026-08-21',
    title: 'Utstyr per aktivitet i økta',
    body: 'Velg utstyr for hele økta i en kompakt chip-rad, og bytt per aktivitet der du faktisk byttet — km og tid følger aktivitetene. Planlagt utstyr teller først når økta er gjennomført.',
    version: '1.2',
  },
  {
    date: '2026-08-20',
    title: 'Ny forside',
    body: 'x-pulse.no er bygget om — nye bilder, funksjonssider og priser.',
    version: '1.2',
  },
  {
    date: '2026-08-20',
    title: 'Intervall-byggeren',
    body: 'Hele økta fra antall × dragtid × sone / pause — skiskyttere velger skyting i pausene. Struktur på sekunder, alt kan justeres etterpå.',
    version: '1.2',
  },
  {
    date: '2026-08-20',
    title: '58 øktmaler fra OLT-skalaen',
    body: 'Ferdige økter bygget på Olympiatoppens intensitetsskala, med søk som forstår «6x6».',
    version: '1.2',
  },
  {
    date: '2026-08-20',
    title: 'Konkurranse- og testpanel i føringen',
    body: 'Konkurranse, testløp og test øverst i økta — med A/B/C-prioritet rett fra årsplanen og testvalg fra biblioteket.',
    version: '1.2',
  },
  {
    date: '2026-08-20',
    title: 'Standardøkter i analysen',
    body: 'Merk økter som standardøkt og sammenlign gjennomføringene mot hverandre over tid.',
    version: '1.2',
  },
  {
    date: '2026-08-20',
    title: 'Reisedag i dagboka',
    body: 'Planlegg og før reisedager med timer og notat — og tren samme dag som vanlig.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Polar-synk er live',
    body: 'Koble Polar direkte, så kommer øktene inn av seg selv.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Helse og søvn fra klokka',
    body: 'Søvn, hvilepuls, HRV og skritt hentes automatisk — og kan føres manuelt.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Vind og sikt per skyteserie',
    body: 'Før vimpelstilling og sikt for hver serie, og se det igjen i analysen.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Skuddplotting på blink',
    body: 'Plott hvert skudd der det traff. Treffprosenten regnes ut av seg selv.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Skytetest-maler',
    body: 'NSSF-testene ligger klare i biblioteket, og du kan lage dine egne.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Testmaler for alle idretter',
    body: 'Merk en øktmal som test, uansett om det er løping, styrke eller skyting.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: 'Standardøkter',
    body: 'Samle økter du gjentar i en serie, og finn dem igjen i analysen.',
    version: '1.2',
  },
  {
    date: '2026-08-15',
    title: '287 øvelser i biblioteket',
    body: 'Utvidet fra 127, med en ny kategori for bæring og grep.',
    version: '1.2',
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
