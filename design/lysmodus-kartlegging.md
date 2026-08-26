# Lysmodus - steg 1: kartlegging av nøytralverdiene

Generert 2026-08-26. **Ingen inline-hex er rørt.** Kartleggingen er leveransen.

Treffene under er talt *før* tokenstillaset ble lagt inn i `globals.css` og
`xpulse.html`. Teller du på nytt i dag, får du ~140 flere treff i CSS — det er
stillaset som teller seg selv, ikke ny drift.

## Kort fasit

| | |
|---|---|
| Nøytrale verdier funnet | **70** (ikke ~15) |
| Treff totalt | **3563** |
| Skannet | `app/`, `components/`, `lib/` (.ts/.tsx) + `app/`, `public/`, `components/` (.css/.html) |
| Tonede flater holdt utenfor | 10 (se tvilsfila) |

Nøytral = maks kanalspenn <= 12 (gråtoner og de svakt blåtonede gråene). Fargene i
fargefasiten - sone, skyting, merke, periodisering - er ikke med i det hele tatt.

### Hvorfor 70 og ikke 15

De 15 du husker er de som ligger i `:root` i dag. Resten er inline-hex som har drevet
fra dem over tid. Fordelingen er ekstremt skjev: **7 verdier dekker 77 % av alle
treff**, mens 30 verdier har 1-3 treff hver. Halen er nesten helt sikkert drift, ikke
design - men vakt 1 sier at jeg ikke slår dem sammen på eget initiativ. Alle står
derfor som egne tokens med sin egen mørkverdi, og halen er ført opp som spørsmål i
tvilsfila.

## Slik er lysverdiene regnet ut

Mekanisk, ikke håndplukket: **samme nyanse og metning, lyshet speilet** (L -> 1-L i HSL).
Det gir to ting som er verdt mer enn et pent øye:

1. Regelen er reproduserbar - du kan regne etter og se at jeg ikke har gjettet.
2. Kontrastforholdene fra mørk modus overlever nesten uendret (kolonnen under). Der
   designet allerede er svakt i mørk modus, blir det like svakt i lys - ikke verre.

Kontrast er målt mot bunnflata i hvert tema: `#0A0A0B` i mørk, `#F4F4F5` i lys.

## Tekst (24 tokens, 2553 treff)

Sortert lysest -> mørkest i mørk modus.

