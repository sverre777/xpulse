// ÉN liste som driver hele klokkesync-inngangen: merkevelgeren, merkesidene
// og «kommer snart»-oppføringene. Nytt merke legges til ved å utvide denne
// lista — ikke ved å kopiere komponenter.
//
// JUS PER MERKE (viktig, se `branding`-feltet):
//  · Strava: «Powered by Strava»-merkingen og Stravas egen Koble til-knapp er
//    PÅKREVD av deres brand guidelines. Merkesiden for Strava rendrer derfor
//    Strava-komponentene i tillegg til innholdet herfra.
//  · Polar: logobruk er begrenset i lisensavtalen. Vi bruker navnet nøytralt
//    for å vise interoperabilitet, ingen markedsføringsgrafikk, og krediterer
//    datakilden tekstlig som «Polar Ecosystem» der Polar-data vises.
//  · Nye merker: sjekk deres egne brand guidelines FØR logo tas i bruk. Står
//    du i tvil, bruk tekstvarianten (branding: 'tekst').

export type BrandStatus = 'live' | 'kommer'

export interface KlokkesyncBrand {
  slug: string
  name: string
  status: BrandStatus
  /** Én linje i merkevelgeren om hva integrasjonen gir. */
  tagline: string
  /** Aksentfarge på kortet. Nøytral X-PULSE-oransje der merket ikke har egne krav. */
  accent: string
  /** 'strava' = merkets egne påkrevde komponenter i tillegg. 'tekst' = kun tekst. */
  branding: 'strava' | 'tekst'
  /**
   * Bokstav(er) i merke-flisen. Vi tegner en nøytral monogram-flis i merkets
   * farge — ikke merkets logo. Grunnen er at vi verken har de offisielle
   * logo-filene eller lisens til å tegne dem selv, og en omtrentlig kopi av et
   * varemerke er verre enn ingen logo. Strava er unntaket: der har vi (og skal
   * ha) merkets egen logo.
   */
  mark?: string
  /**
   * Sti til offisiell logo-fil under /public når vi har den (f.eks.
   * '/brands/polar.svg'). Settes den, vises den i stedet for monogrammet —
   * ett felt per merke, ingen kodeendring.
   */
  logoSrc?: string
  /** OAuth-inngang. Kun satt for live merker. */
  connectPath?: string
  /** Tabellen som holder brukerens tilkobling. Kun satt for live merker. */
  connectionTable?: string
  /** Tekstlig kildekreditering der merkets data vises. */
  credit?: string

  // ── Innhold på merkesiden ──
  intro?: string
  fetches?: string[]
  stores?: string[]
  limits?: string[]
  deletion?: string[]
  privacyUrl?: string
  privacyLabel?: string
}

