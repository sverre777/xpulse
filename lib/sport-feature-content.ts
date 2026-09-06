import type { FeatureSportSlug } from './landing-meta'
import type { SportFeatureBullet } from '@/components/landing/SportFeatureSection'
import type { LandingMedia } from '@/components/landing/LandingSeksjon'
import { NYTT_I_VERSJON } from './versjon'

// Innhold per sport-underside. Hold dette ett sted så hver page-fil kun
// renderer; tekst-endringer trenger ikke en page-rebuild-runde.

export interface SportPageContent {
  slug: FeatureSportSlug
  hero: {
    kicker: string
    titleLines: string[]   // Splittes på <br/> i UI; siste linje får oransje aksent
    description: string
    // Valgfritt hero-bakgrunnsbilde. Path som er relativt fra public/.
    backgroundImage?: string
    // UNDERSIDENE v2 bolk B2: basisnavnet i public/underside/ (uten -760/-1280/-1920
    // og .webp). Er det tomt, brukes backgroundImage direkte.
    bilde?: string
    alt?: string
    /** Bevis-chipsene under ingressen. Maks seks - de skal kunne leses på én linje. */
    bevis?: string[]
  }
  metaDescription: string
  sections: {
    id?: string
    kicker?: string
    title: string
    intro?: string
    bullets?: SportFeatureBullet[]
    /** Kort navn i snarveisraden (bolk B3). Uten dette brukes kicker. */
    snarvei?: string
    /** Media til høyre (bolk B4): ekte produktfragment, foto eller merkeliste. */
    media?: LandingMedia
  }[]
  /** Seks spørsmål per side (bolk B5). Gir FAQPage JSON-LD. */
  faq?: { sporsmal: string; svar: string }[]
}

