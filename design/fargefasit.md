# X-Pulse fargefasit - alle fargekoder

Hentet 13. sep 2026 fra `app/globals.css`, `public/xpulse.html`, `lib/activity-summary.ts`,
`lib/segmenter.ts`, `lib/status-farger.ts`, `lib/helse-farger.ts`. Repoet er fasiten -
står det noe annet i en designfil, vinner koden.

---

## 1. Aksentene - FREDET, samme hex i lys og mørk modus

| Rolle | Variabel | Hex |
|---|---|---|
| Oransje (utøver-aksent) | `--orange` | `#FF4500` |
| Oransje, myk flate | `--orange-soft` | `rgba(255,69,0,.12)` |
| Oransje 45 % | `--accent-45` | `rgba(255,69,0,.45)` |
| Oransje 50 % | `--accent-50` | `rgba(255,69,0,.5)` |
| Oransje, mørk (forsiden) | `--orange-dark` | `#CC3700` |
| Blå (trener-aksent) | `--blue` | `#1A6FD4` |
| Blå, myk flate | `--blue-soft` | `rgba(26,111,212,.10)` |
| Grønn | `--green` | `#28A86E` |
| Grønn, myk flate | `--green-soft` | `rgba(40,168,110,.12)` |
| **Gull** | `--gold` | **`#D4A017`** |
| Rød (forsiden) | `--red` | `#E23A5A` |

`--accent` er oransje som standard og bytter til blå inne i `.xp-coach` (trenerpanelet).
Bruk alltid `--accent`, aldri `--orange` direkte, i flater som finnes i begge roller.

**Gull - besluttet 13. sep: `#D4A017`, én verdi for hele siden.** Tidligere sto tre
toner samtidig: `#F5C542` (globals), `#E8B93C` (forsiden), `#D4A017` (status og
konkurranse). `#E8B93C` var diskvalifisert fordi den er sone I3 og samtidig appens gule
dataserie (laktat, vekt, HRV-gul, maks vekt, terskelprofil, PR-merket, medium-periode -
15 hardkodede steder). `#F5C542` har kontrast 1,48 mot lys bunn og er uleselig i
lysmodus. `#D4A017` gir 2,16 mot lys bunn og 8,33 mot mørk, og ligger nærmest metallisk
gull av de brukbare (ΔE2000 5,4 mot `#D4AF37`). En varmere hue ble testet og ble verre.
Merk: `#D4A017` er også STATUS_GUL, så «følg med» og konkurranse deler farge - det var
allerede tilfellet i `lib/status-farger.ts`.
De 15 stedene som bruker `#E8B93C` er GULE, ikke gull, og skal ikke endres.

---

## 2. Intensitetssonene - fasit i `lib/activity-summary.ts` (ZONE_COLORS_V2)

| Sone | Hex | Merknad |
|---|---|---|
| I1 | `#28A86E` | grønn, alltid |
| I2 | `#1A6FD4` | blå, alltid |
| I3 | `#E8B93C` | |
| I4 | `#FF8C00` | |
| I5 | `#E23A5A` | |
| I6 | `#7C3AED` | fase 111, CVD-validert |
| I7 | `#E879F9` | |
| I8 | `#881337` | |
| Hurtighet | `#8B5CF6` | lilla, skilles fra I1-I5 |

CSS-kopien `--i1`..`--i8` og `--hurt` i `app/globals.css` er en nødvendig andrekopi
(CSS kan ikke importere TypeScript). Endres den ene, må den andre endres i samme commit.
I6-fiolett ligger bevisst nær Hurtighet-lilla - trygt kun fordi de aldri står på samme
flate. En framtidig flate med begge må revurdere fargene der.

---

## 3. Segmentfargene - `lib/segmenter.ts` (aktivitetstype, ALDRI sonefarge)

| Segment | Hex |
|---|---|
| Oppvarming | `#BBAA55` |
| Drag | `#1E2AA8` |
| Nedjogg | `#64748B` |
| Pause | `#43434B` |
| Veksling | `#43434B` + diagonale striper |
| Bevegelsesform | `#A6A6AF` |
| Annet | `#A6A6AF` |
| Skyting (ligg/stå/annet) | `#43434B` |

