# STYRKE, LIVE STYRKE, STYRKEGRAFEN OG FLETT - CC-prompt

**Status 17. sep:** bolk 0, 1 og 2 er BYGGET (`94c5da3`, `5b33f41`, `c9f4bd1`,
`f5cd13e`). CC bygde dem fra designfila alene - denne fila nådde ham aldri.
**Gjenstår: bolk 3 (beviset), 4, 5, 6, 7 og den nye bolk 8.** CC skal committe
denne fila til `claude/styrke-prompt.md` i repoet FØR han bygger videre.

**Anbefalt modell:** Opus på bolk 3 og 6 (tidsregnestykket, flett-datamodellen,
fredningen). Fable på 4, 5, 7 og 8 mot ferdig fasit.

---

FASIT, i denne rekkefølgen:
  1. design/xpulse-styrke-design.html - «Notat - regler» nederst er bindende.
  2. claude/styrke-loft-plan.md + claude/styrke-flett-tillegg.md
  3. claude/plan-klokkesynk-flett.md (flett-fasiten fra 28. aug - uendret)
  4. claude/x-pulse-status.md - ved sprik vinner denne.

ARBEIDSFORM
  Én bolk per omgang, push etter hver (regel 29). Stopp KUN ved SQL, motsigelse
  i fasiten, eller noe som rører Strava/flett-datamodellen. «bygget: X · ikke
  bygget ennå: Y» ØVERST i hver rapport (regel 25), med verifiserte hasher.

DET MESTE AV GRUNNMUREN FINNES. Ikke bygg om:
  · LiveSessionView.tsx: supersett, steppere, RPE, hviletimer, volum, «Sist»,
    «Gjenta forrige», tastaturflate, Stopp, Beste/PR, ferdig-skjerm (bolk 2).
  · ActivitiesSection / StrengthEditor / ExerciseBlock: grå forrige-verdier,
    Beste-chip, 16 px kort, piller, plan-chip, Tid-kolonne (bolk 1, c9f4bd1).
  · lib/styrke-pr.ts: epley1RM, beregnPR (maks_vekt, vekt_x_reps, est_1rm,
    maks_reps), ovelseOverTid, normOvelse.
  · lib/live-styrke.planlagtStyrkePerOvelse - ÉN kilde for plan-chipen.
  · StyrkeTab.tsx: «Øvelse over tid», PR-liste, tonnasje, muskelgrupper.
  · flett.ts + LinkWorkoutActions.tsx: én dialog, modus legg_bak og bytt_ut.
  · cancelLiveSession, ResumeSessionBanner, getActiveLiveSession.
  · Supersett-markering: klamme i --kant-7 + «SS A». INGEN farge (bolk 2b).

═══ BOLK 0 - KARTLEGGING, INGEN KODE ═══ (GJORT)

a) Skjemasjekk mot PROD: finnes alt som trengs for grå forrige-verdier
   (forrige gjennomførte økt per øvelse, sett for sett), «Beste», styrke i
   øktgrafen og styrkerader i flett? Jeg tror ja. Mangler noe: STOPP OG VIS.
b) Bekreft at user_exercises.category finnes og er ubrukt.
c) Hvor kommer styrkeradenes varighet fra i dag, og inkluderer den hvile?
   Dette avgjør bolk 3. Svar med linjenummer, ikke antagelse.
d) Hvilke aktivitetstyper fredes i modus B i dag (hentFlettGrunnlag), og hvor
   legges styrke inn i den fredningen?

═══ BOLK 1 - GRÅ FORRIGE-VERDIER OG «BESTE» ═══ (GJORT, c9f4bd1 + 94c5da3)
(ActivitiesSection.tsx + LiveSessionView.tsx)

Grå tall = forrige GJENNOMFØRTE økt med samme øvelse, sett for sett (sett 1 mot
sett 1). Ikke planen, ikke snittet, ikke beste.

ABSOLUTT KRAV:
  · I sett-lista er grått en PLACEHOLDER, ikke innhold. Lagrer brukeren uten å
    taste, lagres INGENTING for det settet. Et grått tall som smetter inn i
    basen er en oppdiktet måling.
  · Færre sett sist = ekstra sett står TOMME. Aldri gjentatt siste verdi.
  · Ny øvelse uten historikk = tomme felt + chip «Ingen historikk ennå».
    Aldri 0 som plassholder.
  · Trykk på grått felt fyller verdien inn som ført.
  · Farge: --tekst-10 (#3A3A44 mørk / #BBBBC5 lys). Ingen ny farge.

«BESTE»-chip: maks reps på tyngste vekt, formen «8 × 100 kg», gull #D4A017.
  · Det er maks_reps-PR-en fra beregnPR. INGEN ny beregning.
  · Første registrering av en øvelse er grunnlinje, ikke PR - samme regel som
    PR-lista bruker i dag.
  · Est. 1RM står IKKE som chip under føring. Estimat skal ikke stå som mål
    midt i et sett.
  · Egne øvelser er likestilte (normOvelse normaliserer på navn).

═══ BOLK 2 - LIVE STYRKE: PILLER, TASTATURFLATE, STOPP ═══ (GJORT, 94c5da3)

a) Alle knapper over på .xp-pill (radius 999, versaler, min 36 px).
b) Supersett får INGEN egen farge. Klamme i --kant-7 pluss bokstaven (SS A).
   Vi låner ikke trener-blå til noe som ikke er trener. (Rettet i f5cd13e.)
