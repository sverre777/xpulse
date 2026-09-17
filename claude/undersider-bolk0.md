# UNDERSIDENE - BOLK 0: MÅLT FØR (CC 17. sep 2026, kveld)

Regel 40: lista er leveransen. Ingenting er skrevet om ennå.

## a) Fragmenter i bruk i dag (AppFragment, lastet fra public/forside/*.html)

Sju idretter (lib/sport-feature-content.ts), alle: `hurtigoppsett` · `oktgraf` · `aarsplan`.
Skiskyting i tillegg: `skytestripe`. Bekreftet mot Coworks måling.

Funksjonssidene (app/funksjoner/*/page.tsx):
- analyse: `custom-graf` · `helse`
- trener: `aarsplan` · `oktkort-gjennomfort`
- dagbok-og-plan: `hurtigoppsett` · `kalender-uke` · `oktgraf`
- klokkesync: `samlet-bryter` · `helse`
- ai-coach: ingen fragmenter (bare foto og tekst)

Eksporter i public/forside (9): aarsplan, custom-graf, helse, hurtigoppsett, kalender-uke, oktgraf,
oktkort-gjennomfort, samlet-bryter, skytestripe. **Ubrukte: ingen** - alle ni brukes av minst én
underside. Forsiden (xpulse.html + forside/*.js) bruker ingen av dem; den tegner sine egne flater i JS.

## b) LCP og overført vekt FØR (dev-server på :3953, Chrome, to målinger per flate)

| side | 390 px | 1440 px |
|---|---|---|
| /funksjoner/skiskyting | LCP 212 / 156 ms · 921 KB | LCP 192 / 208 ms · 997 KB |
| /funksjoner/analyse | LCP 144 / 144 ms · 1003 KB | LCP 192 / 192 ms · 1617 KB |
| /funksjoner/trener | LCP 160 / 152 ms · 976 KB | LCP 196 / 172 ms · 1078 KB |

Fordeling (likt på alle): JS 779 KB (dev-bundlen, Turbopack), CSS 16 KB, fragment-HTML 0-7 KB
(lastes lat, bare det som er i viewport + 300 px), bilder 24-715 KB (analyse 1440 laster hero-foto).
Budsjettet i bolk 5: ikke verre enn dette + 10 % målt på samme måte (dev, samme script:
scratchpad lcp.ts - flyttes til scripts/ i bolk 5).

## c) Tekstene mot appen (17. sep) - det som skal rettes i bolk 4

LOVER NOE APPEN IKKE HAR (strykes/rettes):
1. «Radene er editoren - ingen dra-og-slipp.» (langrenn 64, multisport 788, dagbok-og-plan 44).
   Aktivitetsradene HAR dra-og-slipp (håndtak, pkt 18), og styrkeøvelsene fikk det i 1.4. Feil.
2. sykling 693 «Utstyret har sin egen historikk, så service kommer når den skal.» Appen har km og
   timer per utstyr, men ingen service-påminnelse. Andre halvdel strykes.
3. Trener-avsnittene på alle sju idretter (148, 290, 432, 574, 716, 858, 999) og FAQ
   «Treneren ser planen, dagboka og analysen din, kan pushe økter…» (172, 322, 606, 890):
   RETTET av Sverre 17. sep: ved innløsning settes can_edit_plan, can_view_dagbok,
   can_view_analysis og can_edit_periodization = true (coach-invite.ts, fra
   coach_default_permissions med fallback true); bare de fire NYE redigeringsrettene (dagbok,
   terskler, utstyr, tester) er av. Prod: 6 relasjoner, 4 første 6/6, 4 nye 0/6 - de nye vil vise
   det samme. Riktig tekst: «treneren ser plan, dagbok og analyse fra start; de fire
   redigeringsrettene er av til du slår dem på». «Treneren ser …»-setningene STÅR; det som legges
   til er redigeringsrettene (se «mangler» 6).
4. trener-siden 108 «Utøveren fører fortsatt dagboka selv» og dagbok-og-plan 106 «Treneren … fører
   ikke dagboka for deg»: treneren KAN redigere dagboka når utøveren har åpnet for det, men kan
   aldri markere en økt som gjennomført. Setningene må si det - ikke «fører ikke».
5. trener-siden 44/46 «Trener-hjem … flagger dem som ligger bak eller har lav restitusjon» og
   sport-avsnittene «hvem som har lav restitusjon»: helsedata (søvn, HRV, hvilepuls) vises bare
   når utøveren har slått på deling - presiseres til «… og, når utøveren deler helsedata, hvem som
   har lav restitusjon». Ikke stryking.
6. klokkesync 31 (fot) «Apple Health kommer.» - STRYKES HELT (Sverre 17. sep: ikke i kø, ikke
   «på vei»).
7. multisport 792 og FAQ 878 «Live styrkeøkt: 287 øvelser, plan og «sist» per øvelse, START per
   sett» - stemmer, men beskriver 1.3-versjonen; oppdateres (se «mangler» 1).

STEMMER (verifisert i koden, ingen endring): 58 øktmaler (OKT_MAL_BIBLIOTEK = 58), 287 øvelser
(STANDARD_EXERCISES = 287), Trener Basic inntil ti utøvere (BASIC_MAX_ATHLETES = 10), «under ti
punkter vises ingen korrelasjon» (KORR_MIN_N = 10), konkurranseformatene Sprint/Jaktstart/Normal/
Fellesstart (lib/types.ts), karbo per time (ErneringTab), skuddplott og treff per posisjon, skitester
med forhold, GAP, NP/IF, Intervals.icu/Whoop merket «på vei».

MANGLER NOE APPEN HAR (én setning der den hører hjemme, bolk 4):
1. Live styrke 1.4 (trinnknapper eller skriv tallet, dra øvelser, supersett, pausen teller opp,
   kommentar og form på ferdig-skjermen): multisport 788-792 + FAQ 878, dagbok-og-plan (øktbygger-
   avsnittet 44-48), langrenn/skiskyting/løping «Radene er editoren»-avsnittene (styrke nevnes ikke).
2. Styrke i øktgrafen og analysen (settblokker, plan mot faktisk, sammenlign, øvelse over tid):
   analyse-siden (ingen styrke nevnt), multisport 830-835.
3. Formkartet på Oversikt: analyse-siden 93-97 («Favoritter først … på Oversikt») og sport-
   analyseavsnittene («hvordan formen svarer»).
4. Stillestand til pause + klokketid: klokkesync 70-74 («Samlet eller splittet», «Kilde per verdi»)
   og dagbok-og-plan 67 (dagboka).
5. Y-aksen mot sonene: dagbok-og-plan 67-71 («Punkter på kurven») eller analyse 58-62 (Soner).
6. Trener-redigeringsrettene (dagbok, terskler og soner, utstyr, tester - av til utøveren slår dem
   på; plan, dagbok, analyse og periodisering er åpne fra start; varsel med gammel og ny verdi;
   gjennomført er utøverens ord): trener-siden 92-94 («Personvern») og alle sju sport-trenersvar.
7. Innboksen (teller på uleste, marker lest): trener-siden 71 «Innboks for resten» - én setning.

IKKE RØRT: ai-coach-siden (sier selv at ingenting er live), prisene, klokkelista.

## Status etter bolk 4 (CC 17. sep, kveld)
Rettet: 1 (dra-og-slipp-setningen strøket på langrenn og dagbok-og-plan), 2 (service-påminnelsen
strøket), 4 (trener-FAQ og dagbok-FAQ sier redigering bare når utøveren har åpnet, gjennomført er
utøverens ord), 5 (lav restitusjon bare når utøveren deler helsedata - 9 steder), 6 (Apple Health
strøket), 7 (live styrke 1.4 på multisport). Punkt 3: «Treneren ser …» står, redigeringsrettene lagt
til (6 sport-trenerpunkter + 4 FAQ + trener-siden). Mangler-lista: alle sju fikk én setning der de
hører hjemme (formkart 5 idretter + analyse, live styrke dagbok-og-plan + multisport, styrke i
graf/analyse analyse + multisport, stillestand klokkesync, y-aksen dagbok-og-plan, trener-rettene,
innboksen). «Nytt i V1.4»-etiketter finnes ikke på undersidene (NYTT_I_VERSJON importeres, brukes ikke).

## Bolk 5 - QA ETTER (CC 17. sep, sent). Samme måling som FØR (dev, Chrome, transferSize = komprimert)
LCP er median av fem lastinger (svinger 130-430 ms på dev-serveren; FØR var to lastinger).

| side | 390: FØR -> ETTER | 1440: FØR -> ETTER |
|---|---|---|
| skiskyting | 921 -> 923 KB (+0,2 %) · LCP 156-212 -> median 176 ms | 997 -> 999 KB (+0,2 %) · LCP 192-208 -> median 232 ms |
| analyse | 1003 -> 1005 KB (+0,2 %) · LCP 144 -> 160 ms | 1617 -> 1672 KB (+3,4 %) · LCP 192 -> 212 ms |
| trener | 976 -> 1055 KB (+8,1 %) · LCP 152-160 -> 172 ms | 1078 -> 1156 KB (+7,2 %) · LCP 172-196 -> 208 ms |

Alle innenfor +10 %. Økningen på trener (+79 KB) er hele raden: tokens.css + runde3.css (+28 KB css)
og ikoner/karusell/oktgraf/scener-trener (+32 KB js), lastet lat 400 px før raden. Analyse 1440
+55 KB: motoren + scener-detaljene/flyt. Skiskyting: kortene ligger under folden og lastes etter
3,5 s-vinduet - ikke med i tallet (ekte overført vekt når man scroller: +~60 KB).
Fragmentene: oktgraf.mork.html er 383 KB rå, 28 KB komprimert fra dev-serveren.

Lighthouse tilgjengelighet (desktop, FØR målt med bolk 0-filene sjekket ut i samme server):
skiskyting 96 -> 96 (uendret). trener 96 -> 94: prikkene i karusellen er 7 px treffflate og
kapittelnummer/blå kick har lav kontrast - forsidens egen design, identisk på xpulse.html. To
funn som var mine (aria-label på div uten rolle, h3 rett etter h1) er rettet (role="figure",
h2 «Trener-modulen i bruk» over raden). Prikkenes treffflate: lagt i kø.

Skjermbilder: 12 sider × 390 lys, 390 mørk, 1440 (36 stk, hele sida) i scratchpad qa/; sjekket
maskinelt: kortene spiller, alle fragmenter lastet, 0 brutte bilder, 0 px horisontal overflyt,
ingen console-feil på noen side i noen kontekst. forside-e2e grønn.
