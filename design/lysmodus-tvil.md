# Lysmodus — tvilslogg fra steg 1

Skrevet 2026-08-26. Regel 2 sier stopp-og-logg framfor gjetting. Under står alt jeg
ikke kunne avgjøre selv, sortert etter hvor mye det blokkerer steg 2.

Ingenting her er endret i koden. Kartleggingen ligger i `lysmodus-kartlegging.md`.

---

## 1. `globals.css` har to konkurrerende `:root`-sett — BLOKKERER

`app/globals.css` definerer nøytraler to steder, med ulike verdier for samme rolle:

| Rolle | Linje 118-sett | Linje 321-sett |
|---|---|---|
| Bunnflate | `--bg-primary: #0A0A0B` | — |
| Kortflate | `--bg-card: #1A1A22` | `--card: #101014` |
| Kort nivå 2 | `--bg-elevated: #1C1C21` | `--card2: #15151B` |
| Kant | `--border: #222228` | `--line: #1F1F26` |
| Sterk tekst | `--text-primary: #F0F0F2` | `--ink: #F2F2F0` |
| Sekundær tekst | `--text-secondary: #8A8A96` | `--mut: #8B8B95` |
| Dempet tekst | `--text-muted: #55555F` | `--dim: #5A5A64` |

Begge er i bruk. Steg 2 kan ikke velge «riktig» token uten at du sier hvilket sett som
er fasit — eller om begge skal leve videre som to lag med hver sin lysvariant.

**Mitt forslag:** begge lever videre uendret i mørk modus (vakt 1), og begge får
lysvarianter. Sammenslåing er en egen opprydding etter at lysmodus står.

## 2. `--dim` og `--gold` betyr to forskjellige ting — BLOKKERER

| Token | `globals.css` | `public/xpulse.html` |
|---|---|---|
| `--dim` | `#5A5A64` | `#8B8B95` |
| `--gold` | `#F5C542` | `#E8B93C` |

Prompten oppgir `--dim #8B8B95` og `--gold #E8B93C` som fasit — det er `xpulse.html`
sine verdier. `globals.css` avviker på begge.

`--dim` er nøytral og min sak: én av dem må endre navn, ellers gjør steg 2 samme
konvertering til to ulike resultater avhengig av hvilken fil komponenten treffes fra.

`--gold` er en **farge** og dermed fredet — jeg har ikke rørt den. Men den er ulik i
de to filene, og det bør noen se på uavhengig av lysmodus.

## 3. `#1E1E22` — avgjort, sier ifra

266 treff i kode, 1 i CSS. Ligger ikke i noe `:root`. Ligger 1 steg fra `--line`
(`#1F1F26`, 17 treff).

**Jeg valgte eget token: `--kant-3`.** To grunner. Vakt 1 forbyr sammenslåing, og
`#1E1E22` er brukt 15× oftere enn `#1F1F26` — det er `--line` som ser ut som avviket
her, ikke omvendt. Å mappe det mest brukte inn i det minst brukte hadde vært å velge
side i en strid du ikke har tatt stilling til.

## 4. VAKT 2 — alle datafargene jeg fant

Du ba om å få rapportert alle av samme mønster som `COLOR_TOTAL`, også de i tvil.
Dette er nøytraler som **betyr noe i dataene** og ikke skal følge temaet mekanisk.

**Sikre datafarger — trenger egen lysvariant, ikke tematoken:**

| Sted | Verdi | Hva den betyr |
|---|---|---|
| `analysis/SkytingSummaryCards.tsx:20` | `COLOR_TOTAL = #F0F0F2` | skytingens «begge/total» — den kjente |
| `analysis/BelastningTab.tsx:21` | `COLOR_TSS_AVG = #F0F0F2` | 7-dagers snitt-linja i grafen |
| `analysis/CustomBreakdownChart.tsx:39` | `FALLBACK_NON_ENDURANCE = #7A7A84` | seriefarge for ikke-utholdenhet |
| `oversikt/UkensTotaler.tsx:24` | `#8A8A96` | «flat» trend — står side om side med grønn og rød |
| `workout/WorkoutDeepAnalysis.tsx:232` | `#8A8A96` | fallback når sonen er ukjent |
| `analysis/TesterPRTab.tsx:130` | `#8A8A96` | «ikke koblet»-tilstand mot TEST_BLUE |
| `abonnement/page.tsx:47` | `#8A8A96` | ukjent abonnementsstatus |
| `workout/LapTable.tsx:167` | `#1A1A22` + `#8A8A96` | chip for ukjent lap-type |
| `focus/FocusSection.tsx:24` | `ACCENT_EMPTY = #1E1E22` | «tom» ved siden av ekte aksenter |

**I tvil — du bør se på disse selv:**

- `klokkesync/KlokkesyncBrandPicker.tsx:149` — `live ? '#0A0A0B' : '#555560'`. Dette er
  blekk **på en merkefarge**, ikke på temaflata. Strava-oransje er like oransje i lys
  modus, så svart blekk skal bli værende svart. Speiles det, blir det hvitt på oransje.
  Nøytral i form, men merkefarge i funksjon.