Skyting har ikke farge på tidslinja - en farget blokk leses som en sone. Den er et
nøytralt lavt mellomrom i pausefargen med 🎯-markør over.

**Skytefargene** (kun i skytefanen og treff-plottet, aldri på tidslinja):
ligg `#38BDF8` · stå `#FF4500`.

---

## 4. Statusfargene - `lib/status-farger.ts`

| Rolle | Hex |
|---|---|
| Grønn: på plan / uthvilt / god treff-% | `#28A86E` |
| Gul: følg med | `#D4A017` |
| Rød: for lite / for mye / ingen logging | `#E11D48` |
| Gull: konkurranse | `#D4A017` |
| Blå: trener | `#1A6FD4` |

«% av plan»-skalaen: under 60 rød · 60-84 gul · 85-105 grønn · over 105 oransje.
Baren går til 130 %.

---

## 5. Helsefargene - `lib/helse-farger.ts`

Søvnstadier: dyp `#1A6FD4` · lett `#38BDF8` · REM `#8B5CF6` · våken `#E8B93C`.
Krever 2 px gap og legend - det er forutsetning for CVD-valideringen, ikke pynt.

Trender: HRV `#8B5CF6` · hvilepuls `#E23A5A` · søvnscore `#1A6FD4`.

Fargede verdier er uendret i lys og mørk modus - kun nøytralene bytter tema.

---

## 6. Merkefarger

Strava `#FC5200` · Polar `#E4002B`. Brukes kun i merkets egen kontekst.

---

## 7. Nøytralene - `app/globals.css`, mørk og lys

### Tekst

| Variabel | Mørk | Lys |
|---|---|---|
| `--tekst-1` | `#F2F2F0` | `#0F0F0D` |
| `--tekst-1-app` | `#F0F0F2` | `#0D0D0F` |
| `--tekst-1-land` | `#F2F0EC` | `#13110D` |
| `--tekst-1-ren` | `#FFFFFF` | `#000000` |
| `--tekst-2` | `#DEDEE6` | `#191921` |
| `--tekst-3` | `#C9C9D4` | `#2B2B36` |
| `--tekst-3-alt` | `#C9C9CE` | `#313136` |
| `--tekst-3-app` | `#C0C0CC` | `#33333F` |
| `--tekst-3-fok` | `#C0C0C8` | `#37373F` |
| `--tekst-4` | `#B0B0B8` | `#47474F` |
| `--tekst-4-kal` | `#A9A9B5` | `#4A4A56` |
| `--tekst-4-alt` | `#A0A0AC` | `#53535F` |
| `--tekst-5` | `#8B8B95` | `#6A6A74` |
| `--tekst-5-app` | `#8A8A96` | `#696975` |
| `--tekst-6` | `#7A7A84` | `#7B7B85` |
| `--tekst-6-graa` | `#6A6A6A` | `#959595` |
| `--tekst-7` | `#6E6E78` | `#878791` |
| `--tekst-8` | `#5A5A64` | `#9B9BA5` |
| `--tekst-8-alt` | `#55555F` | `#A0A0AA` |
| `--tekst-8-app` | `#555560` | `#9F9FAA` |
| `--tekst-9` | `#4A4A54` | `#ABABB5` |
| `--tekst-9-graa` | `#4A4A4A` | `#B5B5B5` |
| `--tekst-10` | `#3A3A44` | `#BBBBC5` |
| `--tekst-10-alt` | `#3A3A42` | `#BDBDC5` |

`--tekst-7` er identisk med Styrke-sonefargen - står i tvilsfila.

### Kanter

