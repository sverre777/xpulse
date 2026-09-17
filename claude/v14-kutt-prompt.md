# VERSJON 1.4 - KUTTET (Cowork 17. sep, etter Sverres «gjør alt som står igjen»)

Alt i 1.4-porten er levert og verifisert: trener redigerer utøverdata, styrke v2
(bolk 0-8, beslutning A, forsidens settgraf), forside runde 3, y-aksen. Det som
står igjen er én småfiks og selve kuttet. Fire commits, i denne rekkefølgen.
Regel 40 i alle: mål før du sier noe, bevis etterpå. Ingen SQL i noen av dem.

═══ COMMIT 1 - LIVE STYRKE: TOPPEN LEGGER SEG UNDER PILLA ═══════════════════

MÅLT (Cowork, skjermbilde fra Sverre 17. sep 17:18): den klebrige toppen i
LiveSessionView (`topp`: position sticky, top 0, zIndex 10) fester seg BAK
GlassTopp (sticky, zIndex 47, høyde safe-area + 8 + 52 + 6 px) når lista
scroller. «0:58» er halvt skjult, bare «TOTALTID · 6 AV 6 SETT» synes.

· `top` for live-toppen = pillas høyde, via ÉN CSS-variabel satt av layouten
  (f.eks. `--app-topp-h`, definert der GlassTopp rendres; på PC der MainNav
  rendres, med MainNavs høyde). Aldri et hardkodet tall i LiveSessionView.
· Sjekk om andre klebrige topper i appen har samme feil (grep sticky/top: 0 i
  components/). Finner du flere: samme variabel, samme commit, si hvilke.
· Bevis: 390 px, scroll til bunnen av en live-økt med 6+ øvelser: totaltid,
  «Pause» og tilstand fullt synlige rett under pilla. Lys og mørk, utøver og
  trener (trener med edit_dagbok). Skjermbilde.

b) SAMME COMMIT - VARIGHET PÅ FERDIG-SKJERMEN KAN TASTES (Sverre 17. sep
   17:20, skjermbilde). Feltet «3 MIN» mellom -5 og +5 er bare tekst i dag.
   Samme mønster som bolk 8f: trykk på tallet åpner numerisk felt
   (inputmode numeric), forhåndsfylt og markert, Enter/trykk utenfor lukker,
   skriver til samme `varighetMin`-tilstand som stepperne. Minst 1, ingen
   maks utover det som finnes. Steppere står. Treffflate 52 px. Bevis: tast
   47, lagre - duration_minutes = 47 i basen, dagboken viser 47 min.
   Sjekk samtidig at -5 fra 3 gir 1, ikke -2.

═══ COMMIT 2 - FORSIDEN: UTKAST-LISTA TØMMES ═════════════════════════════════

`UTKAST_TITLER` i public/forside/scener-flyt.js har fortsatt «SE HELE FORMEN
PÅ ÉN AKSE.». Formkartet er bygget (styrke bolk 3, på Oversikt). Tøm lista,
la `VIS_UTKAST_SCENER`-mekanismen stå (den skal brukes neste gang en scene
tegnes før funksjonen finnes). Kommentaren øverst i fila oppdateres så den
ikke lenger sier at to scener er utkast. forside-e2e grønn.

═══ COMMIT 3 - VERSJONSSTRENG + «HVA ER NYTT» ═══════════════════════════════

a) `lib/versjon.ts`: APP_VERSJON '1.3' → '1.4'. Det er ÉN kilde -
   VERSJONS_MERKE (MainNav, CoachNav, FeedbackCard) og NYTT_I_VERSJON
   (sport-feature-content) følger. Verifiser at ingen fil har '1.3'
   hardkodet utenom changelog-historikken: `grep -rn "1\.3" lib app
   components public --include=*.ts* --include=*.js | grep -v changelog`.
   Finner du noe: rett, og si hvor.

