// Dagens dato som YYYY-MM-DD i LOKAL tid. toISOString() gir UTC-dato og
// bommer med én dag mellom midnatt og ~02:00 norsk tid — bruk denne for alt
// brukervendt «i dag»-logikk.
export function localISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