| Variabel | Mørk | Lys |
|---|---|---|
| `--kant-1` | `#141417` | `#E8E8EB` |
| `--kant-1-alt` | `#141419` | `#E6E6EB` |
| `--kant-1-app` | `#14141A` | `#E5E5EB` |
| `--kant-2` | `#1A1A1E` | `#E1E1E5` |
| `--kant-2-alt` | `#1A1A1F` | `#E0E0E5` |
| `--kant-3` | `#1E1E22` | `#DDDDE1` |
| `--kant-3-alt` | `#1F1F26` | `#D9D9E0` |
| `--kant-4` | `#222228` | `#D7D7DD` |
| `--kant-4-alt` | `#22222A` | `#D5D5DD` |
| `--kant-5` | `#262629` | `#D6D6D9` |
| `--kant-6` | `#2A2A30` | `#CFCFD5` |
| `--kant-6-alt` | `#2A2A32` | `#CDCDD5` |
| `--kant-6-app` | `#2A2A33` | `#CCCCD5` |
| `--kant-7` | `#34343E` | `#C1C1CB` |
| `--kant-hover` | `#333340` | `#BFBFCC` |

### Flater

| Variabel | Mørk | Lys |
|---|---|---|
| `--flate-1` | `#060607` | `#F8F8F9` |
| `--flate-2` | `#09090B` | `#F4F4F6` |
| `--flate-2-alt` | `#09090C` | `#F3F3F6` |
| `--flate-3` | `#0A0A0B` | `#F4F4F5` |
| `--flate-3-alt` | `#0A0A0C` | `#F3F3F5` |
| `--flate-3-b` | `#0A0A0D` | `#F2F2F5` |
| `--flate-4` | `#0B0B0D` | `#F2F2F4` |
| `--flate-4-alt` | `#0B0B0F` | `#F0F0F4` |
| `--flate-5` | `#0C0C0F` | `#F0F0F3` |
| `--flate-6` | `#0D0D10` | `#EFEFF2` |
| `--flate-6-alt` | `#0D0D11` | `#EEEEF2` |
| `--flate-6-b` | `#0D0D14` | `#EBEBF2` |
| `--flate-7` | `#0E0E10` | `#EFEFF1` |
| `--flate-7-alt` | `#0E0E12` | `#EDEDF1` |
| `--flate-8` | `#0F0F11` | `#EEEEF0` |
| `--flate-8-alt` | `#0F0F12` | `#EDEDF0` |
| `--flate-8-b` | `#0F0F14` | `#EBEBF0` |
| `--flate-8-c` | `#0F0F16` | `#E9E9F0` |
| `--flate-9` | `#101014` | `#EBEBEF` |
| `--flate-10` | `#111113` | `#ECECEE` |
| `--flate-10-alt` | `#111115` | `#EAEAEE` |
| `--flate-11` | `#121216` | `#E9E9ED` |
| `--flate-11-alt` | `#121218` | `#E7E7ED` |
| `--flate-11-b` | `#12121A` | `#E5E5ED` |
| `--flate-12` | `#131318` | `#E7E7EC` |
| `--flate-12-alt` | `#13131A` | `#E5E5EC` |
| `--flate-13` | `#15151A` | `#E5E5EA` |
| `--flate-13-alt` | `#15151B` | `#E4E4EA` |
| `--flate-14` | `#1A1A22` | `#DDDDE5` |
| `--flate-15` | `#1C1C21` | `#DEDEE3` |
| `--flate-16` | `#1E1E26` | `#D9D9E1` |
| `--flate-17` | `#26262E` | `#D1D1D9` |

App-bakgrunn mørk: `linear-gradient(115deg, rgba(255,69,0,.09), rgba(26,111,212,.09) 70%), #0A0A0B`.
Lys: flat `#F4F4F5`.

### Rene gråtoner

| Variabel | Mørk | Lys |
|---|---|---|
| `--graa-33` | `#333333` | `#CCCCCC` |
| `--graa-44` | `#444444` | `#BBBBBB` |
| `--graa-55` | `#555555` | `#AAAAAA` |
| `--graa-77` | `#777777` | `#888888` |

### Scrim og skygge - egne verdier, ikke speilet