c) Tastaturflate nederst: aktivt sett løftes ned, to steppere (reps ±1,
   kg ±2,5), treffflate 52 px. Stepperen starter på forrige økts tall, GRÅTT.
   «Logg sett» uten å røre den lagrer forrige økts tall - BEVISST motsatt av
   lista i bolk 1 (kommentert i koden). «Samme som sist sett» kopierer settet.
d) STOPP: Stopp → klokka står → Fortsett eller Avslutt. Avbryt = cancelLive-
   Session. live_started_at nullstilles ALDRI. Stopp er LOKALT i første
   versjon (fasit 16. sep) - stoppet tid må rettes manuelt hvis appen lukkes.
e) Ferdig-skjerm: tonnasje, sett, øvelser, «Nye rekorder». Ingen konfetti.

═══ BOLK 3 - TIDSREGLENE ═══ (KODEN ER DER - BEVISET MANGLER)

TO TIDSBEGREPER, og de blandes aldri (Sverre 16. sep):
  TOTALTID = TRENINGSTIDEN. Hvile mellom sett er MED. En styrkeøkt er
             48 min inkludert hvile, ikke 18 min arbeid.
  ELAPSED  = klokkas spenn (Klokketid, regel B). Stoppet tid ligger HER,
             og ALDRI i totaltid.

KRITISK: hvile mellom sett skal ALDRI lagres som rad med
activity_type = 'pause'. IKKE_TRENINGSTID_TYPER trekker pauserader ut av ren
treningstid. HVILEN LIGGER INNE I STYRKERADENS VARIGHET. CC har bekreftet at
hvile aldri lager pause-rader (E2E 94c5da3) - det som gjenstår er utfallet:

E2E-KRAV (regel 40): en styrkeøkt på 48 min med 18 min arbeid skal vise 48 min
i ukesummen, i plan mot faktisk og i årsplan-framdriften. Mål det, ikke anta
det. Blandet økt: hvile under styrkedelen teller, stillestand under løpedelen
trekkes fra - to behandlinger av å stå stille i samme økt, bevisst, og det
skal stå som kommentar der regnestykket bor.

═══ BOLK 4 - STYRKE I ØKTGRAFEN ═══
(PlanGraf.tsx / OktKurve.tsx - én komponent, flere monteringspunkter)

· Styrke er IKKE en sone. Blokker i styrkegrått #6E6E78 (ZONE_COLORS_V2.Styrke),
  aldri sonefarger - samme grunn som skyting er pausegrå på tidslinja.
· Høyde = vekt, bredde = tid, tall i blokka = reps. Hvile mellom sett #43434B.
  Øvelsen som klamme under, ikke etikett i hver blokk.
· Vekt null (kroppsvekt, mobilitet) = fast lav høyde, tallet er reps alene.
  Reps null men tid ført (planke) = tiden i blokka.
· BLANDET ØKT: samme tidsakse. Sonefarger før og etter, styrkebånd imellom,
  pulskurven ubrutt over hele. Styrkeblokkene på EGEN RAD under kurven, ikke
  i segmentbåndet sammen med oppvarming og drag.
· Sonesummene teller IKKE styrketid som sonetid. Styrke er egen kategori.
· Plan som spøkelse med PlanSpokelse-mønsteret. Ikke en ny mekanisme.
· chartKey i lib/graf-register.ts. Ingen nakne grafer.
· Samme settgraf brukes på forsiden i runde 3 (design/xpulse-styrke-design.html
  er fasiten for begge).

═══ BOLK 5 - PLAN MOT FAKTISK OG SAMMENLIGN ═══

a) Plan mot faktisk per øvelse i PlanVsActualComparison.tsx: planlagt sett ×
   reps × kg mot ført, én rad per øvelse, PR-stjerne der det er PR. Øvelse i
   planen som ikke ble ført står som «ikke ført», ikke som 0.
b) Sammenlign like styrkeøkter i CompareWorkoutsTab.tsx: samme øvelser side om
   side over 2-4 gjennomføringer. Eldst dempet, nyeste i aksentfargen - samme
   språk som sesongsammenligningen bruker for dempet fjorår.

