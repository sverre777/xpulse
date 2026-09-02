import type { FeatureSportSlug } from './landing-meta'
import type { SportFeatureBullet } from '@/components/landing/SportFeatureSection'
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
      backgroundImage: '/photos/langrenn.jpg',
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
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          '58 ferdige øktmaler bygget på Olympiatoppens intensitetsskala — terskel, I4/I5, motbakke, lagtur — pluss en intervall-bygger som genererer hele økta fra antall × dragtid × sone / pause. Søk «6x6» og økta ligger klar.',
        bullets: [
          { title: 'Øktmal-biblioteket', body: 'Velg blant 58 OLT-baserte økter med oppvarming og nedjogg klart — eller lagre dine egne økt-, uke- og planmaler.' },
          { title: 'Intervall-byggeren', body: 'Stable rader for pyramider og progressive økter — rundene genereres som vanlige aktivitetsrader du kan justere fritt.' },
          { title: 'Helse og søvn fra klokka', body: 'Søvn, hvilepuls og HRV kommer inn av seg selv hver natt — det du fører manuelt vinner alltid.' },
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
      backgroundImage: '/photos/skiskyting.jpg',
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
        id: 'standplass',
        kicker: 'Som på standplass',
        title: 'SKUDD PÅ BLINK. VIND PÅ VIMPEL.',
        intro:
          'Hver serie føres slik du opplevde den: plott hvert skudd der det traff på blinken, sett vimpelen slik den sto, og velg sikten. Treffprosenten regnes ut av seg selv — og analysen viser treff mot forholdene over hele sesongen.',
        bullets: [
          { title: 'Skuddplotting', body: 'Plott skuddene på blink per serie — bommene avslører mønsteret sitt selv.' },
          { title: 'Vind og sikt per serie', body: 'Vimpelstilling (retning og styrke) og sikt føres per serie, slik du faktisk så det.' },
          { title: 'Serie for serie', body: 'Treff, tid og puls per serie — sammenlign første mot siste skyting under tretthet.' },
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
        kicker: 'Skytetester',
        title: 'NSSF-TESTENE LIGGER KLARE.',
        intro:
          'NSSF-testene ligger som ferdige maler i biblioteket — velg testen, så er serieoppsettet klart. Definisjonen er låst, så resultatene kan sammenlignes over år. Du kan også lage dine egne skytetest-maler, og skiparken fra langrenn er åpen for skiskyttere.',
        bullets: [
          { title: 'NSSF-maler', body: 'Standardtestene klare i biblioteket med riktig serieoppsett — også tørrtrening.' },
          { title: 'Egne skytetester', body: 'Lag dine egne testformater; låst definisjon gjør resultatene sammenlignbare over tid.' },
          { title: 'Skipark-felles', body: 'Samme skipark-modul som langrenn — ski-tester, smøring og rangering per føre.' },
        ],
      },
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          'Komb-øktene bygges på sekunder: velg skyting i pausene, så legges L–S-mønsteret inn av seg selv. 58 øktmaler fra OLT-skalaen ligger klare, komb-øktene med serier ferdig satt opp.',
        bullets: [
          { title: 'Skyting i pausene', body: 'Intervall-byggeren gjør pausene om til skyteserier — L–S, alle liggende først eller parvis, du velger mønsteret.' },
          { title: 'Ferdige komb-maler', body: 'Rolig og hard komb ligger i biblioteket med serier og soner klare — juster og kjør.' },
          { title: 'Helse og søvn fra klokka', body: 'Søvn, hvilepuls og HRV inn automatisk — restitusjonen synlig ved siden av treffprosenten.' },
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
      backgroundImage: '/photos/langlop.jpg',
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
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          'De lange øktene planlegges på sekunder: 58 ferdige øktmaler fra OLT-skalaen, intervall-bygger for fartslek og terskeldrag, og standardøkter som kobler gjentakelser av samme langtur i én graf.',
        bullets: [
          { title: 'Øktmal-biblioteket', body: 'Langkjøring, terskel og motbakke ligger klart med oppvarming og nedjogg — søk, juster, kjør.' },
          { title: 'Standardøkter', body: 'Samme testrunde gjennom vinteren? Koble øktene i en serie og se utviklingen som én kurve.' },
          { title: 'Helse og søvn fra klokka', body: 'Søvn og hvilepuls inn automatisk — restitusjonen etter de lange øktene blir synlig.' },
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
      backgroundImage: '/photos/loping.jpg',
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
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          'Intervalløkta bygges på fire tastetrykk: antall, dragtid, sone, pause. Eller velg blant 58 ferdige øktmaler fra Olympiatoppens intensitetsskala — 6 × 6 min terskel ligger klar med oppvarming og nedjogg.',
        bullets: [
          { title: 'Intervall-byggeren', body: 'Antall × dragtid × sone / pause — hele strukturen genereres som aktivitetsrader. Stable rader for pyramider.' },
          { title: 'Øktmal-biblioteket', body: 'Terskel, I4/I5-intervaller, motbakke og fartslek ferdig rigget — søk «6x6» og du finner den.' },
          { title: 'Standardøkter', body: 'Koble gjentakelser av samme intervalløkt i en serie — terskeltesten som graf gjennom sesongen.' },
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
      backgroundImage: '/photos/sykling.jpg',
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
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          'Intervalløktene bygges på sekunder med intervall-byggeren, og 58 ferdige øktmaler fra OLT-skalaen dekker terskel til VO2-drag. Helse og søvn kommer inn fra klokka hver natt.',
        bullets: [
          { title: 'Intervall-byggeren', body: 'Antall × dragtid × sone / pause — også progressive økter med flere rader.' },
          { title: 'Øktmal-biblioteket', body: 'Terskel- og intervalløkter ferdig rigget — velg, juster watt-målene, kjør.' },
          { title: 'Helse og søvn fra klokka', body: 'Søvn, hvilepuls og HRV automatisk — restitusjon og belastning i samme bilde.' },
        ],
      },
    ],
  },

  multisport: {
    slug: 'multisport',
    hero: {
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
        kicker: 'Én dagbok for alt',
        title: 'ALT DU GJØR — SAMLET.',
        intro:
          'Logg løpeturen, sykkeløkten, skituren og styrken i samme dagbok. Hver bevegelsesform får sine egne felter, og totalbelastningen regnes på tvers av alt.',
        bullets: [
          { title: 'Alle bevegelsesformer', body: 'Løp, sykkel, ski, rulleski, svømming, roing, fjellsport, styrke — og egne du definerer selv.' },
          { title: 'Felles belastning', body: 'CTL/ATL/TSB summerer alt du gjør — formen din er én kurve, ikke fem.' },
          { title: 'Soner per sport', body: 'Maks-puls og terskler kan settes per idrett — løpepuls er ikke sykkelpuls.' },
        ],
      },
      {
        id: 'hybrid',
        kicker: 'Hybrid-økter',
        title: 'STYRKE OG KONDISJON I SAMME ØKT.',
        intro:
          'En økt kan inneholde flere aktiviteter i sekvens — intervaller etterfulgt av styrke logges som ÉN økt med egne tall per del. Styrken føres sett for sett, gjerne live mens du trener.',
        bullets: [
          { title: 'Multi-aktivitet', body: 'Oppvarming, hoveddel og styrke i én økt — hver del med egne data.' },
          { title: 'Live styrkeøkt', body: 'Timer, supersett og «sist gang»-hint mens du står i rekkene.' },
          { title: 'Utstyr på tvers', body: 'Sko, ski og sykkel får kilometerne sine automatisk uansett økt-type.' },
        ],
      },
      {
        id: 'kom-i-gang',
        kicker: 'Fra enkel logg til full struktur',
        title: 'START ENKELT. VOKS NÅR DU VIL.',
        intro:
          'Du trenger ikke være seriøs utøver for å ha nytte av struktur. Start med å logge det du gjør — planlegging, soner, tester og analyse ligger klare den dagen du vil ta det videre.',
        bullets: [
          { title: 'Lav terskel', body: 'Logg en økt på under ett minutt — tittel, tid, følelse. Resten er valgfritt.' },
          { title: 'Koble klokken', body: 'Strava-synk eller .fit-import fyller dagboken automatisk.' },
          { title: 'Sekundæridretter', body: 'Velg idrett nummer to og tre i profilen — feltene følger etter (skiskyting gir f.eks. skyteanalyse).' },
        ],
      },
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          'Uansett idrett: 58 ferdige øktmaler fra Olympiatoppens intensitetsskala, intervall-bygger som genererer økta på fire tastetrykk, og helse og søvn som kommer inn fra klokka av seg selv.',
        bullets: [
          { title: 'Øktmal-biblioteket', body: 'Rolig, terskel, intervall, motbakke, fartslek og tester — klare for alle utholdenhetsidretter.' },
          { title: 'Intervall-byggeren', body: 'Bygg drag-økta én gang — bevegelsesformen velger du fritt etterpå.' },
          { title: 'Reisedag og helse', body: 'Reisedager, søvn og hvilepuls hører hjemme i samme dagbok som treningen.' },
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
      backgroundImage: '/photos/triatlon.jpg',
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
      {
        id: 'nytt-v12',
        kicker: NYTT_I_VERSJON,
        title: 'PLANLEGGING PÅ SEKUNDER.',
        intro:
          'Tre disipliner — samme verktøy: 58 ferdige øktmaler fra OLT-skalaen, intervall-bygger for drag i alle tre, og standardøkter som sporer nøkkeløktene gjennom sesongen.',
        bullets: [
          { title: 'Intervall-byggeren', body: 'Drag-økter for svøm, sykkel og løp genereres på fire tastetrykk — sonene følger idrettens egne terskler.' },
          { title: 'Øktmal-biblioteket', body: '58 OLT-baserte økter pluss dine egne — også brick-økter kan lagres som mal.' },
          { title: 'Helse og søvn fra klokka', body: 'Restitusjonen på tvers av tre idretter samlet i ett bilde — automatisk.' },
        ],
      },
    ],
  },
}

export function getSportPageContent(slug: string): SportPageContent | null {
  if (!(slug in SPORT_PAGE_CONTENT)) return null
  return SPORT_PAGE_CONTENT[slug as FeatureSportSlug]
}