| Token | Mørk | Lys | Treff kode | Treff CSS | Kontrast m/l | Hvor og hva |
|---|---|---|---:|---:|---|---|
| `--tekst-1` | `#F2F2F0` | `#0F0F0D` | 46 | 2 | 17.7 / 17.5 | workout(23), analysis(12), oversikt(8), landing(1) - *xpulse --paper / globals --ink* |
| `--tekst-1-app` | `#F0F0F2` | `#0D0D0F` | 782 | 3 | 17.4 / 17.7 | analysis(189), coach(160), workout(77), klokkesync(41) - *globals --text-primary — appens dominerende* |
| `--tekst-1-land` | `#F2F0EC` | `#13110D` | 28 | 4 | 17.4 / 17.2 | landing(18), funksjoner(9), app(3), layout(1) - *landingsflatene* |
| `--tekst-1-ren` | `#FFFFFF` | `#000000` | 25 | 6 | 19.8 / 19.1 | public(6), periodization(5), klokkesync(5), app(4) - *ren hvit* |
| `--tekst-2` | `#DEDEE6` | `#191921` | 2 | 0 | 14.8 / 15.9 | calendar(1), coach(1) |
| `--tekst-3` | `#C9C9D4` | `#2B2B36` | 6 | 0 | 12.1 / 12.7 | calendar(4), oversikt(1), workout(1) |
| `--tekst-3-alt` | `#C9C9CE` | `#313136` | 2 | 0 | 12.0 / 11.8 | ui(1), pwa(1) |
| `--tekst-3-app` | `#C0C0CC` | `#33333F` | 66 | 0 | 11.0 / 11.3 | workout(22), analysis(12), coach(9), settings(5) |
| `--tekst-3-fok` | `#C0C0C8` | `#37373F` | 1 | 0 | 10.9 / 10.7 | focus(1) |
| `--tekst-4` | `#B0B0B8` | `#47474F` | 3 | 0 | 9.2 / 8.4 | layout(3) |
| `--tekst-4-kal` | `#A9A9B5` | `#4A4A56` | 10 | 0 | 8.5 / 7.9 | calendar(10) - *kun kalenderen* |
| `--tekst-4-alt` | `#A0A0AC` | `#53535F` | 2 | 0 | 7.7 / 6.9 | workout(2) |
| `--tekst-5` | `#8B8B95` | `#6A6A74` | 93 | 7 | 5.9 / 4.9 | workout(40), analysis(18), oversikt(14), calendar(9) - *xpulse --dim / globals --mut* |
| `--tekst-5-app` | `#8A8A96` | `#696975` | 748 | 10 | 5.8 / 4.9 | analysis(167), coach(148), workout(82), equipment(44) - *globals --text-secondary — appens dominerende* |
| `--tekst-6` | `#7A7A84` | `#7B7B85` | 1 | 0 | 4.7 / 3.8 | analysis(1) |
| `--tekst-6-graa` | `#6A6A6A` | `#959595` | 1 | 0 | 3.7 / 2.7 | analysis(1) - *ekte gra, ingen blatone* |
| `--tekst-7` | `#6E6E78` | `#878791` | 12 | 0 | 3.9 / 3.2 | calendar(3), analysis(3), landing(2), workout(2) - *OBS: identisk med Styrke-sonefargen — se tvilsfil* |
| `--tekst-8` | `#5A5A64` | `#9B9BA5` | 0 | 1 | 2.9 / 2.5 | app(1) - *globals --dim* |
| `--tekst-8-alt` | `#55555F` | `#A0A0AA` | 112 | 8 | 2.7 / 2.4 | workout(43), oversikt(12), calendar(12), periodization(8) - *xpulse --mute / globals --text-muted* |
| `--tekst-8-app` | `#555560` | `#9F9FAA` | 543 | 1 | 2.7 / 2.4 | analysis(166), coach(104), workout(88), equipment(42) - *appens dominerende dempede* |
| `--tekst-9` | `#4A4A54` | `#ABABB5` | 0 | 2 | 2.3 / 2.1 | public(2) |
| `--tekst-9-graa` | `#4A4A4A` | `#B5B5B5` | 2 | 0 | 2.2 / 1.9 | lib(2) - *ekte gra, kun lib/* |
| `--tekst-10` | `#3A3A44` | `#BBBBC5` | 13 | 5 | 1.8 / 1.7 | public(5), analysis(4), workout(4), calendar(2) |
| `--tekst-10-alt` | `#3A3A42` | `#BDBDC5` | 6 | 0 | 1.8 / 1.7 | coach(2), workout(2), calendar(1), equipment(1) |

## Kanter (14 tokens, 562 treff)

Sortert mørkest -> lysest.

| Token | Mørk | Lys | Treff kode | Treff CSS | Kontrast m/l | Hvor og hva |
|---|---|---|---:|---:|---|---|
| `--kant-1` | `#141417` | `#E8E8EB` | 1 | 1 | 1.1 / 1.1 | layout(1), public(1) |
| `--kant-1-alt` | `#141419` | `#E6E6EB` | 0 | 1 | 1.1 / 1.1 | public(1) |
| `--kant-1-app` | `#14141A` | `#E5E5EB` | 14 | 5 | 1.1 / 1.1 | workout(5), public(5), calendar(3), analysis(3) |
| `--kant-2` | `#1A1A1E` | `#E1E1E5` | 48 | 2 | 1.1 / 1.2 | calendar(11), settings(8), funksjoner(5), landing(5) |
| `--kant-2-alt` | `#1A1A1F` | `#E0E0E5` | 1 | 0 | 1.1 / 1.2 | settings(1) |
| `--kant-3` | `#1E1E22` | `#DDDDE1` | 266 | 1 | 1.2 / 1.2 | analysis(112), workout(45), periodization(23), equipment(16) - *appens dominerende kant* |
| `--kant-3-alt` | `#1F1F26` | `#D9D9E0` | 13 | 4 | 1.2 / 1.3 | analysis(5), workout(5), public(3), landing(2) - *xpulse --line* |
| `--kant-4` | `#222228` | `#D7D7DD` | 39 | 1 | 1.3 / 1.3 | coach(20), workout(10), app(5), components(3) - *globals --border* |
| `--kant-4-alt` | `#22222A` | `#D5D5DD` | 0 | 1 | 1.3 / 1.3 | public(1) |
| `--kant-5` | `#262629` | `#D6D6D9` | 58 | 1 | 1.3 / 1.3 | settings(23), landing(11), workout(8), funksjoner(4) |
| `--kant-6` | `#2A2A30` | `#CFCFD5` | 41 | 7 | 1.4 / 1.4 | periodization(7), public(7), klokkesync(6), workout(5) |
| `--kant-6-alt` | `#2A2A32` | `#CDCDD5` | 2 | 0 | 1.4 / 1.4 | coach(1), periodization(1) |
| `--kant-6-app` | `#2A2A33` | `#CCCCD5` | 44 | 5 | 1.4 / 1.5 | analysis(10), workout(9), equipment(9), seats(5) - *xpulse --line2* |
| `--kant-7` | `#34343E` | `#C1C1CB` | 3 | 3 | 1.6 / 1.6 | landing(3), public(3) |

## Flater (32 tokens, 448 treff)

Bakgrunner, sortert mørkest -> lysest i mørk modus.

| Token | Mørk | Lys | Treff kode | Treff CSS | Kontrast m/l | Hvor og hva |
|---|---|---|---:|---:|---|---|
| `--flate-1` | `#060607` | `#F8F8F9` | 2 | 0 | 1.0 / 1.0 | landing(2) |
| `--flate-2` | `#09090B` | `#F4F4F6` | 1 | 0 | 1.0 / 1.0 | coach(1) |
| `--flate-2-alt` | `#09090C` | `#F3F3F6` | 0 | 2 | 1.0 / 1.0 | public(2) |
| `--flate-3` | `#0A0A0B` | `#F4F4F5` | 163 | 3 | 1.0 / 1.0 | app(40), analysis(37), workout(21), coach(19) - *globals --bg-primary — appens dominerende bunn* |
| `--flate-3-alt` | `#0A0A0C` | `#F3F3F5` | 1 | 0 | 1.0 / 1.0 | oversikt(1) |
| `--flate-3-b` | `#0A0A0D` | `#F2F2F5` | 2 | 3 | 1.0 / 1.0 | public(3), landing(1), workout(1) |
| `--flate-4` | `#0B0B0D` | `#F2F2F4` | 1 | 0 | 1.0 / 1.0 | search(1) |
| `--flate-4-alt` | `#0B0B0F` | `#F0F0F4` | 6 | 1 | 1.0 / 1.0 | seats(2), equipment(2), landing(1), calendar(1) |
| `--flate-5` | `#0C0C0F` | `#F0F0F3` | 9 | 0 | 1.0 / 1.0 | analysis(7), calendar(2) |
| `--flate-6` | `#0D0D10` | `#EFEFF2` | 1 | 0 | 1.0 / 1.0 | analysis(1) |
| `--flate-6-alt` | `#0D0D11` | `#EEEEF2` | 20 | 5 | 1.0 / 1.1 | analysis(6), coach(5), calendar(4), public(4) - *xpulse --bg* |
| `--flate-6-b` | `#0D0D14` | `#EBEBF2` | 4 | 0 | 1.0 / 1.1 | calendar(2), periodization(2) |
| `--flate-7` | `#0E0E10` | `#EFEFF1` | 10 | 0 | 1.0 / 1.0 | settings(5), inbox(2), coach(2), search(1) |
| `--flate-7-alt` | `#0E0E12` | `#EDEDF1` | 7 | 2 | 1.0 / 1.1 | workout(3), calendar(2), app(2), analysis(1) |
| `--flate-8` | `#0F0F11` | `#EEEEF0` | 3 | 0 | 1.0 / 1.1 | pace(3) |
| `--flate-8-alt` | `#0F0F12` | `#EDEDF0` | 19 | 0 | 1.0 / 1.1 | equipment(11), analysis(3), settings(2), seats(1) |
| `--flate-8-b` | `#0F0F14` | `#EBEBF0` | 14 | 0 | 1.0 / 1.1 | klokkesync(8), workout(4), coach(2) |
| `--flate-8-c` | `#0F0F16` | `#E9E9F0` | 3 | 0 | 1.0 / 1.1 | calendar(2), klokkesync(1) |
| `--flate-9` | `#101014` | `#EBEBEF` | 13 | 4 | 1.0 / 1.1 | workout(8), public(3), seats(2), landing(1) - *xpulse --surface / globals --card* |
| `--flate-10` | `#111113` | `#ECECEE` | 3 | 1 | 1.0 / 1.1 | landing(3), public(1) - *xpulse --mid* |
| `--flate-10-alt` | `#111115` | `#EAEAEE` | 1 | 0 | 1.1 / 1.1 | workout(1) |
| `--flate-11` | `#121216` | `#E9E9ED` | 0 | 1 | 1.1 / 1.1 | public(1) |
| `--flate-11-alt` | `#121218` | `#E7E7ED` | 3 | 0 | 1.1 / 1.1 | app(2), calendar(1) |
| `--flate-11-b` | `#12121A` | `#E5E5ED` | 1 | 1 | 1.1 / 1.1 | landing(1), public(1) |
| `--flate-12` | `#131318` | `#E7E7EC` | 5 | 2 | 1.1 / 1.1 | workout(3), calendar(2), app(2) |
| `--flate-12-alt` | `#13131A` | `#E5E5EC` | 43 | 1 | 1.1 / 1.1 | analysis(13), workout(10), api(5), app(3) - *globals --bg-secondary* |
| `--flate-13` | `#15151A` | `#E5E5EA` | 1 | 0 | 1.1 / 1.1 | analysis(1) |
| `--flate-13-alt` | `#15151B` | `#E4E4EA` | 1 | 3 | 1.1 / 1.2 | public(2), oversikt(1), app(1) - *globals --card2 / xpulse --card* |
| `--flate-14` | `#1A1A22` | `#DDDDE5` | 69 | 1 | 1.1 / 1.2 | analysis(18), workout(12), calendar(11), periodization(10) - *globals --bg-card* |
| `--flate-15` | `#1C1C21` | `#DEDEE3` | 3 | 1 | 1.2 / 1.2 | app(3), components(1) - *globals --bg-elevated* |
| `--flate-16` | `#1E1E26` | `#D9D9E1` | 3 | 2 | 1.2 / 1.3 | equipment(2), public(2), landing(1) |
| `--flate-17` | `#26262E` | `#D1D1D9` | 2 | 1 | 1.3 / 1.4 | oversikt(1), periodization(1), public(1) |

## De sju som bærer flata

Konverterer du bare disse i steg 2, er 77 % av jobben gjort:

| Token | Hex | Treff | Rolle |
|---|---|---:|---|
| `--tekst-1-app` | `#F0F0F2` | 785 | tekst |
| `--tekst-5-app` | `#8A8A96` | 758 | tekst |
| `--tekst-8-app` | `#555560` | 544 | tekst |
| `--kant-3` | `#1E1E22` | 267 | kant |
| `--flate-3` | `#0A0A0B` | 166 | bakgrunn |
| `--tekst-8-alt` | `#55555F` | 120 | tekst |
| `--tekst-5` | `#8B8B95` | 100 | tekst |

## Hva som IKKE er med

- **Fargefasiten.** Sone-, skyting-, merke- og periodiseringsfarger er ikke skannet,
  ikke tokenisert, ikke rørt. De gjelder i begge tema.
- **Tonede flater** (10 stk). De ser nøytrale ut i en liste, men har
  fargestikk og er antakelig bevisste status-bakgrunner. Speiling ville snudd stikket.
- **`design/`-mappa.** Rene referansefiler, ikke prod.
- **Favicons og eksterne flater** (Stripe, IG, e-post). Ikke tema-avhengige.

Se `lysmodus-tvil.md` for sporsmalene som må besvares før bulk-konverteringen.
