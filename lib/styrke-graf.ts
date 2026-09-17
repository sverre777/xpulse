// STYRKE I ØKTGRAFEN - ren utleggslogikk (styrke bolk 4). Ingen React.
//
// Fasit: design/xpulse-styrke-design.html seksjon 3 + notat pkt 3.
// Styrke er IKKE en sone: settene tegnes som blokker i styrkegrått
// (ZONE_COLORS_V2.Styrke), aldri i sonefarger. Høyde = kg, bredde = tid,
// tall i blokka = reps. Hvile mellom sett i pausegrå. Øvelsen som klamme
// under, ikke som etikett i hver blokk. Kroppsvekt (kg 0) = fast lav høyde
// med reps alene; reps null men tid ført (planke) = tida i blokka.
//
// Settene har ingen klokkeslett i basen. De legges ut i STYRKERADENS spenn
// (startSek..startSek+sek) etter designfilas enheter: sett = 2,2, hvile
// mellom sett = 0,8, mellomrom mellom øvelser = 1,2. Da fyller settene
// nøyaktig radens varighet - som inkluderer hvilen (bolk 3).

import type { StrengthExerciseRow } from './types'
import { parseDecimal } from './parse-decimal'
import { erPr, type BesteForOvelse } from './live-styrke'
import { normOvelse, erFortSett } from './styrke-pr'

export const STYRKE_GRAA = '#6E6E78'   // ZONE_COLORS_V2.Styrke
export const HVILE_GRAA = '#43434B'    // pausegrå på tidslinja
export const KROPPSVEKT_HOYDE = 0.2    // fast lav høyde når vekten er 0

const ENHET_SETT = 2.2, ENHET_HVILE = 0.8, ENHET_OVELSE = 1.2

export interface SettBlokk {
  ovelse: string
  settNr: number
  /** Sekunder fra øktstart. */
  fraSek: number
  tilSek: number
  kg: number
  reps: number | null
  tidSek: number | null
  /** 0-1 av radens høyde. */
  hoyde: number
  /** Tallet i blokka: tid («45 s») når reps mangler, ellers reps. */
  merke: string
  pr: boolean
}
export interface HvileBlokk { fraSek: number; tilSek: number }
export interface OvelseKlamme { ovelse: string; fraSek: number; tilSek: number; antallSett: number }
export interface StyrkeUtlegg {
  sett: SettBlokk[]
  hvile: HvileBlokk[]
  klammer: OvelseKlamme[]
  maksKg: number
}

const tall = (v: string): number | null => { const n = parseDecimal(v); return Number.isFinite(n) && n > 0 ? n : null }
export function tidSekAv(v: string): number | null {
  const s = v.trim(); if (!s) return null
  const m = /^(\d+):(\d{1,2})$/.exec(s); if (m) return Number(m[1]) * 60 + Number(m[2])
  const n = Number(s); return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}
export const fmtTidKort = (sek: number) => sek >= 60 && sek % 60 === 0 ? `${sek / 60} min` : `${sek} s`

/**
 * Legger øvelsenes sett ut i tid innenfor [startSek, startSek + sek].
 * Øvelser uten navn eller uten sett hoppes over. maksKg kan gis utenfra
 * (plan og faktisk deler skala i samme graf).
 */
export function leggUtSett(
  ovelser: StrengthExerciseRow[],
  startSek: number,
  sek: number,
  valg: { beste?: Record<string, BesteForOvelse | undefined>; maksKg?: number } = {},
): StyrkeUtlegg {
  // Beslutning A: tomme rader (planlagte sett uten tall) tegnes ikke - bare førte sett.
  const brukte = ovelser
    .map(o => ({ ...o, sets: o.sets.filter(s => erFortSett(s)) }))
    .filter(o => o.exercise_name.trim() && o.sets.length > 0)
  const tom: StyrkeUtlegg = { sett: [], hvile: [], klammer: [], maksKg: valg.maksKg ?? 0 }
  if (brukte.length === 0 || sek <= 0) return tom
  const settTot = brukte.reduce((a, o) => a + o.sets.length, 0)
  const hvileTot = brukte.reduce((a, o) => a + Math.max(0, o.sets.length - 1), 0)
  const enheter = settTot * ENHET_SETT + hvileTot * ENHET_HVILE + Math.max(0, brukte.length - 1) * ENHET_OVELSE
  const sekPerEnhet = sek / enheter
  const alleKg = brukte.flatMap(o => o.sets.map(s => tall(s.weight_kg) ?? 0))
  const maksKg = Math.max(valg.maksKg ?? 0, ...alleKg)
  const ut: StyrkeUtlegg = { sett: [], hvile: [], klammer: [], maksKg }
  let t = startSek
  brukte.forEach((o, oi) => {
    const fra = t
    const beste = valg.beste?.[normOvelse(o.exercise_name)]
    o.sets.forEach((s, si) => {
      const kg = tall(s.weight_kg) ?? 0, reps = tall(s.reps), tid = tidSekAv(s.duration)
      const fraSek = t, tilSek = t + ENHET_SETT * sekPerEnhet
      ut.sett.push({
        ovelse: o.exercise_name, settNr: si + 1, fraSek, tilSek, kg, reps: reps != null ? Math.round(reps) : null, tidSek: tid,
        hoyde: kg > 0 && maksKg > 0 ? Math.max(0.12, kg / maksKg) : KROPPSVEKT_HOYDE,
        merke: reps != null ? String(Math.round(reps)) : tid != null ? fmtTidKort(tid) : '',
        pr: erPr(beste, reps, kg > 0 ? kg : null) != null,
      })
      t = tilSek
      if (si < o.sets.length - 1) { ut.hvile.push({ fraSek: t, tilSek: t + ENHET_HVILE * sekPerEnhet }); t += ENHET_HVILE * sekPerEnhet }
    })
    ut.klammer.push({ ovelse: o.exercise_name, fraSek: fra, tilSek: t, antallSett: o.sets.length })
    if (oi < brukte.length - 1) t += ENHET_OVELSE * sekPerEnhet
  })
  return ut
}