export const KLOKKESYNC_BRANDS: KlokkesyncBrand[] = [
  {
    slug: 'strava',
    name: 'Strava',
    status: 'live',
    tagline: 'Automatisk import av økter, lap-tider og puls/watt/pace-strømmer.',
    accent: '#FC5200',
    branding: 'strava',
    connectPath: '/auth/strava/connect',
    connectionTable: 'strava_connections',
    intro:
      'Koble til Strava én gang — alle nye økter synkes automatisk innen 5 minutter. ' +
      'Vi henter aktiviteten, splittene/lapsene og puls/watt/pace-strømmene.',
    fetches: [
      'Treningsøkter: tittel, sport, varighet, distanse, dato og klokkeslett',
      'Puls: snittpuls, makspuls og sonefordeling regnet fra din egen pulsskala',
      'Lap-data: tider, distanse, watt, kadens og høydemeter per intervall',
      'Sekund-for-sekund-strømmer: puls, watt, pace, høyde og kadens',
    ],
    stores: [
      'Aggregerte verdier (varighet, distanse, sonefordeling, lap-data) lagres så lenge Strava er koblet til',
      'Rå strømmer og GPS slettes automatisk etter 7 dager — Stravas eget krav',
    ],
    limits: [
      'Strava-sync rulles ut gradvis mens vi utvider kapasiteten',
      'Vi importerer kun aktiviteter du har gitt tilgang til i Strava-dialogen',
    ],
    deletion: [
      'Ved frakobling slettes ALL importert Strava-data innen 48 timer (API Agreement § 5.4)',
      'Tilgangen vår trekkes tilbake hos Strava i samme operasjon',
      'Vil du beholde øktene: last ned .fit-filer fra Strava og last dem opp her',
    ],
    privacyUrl: 'https://www.strava.com/legal/privacy',
    privacyLabel: 'strava.com/legal/privacy',
  },
  {
    slug: 'polar',
    name: 'Polar',
    status: 'live',
    tagline: 'Automatisk import fra Polar Flow — nye økter kommer inn av seg selv.',
    accent: '#FF4500',
    branding: 'tekst',
    connectPath: '/auth/polar/connect',
    connectionTable: 'polar_connections',
    credit: 'Polar Ecosystem',
    intro:
      'Koble til Polar én gang. Nye økter varsles til oss automatisk og hentes inn — ' +
      'med sikkerhetsnett som henter det som måtte falle utenfor hver 6. time.',
    fetches: [
      'Treningsøkter: sport, varighet, distanse, dato og klokkeslett',
      'Puls: snittpuls og makspuls, pluss sekund-for-sekund puls der klokka har lagret det',
      'Fart, kadens og høyde der Polar leverer det',
      'Sonefordeling regnes ut hos oss, fra DIN pulsskala — ikke Polars',
    ],
    stores: [
      'Økta og de aggregerte verdiene lagres så lenge Polar er koblet til',
      'Rå sekund-data lagres sammen med økta og følger den',
      'Vi lagrer ingen personopplysninger fra Polar-profilen din (navn, fødselsdato, kjønn, vekt)',
    ],
    limits: [
      'Polar gir kun økter fra de siste 30 dagene',
      'Kun økter som lastes opp til Polar Flow ETTER at du koblet til er tilgjengelige — eldre historikk må inn via .fit-opplasting',
      'Høydemeter følger ikke med i Polars øktsammendrag, så feltet står tomt på importerte økter. Det er ikke en feil hos oss',
      'Alle obligatoriske samtykker må være godtatt i Polar Flow, ellers nekter Polar oss tilgang',
    ],
    deletion: [
      'Ved frakobling slettes alle Polar-importerte økter, aktiviteter og rå-data',
      'X-PULSE avregistreres hos Polar og tilgangen (tokenet) trekkes tilbake — påkrevd av Polars API-lisensavtale',
      'Vil du beholde øktene: eksporter dem som .fit fra Polar Flow og last dem opp her',
    ],
    privacyUrl: 'https://www.polar.com/en/legal/privacy-notice',
    privacyLabel: 'polar.com/legal/privacy-notice',
  },
  {
    slug: 'garmin',
    name: 'Garmin',
    status: 'kommer',
    tagline: 'Direkte-synk fra Garmin Connect. Bruk .fit-opplasting i mellomtiden.',
    accent: 'var(--tekst-5-app)',
    branding: 'tekst',
  },
  {
    slug: 'coros',
    name: 'COROS',
    status: 'kommer',
    tagline: 'Direkte-synk fra COROS. Bruk .fit-opplasting i mellomtiden.',
    accent: 'var(--tekst-5-app)',
    branding: 'tekst',
  },
  {
    slug: 'suunto',
    name: 'Suunto',
    status: 'kommer',
    tagline: 'Direkte-synk fra Suunto. Bruk .fit-opplasting i mellomtiden.',
    accent: 'var(--tekst-5-app)',
    branding: 'tekst',
  },
  {
    slug: 'whoop',
    name: 'Whoop',
    status: 'kommer',
    tagline: 'Belastning og restitusjon fra Whoop.',
    accent: 'var(--tekst-5-app)',
    branding: 'tekst',
  },
  {
    slug: 'oura',
    name: 'Oura',
    status: 'kommer',
    tagline: 'Søvn og restitusjon fra Oura.',
    accent: 'var(--tekst-5-app)',
    branding: 'tekst',
  },
]

export function getKlokkesyncBrand(slug: string): KlokkesyncBrand | null {
  return KLOKKESYNC_BRANDS.find(b => b.slug === slug) ?? null
}

export function liveKlokkesyncBrands(): KlokkesyncBrand[] {
  return KLOKKESYNC_BRANDS.filter(b => b.status === 'live')
}
