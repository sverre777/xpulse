# Lysmodus — tvilslogg

Oppdatert 2026-08-26, etter at steg 2 er kjørt. Punktene du har avgjort står
først, med hva som faktisk ble gjort. Det som fortsatt er åpent står nederst.

---

# Avgjort og utført

## 1. De to `:root`-settene i globals.css

**Din avgjørelse:** finn hvilket som rendrer, det er fasit, slett det andre.

**Retting av premisset:** de to blokkene delte **null tokennavn**, så de
konkurrerte aldri i kaskaden. «Senere definisjon vinner» avgjorde ingenting,
og en ren sletting ville fjernet 19 levende referanser — ikke døde duplikater.

**Avgjort på faktisk bruk i stedet:**

| Blokk | `var()`-treff |
|---|---:|
| Linje 321 (`--card`, `--line`, `--ink` …) | **1 440** |
| Linje 118 (`--bg-primary`, `--text-primary` …) | 27 (8 av dem i xpulse.html, som har sin egen `--border`) |

Blokk 118 er slettet. De 19 referansene er flyttet til tokens med **identisk**
verdi, verifisert i kode før byttet. Sju tokens hadde null bruk og er bare
fjernet. `--border-hover: #333340` ble `--kant-hover` — den har kanalspenn 13
og falt utenfor nøytralgrensa på 12 i steg 1. Commit `73739f2`.

## 2. `--dim` og `--gold`

App og landingsside er separate tokensett og er ikke forent. `--gold` er ikke
rørt. **Ført opp som egen sak:** `--gold` er `#F5C542` i globals.css men
`#E8B93C` i xpulse.html, og fargefasiten sier graf-gull `#E8B93C` og kort-gull
`#D4A017`. `#F5C542` står ikke i fasiten i det hele tatt.

## 3. Halen på 30 verdier

Beholdt. Ingen sammenslåing. Alle 70 nøytralene har hvert sitt token.

## 4. Logoen

Ingen logofil er referert noe sted i repoet — heller ikke
`xpulse-logo-currentcolor.svg`. All logo-rendering går gjennom inline-SVG i
`components/branding/XPulseIcon.tsx`, brukt i MainNav, CoachNav, AppFooter,
LandingNav, LandingFooter og AuthCard.

Å bytte til fila ville betydd å bygge om seks brukssteder og miste variantene
hero/utøver/trener. Løst med **ett token i stedet**: `--logo-strek`, hvit på
mørk bunn og svart på lys, brukt ett sted. Samme resultat som currentColor-fila,
uten filavhengigheten.

## 5. Strava-blekket

`KlokkesyncBrandPicker.tsx:149` er fredet i sin helhet. Hele
`components/strava/`, `lib/strava.ts` og `app/actions/strava-sync.ts` er også
holdt utenfor konverteringen.

## 6. Datafargene

`COLOR_TOTAL`, `COLOR_TSS_AVG` og `#8A8A96`-som-flat-trend fikk `--data-*`-tokens
med egen lysvariant. Det samme fikk de øvrige jeg fant: ukjent sone/status/
lap-type, seriefarge for ikke-utholdenhet, tom tilstand, notatfarge, og uke uten
periodiseringsintensitet.

## 7. Scrim og skygge

Egne lysverdier, ikke speilet. Scrim: lys alfa = mørk alfa × 0.55. Skygge: lys
alfa = mørk alfa × 0.22. Tresifret hex speilet som vanlig.

## 8. `TEMA_FOLG_OS`

Står `false` til du har klikket gjennom de innloggede flatene. Egen commit
etterpå — det er én linje i `lib/tema.ts`.

## 9. Statuslinja (`theme-color`)

`<meta name="theme-color">` settes nå fra klienten sammen med `data-tema`:
`#0A0A0B` mørk, `#F4F4F5` lys. Verdiene følger `--flate-3`, og det står i koden
at de skal endres i samme commit som den.

`themeColor` er **fjernet** fra `viewport` i `layout.tsx`. Med den på plass
fikk vi to `theme-color`-tagger — inline-skriptet lagde sin før React rakk å
sette inn sin, og nettleseren bruker den første. Det virket, men bare i kraft av
rekkefølgen. Verifisert i nettleser: før fjerningen to tagger, etter fjerningen
én, med riktig farge i begge tema.

