# Klokkemerke-logoer

Legg offisielle logo-filer her, så vises de i klokkesync-velgeren, på
merkesidene og på merkekortene. Uten fil vises en monogram-flis i merkets
farge — det er en bevisst designløsning, ikke en feil.

## Slik skrur du på en logo

1. Last ned SVG-en fra merkets **offisielle** brand-/partnerkit (lenker under).
   Ikke fra bildesøk, ikke fra logo-aggregatorer.
2. Legg fila her som `<slug>.svg` — samme slug som i `lib/klokkesync-brands.ts`
   (`strava`, `polar`, `garmin`, `coros`, `suunto`, `whoop`, `oura`).
3. Sett `logoSrc: '/brands/<slug>.svg'` på merket i `lib/klokkesync-brands.ts`.
   Det er hele endringen — ett felt, ingen kodeendring.

Bruk en enfarget/hvit variant der den finnes: flisen har merkefargen som
bakgrunn for live merker.

## Offisielle kilder

| Merke | Hvor filene ligger | Merk |
|---|---|---|
| Strava | Allerede på plass i koden (`components/strava/StravaBrand.tsx`) | Vi er PÅLAGT å vise «Powered by Strava» og bruke deres egen knapp |
| Polar | [polar.com/en/media-room](https://www.polar.com/en/media-room) → pressebank (EPS/PDF, ikke web-SVG). Kontakt: polar@miltton.com | Logobruk er BEGRENSET i AccessLink-lisensavtalen. Krever skriftlig klarering før den tas i bruk — til da: flis + tekstlig «Polar Ecosystem» |
| Garmin | Garmin Connect Developer Program / brand guidelines | Krever partneravtale-klarering |
| COROS | COROS press/media kit | — |
| Suunto | Suunto brand assets | — |
| Whoop | Whoop press kit | — |
| Oura | Oura press kit | — |

## Regelen vi følger

Et merke får ekte logo først **når integrasjonen er live**, og filen hentes fra
merkets **offisielle** kit. Ingen tegnede etterligninger, ingen filer fra
bildesøk eller tredjeparts logo-arkiv. Står vi i tvil om en visuell bruk,
velger vi tekstvarianten.
