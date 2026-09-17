# Flett og styrke på pulskurven - tillegg til styrkebolken
_16. sep 2026. Hører til `claude/styrke-loft-plan.md` og `design/xpulse-styrke-design.html` (seksjon 3b). Kopiert fra prosjektet til repoet 17. sep - fasiten lever i prosjektet._

Sverres ønske: når klokkesynk kommer inn må styrkeøkta kunne flettes med den, så
pulsgrafen i det minste er der. Live styrke blir «sjef», pulsen legges bak. Og
lista når man trykker Flett må ha to adskilte valg: flett med plan, og flett med
ført/dagbok.

## FLETT ER BYGGET - DET MESTE AV DETTE FINNES

`app/actions/flett.ts` (`flettOkter`, `hentFlettGrunnlag`, `hentFlettStatus`,
`angreFlett`) og `LinkWorkoutActions.tsx` (505 linjer) med én dialog og to moduser.
Fasit: `claude/plan-klokkesynk-flett.md` + `design/xpulse-flett-design.html`.

**«Live styrke er sjef, pulsen legges bak» = modus A «Legg bak», som finnes.**
Mål-øktas aktiviteter og runder røres aldri; inn kommer puls, pulskurve, totaltid
(klokkas vinner) og soner regnet fra kurven. Fasit-dokumentet fra 28. aug har
nøyaktig dette scenariet som typetilfelle: «planlagt styrke → live styrke ført →
klokka synker samme økt → pulsen skal INN i økta, ikke bli duplikat».

**Mål kan allerede være både planlagt og ført.**

## HVA SOM FAKTISK MANGLER

1. **To grupper i kandidat-velgeren.** I dag er lista flat med en liten
   «planlagt»-etikett per rad (`LinkWorkoutActions.tsx:311`). Skal bli to grupper
   med overskrift, fordi konsekvensen er ulik: **flett mot en plan markerer økta
   som gjennomført samtidig**, flett mot en ført økt gjør ikke det. Ren
   presentasjonsendring.
2. **Styrke tegnet på pulskurven.** Selve fletten finnes, visningen gjør ikke.
   Pulskurven bak med svak fylling, settene foran, samme tidsakse. Ingen
   soneflater bak en styrkeøkt.
3. **Styrkerader må fredes i modus B**, på linje med skyteradene som allerede
   fredes (`hentFlettGrunnlag` filtrerer bort skyting fra `maalRader`).

## REELT HULL - SVERRE MÅ AVGJØRE

**Kilden i en flett må være en synket økt.** Står du på en økt uten klokkedata,
sier dialogen «Ingen synkede økter å koble til innen ±3 dager».
**To manuelt førte økter kan ikke flettes i dag.**

Sverres scenario (styrke ført + klokka kommer inn) virker allerede. Men «ført
styrke + ført løpetur slås sammen til én økt» gjør ikke det. Er det ønsket?

## FORSLAG

- **«Legg bak» bør forvelges når målet er en styrkeøkt.** I dag er «Bytt ut»
  forvalgt (Sverre 28. aug). Å bytte ut tolv sett med fire klokkerunder er nesten
  alltid feil. AVGJORT 16. sep: ja, forvelges (styrke-prompten bolk 6b).
- Vinduet er ±3 dager i dag. Ikke foreslått endret.

## ÅPENT

1. Skal to manuelt førte økter kunne flettes? (Ikke avgjort - bygg det ikke.)
2. «Legg bak» forvelges når målet er en styrkeøkt - AVGJORT ja.
