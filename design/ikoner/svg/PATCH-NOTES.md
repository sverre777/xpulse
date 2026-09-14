# X-PULSE ikonrettelser

Dette er en patch til `x-pulse-ikoner-komplett.zip`. Legg innholdet oppå den
opprinnelige ikonmappen og erstatt bare SVG-filene som følger med her.

Endret:
- `helse`: rent hjerte uten pulslinje. Puls beholder hjerte med pulslinje.
- `konkurranse-strek`: samme flagg har nå sjakkmønster som fyll-varianten.

Uendret:
- Alle andre SVG-filer.
- `konkurranse-fyll.svg` var allerede riktig og er derfor ikke kopiert inn i patchen.
- `live-styrke` og `styrketrening` er med vilje samme path.
- `ski` og `utstyr` er med vilje samme path og skal defineres som alias.

`rettelser.json` inneholder d-attributtene for korrigerte standardpar. For
konkurranse ligger fyll-pathen der som referanse; selve fyll-SVG-en er uendret
og er derfor ikke med i patchen.
`rettelser-14px.json` inneholder d-attributtene for mini-filene som er endret.
`aliases.json` er den tilsiktede alias-mappingen.

## Avvik fra patchen (Sverre 14. sep)
`ski`, `utstyr` og `peak` er RULLET TILBAKE til originalen - de bøyde skispissene ble ikke
brukt. Kjent følge: i fyll ligger de på 0,94 likhet mot `pause` (to loddrette
bjelker). Akseptert.
`peak` er igjen samme stjerne som `favoritt`, bekreftet av Sverre. De tre aliasene
er dermed: utstyr=ski, styrketrening=live-styrke, peak=favoritt.