| Variabel | Mørk | Lys |
|---|---|---|
| `--scrim-35` | `rgba(0,0,0,.35)` | `rgba(0,0,0,.19)` |
| `--scrim-60` | `rgba(0,0,0,.6)` | `rgba(0,0,0,.33)` |
| `--scrim-70` | `rgba(0,0,0,.7)` | `rgba(0,0,0,.39)` |
| `--scrim-72` | `rgba(0,0,0,.72)` | `rgba(0,0,0,.40)` |
| `--scrim-75` | `rgba(0,0,0,.75)` | `rgba(0,0,0,.41)` |
| `--scrim-80` | `rgba(0,0,0,.8)` | `rgba(0,0,0,.44)` |
| `--skygge-40` | `rgba(0,0,0,.4)` | `rgba(0,0,0,.09)` |
| `--skygge-50` | `rgba(0,0,0,.5)` | `rgba(0,0,0,.11)` |
| `--skygge-55` | `rgba(0,0,0,.55)` | `rgba(0,0,0,.12)` |
| `--skygge-60` | `rgba(0,0,0,.6)` | `rgba(0,0,0,.13)` |

### Datafarger

| Variabel | Mørk | Lys | Rolle |
|---|---|---|---|
| `--data-total` | `#F0F0F2` | `#0D0D0F` | skytingens «begge/total» |
| `--data-snitt` | `#F0F0F2` | `#0D0D0F` | 7-dagers snitt, belastningsgraf |
| `--data-flat` | `#8A8A96` | `#696975` | trend «flat» |
| `--data-ukjent` | `#8A8A96` | `#696975` | ukjent sone/status/lap |
| `--data-ovrig` | `#7A7A84` | `#7B7B85` | ikke-utholdenhet |
| `--data-tom` | `#1E1E22` | `#DDDDE1` | tom tilstand |
| `--data-notat` | `#C0C0CC` | `#33333F` | notat i trenerkalenderen |
| `--data-nopris` | `#2A2A30` | `#CFCFD5` | uke uten periodiseringsintensitet |

### Tonede flater

| Variabel | Mørk | Lys |
|---|---|---|
| `--tonet-bla-1` | `#0F121A` | `#E5E8F0` |
| `--tonet-bla-2` | `#161A22` | `#DDE1E9` |
| `--tonet-gul` | `#100F0A` | `#F5F4EF` |
| `--tonet-oransje-1` | `#14110A` | `#F5F2EB` |
| `--tonet-oransje-2` | `#1A1410` | `#EFE9E5` |
| `--tonet-oransje-3` | `#17110C` | `#F3EDE8` |
| `--tonet-gronn-1` | `#1A2418` | `#DDE7DB` |
| `--tonet-gronn-2` | `#1E2A22` | `#D5E1D9` |
| `--tonet-lilla-1` | `#241A24` | `#E5DBE5` |
| `--tonet-lilla-2` | `#1A1218` | `#EDE5EB` |

### Halvgjennomsiktige flater

| Variabel | Mørk | Lys |
|---|---|---|
| `--knapp-flate` | `rgba(16,16,20,.9)` | `rgba(235,235,239,.9)` |
| `--knapp-flate-97` | `rgba(16,16,20,.97)` | `rgba(235,235,239,.97)` |
| `--savebar-topp` | `rgba(10,10,11,.98)` | `rgba(244,244,245,.98)` |
| `--savebar-bunn` | `rgba(10,10,11,0)` | `rgba(244,244,245,0)` |
| `--live-topp` | `rgba(14,14,18,.97)` | `rgba(237,237,241,.97)` |
| `--nav-scrim` | `rgba(11,19,21,.75)` | `rgba(234,242,244,.75)` |
| `--logo-strek` | `#FFFFFF` | `#000000` |

### Etablerte kortnavn (1 440 var()-treff)

| Variabel | Mørk | Lys |
|---|---|---|
| `--card` | `#101014` | `#EBEBEF` |
| `--card2` | `#15151B` | `#E4E4EA` |
| `--line` | `#1F1F26` | `#D9D9E0` |
| `--line2` | `#2A2A33` | `#CCCCD5` |
| `--ink` | `#F2F2F0` | `#0F0F0D` |
| `--mut` | `#8B8B95` | `#6A6A74` |
| `--dim` | `#5A5A64` | `#9B9BA5` |