`app/manifest.ts` beholder sin `theme_color` som installasjons-standard.
Manifestet leses ved installasjon og kan ikke ha temavarianter, men meta-taggen
vinner over den i en kjørende nettleser. Begrunnelsen står i fila.

## 10. Sport-ikonene

Ingen endring var nødvendig, og konverteringen rørte dem aldri. I appen tvinges
PNG-ene til ren `#FF4500` med CSS-filter — oransje er fredet. `StyrkeIcon`,
`SkytingIcon` og `nav-icons` er SVG med `currentColor`, altså samme mønster som
logoen. På landingssida står PNG-ene ufiltrert med kun drop-shadow, og en PNG
speiles ikke av et tema.

Den ekte feilen lå under ikonet: `.dtile` er foto-fliser, én per sport, og
bildeteksten `.dcap` brukte `var(--hvit)` som flippet til svart på fotoet.
Samme feil som heroen, i en seksjon som ikke lå inne i `.hero`. Løst ved å legge
`.dtile` til den eksisterende fredningsregelen — null nye filer, null nye tokens.

---

# To feil funnet underveis

## A. Jeg korrumperte `public/xpulse.html`

Konverteringsskriptet maskerer `:root`-blokker, kommentarer og `<script>` for å
la dem stå urørt. Når en kommentar ligger **inne i** et script, ble kommentaren
maskert først og scriptet etterpå — og gjenopprettingen gikk i stigende
rekkefølge, så den ytre masken skrev den indre markøren tilbake etter at den var
behandlet. To NUL-bytes og en tapt kommentar.

Det skjulte seg godt: NUL gjør at `grep` leser fila som binær og tier helt, så
et søk etter «hero» ga null treff i en fil full av dem. Reparert i `2a46ac1`.

## B. Flater på fotografi ble uleselige i lysmodus

Heroen på landingssida ligger på et bilde, nav-en på sin egen mørke gradient, og
`SportPageHero` på hardkodede overlegg. Ingen av dem blir lysere i lysmodus, men
forgrunnen fulgte temaet og ble svart på mørkt. H1 forsvant helt.

Løst med ditt eget prinsipp fra Strava-blekket: bundet til bunnen, altså fredet.
`.hero` + `nav` i xpulse.html, og klassen `.xp-paa-foto` i globals.css som
`SportPageHero` setter kun når `backgroundImage` er satt.

**To CSS-feller måtte løses først:**

1. `color` må settes **eksplisitt**. Barn uten egen `color` arver den ferdig
   utregnede fargen fra forelderen, ikke variabelen. Å frede tokenene alene lot
   h1 stå svart.
2. Alias-tokens (`--white: var(--paper)`) løses opp på `:root` og arves ferdig
   utregnet. Å frede `--paper` hjelper ikke — aliaset må fredes selv.

---

# Fortsatt åpent

## 1. De tonede flatene

Ti verdier med fargestikk står urørt i begge tema:
`#0F121A` `#161A22` `#14110A` `#100F0A` `#1A1410` `#17110C` `#1A2418` `#241A24`
`#1A1218` `#1E2A22`

De grønne og gule ser ut som status-bakgrunner. På en lys flate vil de fortsatt
være mørke firkanter. De trenger egne lysvarianter, men å speile dem ville snudd
stikket — en grønn flate blir rosa. Dette er en designjobb, ikke en mekanisk.

## 2. Kontrasten er allerede lav i mørk modus

`#555560` (544 treff, den dempede teksten) har **2,7:1** mot bunnflata i dag.
WCAG AA krever 4,5:1. Speilingen gir 2,4:1 i lys — like lavt, ikke lavere.
Lysmodus gjør det ikke verre, men det blir lettere å se.

## 3. `var(--surface, var(--card))`

`KonkurransePanel.tsx` og `TestPRInputForm.tsx` bruker `--surface`, som ikke
finnes i globals.css — den er et landingsside-token. Fallbacken til `--card`
gjør at det virker i begge tema, så ingenting er brukket. Men den er eldre enn
dette arbeidet og bør ryddes.

## 4. Ikke visuelt verifisert

Jeg har verifisert i nettleser: landingssida (hero, app-mockupene, sport-flisene),
`/funksjoner/trener` og `/vilkar`, i begge tema. **De innloggede flatene har jeg
ikke sett** — de krever pålogging. Hjem, dagbok og analysesidene med grafer må du
se på selv, og det er den runden `TEMA_FOLG_OS` venter på.
