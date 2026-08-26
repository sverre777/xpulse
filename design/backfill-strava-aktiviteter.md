# Backfill: 83 Strava-økter uten aktivitetsrad

Analyse 2026-08-26. **Ingenting er kjørt.** Dette er et grunnlag for en
beslutning, ikke en plan som er satt i gang.

## Omfanget, målt i prod

83 gjennomførte Strava-økter har null rader i `workout_activities`. De faller
i to grupper med **ulik årsak**, og det avgjør hva som er riktig å gjøre:

| | Antall | Datospenn | Brukere | Har strømdata | Har snittpuls |
|---|---:|---|---:|---:|---:|
| Før fallbacken (22. aug 08:17 UTC) | 64 | 16. mai – 22. aug | 8 | 18 | 49 |
| Etter fallbacken | 19 | 22. – 26. aug | 6 | 19 | 19 |

**De 64** ble importert før fallbacken fantes. Koden lot den gang økter uten
laps stå uten aktivitetsrad — det var det kjente hullet.

**De 19** er noe annet. Alle har strømdata, altså ble detaljen hentet. De
hadde ekte runder, men aktivitets-inserten falt på `Math.round(undefined)` →
NaN → NOT NULL-brudd, og hele batchen røk. Det er feilen som ble rettet i
`ab617f3`.

## Hva vi har å bygge på

Alle 83 har km, tid og høyde på selve økta:

```
duration_minutes   mangler i  0 av 83
distance_km        mangler i  0 av 83
elevation_meters   mangler i  0 av 83
avg_heart_rate     mangler i 15 av 83
max_heart_rate     mangler i 15 av 83
```

Og **82 av 83 har Strava-id-en bevart** i `imported_activities.external_id`
på formen `strava_<id>`. Én økt mangler rad der og kan ikke re-importeres.

## Den eksisterende runneren løser det ikke

`/api/admin/import-all-missing-strava` bygger sin «missing»-liste fra
`imported_activities.external_id` og hopper over alt som allerede står der.
Våre 82 står nettopp der. Den ville hoppet over hver eneste én.

## To veier, med ærlige kostnader

### A — Syntetisk rad fra øktas egne totaler

Én aktivitetsrad per økt, bygget av km/tid/høyde/puls som allerede ligger på
`workouts`. Ingen Strava-kall, ingen rate limit, kjøres som ren SQL.

- Treffer alle 83, også den uten Strava-id.
- **Mister runde-inndelingen.** For de 19 vet vi at det FANTES ekte runder —
  «Ettermiddag med langrenn» samme dag hadde 23. En syntetisk rad gjør en
  intervalløkt til én blokk, og det er en påstand om økta som ikke er sann.
- For de 64 er tapet mindre: de fleste hadde trolig ingen runder i
  utgangspunktet, men vi vet det ikke uten å spørre Strava.

### B — Re-hent detaljen fra Strava for de 82

Hent `/activities/{id}` per økt, lag aktivitetsrader av de ekte rundene, og
fall tilbake til den syntetiske raden når Strava faktisk ikke har runder.

- Gjenoppretter det som virkelig skjedde, inkludert intervaller.
- Koster 82 API-kall mot Strava. Rate limit håndteres allerede i
  `lib/strava.ts` (`readRateLimit`), så batching er mulig — men det må kjøres
  kontrollert, ikke i én sløyfe.
- Krever at hver brukers Strava-token fortsatt er gyldig. 8 + 6 brukere er
  involvert; en frakoblet konto kan ikke re-importeres.
- Mer kode enn A, og koden treffer Strava-veien — som er fredet og krever
  egen klarering.

## Anbefaling

**B for de 19, A for de 64** — eller B for alle 82 hvis du vil ha det riktig
i ett jafs.

Grunnen til å skille: for de 19 VET vi at ekte rundedata gikk tapt, og de er
ferske nok til at brukerne husker øktene. For de 64 er en syntetisk rad trolig
nøyaktig det Strava ville gitt oss uansett, og den er gratis.

## Hva jeg trenger fra deg før noe skjer

1. Hvilken vei, og for hvilken gruppe.
2. Går vi for B: klarering til å røre Strava-veien, siden en backfill-runner
   må bruke de samme hente- og mappe-funksjonene.
3. Går vi for A: SQL-en skrives med før/etter-telling og sendes til
   godkjenning som vanlig, og limes i chat før kjøring.

Uansett vei bør den ene økta uten `imported_activities`-rad håndteres
eksplisitt, ikke stilltiende hoppes over.
