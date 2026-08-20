// Én felles grense for .fit-opplasting — brukt av BÅDE klientvalideringen
// (KlokkesyncView), server-action-sjekken (fit-upload.ts) og next.config.ts.
// Tallet er valgt mot to harde tak:
//
//   1. Next.js Server Actions har 1 MB kroppsgrense som DEFAULT. Det var
//      FEIL-1: en ekte .fit med GPS og puls er 1–5 MB, så hver eneste ekte
//      fil døde i rammeverket («Body exceeded 1 MB limit») før appens kode
//      kjørte — klienten så bare en lukket tilkobling. Bevist empirisk på
//      Next 16.2.4 2026-08-20. Grensen heves i next.config.ts.
//
//   2. Netlify Functions (som kjører Next-serveren i prod) har ~6 MB
//      payload-tak på synkrone kall, og binærkropper base64-kodes gjennom
//      Lambda-formatet → effektivt ~4,5 MB binært. En Next-grense over det
//      hadde bare flyttet feilen ut til Netlify — like stille, enda
//      vanskeligere å se. Derfor 4 MB, ikke 10.
//
// Endres grensen: endre BEGGE steder (her og next.config.ts) — de kan ikke
// dele konstant fordi next.config leses før appkoden bygges.

export const FIT_MAX_BYTES = 4 * 1024 * 1024

/** Lesbar størrelse til feilmeldinger: «2,3 MB». */
export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
