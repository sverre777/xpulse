# Styrke, live styrke og styrkegrafen - designløft
_Utkast levert 16. sep 2026. Fil: `design/xpulse-styrke-design.html`. Kopiert fra prosjektet til repoet 17. sep - fasiten lever i prosjektet. Status per 17. sep: punkt 1, 2, 3, 9 BYGGET (bolk 1-2), tidsreglene BEVIST (bolk 3, `761f567`). Åpne spørsmål nederst er AVGJORT - se der._

Sverres bestilling: grå forrige-verdier når en øvelse er valgt · «beste» (maks reps
på kg) · designløft i pill-format · ny øktgraf-stil for styrke som viser sett, kg,
reps, tid og øvelse · plan mot gjennomført · sammenligne like økter · styrke midt i
en annen økt (soner + styrke på samme graf) · løft på live styrke, enklere
inntasting · analyse med øvelser over tid, også egne øvelser · mobil først ·
mer app- og Apple-følelse, men X-Pulse-stil.
**Tillegg samme dag:** stopp av hele økta med fortsett eller avslutt · hviletid i
styrke føres som styrketid, med i totaltida.
**Tillegg 17. sep (bolk 8):** dra og slipp mellom øvelser i plan, dagbok og live ·
«Supersett» som én knapp · «Legg til supersett».

## HVA SOM ALLEREDE FINNES I KODEN (verifisert, ikke antatt)

- **`components/workout/LiveSessionView.tsx`.** Supersett med kobling og
  opplåsing, stepper for reps og kg, RPE-velger, hviletimer, løpende volum,
  «Sist», «Gjenta forrige», lenke til utvikling og PR-er. Etter bolk 2: tastaturflate,
  Stopp/Fortsett/Avslutt, Beste/PR, ferdig-skjerm.
- **`lib/styrke-pr.ts`.** `epley1RM`, `beregnPR`, `ovelseOverTid`, `normOvelse`.
  PR-typene er `maks_vekt`, `vekt_x_reps`, `est_1rm` og **`maks_reps`**.
- **`components/analysis/StyrkeTab.tsx`.** «Øvelse over tid», PR-liste, tonnasje
  per uke, muskelgrupper, mest brukte øvelser, periodesammenligning.
- **`user_exercises`** med `kind`, `category`, `default_reps`, `default_weight_kg`.
- **`cancelLiveSession`**, **`ResumeSessionBanner` / `getActiveLiveSession`**.

## HVA SOM MANGLET - OG STATUS

1. Grå forrige-verdier per sett-felt - BYGGET (`c9f4bd1`, `94c5da3`).
2. «Beste»-chip - BYGGET.
3. Pill-format - BYGGET.
4. **Styrke i øktgrafen** - bolk 4, IKKE BYGGET.
5. **Blandet økt** på én tidsakse - bolk 4, IKKE BYGGET.
6. **Plan mot faktisk per øvelse** og **sammenlign like styrkeøkter** - bolk 5.
7. **Sett-for-sett under «Øvelse over tid»** - bolk 7.
8. **Muskelgruppe på egne øvelser** - bolk 7. `user_exercises.category` finnes.
9. Stopp av hele økta - BYGGET (lokalt, overlever ikke app-lukking).

## TID - SVERRES BESLUTNING 16. SEP

| | Hva | Teller med |
|---|---|---|
| **Stopp** | Hele økta stanses. Fortsett eller Avslutt. | Nei - tiden fra stopp teller ingen steder |
| **Hvile mellom sett** | Del av økta | **Ja - føres som styrketid, med i totaltida** |
| **Total tid** | Fra start til ferdig, minus stoppet tid | Ja |

**KRITISK:** hvile mellom sett skal **ALDRI** lagres som en rad med
`activity_type = 'pause'`. `IKKE_TRENINGSTID_TYPER` trekker pauserader ut av ren
treningstid. **Hvilen ligger inne i styrkeradens varighet.**

**Bevist 17. sep (bolk 3, `761f567`):** styrkeraden fikk varighet 0 før fiksen
(default i `phase7:69`, `finishLiveSession` skrev bare `duration_minutes`), så Hjem
telte 0 timer på en 51-minutters økt og styrken forsvant i blandet økt. Nå får
styrkeraden resten av totaltida etter de andre radene. E2E: 51 min ren og 30+31
blandet, riktig i ukesum, hovedmål og plan mot faktisk.

**Bevisst følge:** i en blandet økt teller stillestand under styrke som
treningstid, mens stillestand på løpetur er pause og trekkes fra. Står som
kommentar over `computeActivityTotals`.

## ØKTGRAFEN (bolk 4 - fasit)

Styrke er **ikke en sone**: blokkene tegnes i styrkegrått `#6E6E78`
(`ZONE_COLORS_V2.Styrke`), aldri i sonefarger. Hvile mellom sett er `#43434B`.
Kroppsvekt = fast lav høyde. Tid ført i stedet for reps = tiden i blokka.
Blandet økt: samme tidsakse, sonefarger før og etter, styrkebånd imellom,
pulskurven ubrutt over hele. Styrketid teller **ikke** som sonetid. Plan tegnes
som spøkelse med `PlanSpokelse`-mønsteret. **Styrkeblokkene på egen rad under
kurven** (avgjort).

## «APPLE-FØLELSEN»

Ikke en ny stil: rundere kort (16 px), mer luft, større tall, mykere skille
mellom rader, færre kanter. Farger, font og aksenter uendret. Ingen nye skygger
utenfor `--skygge-*`. Treffflate 52 px i live.

## AVGJORT (var «åpent»)

1. Supersett: INGEN farge - klamme i `--kant-7` + bokstav (`f5cd13e`).
2. Asymmetrien (grått lagres i live ved «Logg sett», ikke i lista): riktig,
   kommentert i koden.
3. «Beste» = maks reps på tyngste vekt (`maks_reps`). Ikke est. 1RM.
4. Styrkeblokker i blandet økt: egen rad under kurven.
5. Live styrke uten øvelser, bygges underveis: ikke avgjort - bygg det ikke.
6. Stopp overlever ikke app-lukking i første versjon. Ærlig tekst på
   ferdig-skjermen. To kolonner på `workouts` = egen beslutning senere.
7. Blandet økt: hvile under styrken teller. Ja, bevisst.
