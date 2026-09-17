# UNDERSIDENE - NYESTE DESIGN PÅ GRAFENE + ANIMASJONSKORT (Cowork 17. sep kveld)

Går ETTER 1.4-kuttet (commit 3 og 4). Sverres beslutninger 17. sep:
- Undersidene skal fortsatt være informative: **en del tekst står**.
- **Bildene står.** Det som byttes er de STATISKE fragmentene (AppFragment) -
  de erstattes av nyeste eksport eller av et animasjonskort.
- `/funksjoner/trener` får **hele trener-raden, alle fem scenene**.
- Enkeltkort der de passer, ikke hele raden: skytekortene på skiskyting osv.

Regel fra 16. sep gjelder overalt: alt som vises skal finnes i appen.

═══ BOLK 0 - MÅL FØRST (regel 40) ════════════════════════════════════════════

a) List hvilke fragmenter hver underside faktisk bruker i dag (les
   `lib/sport-feature-content.ts` og de fem funksjonssidene). Cowork målte:
   `aarsplan`, `hurtigoppsett`, `oktgraf` på alle sju idretter + `skytestripe`
   på skiskyting. Bekreft, og si hvilke andre eksporter i public/forside som
   ligger ubrukt.
b) Mål LCP og overført vekt på tre undersider (skiskyting, analyse, trener)
   FØR du rører noe - 390 px og 1440. Det er budsjettet.
c) Les sport-tekstene i `sport-feature-content.ts` mot appen: formkart,
   live styrke, pause/stillestand, y-aksen, trener-flaggene er nye siden
   tekstene ble skrevet. List setninger som lover noe appen ikke har, eller
   mangler noe den har. Ikke skriv om ennå - lista er leveransen i bolk 0.

═══ BOLK 1 - RE-EKSPORT: NYESTE APP-KOMPONENTER I FRAGMENTENE ═══════════════

Fragmentene ER appen (`/forside-eksport` serialiserer appens egne
komponenter). `oktgraf` er eksportert før y-aksen (908a978) og settraden
(fcc8674), `aarsplan` og `hurtigoppsett` før flere runder.
- Kjør eksporten på nytt for ALLE fragmenter i bruk, lys/mørk/mobil. Ingen
  håndredigering av HTML-en.
- Sjekk at eksport-ruta bruker y-akse-regelen (soner 108-190 som forsiden)
  og at oktgraf-fragmentet på en styrkeside viser settraden.
- Bevis: diff av fragmentene (linjer endret), skjermbilde av oktgraf før/etter
  på skiskyting 390 mørk.

═══ BOLK 2 - ÉN SCENE ALENE: `enScene` ═══════════════════════════════════════

Animasjonene finnes bare som hel rad (`karusell(SC, KAP, P)` i karusell.js).
Lag ÉN mekanisme for ett kort:
- `enScene(tittel, element, opts)` i karusell.js (samme fil, ingen ny motor):
  monterer én scene fra SC uten kapittelrad, med scenens egne steg-tekster
  under kortet. Spiller når kortet er minst 50 % i viewport
  (IntersectionObserver), stopper og nullstiller utenfor. Loop av.
- Scenefilene lastes lazy per underside: bare den fila kortets scene ligger i
  (flyt / trener / detaljene), aldri alle tre. Mål vekten.
- `prefers-reduced-motion`: vis sluttbildet stille.
- Lys og mørk følger sidas tema som i dag.
- Bevis: én scene på en testside, spiller ved scroll inn, stopper ute, 390 og
  1440, ingen console-feil, forside-e2e fortsatt grønn (forsiden er urørt).

═══ BOLK 3 - KORTENE PÅ PLASS ════════════════════════════════════════════════

Plassering (Cowork-forslag - CC sier fra om noe ikke passer på flaten):
- skiskyting: «PLOTT HVERT SKUDD.» + «SE HVA VINDEN GJØR MED TREFFET.»
  (erstatter skytestripe-fragmentet) · oktgraf-fragmentet står (re-eksportert).
- langrenn, langlop, loping, sykling, triatlon, multisport: «ØKT-GRAF» (flyt)
  erstatter oktgraf-fragmentet; «PLANEN STÅR. SANNHETEN VED SIDEN AV.»
  (detaljene) der sida har en plan-mot-faktisk-tekst. Ett til to kort per side,
  aldri tre.
- analyse: «SE HELE FORMEN PÅ ÉN AKSE.» + «LAKTAT, TERSKEL OG BELASTNING.»
- dagbok-og-plan: «MAL SESONGEN.» + «BYGG ØKTA PÅ SEKUNDER.»
- klokkesync: «ØKTA KOMMER INN AV SEG SELV.» + «FØR DET KLOKKA IKKE VET.»
- ai-coach: ingen animasjon finnes - siden får bare re-eksporterte fragmenter
  og tekst. Ikke lag en scene for noe som ikke er bygget.
- trener: HELE raden, alle fem scener, med `karusell` som på forsiden - men
  under tekstinnledningen, ikke i stedet for den. Kapittelraden beholdes.
Regel: et kort erstatter et statisk fragment, ikke et avsnitt. Hero-tekst og
de informative avsnittene står. Bildene står.

═══ BOLK 4 - TEKST MOT APPEN ═════════════════════════════════════════════════

Rett lista fra bolk 0c: setninger som lover noe appen ikke har, strykes;
nye ting appen har (formkart, live styrke, pause, y-akse, trener-flagg)
får én setning der de hører hjemme. Ingen nye superlativer, samme tone som
i dag. Vanlig bindestrek. «Nytt i V1.4»-etikettene følger versjon.ts.

═══ BOLK 5 - QA ══════════════════════════════════════════════════════════════

- Alle 12 undersider: 390 lys/mørk + 1440, skjermbilder.
- LCP og vekt ETTER på de tre sidene fra bolk 0b - må ikke være verre enn
  FØR med mer enn 10 %. Er det verre: si det, ikke skjul det i lazy-load.
- Ingen console-feil. forside-e2e grønn. Lighthouse-tilgjengelighet uendret.
- Én commit per bolk. Rapport per bolk med bevis og avvik (regel 40 begge
  veier).
