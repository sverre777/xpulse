# Formkartet - plan, beslutninger og åpne punkter

Fasit-rekkefølge: `design/xpulse-formkart-design.html` (notatet er bindende) -> denne fila -> `claude/x-pulse-status.md`
(finnes ikke i repoet per 17. sep 2026). Denne fila skulle ligget her før bolk 0; den er skrevet etter
levering og speiler det som ble bygget.

## 1. Plassering - AVGJORT: Oversikt
Formkartet og dagvisningen bor på **Analyse -> Oversikt, rett under «Status nå»**, full bredde
(`oversikt_formkart`, `bred: true`). Notatet §1 i designfila sier «under Belastning»; plasseringskartet,
§6b og bestillingen (bolk 2) sier Oversikt. Bygget på Oversikt, og Sverre bekreftet 17. sep: valget står.
Dybden bor i fanen som eier emnet: mønsterkort i Belastning (over korrelasjonskortene) og Helse,
standplassform i Skyting (under SkytingBolk8), laktat per puls i Terskel (ved laktat-mot-watt).
Trenerpanelet arver plasseringen uendret med targetUserId hele veien ned.

## 2. Beslutninger tatt under bygging (bolk 0-7, 807f306..ac5acdd)
- Én henting: `getFormkart(fra, til, targetUserId)` gir hele kartet per dag. Alt parallelt, ett kall.
- Helse resolver med `resolveHealthTargetUser` - uten rettighet finnes ikke `helse` i payloaden.
- Terskel alltid via `lib/terskel-oppslag`, per øktas dato. % av terskel regnes i `lib/formkart`.
- Laktatmålinger (`workout_activity_lactate_measurements`) har ingen egen puls: radens `avg_heart_rate`
  brukes. Egen puls per måling krever SQL - ikke foreslått.
- `daily_health.hrv_ms` leses ikke; Helse-fanen leser heller ikke den (én kilde: health_metrics/
  sleep_records/daily_health.day_form).
- Hviledag = dag uten ført OG uten planlagt økt; sykdom er ikke hvile. `day_states.hviledag` brukes ikke.
- Hardøkt = tid i I3+ > 0 (samme definisjon som «Status nå»).
- Restitusjonsbanens grunnivå = ett 60-dagersvindu t.o.m. periodens siste dag, band ±1 SD.
- Monotoni regnes på daglig TSS fra `getBelastningAnalysis`. Standplassform: én dag med skyting = én økt.
- Dagvisningen: én komponent, montert under kartet (klikk) og i ukevisningens dagdetalj. «Se økta» åpner
  eksisterende WorkoutModal via `?edit=`; trener får `/app/trener/<id>/dagbok?edit=`.
- Mønsterkortene i Belastning står mellom RestDayStats og HelseBelastningSeksjon.

## 3. Målte fargefunn (fra designfila, gjelder)
- I3 #E8B93C mot I4 #FF8C00: ΔE 10,4 normalt syn, 5,3 deuteranopi. Tiltak: 2 px mellomrom, fast
  rekkefølge, Lav/Med/Høy standard under 640 px. Sonefargene røres ikke (ZONE_COLORS_V2).
- Følelse #A855F7 mot HRV #8B5CF6: ΔE 0,3 protanopi. Følelse tegnes i nøytral blekk; HRV beholder #8B5CF6.
- I lys modus er I1/I3/I4 under 3:1 mot kortflaten: verdier i tooltip og dagvisning, farge bærer aldri alene.
- Skytefarger: liggende #38BDF8, stående #FF4500 (SkytingSummaryCards er kilden).

## 4. Åpne punkter - Sverre avgjør
- Dobbel y-akse i BelastningBolk4 sin custom belastningsgraf: unntak eller feil? Formkartet følger
  konvensjonen; grafen er ikke rørt.
- TSB-varmtonen #E23A5A er tredje bruk av samme røde (hvilepuls, I5). Godkjennes eller byttes.
- Egen bryter «skjul helsebanene» for å vise skjermen til andre? Ikke bygget.
- Laktat per bevegelsesform: filter bygget med «Alle» som standard, skjult ved én form.

## 5. Bevis
`npm run formkart` (lib, 32 OK) · `TESTBRUKERE=ja npm run formkart-e2e` (49 OK mot ekte flate, inkl.
payload-bevis for trener med og uten can_see_health_data).