═══ BOLK 6 - FLETT ═══

Flett-mekanismen er bygget og datamodellen RØRES IKKE. Fire endringer:

a) Kandidat-velgeren deles i TO GRUPPER med overskrift: «Planlagte økter» og
   «Førte økter i dagboka». Under hver: én linje som sier hva som skjer -
   mot plan markeres økta samtidig som gjennomført, mot ført gjør den ikke det.
   Ren presentasjonsendring i LinkWorkoutActions.tsx.
b) «Legg bak» forvelges når målet er en STYRKEØKT. «Bytt ut» er forvalgt i
   dag (Sverre 28. aug) og blir stående ellers. Å bytte tolv sett mot fire
   klokkerunder er nesten alltid feil.
c) Styrkerader fredes i modus B, på linje med skyteradene som allerede fredes
   i hentFlettGrunnlag. Konsekvens-linja skal ikke true med å slette sett som
   ikke slettes.
d) Etter flett: pulskurven tegnes BAK styrkeblokkene på samme tidsakse, svak
   fylling under (ca 8 %). INGEN soneflater bak en styrkeøkt.
MERK (fase 131): flett krever nå edit_dagbok for treneren (kan_flette_for).
Rør ikke det.

UTENFOR DENNE BOLKEN: å flette to manuelt førte økter. Kilden må fortsatt være
en synket økt. Bygg det ikke - det er en egen beslutning Sverre ikke har tatt.

═══ BOLK 7 - ANALYSE ═══

a) Sett-for-sett under «Øvelse over tid» (styrke_ovelse): én kolonne per økt
   under kurven, høyde = kg, tall = reps, gull ring på PR-økta. Da ser man om
   framgangen kom fra vekt, reps eller flere sett.
b) Muskelgruppe på egne øvelser: la brukeren velge kategori når øvelsen
   opprettes, med «ukjent» som gyldig valg. Kolonnen user_exercises.category
   finnes - VERIFISER mot prod før du sier noe annet. Ingen SQL.
   Fyll ikke inn kategori for eksisterende egne øvelser automatisk.

═══ BOLK 8 - DRA OG SLIPP, OG SUPERSETT SOM ÉN KNAPP ═══ (Sverre 17. sep)

a) DRA OG SLIPP MELLOM ØVELSER - i plan, i dagbok OG i live styrke.
   · dnd-kit ligger alt i repoet (kalenderen bruker den). Ingen ny pakke.
   · Plan og dagbok er SAMME komponent (ActivitiesSection) - ett drag-oppsett
     der. Live (LiveSessionView) får sitt, men rekkefølgelagringen er ÉN
     hjelper delt av begge (regel 11).
   · MOBIL: draget går på et HÅNDTAK (grip-ikon ved nummeret), aldri hele
     kortet - ellers slåss det med scrollen. Samme felle som touch-fiksen på
     forsiden: test med CDP Input.synthesizeScrollGesture, gestureSourceType
     'touch', og aldri touch-action:none på noe som skal scrolle.
   · Opp/ned i ⋯-menyen BEHOLDES som tastatur- og skjermleser-vei.
   · Rekkefølgen lagres. Finnes det en rekkefølgekolonne på
     workout_activity_exercises i prod? VERIFISER FØR DU SIER NOE. Mangler
     den: STOPP OG VIS - det er SQL, og Sverre kjører.
   · Kun øvelser flyttes. Sett innenfor en øvelse flyttes IKKE (ikke bestilt).

b) SUPERSETT SOM ÉN KNAPP.
   · «Supersett» på øvelseskortet: kobler denne øvelsen med den NESTE. Én
     trykk. Samme kobling som live har i dag - ingen ny datamodell.
   · «Legg til supersett» nederst, ved siden av «+ Øvelse»: legger til TO
     tomme, koblede øvelser i ett trykk.
   · «+ Legg til sett» finnes - beholdes som den er.
   · Markeringen er fortsatt klamme i --kant-7 + bokstav. Ingen farge (2b).
   · Samme tre knapper i plan, dagbok og live.