Radius: `--r-field: 10px` · `--r-card: 14px` (forsiden bruker `--r-card: 16px`, `--r-sm: 10px`).

---

## 8. Forsiden - `public/xpulse.html` har sitt eget sett

| Variabel | Mørk | Lys |
|---|---|---|
| `--bg` | `#0D0D11` | `#EEEEF2` |
| `--surface` | `#101014` | `#EBEBEF` |
| `--surface2` | `#1E1E26` | `#D9D9E1` |
| `--card` | `#15151B` | `#E4E4EA` |
| `--paper` | `#F2F2F0` | `#0F0F0D` |
| `--paper2` | `#F2F0EC` | `#13110D` |
| `--hvit` | `#FFFFFF` | `#000000` |
| `--dim` | `#8B8B95` | `#6A6A74` |
| `--dim2` | `#8A8A96` | `#696975` |
| `--mute` | `#55555F` | `#A0A0AA` |
| `--mute2` | `#555560` | `#9F9FAA` |
| `--mute3` | `#4A4A54` | `#ABABB5` |
| `--mute4` | `#3A3A44` | `#BBBBC5` |
| `--line` | `#1F1F26` | `#D9D9E0` |
| `--line2` | `#2A2A33` | `#CCCCD5` |
| `--line3` | `#2A2A30` | `#CFCFD5` |
| `--line4` | `#34343E` | `#C1C1CB` |
| `--line5` | `#26262E` | `#D1D1D9` |
| `--line6` | `#262629` | `#D6D6D9` |
| `--line7` | `#22222A` | `#D5D5DD` |
| `--line8` | `#1A1A1E` | `#E1E1E5` |
| `--bg2` | `#14141A` | `#E5E5EB` |
| `--bg3` | `#141419` | `#E6E6EB` |
| `--bg4` | `#141417` | `#E8E8EB` |
| `--bg5` | `#121216` | `#E9E9ED` |
| `--bg6` | `#12121A` | `#E5E5ED` |
| `--bg7` | `#0B0B0F` | `#F0F0F4` |
| `--bg8` | `#0A0A0D` | `#F2F2F5` |
| `--bg9` | `#09090C` | `#F3F3F6` |
| `--darker` | `#0A0A0B` | `#F4F4F5` |
| `--mid` | `#111113` | `#ECECEE` |
| `--tonet-oransje` | `#17110C` | `#F3EDE8` |

Aksentene på forsiden er de samme i begge tema: `--orange #FF4500`, `--blue #1A6FD4`,
`--gold #E8B93C`, `--green #28A86E`, `--red #E23A5A`, sonene `--i1`..`--i5` og
`--hurt #8B5CF6`, `--strava #FC5200`, `--polar #E4002B`.

---

## 9. Hva dette betyr for ikonene

Ikonfilene har ingen farge - `currentColor`, alltid. Fargen kommer fra konteksten:

| Kontekst | Farge |
|---|---|
| Topplinje, menyer, innstillinger | `--tekst-5-app` / `--tekst-3-app` |
| Aktivt menyvalg | `--accent` (oransje utøver, blå trener) |
| Konkurranse-chip på økt | `#D4A017` (KONKURRANSE_GULL) |
| Trenerting | `#1A6FD4` (TRENER_BLAA) |
| Sykdom | `#E11D48` (STATUS_ROD) |
| Status god / følg med / dårlig | `#28A86E` / `#D4A017` / `#E11D48` |
| Skyting | grå, `#43434B` på tidslinja |
| Punkt på graf i en sone | sonens egen farge, I1-I8 |
| Segmentmarkør | segmentfargen |

**Ikke bestemt ennå** - disse koblingene finnes ikke i koden, og jeg har ikke funnet på
verdier: A/B/C-konkurranse som gull/sølv/bronse (bare felles gull `#D4A017` finnes),
egen farge for laktat, ernæring, oppvarming, nedjogg, varmetrening, høydesamling og
treningssamling. Skal de ha egne farger, må det bestemmes før ikonene tas i bruk som
fargede markører - ellers arver de bare tekstfargen.
