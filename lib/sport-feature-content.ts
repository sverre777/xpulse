import type { FeatureSportSlug } from './landing-meta'
import type { SportFeatureBullet } from '@/components/landing/SportFeatureSection'

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
  }
  metaDescription: string
  sections: {
    id?: string
    kicker?: string
    title: string
    intro?: string
    bullets?: SportFeatureBullet[]
  }[]
}

export const SPORT_PAGE_CONTENT: Record<FeatureSportSlug, SportPageContent | null> = {
  langrenn: {
    slug: 'langrenn',
    hero: {
      kicker: 'X-PULSE for langrenn',
      titleLines: ['Klassisk.', 'Skøyting.', 'Staking.'],
      description:
        'Full bredde av langrennssporten på én plattform. Logg drag, analyser bevegelsesform-spesifikk utvikling, hold orden på skiparken og bygg sesongplan rundt nasjonale konkurranser.',
      backgroundImage: '/photos/DSC09859_thumb.jpg',
    },
    metaDescription:
      'X-PULSE for langrennsutøvere. Klassisk, skøyting, staking, skipark, ski-tester og bevegelsesform-spesifikk analyse på én plattform.',
    sections: [
      {
        id: 'aktivitet',
        kicker: 'Aktivitets-basert logging',
        title: 'DRAG, PAUSE OG TERRENG.',
        intro:
          'Hver økt kan brytes ned i drag eller intervaller med egen sone, varighet, høydemeter og terreng. Pause registreres separat så aktiv tid blir riktig — også når du står og venter på etterregistrering.',
        bullets: [
          { title: 'Drag og intervall', body: 'Splitt en økt i flere drag med egen sone og varighet. Sum og snitt vises automatisk.' },
          { title: 'Høydemeter og terreng', body: 'Registrer stigning per drag — rolig, kupert, bratt. Påvirker både belastning og analyse.' },
          { title: 'Pause som egen rad', body: 'Stopp er ikke "tid på ski". Aktiv pause vs full pause skilles, så aktivitets-sum blir korrekt.' },
        ],
      },
      {
        id: 'skipark',
        kicker: 'Skipark og ski-tester',
        title: 'ALLE SKIENE DINE — ÉN OVERSIKT.',
        intro:
          'Registrer hele skiparken med par, ski-merke, type og strukturen. Test ulike par på ulike forhold (snøtype, temperatur, fuktighet) og se hvilken konfigurasjon som faktisk fungerer på din typiske konkurransedag.',
        bullets: [
          { title: 'Par og merker', body: 'Hvert ski-par registreres med modell, lengde, fleks og slip-historikk.' },
          { title: 'Test-historikk', body: 'Logg test-økter med snøtype, lufttemp, snøtemp og fuktighet. Se hva som har vært raskest under hvilke forhold.' },
          { title: 'Smøring og slip', body: 'Hold rede på siste smøre-jobb og når slip ble gjort på hvert par.' },
        ],
      },
      {
        id: 'analyse',
        kicker: 'Bevegelsesform-spesifikk analyse',
        title: 'KLASSISK VS SKØYTING — SIDE OM SIDE.',
        intro:
          'Belastning, sonefordeling og test-utvikling kan filtreres på bevegelsesform. Sammenlign skøytings-økter mot klassiske over en periode og se om du faktisk dekker begge stilarter slik planen tilsier.',
        bullets: [
          { title: 'Filter per stil', body: 'Skill skøyting, klassisk og staking i alle dashbord — også custom grafer.' },
          { title: 'Tid per teknikk', body: 'Aggregert tid og høydemeter per bevegelsesform over uka, måneden eller sesongen.' },
          { title: 'Test-PR per stil', body: 'Egen PR-historikk for klassisk vs skøyting, så du ser fremgangen i begge retninger.' },
        ],
      },
      {
        id: 'periodisering',
        kicker: 'Periodisering for sesong',
        title: 'BYGG MOT NASJONALE LØP.',
        intro:
          'Legg inn konkurransekalenderen — Beitosprinten, Lillehammer, NM, Holmenkollen — og bygg perioder rundt dem. Grunntrening, spesifikk fase og peaking-uke håndteres som egne segmenter med egne mål.',
        bullets: [
          { title: 'Sesong-mal', body: 'Importer en typisk langrennssesong eller bygg din egen fra bunn.' },
          { title: 'Peak-merking', body: 'Marker konkurranser som "peak target" — hele plan-strukturen formes mot dem.' },
          { title: 'Grupperte trener-planer', body: 'Trenere kan sende samme grunnplan til hele laget og personalisere på toppen.' },
        ],
      },
    ],
  },

  skiskyting: {
    slug: 'skiskyting',
    hero: {
      kicker: 'X-PULSE for skiskyting',
      titleLines: ['Eneste plattformen', 'med dyp', 'skyting-analyse.'],
      description:
        'Auto-genererte konkurranseformater (Sprint, Jaktstart, Normal, Fellesstart), per-skyting-data, treff% delt på liggende/stående, og custom grafer som lar deg svare på spørsmål andre apper ikke kan.',
      backgroundImage: '/photos/IMG_4578_thumb.jpg',
    },
    metaDescription:
      'X-PULSE for skiskyttere. Auto-konkurransestruktur, treff% per posisjon, per-skyting-data og custom skyting-grafer.',
    sections: [
      {
        id: 'konkurranse',
        kicker: 'Konkurranseformater',
        title: 'SPRINT. JAKT. NORMAL. FELLES.',
        intro:
          'Velg format og økten kommer med riktig antall skytinger og posisjoner allerede satt. Jaktstart-format håndterer bonus-tid på straffe-runde; fellesstart har 4 skytinger med riktig liggende/stående-rekkefølge.',
        bullets: [
          { title: 'Auto-struktur', body: '4-skytingsformat for Normal/Felles, 2 for Sprint — alt strukturert riktig fra start.' },
          { title: 'Posisjon-rekkefølge', body: 'Liggende-stående-veksling ligger som forventet i hvert format, så du kan logge raskt.' },
          { title: 'Straffe-runde og bonus-tid', body: 'Logg straffe-runder per skyting; tids-bidrag regnes inn i totalen automatisk.' },
        ],
      },
      {
        id: 'analyse',
        kicker: 'Skyting-analyse',
        title: 'TREFF% — DELT.',
        intro:
          'Total treff% er én tall. Liggende vs stående er to. X-PULSE viser begge separat over tid, så du ser hvor faktisk problemet ligger og om det henger sammen med puls eller intensitet.',
        bullets: [
          { title: 'Per-posisjon-utvikling', body: 'Egne grafer for liggende- og stående-treff% over uker/måneder.' },
          { title: 'Treff% etter pulsintervall', body: 'Se om stå-skuddene faller når puls krysser 165, og om første-stående er svakere enn andre.' },
          { title: 'Akkumulert poeng', body: 'Skyttekonkurransepoeng (10-9-8 osv.) summeres per skyting og økt.' },
        ],
      },
      {
        id: 'per-skyting',
        kicker: 'Per-skyting-data',
        title: 'FØRSTE VS SISTE SKYTING.',
        intro:
          'For hver skyting i økten registreres totaltall: treff, bom og poengsum per posisjon. Sammenligning av første mot siste skyting viser om du blir mer eller mindre stabil utover økten — kritisk for fellesstart.',
        bullets: [
          { title: '5-skudds-totaler per skyting', body: 'Treff, bom og poengsum logges per skyting (1-N) i økten.' },
          { title: 'Skyting-til-skyting-utvikling', body: 'Sammenlign første vs siste skyting i økten — viser stabilitet under tretthet.' },
          { title: 'Tid på skytteplass', body: 'Logg skytetid per skyting hvis tilgjengelig; sammenlign med treff%.' },
        ],
      },
      {
        id: 'custom-graf',
        kicker: 'Custom skyting-graf',
        title: 'BYGG DINE EGNE SPØRSMÅL.',
        intro:
          'Custom-graf-modulen lar deg filtrere på workout-type, posisjon, pulsintervall og periode — og bygge en egen graf som svarer på akkurat ditt spørsmål. F.eks. "treff% liggende på sprint over siste 6 uker".',
        bullets: [
          { title: 'Filtre', body: 'Workout-type, posisjon, pulssone, periode, sport, bevegelsesform.' },
          { title: 'Lagring som favoritt', body: 'Marker grafen som favoritt — den hentes automatisk i Oversikt.' },
          { title: 'Trener-tilgang', body: 'Trener kan se alle utøvers custom-grafer hvis tilgang er gitt.' },
        ],
      },
      {
        id: 'tester',
        kicker: 'Skipark + skyting-tester',
        title: 'KOMBINERT TRACKING.',
        intro:
          'Skiparken fra langrenn-modulen er åpen også for skiskyttere — registrer ski og test-resultater. Skyting-tester (egne formater på blink, biathlon ranking, dry-fire-økter) loggføres separat med egen historikk.',
        bullets: [
          { title: 'Skipark-felles', body: 'Samme skipark-modul som langrenn — bytt mellom skøyte- og klassisk-ski.' },
          { title: 'Skytt-tester', body: 'Tørr-skyting og blink-tester registreres som egne workout-typer med skudd-data.' },
          { title: 'PR per format', body: 'Personlig rekord per konkurranseformat — vises tydelig i historikken.' },
        ],
      },
    ],
  },

  langlop: {
    slug: 'langlop',
    hero: {
      kicker: 'X-PULSE for langløp',
      titleLines: ['Birken.', 'Vasaloppet.', 'Lange økter.'],
      description:
        'Bygd for de virkelig lange utholdenhetsøktene og turrennene. Logg ernæring, klær, gear og forhold per økt; bygg periodiseringen så du topper formen til riktig dato.',
      backgroundImage: '/photos/DJI_0062_thumb.jpg',
    },
    metaDescription:
      'X-PULSE for langløp. Lang-tur-spesifikke felt, terreng-detaljering, periodisering mot Birken/Vasaloppet og pacing-analyse.',
    sections: [
      {
        id: 'lang-tur',
        kicker: 'Lang-tur-spesifikke felt',
        title: 'ERNÆRING. KLÆR. GEAR. VÆR.',
        intro:
          'En 5-timers-tur er ikke en 60-min-økt forstørret. Loggen lar deg legge til hva du spiste/drakk, hva du hadde på, hvilket utstyr som ble brukt og hvordan været forløp.',
        bullets: [
          { title: 'Ernærings-felt', body: 'Logg gel/drikke/mat per time. Sum-blokk viser totalt karbohydrat-inntak per økt.' },
          { title: 'Utstyrs-logg', body: 'Hvilke ski/sykkel/sko ble brukt? Lenker mot utstyrs-modulen for slitasje-tall.' },
          { title: 'Vær og forhold', body: 'Lufttemp, snøtemp, vind og nedbør lagres så du senere kan filtrere på "kalde lange turer".' },
        ],
      },
      {
        id: 'terreng',
        kicker: 'Høydemeter og terreng',
        title: 'STIGNINGER PER DRAG.',
        intro:
          'Birken er ikke 54 km flatt. Hvert drag/avsnitt kan logges med egen høydemeter og stigningsprofil, så belastningen reflekterer faktisk arbeid — ikke bare distanse.',
        bullets: [
          { title: 'Per-drag-stigning', body: 'Stigningsprofil registreres per intervall, og summen vises på økt-nivå.' },
          { title: 'Klatrings-PR', body: 'PR-listen tracker total høydemeter per uke/måned og lengste enkelt-stigning.' },
          { title: 'Terreng-tag', body: 'Marker tur som flatt, kupert eller fjellterreng — påvirker analyse og sammenligning.' },
        ],
      },
      {
        id: 'periodisering',
        kicker: 'Periodisering rundt løp',
        title: 'TOPP TIL RIKTIG DATO.',
        intro:
          'Legg inn løpet i konkurransekalenderen og marker det som "peak target". Hele perioden — grunntrening, spesifikk fase, taper — formes rundt datoen så form og fitness topper riktig.',
        bullets: [
          { title: 'Peak-target-merking', body: 'Konkurransen blir et fast punkt; alle intervall- og volum-økter regnes mot den.' },
          { title: 'Taper-fase', body: 'Mal for siste 2 uker — gradvis volum-reduksjon, behold intensitet.' },
          { title: 'Forms-prognose', body: 'CTL/ATL/TSB-trend ekstrapoleres så du ser om du peaker for tidlig eller for sent.' },
        ],
      },
      {
        id: 'pacing',
        kicker: 'Pacing-analyse',
        title: 'PACE PER KM ELLER KM/T.',
        intro:
          'Etter løpet kan splitts deles inn i km-blokker eller km/t-blokker. Se om du fadet bak i andre halvdel, og hvor mye den fjerde timen kostet i forhold til den første.',
        bullets: [
          { title: 'Splittings-import', body: '.fit-import gir auto-splittinger; manuelle splittinger kan også legges til.' },
          { title: 'Per-km-snitt-puls', body: 'Sammen med pace ser du om hjertet fulgte med eller om det stivnet.' },
          { title: 'Sammenlign med tidligere', body: 'Samme strekning år etter år — splittene legges på hverandre i samme graf.' },
        ],
      },
      {
        id: 'ernering',
        kicker: 'Ernæring og innsats',
        title: 'KARBO-INNTAK MOT INNSATS.',
        intro:
          'Logg drikke/mat/gel per time. Sumblokken og en kort prosessgraf viser inntak-rate så du kan finjustere strategien til neste lange tur.',
        bullets: [
          { title: 'Per-time-inntak', body: 'Bryt øktens varighet i 60-min-blokker; karbo-inntak vises per blokk.' },
          { title: 'Energi-balanse-anslag', body: 'Estimat på hva økten brente vs hva du tok inn — gir indikator for restitusjon.' },
          { title: 'Notat-tag på "lærdom"', body: 'Marker hva som virket og hva som ikke gjorde det. Søkbart i historikken.' },
        ],
      },
    ],
  },

  loping: {
    slug: 'loping',
    hero: {
      kicker: 'X-PULSE for løping',
      titleLines: ['Bane.', 'Asfalt.', 'Terreng.'],
      description:
        'Sone-styrt plan, pace-utvikling over tid og tester for å se om treningen faktisk gir fremgang. Funksjoner som dekker hele bredden — fra 800-meter-intervall til ultra på fjellet.',
      backgroundImage: '/photos/DSC07271_thumb.jpg',
    },
    metaDescription:
      'X-PULSE for løpere. Sone-styrt plan, pace-utvikling, tester og PR-historikk for både bane, asfalt og terreng.',
    sections: [
      {
        id: 'soner',
        kicker: 'Sone-styrt plan',
        title: 'I1 TIL I5 — RIKTIG.',
        intro:
          'Plan-økter har sone-mål (varighet per sone), ikke bare "tempo X". Aktivitetslogg automatisk regner sone-tid fra puls, så du ser om du traff målet eller drev oppover under intervallene.',
        bullets: [
          { title: 'Plan med sone-mål', body: 'Mål-tid per sone (I1, I2, I3, I4, I5, Hurtighet) settes per økt eller per drag.' },
          { title: 'Avvik-flagging', body: 'Røde flagg når faktisk sone-fordeling skiller seg vesentlig fra planlagt.' },
          { title: 'Egne soner per sport', body: 'Maks-puls og terskler kan settes per sport — løp, sykling, langrenn ulikt.' },
        ],
      },
      {
        id: 'pace',
        kicker: 'Pace-utvikling',
        title: 'PER KM, OVER MÅNEDER.',
        intro:
          'Pace-modulen tracker pace per km på sammenlignbare strekninger over tid. Se om dine 4×1000 m blir raskere uten at puls øker — kjernen av utholdenhetsfremgang.',
        bullets: [
          { title: 'Pace-PR per distanse', body: '5K, 10K, halv, hel marathon — auto-detekteres fra økter.' },
          { title: 'Same-route-sammenlign', body: 'Logg favoritt-runder med navn; pace-trend per rute over tid.' },
          { title: 'Pace-trend over tid', body: 'Plot pace per distanse over uker via custom-graf — synlig fremgang i aerob fitness.' },
        ],
      },
      {
        id: 'tester',
        kicker: 'Tester og PR',
        title: 'COOPER. 5K. ANNET.',
        intro:
          'Standard tester (Cooper 12-min, 5K-test, vingate, melkesyre-test) registreres med egen mal. Resultatene plottes så du ser fremgang over år, ikke bare i en enkeltøkt.',
        bullets: [
          { title: 'Test-historikk', body: 'Hver test-type får sin egen PR-side med trend-graf.' },
          { title: 'Egne tester', body: 'Lag dine egne test-formater hvis treneren bruker noe spesifikt.' },
          { title: 'Test-merking på plan', body: 'Plasser test-økten i planen så den ikke konkurrerer med vanlige treninger.' },
        ],
      },
      {
        id: 'terreng',
        kicker: 'Terreng og asfalt',
        title: 'BANE OG FJELLØP.',
        intro:
          'Underlag, høydemeter og terreng-tag skiller bane-økter fra terrengløp. Sone-statistikk og pace-data filtreres riktig så de ikke ødelegger sammenligninger.',
        bullets: [
          { title: 'Underlag-felt', body: 'Asfalt, grus, sti, bane, snø — påvirker filter og sammenligninger.' },
          { title: 'Klatrings-stats', body: 'Total høydemeter per uke; lengste klatre-tur registreres som egen PR.' },
          { title: 'Konkurranse-format', body: 'Trail-konkurranser (Salomon, UTMB, lokal terrengløp) får egne formater.' },
        ],
      },
    ],
  },

  sykling: {
    slug: 'sykling',
    hero: {
      kicker: 'X-PULSE for sykling',
      titleLines: ['Landevei.', 'Terreng.', 'Effekt.'],
      description:
        'Effekt-soner, høydemeter og sammenligning over sesong. Logg landeveis-økter og terrengritt med samme rammeverk og se utviklingen mot dine mål.',
    },
    metaDescription:
      'X-PULSE for syklister. Effekt-soner, høydemeter, FTP-utvikling og sammenligning av økter på samme rute over sesong.',
    sections: [
      {
        id: 'effekt',
        kicker: 'Effekt og belastning',
        title: 'TSS — BELASTNING I TALL.',
        intro:
          'TSS regnes automatisk fra økt-data og brukes i ATL/CTL/TSB-modellen. FTP-test er en av de standard test-malene — bruk den for å spore terskel-utvikling. Egne effekt-soner og NP/IF kommer.',
        bullets: [
          { title: 'TSS i belastningsmodell', body: 'Hver økt får en TSS-verdi som driver fitness/fatigue/form-grafen.' },
          { title: 'FTP-test som standard mal', body: 'Cooper, FTP, terskel-test og flere er forhåndskonfigurert med riktig protokoll.' },
          { title: 'Effekt-soner og NP/IF', body: 'Egne effekt-soner og normalisert effekt kommer i 2026.' },
        ],
      },
      {
        id: 'klatring',
        kicker: 'Høydemeter',
        title: 'KLATRING SOM EGEN MUSKEL.',
        intro:
          'Stigninger logges per drag eller hele økten. PR-listen tracker lengste klatring og total høydemeter per uke/måned, så du ser om volum-progresjonen er der.',
        bullets: [
          { title: 'Per-drag-stigning', body: 'Bryt opp en lang tur i klatringer + flatt; statistikk per type vises.' },
          { title: 'Klatre-PR', body: 'Lengste enkelt-klatring og største høydemeter-uke loggføres i PR.' },
          { title: 'Klatre-effekt', body: 'Watt per kg på klatringer hvis vekt er logget.' },
        ],
      },
      {
        id: 'sesong',
        kicker: 'Sesong-sammenligning',
        title: 'SAMME RUTE — TO ÅR.',
        intro:
          'Logg favoritt-runder med navn. Hver gang du gjør runden lagres tider og effekt så du kan plotte sesong-utvikling mot fjorårets samme runde.',
        bullets: [
          { title: 'Navngivne ruter', body: 'Marker en runde som "favoritt" — alle senere økter på den ruten samles.' },
          { title: 'År-mot-år-graf', body: 'Sesong 2025 vs 2026 på samme runde, plottet i én graf.' },
          { title: 'Vær-kontekst', body: 'Vind og temp logges per runde-økt så du kan filtrere på sammenlignbare forhold.' },
        ],
      },
      {
        id: 'utstyr',
        kicker: 'Utstyr',
        title: 'SYKKELPARK OG SLITASJE.',
        intro:
          'Hver sykkel registreres som eget utstyr. Dekk, kjede, kassett og pads får km/timer-historikk så du vet når det er på tide å bytte.',
        bullets: [
          { title: 'Per-sykkel-logg', body: 'Velg sykkel per økt — total km per sykkel oppdateres automatisk.' },
          { title: 'Komponent-slitasje', body: 'Kjede, dekk, klosser har egne km-tellere; varsel når terskel nås.' },
          { title: 'Service-historikk', body: 'Logg verksteds-besøk og bytt med dato; se historikk per sykkel.' },
        ],
      },
    ],
  },

  triatlon: {
    slug: 'triatlon',
    hero: {
      kicker: 'X-PULSE for triatlon',
      titleLines: ['Svømming.', 'Sykling.', 'Løping.'],
      description:
        'Tre disipliner i én plan. Bytt-tider, brick-økter og periodisering mot konkurransedato — uten å måtte hoppe mellom tre apper for å holde oversikt.',
    },
    metaDescription:
      'X-PULSE for triatleter. Tre disipliner i én plan, brick-økter, bytt-tider og periodisering mot Ironman/Olympic-distanse.',
    sections: [
      {
        id: 'tre-i-en',
        kicker: 'Tre disipliner — én plan',
        title: 'SVØM, SYKKEL, LØP — KOBLET.',
        intro:
          'Plan-modulen håndterer alle tre disipliner som førsteklasses borgere. Sone-soner per sport (svømme-puls er ikke løpe-puls), egne tester per disiplin, og total-belastning som summerer alt.',
        bullets: [
          { title: 'Per-sport-soner', body: 'Maks-puls og terskler settes uavhengig for svøm/sykkel/løp.' },
          { title: 'Total-belastning', body: 'CTL/ATL/TSB regnes på tvers av alle tre — utbrenthet kommer ikke fra én sport alene.' },
          { title: 'Disiplin-volum-mål', body: 'Sett uke-mål per sport (km svøm, t sykkel, km løp); avvik flagges.' },
        ],
      },
      {
        id: 'brick',
        kicker: 'Brick-økter',
        title: 'OVERGANG SOM EGEN ØKT.',
        intro:
          'En brick (svøm-sykkel eller sykkel-løp uten pause) registreres som én økt med to aktiviteter, ikke to separate. Bytt-tiden mellom disiplinene logges som egen rad.',
        bullets: [
          { title: 'Multi-aktivitet', body: 'Én økt kan inneholde svøm + sykkel + løp i sekvens med egne stats.' },
          { title: 'Bytt-tid', body: 'T1 og T2 logges separat; sammenlign med konkurransedager.' },
          { title: 'Aerob effektivitet', body: 'Pace-fall fra solo-løp til løp etter sykkel — viktig indikator for triatlon-form.' },
        ],
      },
      {
        id: 'periodisering',
        kicker: 'Periodisering',
        title: 'TOPP TIL KONKURRANSEDAGEN.',
        intro:
          'Olympic-distanse, halv-ironman og full Ironman har vidt forskjellig peak-strategi. Plan-malene reflekterer det — taper-fasen er ikke én størrelse.',
        bullets: [
          { title: 'Format-spesifikke maler', body: 'Olympic, 70.3, full Ironman har egne periode-strukturer.' },
          { title: 'Brick-progresjon', body: 'Brick-volum øker mot konkurransen og trappes ned i taper.' },
          { title: 'Race-day-checklist', body: 'Egen pre-race-mal med ernæring, gear og bytt-rutiner.' },
        ],
      },
      {
        id: 'analyse',
        kicker: 'Disiplin-analyse',
        title: 'HVOR FALER DU?',
        intro:
          'Custom-graf-modulen lar deg plotte løpe-pace etter sykkelen vs frittstående løpe-pace, eller se om svøm-pulsen din henger med uten å bli utmattet.',
        bullets: [
          { title: 'Disiplin-filter', body: 'Alle dashbord kan filtreres på svøm/sykkel/løp eller multi.' },
          { title: 'Pace-tap etter sykkel', body: 'Spor om løpe-pace-tap-mellom-solo-og-brick reduseres over sesong.' },
        ],
      },
    ],
  },
}

export function getSportPageContent(slug: string): SportPageContent | null {
  if (!(slug in SPORT_PAGE_CONTENT)) return null
  return SPORT_PAGE_CONTENT[slug as FeatureSportSlug]
}