c) REDIGERE ØVELSEN PÅ FØRTE SETT - I LIVE (Sverre 17. sep kveld).
   Har du ført tre sett på feil øvelse, skal du kunne bytte øvelse på kortet
   og beholde tallene. Reps, kg, tid og RPE står; bare øvelsen byttes.
   · Bytte = samme velger som «Legg til øvelse» (søk eller skriv eget), fra
     ⋯-menyen på øvelseskortet. Virker også etter «Logg sett» - ikke bare på
     tomme kort.
   · KRAV: settene flytter til en annen øvelse, så PR-merker og «Beste» må
     regnes PÅ NYTT for det nye navnet (beregnPR via normOvelse). 100 kg er
     PR for knebøy, ikke for markløft. Et stående PR-merke etter bytte er en
     oppdiktet rekord. Ferdig-skjermens «Nye rekorder» skal også stemme
     etter byttet.
   · Grå forrige-verdier på kortet byttes til det nye navnets historikk.
   · Samme i plan og dagbok (ActivitiesSection) - der er navnefeltet alt
     fritt; sjekk at PR-merket regnes på nytt der også.
   · MÅL FØRST: kan et ført sett i live redigeres (reps/kg) i dag, ved å
     trykke på det? Hvis ikke, ta det med i samme bolk - samme klasse feil
     (tastet feil, vil rette uten å slette).

d) BEVIS (regel 40): rekkefølgen står etter reload, i plan OG dagbok OG live.
   Supersett-koblingen står etter reload. Dra på mobil scroller ikke sida.
   Ingenting i basen endres av en drag som slippes der den startet.
   Øvelsesbytte: settene har ny øvelse i basen, PR-merket flyttet eller
   fjernet riktig, «Beste» viser det nye navnets beste.

e) TOTALTID-TELLEREN I LIVE - TYDELIGERE (Sverre 17. sep kveld).
   Telleren er tallet bolk 3 handler om (totaltid = treningstid, hvile med,
   stoppet tid ikke). Den skal ikke se ut som en detalj.
   · Større tall, øverst, alltid synlig (klebrig i toppen når lista scroller),
     Bebas eller Barlow Condensed som appens øvrige store tall - ingen ny
     font. Klar tilstand: går, STOPPET (dempet + merke), avsluttet.
   · Under: «Totaltid» som etikett, og når det finnes stoppet tid: én liten
     linje «Stoppet: 4:12 (ikke med)». Aldri to tall som ser like ut.
   · Ikke rør regnestykket - bare visningen. Verdien er den samme som lagres.
   · Lys og mørk, 390 px.

f) TASTE TALLET DIREKTE I LIVE (Sverre 17. sep kveld).
   Stepperne (reps ±1, kg ±2,5) blir stående som standard. I TILLEGG: trykk på
   selve tallet i stepperen åpner et numerisk felt (inputmode="decimal" for kg,
   "numeric" for reps), forhåndsfylt med dagens verdi, markert, så du kan
   skrive 82,5 rett inn. Enter eller trykk utenfor lukker. Komma og punktum
   godtas begge som desimal. Verdien går inn i samme tilstand som stepperen
   skriver til - ingen ny kilde.
   · Dette opphever «ingen systemtastatur» fra bolk 2c. Begge veier finnes.
   · Treffflate 52 px står. Feltet skal ikke ødelegge den.
   · Bevis: tastet 82,5 lagres som 82.5, og «Beste»/PR regnes med den.

g) NYTT SETT ARVER FORRIGE SETT (Sverre 17. sep kveld).
   «+ Legg til sett» (live) og «+ Sett» (plan/dagbok) lager i dag et TOMT sett
   (makeSet / emptySet). Skal i stedet kopiere reps, kg (og RPE der den
   finnes) fra settet rett over i SAMME øvelse. Første sett i en øvelse:
   som i dag (forrige økt grått / bibliotekets default).
   · PLAN og DAGBOK: verdiene skrives rett inn i det nye settet. Brukeren
     trykket «+ Sett» selv og kan endre.
   · LIVE: det nye settet er IKKE ført. Verdiene ligger som startverdi i
     stepperen/tastaturet (samme sti som «Samme som sist sett» bruker i dag:
     setTast med rort: true) og lagres først ved «Logg sett». Ellers bryter
     vi «ingenting fullført før brukeren markerer det», og volum, PR og
     «Beste» ville telt et sett som ikke er gjort.
   · «Samme som sist sett»-knappen i tastaturet blir overflødig når dette
     er inne - fjern den, ikke la to veier gjøre det samme.
   · Bevis: plan/dagbok: nytt sett har forrige setts tall i basen etter
     lagring. Live: nytt sett er ikke ført (ikke i doneSets, teller ikke i
     volum) før «Logg sett»; etter «Logg sett» lagres de arvede tallene.

GJELDER ALLE BOLKER
  Lys og mørk (regel 23) · vanlig bindestrek (regel 31) · ingen custom
  musepeker (regel 30) · treffflater minst 36 px, 52 i live · mobil er
  hovedformatet · snitt kun på førte verdier · ingenting fullført før brukeren
  markerer det · designfiler committes separat fra kode (regel 26).

  «Apple-følelsen» er ikke ny stil: rundere kort (16 px), mer luft, større tall,
  mykere skille mellom rader, færre kanter. Farger, font og aksenter uendret.
  Ingen nye skygger utenfor --skygge-*-variablene.
