// Helsedata for ET VINDU ut av en større henting (Sverre 15. sep 2026).
//
// Dag-popupen i dagboka hentet helseoversikten (30 dager, fem tabeller) på
// nytt HVER gang en dag ble åpnet, og viste ingenting mens den ventet - så
// kortet «kom noen ganger, ellers tok det bare lang tid». Nå henter
// dagboksida én oversikt for hele måneden (+30 dager bak) på serveren, og
// hver dag skjærer sitt eget 30-dagers vindu ut av den her - rent, uten
// nettverk. Samme HelseOversiktData-form, så KompaktHelseKort er uendret.

import type { HelseOversiktData } from '@/app/actions/helse-oversikt'

export function minusDager(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function avgrensHelse(data: HelseOversiktData, fra: string, til: string): HelseOversiktData {
  const dager = data.dager.filter(d => d.date >= fra && d.date <= til)
  // Hypnogrammet (stadier) finnes bare for hentingens siste natt; ligger den
  // i vinduet beholdes den, ellers pekes det på vinduets siste natt med søvn
  // (søvnstripa leser minuttene fra dagen, ikke stadiene).
  const sisteNatt = data.sisteNatt && data.sisteNatt.date >= fra && data.sisteNatt.date <= til
    ? data.sisteNatt
    : (() => {
        const n = [...dager].reverse().find(d => d.total_sleep_minutes != null)
        return n ? { date: n.date, stadier: null, nap_minutes: null } : null
      })()
  return {
    ...data,
    dager,
    sisteNatt,
    merke: data.merke && data.merke.date <= til ? data.merke : null,
    hendelser: (data.hendelser ?? []).filter(h => h.date >= fra && h.date <= til),
  }
}