export const SPORT_PAGE_CONTENT: Record<FeatureSportSlug, SportPageContent | null> = {
  langrenn: {
    slug: 'langrenn',
    hero: {
      bilde: 'langrenn-hoved-rulleski-kollen',
      alt: 'Langrennsløper på rulleski i Holmenkollen',
      bevis: ['Skipark og ski-tester', 'Klassisk · skøyting · staking', 'Rulleski og mølle', 'Klokkesynk', 'Øktbygger', 'Trenerpanel'],
      kicker: 'X-PULSE for langrenn',
      titleLines: ['Klassisk.', 'Skøyting.', 'Staking.'],
      description:
        'Full bredde av langrennssporten på én plattform. Logg drag, analyser bevegelsesform-spesifikk utvikling, hold orden på skiparken og bygg sesongplan rundt nasjonale konkurranser.',
      backgroundImage: '/photos/langrenn.jpg',
    },
    metaDescription:
      'X-PULSE for langrennsutøvere. Klassisk, skøyting, staking, skipark, ski-tester og bevegelsesform-spesifikk analyse på én plattform.',
    sections: [
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'BYGG ØKTA SLIK DU TENKER DEN.',
        intro:
          'Radene er editoren - ingen dra-og-slipp. Skriv 8 × 45/15 i hurtigoppsettet, så ligger hele økta klar med oppvarming, drag, pauser og nedjogg. Bytt sone, teknikk eller distanse på én rad, og resten regner seg selv.',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Hurtigoppsett', body: 'Skriv antall × dragtid / pause og sone - økta genereres som vanlige rader du kan justere fritt.' },
          { title: '58 ferdige øktmaler', body: 'Bygget på Olympiatoppens intensitetsskala: terskel, I4/I5, motbakke, lagtur. Lagre dine egne som maler.' },
          { title: 'Laktat, ernæring og notat', body: 'Punkter legges rett på kurven der de skjedde - planlagt teller aldri som målt.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening. Rundene fra klokka legges oppå planen din - samlet eller splittet, du velger. Det du fører manuelt vinner alltid over det klokka gjettet.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta. Samlet eller splittet - og manuelle tall vinner.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'analyse',
        snarvei: 'Analyse',
        kicker: 'Analyse',
        title: 'KLASSISK VS SKØYTING - SIDE OM SIDE.',
        intro:
          'Alt kan filtreres på bevegelsesform. Se om du faktisk dekker begge stilarter slik planen sier, hvor mange timer som ligger i I3+, og hvordan formen svarer på det du har gjort. Grafene setter du sammen selv og stjernemerker dem du vil se først.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med soner, laktat og ernæring', hoyde: 620 },
        bullets: [
          { title: 'Filter per teknikk', body: 'Skøyting, klassisk og staking skilles i alle grafer - også de du bygger selv.' },
          { title: 'Belastning og form', body: 'CTL, ATL og TSB på samme kurve som konkurransene dine.' },
          { title: 'Terskel og tester', body: 'Terskelverdiene dine styrer sonene overalt - endrer du dem, regnes historikken riktig.' },
        ],
      },
      {
        id: 'skipark',
        snarvei: 'Skipark',
        kicker: 'Skipark og ski-tester',
        title: 'ALLE SKIENE DINE - ÉN OVERSIKT.',
        intro:
          'Registrer hele skiparken med modell, lengde, fleks, slip og smøring. Test par mot par under kjente forhold - snøtype, luft- og snøtemperatur, fuktighet - og se hvilken kombinasjon som faktisk var raskest den dagen.',
        media: { type: 'foto', bilde: 'langrenn-skitunnel', alt: 'Langrennsløper i skitunnel' },
        bullets: [
          { title: 'Par, slip og smøring', body: 'Hvert par har sin egen historikk: når det ble slipt, hva som ligger på, hvor mange km det har gått.' },
          { title: 'Test-økter med forhold', body: 'Logg testen med føre og temperatur - resultatet henger på forholdene, ikke på minnet.' },
          { title: 'Km og timer per par', body: 'Se hvilke ski som faktisk brukes, og hvilke som bare ligger i kjelleren.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'BYGG SESONGEN MOT DE LØPENE DU BRYR DEG OM.',
        intro:
          'Legg inn konkurransekalenderen - Beitosprinten, Lillehammer, NM, Holmenkollen - og bygg periodene rundt dem. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål for timer og hardøkter.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-løp', body: 'Merk hva som er hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og nøkkeldatoer', body: 'Samlinger, tester og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter. Push økter, plan-maler eller hele årsplaner til én utøver eller hele gruppa.',
        media: { type: 'foto', bilde: 'langrenn-to-utovere-snoskog', alt: 'To langrennsløpere i snødekt skog', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen. Sonene regnes fra hver utøvers egne terskler.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - ikke i en meldingstråd.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja. Frakobling fjerner tilgangen umiddelbart.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Har du et annet merke, laster du opp .fit-fila - også fra Suunto. Intervals.icu og Whoop er på vei. Vi leser bare data; kobler du fra, slettes det vi har hentet.',
      },
      {
        sporsmal: 'Kan jeg registrere skiparken og ski-testene mine?',
        svar: 'Ja. Hvert par registreres med modell, lengde, fleks, slip og smøring, og du kan logge tester med snøtype, temperatur og fuktighet slik at du ser hva som var raskest under hvilke forhold.',
      },
      {
        sporsmal: 'Skiller X-PULSE mellom klassisk, skøyting og staking?',
        svar: 'Ja. Teknikkene er egne underkategorier av bevegelsesformen, og alle grafer og summer kan filtreres på dem - også rulleski og rulleski på mølle.',
      },
      {
        sporsmal: 'Kan treneren min følge meg her?',
        svar: 'Ja. Treneren ser planen, dagboka og analysen din, kan pushe økter og kommentere i selve økta. Helsedata som HRV og søvn deles kun hvis du selv slår det på, og frakobling fjerner tilgangen umiddelbart.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Er X-PULSE laget for eliten eller for mosjonister?',
        svar: 'Verktøyene er bygget for utøvere som trener målrettet, men de er enkle å bruke uansett nivå. Du velger selv hvor detaljert du vil føre - fra én linje til drag, laktat og skyting.',
      },
    ],
  },

  skiskyting: {
    slug: 'skiskyting',
    hero: {
      bilde: 'skiskyting-hoved-tunnel',
      alt: 'Skiskytter i skitunnel',
      bevis: ['Skyting L/S med treff%', 'Standplasstid og bomkart', 'Konkurransestruktur', 'Terskel og laktat', 'Klokkesynk', 'Trenerpanel'],
      kicker: 'X-PULSE for skiskyting',
      titleLines: ['Eneste plattformen', 'med dyp', 'skyting-analyse.'],
      description:
        'Auto-genererte konkurranseformater (Sprint, Jaktstart, Normal, Fellesstart), per-skyting-data, treff% delt på liggende/stående, og custom grafer som lar deg svare på spørsmål andre apper ikke kan.',
      backgroundImage: '/photos/skiskyting.jpg',
    },
    metaDescription:
      'X-PULSE for skiskyttere. Auto-konkurransestruktur, treff% per posisjon, per-skyting-data og custom skyting-grafer.',
    sections: [
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'BYGG ØKTA - MED SKYTINGEN I DEN.',
        intro:
          'Radene er editoren. Skriv 5 × 3 min i hurtigoppsettet, legg skytingen inn der den faktisk skjedde, og få hele økta klar med oppvarming, drag, standplass og nedjogg. Skytingen er egne rader med serie, posisjon og treff.',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Hurtigoppsett', body: 'Skriv antall × dragtid / pause og sone - økta genereres som rader du kan justere fritt.' },
          { title: 'Skyting som egne rader', body: 'Ligg og stå, serie for serie, med treff, standplasstid og bom der de hører hjemme.' },
          { title: '58 ferdige øktmaler', body: 'Bygget på Olympiatoppens intensitetsskala. Lagre dine egne som maler.' },
        ],
      },
      {
        id: 'standplass',
        snarvei: 'Standplass',
        kicker: 'Skyting og standplass',
        title: 'TREFF, TID OG BOMMENE DINE.',
        intro:
          'Hver serie logges med posisjon, treff, standplasstid og hvor bommene satt. Puls inn på standplass og sonen du kom fra ligger på samme rad, så du ser hva som faktisk kostet deg treffene.',
        media: { type: 'app', navn: 'skytestripe', kap: 'Skytestripa fra øktbyggeren', hoyde: 180 },
        bullets: [
          { title: 'Treff% per posisjon', body: 'Ligg og stå hver for seg, over tid og per konkurranse.' },
          { title: 'Puls inn og forrige sone', body: 'Kom du inn fra I5 eller I3? Radene husker det, så mønsteret blir synlig.' },
          { title: 'Bomkart og skuddplott', body: 'Plott skuddene og se om det henger igjen i samme hjørne.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening, og rundene legges oppå planen din. Skytingen fører du selv - det er den delen klokka ikke ser.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta - samlet eller splittet. Det du fører manuelt vinner alltid.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'analyse',
        snarvei: 'Analyse',
        kicker: 'Analyse',
        title: 'SKYTING OG UTHOLDENHET I SAMME BILDE.',
        intro:
          'Se treff% mot fart inn på standplass, timer i I3+, terskelutvikling og hvordan formen svarer. Grafene setter du sammen selv, og de du stjernemerker ligger først neste gang.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med soner, skyting og laktat', hoyde: 620 },
        bullets: [
          { title: 'Skyting mot belastning', body: 'Treffene sett mot hvor hardt du gikk inn - ikke bare mot dagen.' },
          { title: 'Terskel og laktat', body: 'Terskelverdiene styrer sonene overalt; laktatpunktene ligger på kurven der de ble tatt.' },
          { title: 'Belastning og form', body: 'CTL, ATL og TSB på samme kurve som konkurransene dine.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'SESONGEN MOT DE RENNENE SOM TELLER.',
        intro:
          'Legg inn konkurransekalenderen og bygg periodene rundt den. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål for timer, hardøkter og skuddmengde.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-løp', body: 'Merk hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og tester', body: 'Samlinger, skytetester og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter. Push økter, plan-maler eller hele årsplaner til én utøver eller hele gruppa.',
        media: { type: 'foto', bilde: 'skiskyting-staaende-rulleski', alt: 'Skiskytter på standplass med rulleski', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen. Sonene regnes fra hver utøvers egne terskler.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - også på skyteseriene.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja. Frakobling fjerner tilgangen umiddelbart.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Andre merker laster opp .fit-fila - også Suunto. Intervals.icu og Whoop er på vei.',
      },
      {
        sporsmal: 'Kan jeg føre skytingen serie for serie?',
        svar: 'Ja. Hver serie har posisjon, treff, standplasstid, bom og puls inn. Du kan plotte skuddene og se treff% per posisjon over tid.',
      },
      {
        sporsmal: 'Regner appen konkurransestruktur automatisk?',
        svar: 'Konkurranser kan legges opp med runder og standplasser slik løpet faktisk går, så skytingen havner mellom riktige runder.',
      },
      {
        sporsmal: 'Skiller den mellom rulleski, ski og løping?',
        svar: 'Ja. Bevegelsesform og underkategori ligger på økta, og alle grafer og summer kan filtreres på dem.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Kan treneren min se skytingen?',
        svar: 'Ja, hvis du kobler deg til treneren. Treneren ser plan, dagbok og analyse, og kan kommentere i selve økta. Helsedata deles bare hvis du slår det på.',
      },
    ],
  },

  langlop: {
    slug: 'langlop',
    hero: {
      bilde: 'langlop-hoved-drone-skogslop',
      alt: 'Langløp på skogsvei sett fra lufta',
      bevis: ['Birken og Vasaloppet', 'Pacing og ernæring', 'Terreng og høydemeter', 'Lange økter', 'Klokkesynk', 'Årsplan mot rennet'],
      kicker: 'X-PULSE for langløp',
      titleLines: ['Birken.', 'Vasaloppet.', 'Lange økter.'],
      description:
        'Bygd for de virkelig lange utholdenhetsøktene og turrennene. Logg ernæring, klær, gear og forhold per økt; bygg periodiseringen så du topper formen til riktig dato.',
      backgroundImage: '/photos/langlop.jpg',
    },
    metaDescription:
      'X-PULSE for langløp. Lang-tur-spesifikke felt, terreng-detaljering, periodisering mot Birken/Vasaloppet og pacing-analyse.',
    sections: [
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'LANGE ØKTER, BYGGET SOM DE SKAL KJØRES.',
        intro:
          'Radene er editoren. Legg langturen inn med drag, terreng og pauser, eller skriv 3 × 20 min i hurtigoppsettet. Ernæring og drikke legges som punkter der de faktisk skjedde.',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Hurtigoppsett', body: 'Skriv antall × dragtid / pause og sone - resten regner seg selv.' },
          { title: 'Terreng og høydemeter', body: 'Stigning per rad gir riktig belastning på lange turer.' },
          { title: 'Ernæring på kurven', body: 'Gel, drikke og mat legges som punkter i økta - planlagt teller aldri som målt.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening. Rundene fra klokka legges oppå planen din - samlet eller splittet, du velger.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta - samlet eller splittet. Det du fører manuelt vinner alltid.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'pacing',
        snarvei: 'Pacing',
        kicker: 'Pacing og ernæring',
        title: 'SLIK HOLDER DU FARTEN TIL MÅL.',
        intro:
          'Se hvordan farten faktisk falt gjennom de lange øktene, hvor mye du fikk i deg underveis, og hva som skjedde med pulsen etter timen. Det er der Birken avgjøres.',
        media: { type: 'foto', bilde: 'langlop-solnedgang-spor', alt: 'Langløper i spor ved solnedgang' },
        bullets: [
          { title: 'Fart og puls over tid', body: 'Drift i puls mot fart viser når du gikk tom - ikke bare hvor fort du var.' },
          { title: 'Ernæring per time', body: 'Karbo per time logges og summeres, så planen for rennet bygges på tall.' },
          { title: 'GAP i terreng', body: 'Tempo justert for stigning, så motbakkene ikke lyver om formen.' },
        ],
      },
      {
        id: 'analyse',
        snarvei: 'Analyse',
        kicker: 'Analyse',
        title: 'LANGE ØKTER SETT OVER TID.',
        intro:
          'Hvor mange timer ligger i I1 og I2, og har mengden faktisk økt? Sett belastningen mot formen og se hvordan kroppen svarer på de lange helgene.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med soner og ernæringspunkter', hoyde: 620 },
        bullets: [
          { title: 'Volum per uke og periode', body: 'Timer og km per bevegelsesform, uke for uke.' },
          { title: 'Belastning og form', body: 'CTL, ATL og TSB på samme kurve som rennene dine.' },
          { title: 'Terskel og tester', body: 'Terskelverdiene styrer sonene overalt - endrer du dem, regnes historikken riktig.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'BYGG SESONGEN MOT BIRKEN.',
        intro:
          'Legg inn rennene - Birken, Vasaloppet, Marcialonga - og bygg periodene rundt dem. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-løp', body: 'Merk hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og nøkkeldatoer', body: 'Samlinger, testrenn og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon. Push økter, plan-maler eller hele årsplaner til én utøver eller hele gruppa.',
        media: { type: 'foto', bilde: 'langlop-tiny-planet-tre', alt: 'Langløper i vinterskog', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - ikke i en meldingstråd.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Andre merker laster opp .fit-fila - også Suunto. Intervals.icu og Whoop er på vei.',
      },
      {
        sporsmal: 'Kan jeg planlegge ernæring til rennet?',
        svar: 'Ja. Ernæringspunkter logges i økta med mengde og tidspunkt, og summeres per time så du kan bygge rennplanen på egne tall.',
      },
      {
        sporsmal: 'Får jeg med høydemeter og terreng?',
        svar: 'Ja. Stigning kan føres per rad, og høydekurven fra klokka vises i økt-grafen.',
      },
      {
        sporsmal: 'Kan jeg bygge sesongen mot Birken?',
        svar: 'Ja. Legg rennet inn som A-løp i årsplanen, så former periodene og nedtellingen seg etter det.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Kan jeg bruke den til både ski og løping?',
        svar: 'Ja. Alle bevegelsesformer ligger i samme dagbok, og analysen kan filtreres på hver av dem.',
      },
    ],
  },

  loping: {
    slug: 'loping',
    hero: {
      bilde: 'loping-hoved-fjell-gress',
      alt: 'Løper i fjellterreng',
      bevis: ['GAP-tempo', 'Soner og terskel', 'Intervall på bane', 'Belastning og form', 'Klokkesynk', 'Øktbygger'],
      kicker: 'X-PULSE for løping',
      titleLines: ['Bane.', 'Asfalt.', 'Terreng.'],
      description:
        'Sone-styrt plan, pace-utvikling over tid og tester for å se om treningen faktisk gir fremgang. Funksjoner som dekker hele bredden — fra 800-meter-intervall til ultra på fjellet.',
      backgroundImage: '/photos/loping.jpg',
    },
    metaDescription:
      'X-PULSE for løpere. Sone-styrt plan, pace-utvikling, tester og PR-historikk for både bane, asfalt og terreng.',
    sections: [
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'INTERVALLENE SKRIVES, IKKE TEGNES.',
        intro:
          'Skriv 10 × 400 m eller 4 × 8 min i hurtigoppsettet, så ligger økta klar med oppvarming, drag, pauser og nedjogg. Bytt sone eller pause på én rad, og resten regner seg selv.',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Hurtigoppsett', body: 'Antall × dragtid / pause og sone - økta genereres som rader du kan justere fritt.' },
          { title: '58 ferdige øktmaler', body: 'Terskel, I4/I5, bakkedrag og langtur, bygget på Olympiatoppens intensitetsskala.' },
          { title: 'Laktat og notat på kurven', body: 'Punktene legges der de skjedde, så testene ligger i selve økta.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening. Rundene fra klokka legges oppå planen din - samlet eller splittet, du velger. Det du fører manuelt vinner alltid over det klokka gjettet.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta - samlet eller splittet. Det du fører manuelt vinner alltid.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'analyse',
        snarvei: 'Analyse',
        kicker: 'Analyse',
        title: 'GAP-TEMPO SIER SANNHETEN OM FORMEN.',
        intro:
          'Tempo justert for stigning gjør at bakkeøkta og flatøkta kan sammenlignes. Se utviklingen i fart ved terskel, timer i I3+, og hvordan formen svarer på det du faktisk har gjort.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med soner, tempo og laktat', hoyde: 620 },
        bullets: [
          { title: 'GAP over tid', body: 'Stigningsjustert tempo, så terrenget ikke skjuler framgangen.' },
          { title: 'Fart ved terskel', body: 'Tempoet du holder ved terskel, fulgt gjennom sesongen.' },
          { title: 'Belastning og form', body: 'CTL, ATL og TSB på samme kurve som konkurransene dine.' },
        ],
      },
      {
        id: 'tester',
        snarvei: 'Terskel',
        kicker: 'Terskel og tester',
        title: 'TESTENE STYRER SONENE DINE.',
        intro:
          'Terskelverdiene ligger som data med dato - ikke som en innstilling du glemmer å oppdatere. Legg inn en ny test, og sonene og historikken regnes riktig fra den datoen.',
        media: { type: 'foto', bilde: 'loping-bane-to-utovere', alt: 'To løpere på bane' },
        bullets: [
          { title: 'Terskelhistorikk', body: 'Puls, tempo og laktat per test, med dato. Estimater foreslås, men skrives aldri automatisk.' },
          { title: 'Soner per bevegelsesform', body: 'Løping og sykling har egne terskler - sonene følger den du faktisk trente i.' },
          { title: 'Laktatprofil', body: 'Laktatpunktene fra testen ligger på kurven der de ble tatt.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'BYGG SESONGEN MOT LØPENE DINE.',
        intro:
          'Legg inn konkurransene og bygg periodene rundt dem. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål for timer og hardøkter.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-løp', body: 'Merk hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og nøkkeldatoer', body: 'Samlinger, tester og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter.',
        media: { type: 'foto', bilde: 'loping-sti-host', alt: 'Løper på sti om høsten', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen. Sonene regnes fra hver utøvers egne terskler.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - ikke i en meldingstråd.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja. Frakobling fjerner tilgangen umiddelbart.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Andre merker laster opp .fit-fila - også Suunto. Intervals.icu og Whoop er på vei.',
      },
      {
        sporsmal: 'Hva er GAP-tempo?',
        svar: 'GAP er tempo justert for stigning. Det gjør at en bakkeøkt og en flat økt kan sammenlignes, og at framgangen din blir synlig selv om terrenget varierer.',
      },
      {
        sporsmal: 'Kan jeg ha egne soner for løping og sykling?',
        svar: 'Ja. Terskelverdiene ligger per bevegelsesform, og sonene regnes fra den du faktisk trente i.',
      },
      {
        sporsmal: 'Kan jeg legge inn laktattester?',
        svar: 'Ja. Testene ligger som terskelhistorikk med dato, og laktatpunktene kan legges på kurven i selve økta.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Kan treneren min følge meg her?',
        svar: 'Ja. Treneren ser plan, dagbok og analyse, kan pushe økter og kommentere i økta. Helsedata deles kun hvis du slår det på.',
      },
    ],
  },

  sykling: {
    slug: 'sykling',
    hero: {
      bilde: 'sykling-hoved',
      alt: 'Syklist på landevei',
      bevis: ['FTP og watt-soner', 'NP og IF per økt', 'Høydemeter', 'Belastning og form', 'Klokkesynk', 'Øktbygger'],
      kicker: 'X-PULSE for sykling',
      titleLines: ['Landevei.', 'Terreng.', 'Effekt.'],
      description:
        'Effekt-soner, høydemeter og sammenligning over sesong. Logg landeveis-økter og terrengritt med samme rammeverk og se utviklingen mot dine mål.',
      backgroundImage: '/photos/sykling.jpg',
    },
    metaDescription:
      'X-PULSE for syklister. Effekt-soner, høydemeter, FTP-utvikling og sammenligning av økter på samme rute over sesong.',
    sections: [
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'WATT-ØKTA SKRIVES PÅ SEKUNDER.',
        intro:
          'Skriv 4 × 8 min eller 30/15 i hurtigoppsettet, og legg watt eller motstand på radene. Økta ligger klar med oppvarming, drag, pauser og nedjogg - og felt som hører til sykkel, ikke til løping.',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Watt og motstand per rad', body: 'Feltene følger bevegelsesformen: watt, motstand, stigning og kadens der det gir mening.' },
          { title: 'Hurtigoppsett', body: 'Antall × dragtid / pause og sone - resten regner seg selv.' },
          { title: '58 ferdige øktmaler', body: 'Terskel, VO2, sweet spot og langtur. Lagre dine egne som maler.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening. Rundene fra klokka legges oppå planen din - samlet eller splittet, du velger. Det du fører manuelt vinner alltid over det klokka gjettet.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta - samlet eller splittet. Det du fører manuelt vinner alltid.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'effekt',
        snarvei: 'FTP og watt',
        kicker: 'FTP og watt-soner',
        title: 'FTP STYRER SONENE - OG NP/IF ØKTA.',
        intro:
          'FTP ligger som terskelverdi med dato, og watt-sonene regnes fra den. Hver økt får normalisert effekt, intensitetsfaktor og belastning, så en hard time og en lang tur kan sammenlignes.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med watt, soner og segmenter', hoyde: 620 },
        bullets: [
          { title: 'Watt-soner fra FTP', body: 'Coggan-soner regnet fra din egen FTP, med historikk når du tester på nytt.' },
          { title: 'NP, IF og TSS', body: 'Normalisert effekt og intensitetsfaktor per økt - belastningen blir riktig, ikke bare lang.' },
          { title: 'Watt per kg', body: 'Følges over tid sammen med vekt, uten at du må regne selv.' },
        ],
      },
      {
        id: 'klatring',
        snarvei: 'Høyde',
        kicker: 'Høydemeter og klatring',
        title: 'STIGNINGEN LIGGER I TALLENE.',
        intro:
          'Høydekurven fra klokka vises i økta, og stigning kan føres per rad. Klatringen teller inn i belastningen, så en kupert tur ikke ser lettere ut enn den var.',
        media: { type: 'foto', bilde: 'sykling-landevei', alt: 'Syklist på landevei med utsikt' },
        bullets: [
          { title: 'Høydekurve i økta', body: 'Fra klokka, sammen med puls, watt og fart.' },
          { title: 'Stigning per rad', body: 'Før terrenget der det hører hjemme - rolig, kupert, bratt.' },
          { title: 'Km og timer per sykkel', body: 'Utstyret har sin egen historikk, så service kommer når den skal.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'BYGG SESONGEN MOT RITTENE.',
        intro:
          'Legg inn rittene og bygg periodene rundt dem. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål for timer og hardøkter.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-ritt', body: 'Merk hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og nøkkeldatoer', body: 'Samlinger, testritt og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter.',
        media: { type: 'foto', bilde: 'sykling-hoved', alt: 'Syklist i fart', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen. Sonene regnes fra hver utøvers egne terskler.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - ikke i en meldingstråd.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja. Frakobling fjerner tilgangen umiddelbart.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Andre merker laster opp .fit-fila - også Suunto. Intervals.icu og Whoop er på vei.',
      },
      {
        sporsmal: 'Regner appen NP, IF og TSS?',
        svar: 'Ja. Normalisert effekt og intensitetsfaktor regnes per økt, og belastningen bygger på dem når watt finnes.',
      },
      {
        sporsmal: 'Hvordan settes watt-sonene?',
        svar: 'Fra din egen FTP. FTP ligger som terskelverdi med dato, så historikken regnes riktig når du tester på nytt.',
      },
      {
        sporsmal: 'Kan jeg følge watt per kg?',
        svar: 'Ja. Watt per kg følges over tid sammen med vekten du fører.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Kan jeg ha både sykkel og løping i samme dagbok?',
        svar: 'Ja. Alle bevegelsesformer ligger i samme dagbok med egne terskler og soner, og analysen kan filtreres på hver av dem.',
      },
    ],
  },

  multisport: {
    slug: 'multisport',
    hero: {
      bilde: 'multisport-hoved',
      alt: 'Utøver i variert terreng',
      bevis: ['All trening samlet', 'Soner per bevegelsesform', 'Styrke og live-økt', 'Belastning og form', 'Klokkesynk', 'Årsplan'],
      kicker: 'X-PULSE for multisport',
      titleLines: ['Løp. Sykle. Ski.', 'Styrke. Alt teller.'],
      description:
        'For deg som trener variert — eller bare vil komme i gang. All trening i én dagbok, én plan og én belastningsmodell, uansett hvor mange idretter du blander.',
      backgroundImage: '/photos/multisport.jpg',
    },
    metaDescription:
      'X-PULSE for multisport: løping, sykling, ski, styrke og alt annet i én treningsdagbok. Felles belastning, soner per sport og hybrid-økter.',
    sections: [
      {
        id: 'alt-samlet',
        snarvei: 'Alt samlet',
        kicker: 'Alt i én dagbok',
        title: 'ALT DU GJØR, SAMME STED.',
        intro:
          'Ski, løping, sykling, styrke, padling og alt annet ligger i samme dagbok med egne felt per bevegelsesform. Uka leses som en helhet - ikke som fem apper som ikke snakker sammen.',
        media: { type: 'foto', bilde: 'multisport-natur', alt: 'Utøver i variert natur' },
        bullets: [
          { title: 'Felt per bevegelsesform', body: 'Watt, motstand, stigning, fart og kadens dukker opp der de gir mening.' },
          { title: 'Egne terskler', body: 'Hver bevegelsesform har sine egne terskler, og sonene følger den du faktisk trente i.' },
          { title: 'Volum per form', body: 'Timer og km per bevegelsesform, uke for uke.' },
        ],
      },
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'BYGG ØKTA SLIK DU TENKER DEN.',
        intro:
          'Radene er editoren. Skriv 8 × 45/15 i hurtigoppsettet, så ligger hele økta klar med oppvarming, drag, pauser og nedjogg. Styrke har sitt eget oppsett med øvelser, sett og «sist gang».',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Hurtigoppsett', body: 'Antall × dragtid / pause og sone - resten regner seg selv.' },
          { title: 'Live styrkeøkt', body: '287 øvelser, plan og «sist» per øvelse, START per sett - alt havner i dagboka.' },
          { title: '58 ferdige øktmaler', body: 'Lagre dine egne som maler, uansett bevegelsesform.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening. Rundene fra klokka legges oppå planen din - samlet eller splittet, du velger. Det du fører manuelt vinner alltid over det klokka gjettet.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta - samlet eller splittet. Det du fører manuelt vinner alltid.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'analyse',
        snarvei: 'Analyse',
        kicker: 'Analyse',
        title: 'ÉN DAGBOK, HELE BILDET.',
        intro:
          'Filtrer på bevegelsesform, sett timer i I3+ mot formen, og bygg grafene du selv vil se først. Belastningen samler alt du gjør i én kurve.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med soner og segmenter', hoyde: 620 },
        bullets: [
          { title: 'Filter per bevegelsesform', body: 'Alle grafer og summer kan filtreres - også de du bygger selv.' },
          { title: 'Belastning og form', body: 'CTL, ATL og TSB på tvers av alt du gjør, med konkurransene på samme kurve.' },
          { title: 'Terskel og tester', body: 'Terskelverdiene styrer sonene overalt - endrer du dem, regnes historikken riktig.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'SESONGEN, UANSETT IDRETT.',
        intro:
          'Legg inn konkurransene og bygg periodene rundt dem. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål for timer og hardøkter.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-mål', body: 'Merk hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og nøkkeldatoer', body: 'Samlinger, tester og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter.',
        media: { type: 'foto', bilde: 'multisport-hoved', alt: 'Utøvere i variert terreng', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen. Sonene regnes fra hver utøvers egne terskler.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - ikke i en meldingstråd.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja. Frakobling fjerner tilgangen umiddelbart.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Andre merker laster opp .fit-fila - også Suunto. Intervals.icu og Whoop er på vei.',
      },
      {
        sporsmal: 'Kan jeg ha alle idrettene mine i samme dagbok?',
        svar: 'Ja. Bevegelsesformene ligger side om side med egne felt, egne terskler og egne soner, og analysen kan filtreres på hver av dem.',
      },
      {
        sporsmal: 'Får jeg med styrketrening?',
        svar: 'Ja. Live styrkeøkt har 287 øvelser med plan og «sist gang» per øvelse, og alt havner i dagboka når du fullfører.',
      },
      {
        sporsmal: 'Regnes belastningen på tvers?',
        svar: 'Ja. CTL, ATL og TSB samler alt du gjør i én kurve.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Kan treneren min følge meg her?',
        svar: 'Ja. Treneren ser plan, dagbok og analyse, kan pushe økter og kommentere i økta. Helsedata deles kun hvis du slår det på.',
      },
    ],
  },
  triatlon: {
    slug: 'triatlon',
    hero: {
      bilde: 'triatlon-hoved',
      alt: 'Triatlet i konkurranse',
      bevis: ['Tre disipliner, én plan', 'FTP på sykkel', 'GAP på løping', 'Brick-økter', 'Klokkesynk', 'Årsplan mot A-løpet'],
      kicker: 'X-PULSE for triatlon',
      titleLines: ['Svømming.', 'Sykling.', 'Løping.'],
      description:
        'Tre disipliner i én plan. Bytt-tider, brick-økter og periodisering mot konkurransedato — uten å måtte hoppe mellom tre apper for å holde oversikt.',
      backgroundImage: '/photos/triatlon.jpg',
    },
    metaDescription:
      'X-PULSE for triatleter. Tre disipliner i én plan, brick-økter, bytt-tider og periodisering mot Ironman/Olympic-distanse.',
    sections: [
      {
        id: 'tre-i-en',
        snarvei: 'Tre i én',
        kicker: 'Tre disipliner',
        title: 'SVØMMING, SYKKEL OG LØPING - ÉN PLAN.',
        intro:
          'Alle tre disiplinene ligger i samme dagbok og samme plan, med egne terskler, egne soner og egne felt. Uka leses som en helhet, ikke som tre apper ved siden av hverandre.',
        media: { type: 'foto', bilde: 'triatlon-vann', alt: 'Triatlet ved vann' },
        bullets: [
          { title: 'Egne terskler per gren', body: 'FTP på sykkel, terskeltempo på løping, og soner som følger den grenen du faktisk trente.' },
          { title: 'Brick-økter', body: 'Sykkel og løping i samme økt, med byttet som egen rad.' },
          { title: 'Volum per gren', body: 'Timer og km per disiplin, uke for uke og periode for periode.' },
        ],
      },
      {
        id: 'okt',
        snarvei: 'Øktbyggeren',
        kicker: 'Øktbyggeren',
        title: 'ØKTA SKRIVES, UANSETT GREN.',
        intro:
          'Skriv 8 × 100 m, 4 × 8 min eller 30/15 i hurtigoppsettet. Feltene følger grenen: watt og kadens på sykkel, tempo på løping, intervaller og pauser i bassenget.',
        media: { type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 },
        bullets: [
          { title: 'Hurtigoppsett', body: 'Antall × dragtid / pause og sone - økta genereres som rader du kan justere fritt.' },
          { title: 'Felt per bevegelsesform', body: 'Watt, motstand, stigning, fart og kadens dukker opp der de gir mening.' },
          { title: '58 ferdige øktmaler', body: 'Terskel, VO2 og langtur. Lagre dine egne som maler.' },
        ],
      },
      {
        id: 'klokke',
        snarvei: 'Klokkesynk',
        kicker: 'Klokkesynk',
        title: 'KLOKKA FYLLER UT RESTEN.',
        intro:
          'Økta kommer inn av seg selv etter trening. Rundene fra klokka legges oppå planen din - samlet eller splittet, du velger. Det du fører manuelt vinner alltid over det klokka gjettet.',
        media: {
          type: 'merker',
          merker: [
            { navn: 'Garmin', status: 'Beta' },
            { navn: 'COROS', status: 'Beta' },
            { navn: 'Wahoo', status: 'Beta' },
            { navn: 'Zepp', status: 'Beta' },
            { navn: 'Polar', status: 'Utrulling' },
            { navn: 'Strava', status: 'Import' },
            { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
            { navn: 'Intervals.icu', status: 'På vei', pavei: true },
            { navn: 'Whoop', status: 'På vei', pavei: true },
          ],
          fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Vi leser bare - frakobling sletter det vi har hentet.',
        },
        bullets: [
          { title: 'Flett med planen', body: 'Rundene fra klokka legges oppå den planlagte økta - samlet eller splittet. Det du fører manuelt vinner alltid.' },
          { title: 'Søvn, hvilepuls og HRV', body: 'Kommer inn hver natt av seg selv og vises sammen med belastningen din.' },
          { title: 'Du eier dataene', body: 'Frakobling fjerner tilgangen umiddelbart, og det vi har hentet slettes.' },
        ],
      },
      {
        id: 'analyse',
        snarvei: 'Analyse',
        kicker: 'Analyse',
        title: 'FTP PÅ SYKKEL, GAP PÅ LØPING.',
        intro:
          'Watt-sonene regnes fra FTP, løpetempoet justeres for stigning, og belastningen fra alle tre grenene samles i én kurve. Da ser du hva uka faktisk kostet.',
        media: { type: 'app', navn: 'oktgraf', kap: 'Økt-grafen med soner, watt og tempo', hoyde: 620 },
        bullets: [
          { title: 'NP, IF og TSS', body: 'Normalisert effekt og intensitetsfaktor per sykkeløkt.' },
          { title: 'GAP på løping', body: 'Stigningsjustert tempo, så terrenget ikke skjuler framgangen.' },
          { title: 'Samlet belastning', body: 'CTL, ATL og TSB på tvers av grenene, med konkurransene på samme kurve.' },
        ],
      },
      {
        id: 'aarsplan',
        snarvei: 'Årsplan',
        kicker: 'Årsplan',
        title: 'BYGG SESONGEN MOT A-LØPET.',
        intro:
          'Legg inn konkurransene og bygg periodene rundt dem. Grunntrening, spesifikk fase og formtopp er egne segmenter med egne mål for timer og hardøkter per gren.',
        media: { type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 },
        bullets: [
          { title: 'Perioder med volum-mål', body: 'Hver periode har sitt eget uketall, timemål og intensitetsprofil.' },
          { title: 'A-, B- og C-løp', body: 'Merk hovedmålet - nedtellingen og planen former seg etter det.' },
          { title: 'Samlinger og nøkkeldatoer', body: 'Samlinger, tester og reiser ligger i samme tidslinje som treningen.' },
        ],
      },
      {
        id: 'trener',
        snarvei: 'For trenere',
        kicker: 'For trenere',
        title: 'HELE GRUPPA PÅ ÉN SKJERM.',
        intro:
          'Treneren ser hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter.',
        media: { type: 'foto', bilde: 'triatlon-hoved', alt: 'Triatlet i konkurranse', blaa: true },
        bullets: [
          { title: 'Push til gruppa', body: 'Send samme grunnplan til laget og personaliser på toppen. Sonene regnes fra hver utøvers egne terskler.' },
          { title: 'Kommentér i økta', body: 'Tilbakemeldingen ligger der økta ligger - ikke i en meldingstråd.' },
          { title: 'Utøveren eier dataene sine', body: 'Helsedata deles bare hvis utøveren sier ja. Frakobling fjerner tilgangen umiddelbart.' },
        ],
      },
    ],
    faq: [
      {
        sporsmal: 'Fungerer X-PULSE med klokka mi?',
        svar: 'Garmin, COROS, Wahoo og Zepp synker direkte (beta), Polar er under utrulling, og Strava-historikken kan importeres. Andre merker laster opp .fit-fila - også Suunto. Intervals.icu og Whoop er på vei.',
      },
      {
        sporsmal: 'Kan jeg ha egne terskler for hver gren?',
        svar: 'Ja. FTP på sykkel og terskeltempo på løping ligger hver for seg, og sonene følger grenen du trente i.',
      },
      {
        sporsmal: 'Kan jeg føre brick-økter?',
        svar: 'Ja. Sykkel og løping kan ligge i samme økt, med byttet som egen rad.',
      },
      {
        sporsmal: 'Regnes belastningen på tvers av grenene?',
        svar: 'Ja. CTL, ATL og TSB samler alle grenene i én kurve, med konkurransene på samme akse.',
      },
      {
        sporsmal: 'Hva koster det?',
        svar: 'Athlete Pro koster 59 kr i måneden. Trener Basic koster 199 kr og Trener Pro 279 kr. Athlete Pro og Trener Basic har 30 dagers gratis prøve, og det er ingen bindingstid.',
      },
      {
        sporsmal: 'Kan jeg bruke den til svømming?',
        svar: 'Ja. Svømming er en egen bevegelsesform med egne felt og egne intervaller.',
      },
    ],
  },
}

export function getSportPageContent(slug: string): SportPageContent | null {
  if (!(slug in SPORT_PAGE_CONTENT)) return null
  return SPORT_PAGE_CONTENT[slug as FeatureSportSlug]
}