- `calendar/Calendar.tsx:1509` og `periodization/MonthFullCalendar.tsx:127` — `#2A2A30`
  som fallback når uka ikke har periodiseringsintensitet. Nabo til de fredede
  periodiseringsfargene. Tema eller data?
- `coach/trener-kalender/TrenerKalender.tsx:17` — `NOTE_GRAY = #C0C0CC`. Navnet sier
  data, bruken ser ut som tema.
- `branding/XPulseIcon.tsx:19` — `HVIT = '#FFFFFF'`. Se punkt 6.

**Trygge tematokens** (verifisert, tar jeg i steg 2 uten å spørre): `CHART_GRID`,
`CHART_GRID_ZERO`, `CHART_AXIS_LINE`, `GRID_COLOR`, `Calendar.tsx:1105` sin
bakgrunnstrio, tekstfargen i `CustomBreakdownChart.tsx:157`.

## 5. `#6E6E78` er både tekstfarge og fredet sonefarge

12 treff som tekstfarge. Samtidig er `#6E6E78` **Styrke-fargen i `ZONE_COLORS_V2`**,
som er fredet i begge tema.

Verdien må splittes i to: sonefargen står urørt, tekstbruken blir `--tekst-7`. Jeg har
ikke sjekket hvert av de 12 treffene ennå — det hører til steg 2, og jeg gjør det ikke
uten at du har sett at problemet finnes.

## 6. Logoen — VAKT 3

Det finnes **ingen fil med svart midtstrek** i `public/logo/`. Varianten du beskriver
er ikke laget.

Men `public/logo/xpulse-logo-currentcolor.svg` finnes, og alle tre formene i den bruker
`fill="currentColor"`. Den løser vakt 3 på ett sted: sett `color` på en forelder, og
midtstreken følger temaet uten en eneste betingelse per komponent.

**Jeg trenger å vite:** skal jeg bruke `currentColor`-fila, eller vil du at det lages
en egen SVG med svart strek? Ingen komponent refererer til noen av logofilene ved navn
i dag, så begge veier er åpne.

## 7. Hull i kartleggingen jeg fant til slutt

Skanneren min krevde 6-sifret hex. Disse er derfor **ikke** med blant de 70:

| Form | Antall | Merknad |
|---|---|---|
| 3-sifret hex | 43 | `#FFF` 31, `#555` 6, `#444` 3, `#333` 2, `#777` 1 |
| `rgba(0,0,0,·)` | 56 | mest modal-scrim og skygge |
| `rgba(255,255,255,·)` | 2 | |

`#444` i `workout/WorkoutCard.tsx:18` er kanten på planlagte økter — den er 3-sifret og
slapp unna hele kartleggingen.

Scrims og skygger er egen sak: en modal-scrim er svart i begge tema, men en fade som
ligger over en kortflate må snu. Jeg har ikke klassifisert alle 56.

## 8. Halen: 30 verdier med 1–3 treff

Av de 70 nøytralene har 30 stykker 1–3 treff. De ligger typisk 1–2 steg fra en verdi
som brukes hundrevis av ganger — `#0A0A0C` (1 treff) mot `#0A0A0B` (166), `#141419`
(1) mot `#14141A` (19).

Dette er drift, ikke design. Men vakt 1 er tydelig, så jeg har gitt hver av dem sitt
eget token og lar det være med det.

**Spørsmålet er ditt:** skal halen slås inn i nærmeste nabo i steg 2? Det ville tatt
token-tallet fra 70 til rundt 40 og gjort resten av jobben vesentlig lettere å lese.
Mørk modus blir da ikke pikselidentisk — den blir 1–2 verdier unna på ~60 steder.

## 9. Tonede flater — holdt utenfor med vilje

Ti verdier ser nøytrale ut i en liste, men har fargestikk:

`#0F121A` `#161A22` `#14110A` `#100F0A` `#1A1410` `#17110C` `#1A2418` `#241A24`
`#1A1218` `#1E2A22`

De grønne og gule ser ut som status-bakgrunner (medhold/varsel). Speiling ville snudd
stikket og gjort en grønn flate rosa. Jeg har latt dem stå helt urørt.

## 10. Kontrasten er allerede lav i mørk modus

Ikke en tvil, men noe du bør vite før du ser på lysmodus og tror jeg har ødelagt noe.

`#555560` (544 treff, den dempede teksten) har **2,7:1** mot bunnflata i mørk modus i
dag. WCAG AA krever 4,5:1. Speilingen gir 2,4:1 i lys — altså like lavt, ikke lavere.

Lysmodus gjør ikke dette verre. Men det er lettere å se i lys modus, og det kommer nok
til å se ut som en ny feil når det egentlig er en gammel.

## 11. `prefers-color-scheme` er skrudd av med vilje

Bryteren er bygget, men lys modus slår **kun** inn når du velger den selv
(`data-tema="lys"`). Automatikken etter operativsystemet ligger klar bak flagget
`TEMA_FOLG_OS`, satt til `false`.

Grunnen: steg 2 er ikke gjort. Slo automatikken inn nå, ville alle med lyst OS fått en
halvkonvertert flate — 3 500 hardkodede hex-verdier står fortsatt mørke. Flagget settes
til `true` når bulk-konverteringen er ferdig.
