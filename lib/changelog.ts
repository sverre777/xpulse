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

// .ts i stien: selvtesten (scripts/changelog-selftest.ts) kjøres rett i node.
import { APP_VERSJON } from './versjon.ts'

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

/** Vises som diskret merkelapp øverst på /nytt — samme tall som nav-merket
    (lib/versjon.ts er kilden; løftes ved større leveranser). */
export const CHANGELOG_VERSION = APP_VERSJON

/** Hvor mange av de nyeste «nye ting»-punktene (uten version) sida viser.
 * Versjonsslipp (f.eks. v1.2-seksjonen) vises alltid i sin helhet. */
export const CHANGELOG_VISIBLE = 12

export const CHANGELOG: ChangelogEntry[] = [
  // ── NYE TING etter v1.3 legges HER (øverst, uten version) ──────────────
  // MERK (Sverre 28. aug): v1.3 er ÅPEN — leveringer legges med version
  // '1.3', ikke som nye u-versjonerte punkter. Ingen v1.4 før Sverre sier det.
  //
  // FORM I v1.3 (Sverre 2. sep): stikkord — én linje per punkt, færre
  // småting, flere store. Ingen interne navn (bolk, fase, leverandører
  // bak kulissene). Ett punkt per LEVERING: kutt og match i Øktbyggeren
  // og plan-grafen legges inn i SAMME punkt når de lander.

  // ── v1.3 — åpen fra 26. august 2026 ────────────────────────────────────
  {
    date: '2026-09-02',
    title: 'Øktbygger i dagboka',
    body: 'Hurtigoppsettet (antall × dragtid × sone / pause) finnes nå også på gjennomførte økter, og radene styrer tida: start og varighet som tall, del og slå sammen med ett trykk.',
    version: '1.3',
  },
  {
    date: '2026-08-29',
    title: 'Økt-grafen, lesbar',
    body: 'Én y-akse, krysshår med lesepanel, zoom og panorering — og et segmentbånd under kurven der oppvarming, drag, pauser og skyting tegnes i tid.',
    version: '1.3',
  },
  {
    date: '2026-08-29',
    title: 'Plott treff',
    body: 'Alle skytingene i økta på ett sted: plott hvert skudd på skiva, serie for serie, med vind og sikt.',
    version: '1.3',
  },
  {
    date: '2026-08-29',
    title: 'Veksling som egen aktivitet',
    body: 'T1/T2 i triatlon og bytt-tid i multisport er en egen aktivitetstype med egen tidskategori — verken trening eller pause.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Koble og flett klokkeøkter med planen',
    body: 'En synket økt kobles til den planlagte (også ±3 dager) og flettes: bytt ut med klokkas runder eller legg klokka bak det du har ført — alt kan angres, klokkemerket og plan mot gjennomført følger med.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Terskler, soner og helse på profilen',
    body: 'Terskelpuls, terskelfart og FTP per bevegelsesform — versjonert, så hver økt bruker terskelen som gjaldt den dagen — med egne pulssoner, makspuls og hvilepuls på samme flate.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'NP og IF på økter med watt',
    body: 'Normalisert effekt og intensitetsfaktor mot FTP-en din, og belastningen regnes av watt der den finnes.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Ny analysefane: Prestasjon',
    body: 'Effektivitetsfaktor over tid, aerob frakobling på lange økter og stigningsjustert fart (GAP) på løperunder.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Sesong mot sesong',
    body: 'Sammenlign to sesonger måned for måned — timer, kilometer, økter eller effektivitetsfaktor — i analysen og under Årsplan.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Utvidet intensitetsskala I6–I8',
    body: 'Slå på I6–I8 på profilen for anaerob trening, så erstatter de Hurtighet i føring, planlegging og grafer — hos deg og treneren din.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Fyldigere profil',
    body: 'Brukernavn, fødselsdato, høyde, vekt og sekundærsport — og en påminnelse om terskler til de er satt.',
    version: '1.3',
  },
  {
    date: '2026-08-28',
    title: 'Klokkesynk-status i mobil-toppen',
    body: 'Tilkoblingsstatusen ligger i topplinja på mobil — ett trykk til innstillingene.',
    version: '1.3',
  },
  {
    date: '2026-08-27',
    title: 'Ny helseoversikt',
    body: 'Søvnstadier og hypnogram, HRV-, hvilepuls- og vekttrender, og et helsekort på hjem og i kalenderen — det du fører selv vinner alltid.',
    version: '1.3',
  },
  {
    date: '2026-08-27',
    title: 'Garmin, COROS, Wahoo og Zepp synker direkte',
    body: 'Koble klokka én gang, så kommer økter med pulskurve, runder og soner — og søvn, HRV og hvilepuls — inn av seg selv, med rundt 90 dager historikk.',
    version: '1.3',
  },
  {
    date: '2026-08-26',
    title: 'Lys modus',
    body: 'Hele appen i lyst tema — bryter i topplinja, valget huskes, og sonefargene er de samme i begge.',
    version: '1.3',
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