b) `lib/changelog.ts`: v1.3 lukkes, v1.4 åpnes. Punktene under legges inn
   med version '1.4', nyeste øverst, `date` = dagen det landet i prod
   (les git-loggen, ikke gjett). Testen øverst i fila gjelder: ville en
   utøver merket det i går? Ingen interne navn (bolk, fase, RLS,
   regelnummer). Ett punkt per LEVERING. Stikkord-stil som i v1.3.

   UTØVER:
   1. Live styrke, ny. Store trinnknapper eller trykk tallet og skriv;
      dra øvelser i rekkefølge; supersett med én knapp; bytt øvelse på
      førte sett uten å miste tallene; nytt sett arver forrige; totaltid
      stort øverst, pausen mellom sett teller opp til du starter neste;
      stopp hele økta og fortsett; kommentar per øvelse og for økta;
      ferdig-skjerm med nye rekorder, kommentar og fysisk/mental form.
      Lagringen mister ikke sett om nettet svikter.
   2. Styrke i øktgrafen og analysen: settene tegnes som blokker i
      øktgrafen (høyde = kg, bredde = tid, tall = reps, gull ring = PR);
      plan mot faktisk per øvelse; sammenlign like styrkeøkter; sett for
      sett under «Øvelse over tid»; muskelgruppe på egne øvelser.
   3. Styrkeøkt + klokke: flett klokka bak en styrkeøkt - settene står,
      pulsen legges bak.
   4. Formkartet på Oversikt.
   5. Stillestand til pause: klokkesynkede økter får stillestand som
      pause automatisk, med knapp og angre. Klokketid vises når økta hadde
      pauser. Ren pause kan ha sone.
   6. Y-aksen i øktgrafene: pulsen tegnes alltid mot sonene dine (I1-I5),
      ikke mot min og maks i økta. Velg selv: soner, tett eller fast.
   7. Innboksen: teller på uleste, marker lest.

   TRENER (samme liste, egne punkter):
   8. Utøveren styrer hva treneren kan endre: dagbok, terskler og soner,
      utstyr, tester - i tillegg til plan og periodisering. Alt av som
      standard for de nye. Treneren ser bare det utøveren har åpnet.
   9. Treneren kan ikke lenger markere en planlagt økt som gjennomført -
      det gjør utøveren. Endrer treneren en terskel eller en ført økt,
      får utøveren varsel med gammel og ny verdi.

   Legg IKKE inn: Endre-fiksen i byggeren, pausetype ved Opprett,
   RLS-farten, y-akse-valg per enhet, ikoner. Det er feilrettinger og
   finpuss (testen i fila sier nei).

c) Sjekk at /nytt viser v1.4-seksjonen komplett og v1.3 under.
   `npm run changelog-selftest` (scripts/changelog-selftest.ts) grønn.

d) Forsiden: finn hvor forsiden viser versjon eller «nytt» (grep v1.3,
   NYTT_I, «Nytt i» i public/forside og components/landing). Alt som
   nevner versjon skal si 1.4, og alt som står på forsiden skal finnes i
   appen (regel fra 16. sep). Finner du ingenting versjonsbundet på
   forsiden: si det, ikke lag noe.

═══ COMMIT 4 - MELDING TIL TRENERNE (fil, ikke kode) ════════════════════════

Skriv `claude/changelog-1.4-trenere.md`: én melding Sverre sender til
trenerne (Erik og de andre) - norsk, vanlig bindestrek, ingen interne navn,
maks 12 linjer. Innhold: punkt 8 og 9 over, pluss at live styrke og
styrkeanalysen er ny for utøverne deres, og at det de så som «Kommer» i
rettighetsbryterne nå virker. Avslutt med hva treneren må gjøre selv:
ingenting - utøveren slår på flaggene. MÅL FØRST: finnes det en innebygd
kanal (innboks-melding til alle trenere, varsel) som kan sende dette? Hvis
ja: si hvordan, ikke send. Hvis nei: fila er leveransen.

═══ RAPPORT ═════════════════════════════════════════════════════════════════

bygget: <hash> (commit 1) · <hash> (2) · <hash> (3) · <hash> (4) ·
ikke bygget ennå: <alt du hoppet over, med hvorfor>
Per commit: hva, bevis, avvik fra denne prompten (regel 40 begge veier -
meld alt som avviker, også når du mener det er riktig). Alt pushet, build
grønn, testbrukere ryddet til 0.
