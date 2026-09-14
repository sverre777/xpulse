# X-PULSE: tre nye ikoner

## Godkjent fordeling

| Navn | Motiv | Brukssted |
| --- | --- | --- |
| oktbygger | 03: intervallblokker med pluss | Åpne hele øktbyggeren |
| intervallbygger | 01: lyn med pluss | Intervallbyggeren inni øktbyggeren |
| recovery | 04: batteri med returpil | Recovery / restitusjon |

`aktivitet` beholder eksisterende lyn. Det er et eget symbol og skal ikke få pluss.

## Innføring

1. Kopier de seks SVG-filene fra `ikoner/` til eksisterende ikonmappe.
2. Slå de tre nøklene i `ikoner-tillegg.json` sammen med eksisterende ikondata. JSON-filen er et tillegg og skal ikke erstatte hele ikonregisteret.
3. Registrer de tre nye navnene i eventuell navnetype/manifest. Bruk eksisterende XPIcon-renderer.
4. Bruk strek sammen med tekst og fyll der ikonet står som markør. Begge har samme motiv. Sett farger med CSS `color` på inline SVG eller forelderen: øktbygger/intervallbygger normalt X-PULSE-oransje, recovery grønn. Følg appens eksisterende regler for aktive, inaktive og trenerfargede kontroller.
5. Kontroller faktisk visning på mobilen i de tre bruksstedene. Åpne `kontaktark.html` for 14, 18 og 40 px på lys og mørk bakgrunn.

Ingen egen mini-fil: disse nye motivene bruker samme geometri også ved 14 px. Større ikoner skifter derfor ikke utforming. Filene er nye tillegg og endrer ingen eksisterende ikoner eller aliaser.

SVG: viewBox 0 0 24 24, ingen rotbredde/høyde, kun currentColor. Strek 1.7 med runde ender/hjørner. Fyll uten stroke med nonzero og transparente hull. Maks to desimaler, én path per fil.
