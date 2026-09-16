# Designfiler - fasit for forsiden

Hver fil er komplett (CSS i `<style>`, markup i `<section>`, JS i `<script>`) og har et
«Notat - regler» nederst som er bindende. Ved sprik mellom prompt og designfil: designfila vinner
på utseende og oppførsel, prompten på rekkefølge og hva som fjernes. Regel 26: designfiler
committes for seg, uten kode.

## Forside runde 3 (16. sep 2026)

| Fil | Erstatter i public/xpulse.html | Innhold |
|---|---|---|
| `xpulse-hero-v7-design.html` | heroen | den ekte xpulse.html kuttet etter `</header>`, bare heroen endret. Variant B (`h7-b`) er valgt; A, C, D og `.h7-panel` er bare til sammenligning. |
| `xpulse-faktisk-ut-v2-design.html` | `#inside` | dagboken: Uke · Måned (rutenett/liste) · År, PC + mobil, dag-popup. Vanilla JS, datadrevet. |
| `xpulse-flyt-bolk-design.html` | `#nytt` + `#flyten` + `#skiskyting` | to bolker: `#flyt` «Fra årsplan til innsikt» (10 scener) og `#dflyt` «Detaljene som avgjør» (7 scener). Felles motor `karusell(SC, KAP, prefiks)` + `Scene`. |
| `xpulse-trener-bolk-design.html` | `#trener` + «TRENERPANEL»-kommentaren | `#tflyt` «Hele troppen. Ett panel.» (5 scener), samme motor, blå aksent. |

## Eldre fasitfiler i denne mappa

`xpulse-styrke-design.html` (settgrafen, live styrke v2 - del 2 er UTKAST), `xpulse-formkart-design.html`
(UTKAST, ikke bygget), `xpulse-hjem-kort-v2-design.html`, `xpulse-scrollvelger-design.html`,
`fargefasit.md`, `aarsplan-kode.md`, `lysmodus-*.md`.
