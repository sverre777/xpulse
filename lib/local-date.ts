// Datoer som mennesker leser dem.
//
// To feller bor her, og de er ikke samme felle:
//
// 1. toISOString() gir UTC. Brukes den på «nå», bommer datoen med én dag
//    mellom midnatt og 01:00/02:00 norsk tid - økta føres på gårsdagen.
// 2. Serverfunksjonen kjører i UTC, ikke i Europa/Oslo. Da hjelper det ikke å
//    lese Date-objektets LOKALE felter heller: «lokal» er UTC der. Derfor må
//    «i dag» regnes eksplisitt i appens sone, ikke i runtime-sonen. Ellers
//    ville serveren og nettleseren dessuten kunne svare ulikt på samme
//    spørsmål, og server-rendret HTML ikke stemme med hydreringen.
//
// Regel: «i dag» = iDagISO(). Har du allerede en Date bygget av LOKALE
// komponenter (new Date(år, mnd, dag) eller 'YYYY-MM-DDT00:00:00'), er
// localISODate(d) den riktige - den leser tilbake nøyaktig de samme feltene.

/** Sonen appen regner dager i. Samme valg som klokkesynken faller tilbake på. */
export const APP_SONE = 'Europe/Oslo'

/** Datoen på et Date-objekt slik RUNTIME-en ser den, som YYYY-MM-DD. */
export function localISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dato og klokkeslett slik en veggklokke i `sone` viste dem. */
export function iSone(d: Date, sone: string = APP_SONE): { dateStr: string; timeStr: string; offsetMin: number } {
  const deler = new Intl.DateTimeFormat('en-US', {
    timeZone: sone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d)
  const f = (t: string) => deler.find(x => x.type === t)?.value ?? '00'
  // hourCycle h23 kan gi '24' for midnatt i enkelte runtimes.
  const time = f('hour') === '24' ? '00' : f('hour')
  const dateStr = `${f('year')}-${f('month')}-${f('day')}`
  const timeStr = `${time}:${f('minute')}`
  const somUtc = Date.UTC(Number(f('year')), Number(f('month')) - 1, Number(f('day')), Number(time), Number(f('minute')), Number(f('second')))
  return { dateStr, timeStr, offsetMin: Math.round((somUtc - d.getTime()) / 60000) }
}

/**
 * Dagens dato i appens sone, som YYYY-MM-DD. Bruk denne for ALT brukervendt
 * «i dag» - både på server og i nettleser, så de to aldri er uenige.
 */
export function iDagISO(naa: Date = new Date()): string {
  return iSone(naa, APP_SONE).dateStr
}
