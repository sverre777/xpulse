# Plan ↔ klokkesynk: omskriving + flett - SENDT TIL CC (28. aug 2026)
_Kopiert fra prosjektet til repoet 17. sep - fasiten lever i prosjektet. Lange tankestreker byttet til bindestrek (regel 31)._

**Status: designutkast godkjent (`design/xpulse-flett-design.html` i
repoet), full prompt skrevet og sendt til CC 28. aug. BYGGET: `app/actions/flett.ts`
+ `LinkWorkoutActions.tsx`, én dialog, modus legg_bak og bytt_ut.**

## Det vi er enige om

### Del 1 - koblingen skrives om (UI + flyt)
- Knappene («Koble / flett ...») rendres MED kortet - aldri etterlastet.
  **Sverres presisering:** lastingen flyttes til NESTE steg - når
  brukeren skal VELGE hvilken økt som kobles, kan kandidat-lista laste
  et øyeblikk (spinner i pickeren). Knappen er alltid der og svarer i
  samme tick (regel 20).
- Stil: fyldig pill, samme form/tyngde som «Marker som gjennomført».
- Etter kobling mot planlagt: NØYAKTIG samme plan-vs-gjennomført-visning
  som fullført-markering utløser. Gjenbruk komponenten (regel 11).

### Del 2 - FLETT: klokkedata inn i eksisterende økt
Typetilfellet: planlagt styrke → live styrke ført (sett/reps/kg) →
klokka synker samme økt → pulsen skal INN i økta, ikke bli duplikat.

**TO moduser i ÉN dialog:**
- **A) LEGG BAK:** mål-øktas AKTIVITETER/RUNDER røres ALDRI. Inn:
  puls (snitt/maks) + pulskurve/samples · **TOTALTID (klokkas vinner)**
  · **SONER regnet fra pulskurven** (øktnivå, radene urørt).
  (Totaltid- og soneregelen gjelder KUN modus A.)
- **B) BYTT UT AKTIVITETENE:** klokkas runder/rundetider/distanse/soner
  erstatter mål-øktas aktiviteter. Dialogen viser antall rader ut/inn
  FØR bekreftelse.

**Én mekanisme:** kobling og flett er SAMME operasjon - én dialog, to
mål-typer (planlagt/ført). Mot planlagt: markerer samtidig gjennomført
+ plan-vs-gjennomført-visningen. Pekermodellen erstattes; eksisterende
koblinger tolkes som «legg bak».

**Felles krav:**
- Synket økt KONSUMERES (skjult, flettet-inn-i-peker), aldri slettet.
  Samples/FIT-referanse følger dataene til mål-økta. Én transaksjon.
  Angre-rad på økta (fra utkastet), ingen tidsfrist - angring
  gjenoppretter begge.
- **Proveniens (regel 2):** Strava-data arver Stravas vilkår inn i
  mål-økta (imported_activities-merking følger med). Stridee/.fit: fri.
- Generisk mekanisme; trener ser ⌚-badge på flettede økter.
- Regel 1: Strava-hentingen røres ikke. Stridee-konfliktvinduet står.
- **Fase 131 (17. sep):** flett krever `can_edit_dagbok` for treneren
  (`kan_flette_for`). Rør ikke det.

## Avgjort i planfasen

1. ✅ **Totaltid (kun A):** klokkas vinner.
2. ✅ **Soner (kun A):** fra pulskurven, radene urørt.
3. ✅ **Samlet/Splittet-VISNING:** bryter på økter m/ klokke-runder
   (flettede OG rene synk-økter). KUN presentasjon - data lagres ALLTID
   splittet. **Gruppering (oppdatert 16. sep, `be431ba`):** lik
   aktivitetstype + bevegelsesform + underkategori, ren og aktiv pause hver
   for seg, én totalrad per gruppe, rekkefølge = første forekomst, snittpuls
   tidsvektet. Ikke et valg i dialogen.
4. ✅ **Angring:** angre-rad på økta, ingen tidsfrist.
5. ✅ **Vedlegg:** samples/FIT-referanse følger dataene til mål-økta.
6. ✅ **Trener:** ser ⌚-badgen.
7. ✅ **TAGS OG SKJEMA-DATA OVERLEVER ALLTID (Sverre 28. aug):**
   Viktig økt · Fellestrening · Standardøkt · Konkurranse · Testløp ·
   Test · Høyde · Varme - og ALT bak dem (konkurranseskjema/
   workout_competition_data, testdata/workout_test_data, skyting,
   laktat, vær, ernæring, notater, følelse) - står urørt i BEGGE
   moduser, også når klokka er «sjef» i B. **Generelt formulert:
   modus B bytter KUN workout_activities-radene; alle andre
   barnetabeller og felt på økta er brukerens og røres aldri.**
   Økttype-feltet beholdes også - klokka endrer aldri hvilken TYPE økt
   det var. Testkrav: planlagt konkurranse-økt m/ utfylt skjema +
   skyteserier flettes i modus B → skjema, serier og tags står bit for
   bit.
8. ✅ **TITTELEN beholdes fra mål-økta (Sverre 28. aug):** plan-/
   føringstittelen står i BEGGE moduser - klokkas navn («Morning Run»
   o.l.) overskriver aldri.
9. ✅ **Styrke (16. sep):** «Legg bak» forvelges når målet er en styrkeøkt.
   Styrkerader fredes i modus B, som skyteradene. Se
   `claude/styrke-flett-tillegg.md` og styrke-prompten bolk 6.

## Gjenstår

- Re-import av de 19 Strava-øktene står FORTSATT som eldste sak i køen.
- To manuelt førte økter kan ikke flettes - ikke avgjort, bygg det ikke.
