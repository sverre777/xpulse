'use client'

// STYRKE I ØKTGRAFEN - settraden (styrke bolk 4). ÉN komponent, flere
// monteringspunkter: under plan-grafen i øktoversikten og i skjemaets
// oppsummering, og under gjennomført-kartet/kurven i WorkoutDetailChart.
//
// Fasit: design/xpulse-styrke-design.html seksjon 3 + notat pkt 3.
//   · styrke er IKKE en sone: blokker i styrkegrått, aldri sonefarger
//   · høyde = kg, bredde = tid, tall i blokka = reps; hvile i pausegrå
//   · øvelsen som klamme under, ikke etikett i hver blokk
//   · kroppsvekt = fast lav høyde; planke = tida i blokka
//   · blandet økt: SAMME tidsakse som kurven (pct-funksjonen er flatens
//     egen), styrkeblokkene på EGEN RAD under kurven - ikke i segmentbåndet
//   · plan som spøkelse (stiplet, dempet) bak de faktiske settene, samme
//     mønster som PlanSpokelse
//   · sonesummene røres ikke: raden leser bare øvelsene, aldri zones
// HTML-blokker, ikke SVG: tallene skal ikke strekkes med preserveAspectRatio.
// PR-ringen: beste FØR denne økta (getBesteForExercises uten økta selv).

import { useEffect, useState } from 'react'
import type { StrengthExerciseRow } from '@/lib/types'
import { leggUtSett, STYRKE_GRAA, HVILE_GRAA, type StyrkeUtlegg } from '@/lib/styrke-graf'
import { getBesteForExercises } from '@/app/actions/strength-session'
import type { BesteForOvelse } from '@/lib/live-styrke'

const FONT = "'Barlow Condensed', sans-serif"
const GULL = '#D4A017'

export interface StyrkeSpenn {
  id: string
  /** Sekunder fra øktstart, og radens varighet (inkl. hvile - bolk 3). */
  startSek: number
  sek: number
  ovelser: StrengthExerciseRow[]
}

export function StyrkeRad({ spenn, plan = [], fraSek = 0, tilSek, tetthet = 'full', workoutId, targetUserId }: {
  spenn: StyrkeSpenn[]
  /** Planens styrkerader - tegnes som spøkelse bak. */
  plan?: StyrkeSpenn[]
  /** Flatens synlige vindu (kurven kan være zoomet). */
  fraSek?: number
  tilSek: number
  tetthet?: 'full' | 'kompakt'
  /** Til PR-ringen: beste før denne økta. Uten workoutId tegnes ingen PR. */
  workoutId?: string | null
  targetUserId?: string
}) {
  const brukte = spenn.filter(s => s.sek > 0 && s.ovelser.some(o => o.exercise_name.trim() && o.sets.length > 0))
  const navn = Array.from(new Set(brukte.flatMap(s => s.ovelser.map(o => o.exercise_name.trim()).filter(Boolean))))
  const nokkel = `${workoutId ?? ''}|${targetUserId ?? ''}|${navn.join('|')}`
  const [beste, setBeste] = useState<{ nokkel: string; data: Record<string, BesteForOvelse> } | null>(null)
  useEffect(() => {
    if (!workoutId || navn.length === 0) return
    let live = true
    const n = nokkel
    getBesteForExercises(navn, targetUserId, workoutId).then(d => { if (live) setBeste({ nokkel: n, data: d }) }).catch(() => {})
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nokkel])
  if (brukte.length === 0) return null
  const besteMap = beste?.nokkel === nokkel ? beste.data : {}
  const kompakt = tetthet === 'kompakt'
  const spennSek = Math.max(1, tilSek - fraSek)
  const pct = (sek: number) => `${Math.max(0, Math.min(100, ((sek - fraSek) / spennSek) * 100))}%`
  const bredde = (a: number, b: number) => `${Math.max(0.15, ((b - a) / spennSek) * 100)}%`
  // Plan og faktisk deler kg-skala.
  const alleKg = [...brukte, ...plan].flatMap(s => s.ovelser.flatMap(o => o.sets.map(x => Number(String(x.weight_kg).replace(',', '.')) || 0)))
  const maksKg = Math.max(0, ...alleKg)
  const utlegg: { s: StyrkeSpenn; u: StyrkeUtlegg }[] = brukte.map(s => ({ s, u: leggUtSett(s.ovelser, s.startSek, s.sek, { beste: besteMap, maksKg }) }))
  const planUtlegg = plan.filter(s => s.sek > 0).map(s => leggUtSett(s.ovelser, s.startSek, s.sek, { maksKg }))
  const H = kompakt ? 34 : 64, BUNN = kompakt ? 0 : 22   // plass til klammer og navn
  const antallSett = utlegg.reduce((a, x) => a + x.u.sett.length, 0)

  return (
    <div data-styrke-rad data-antall-sett={antallSett} data-tetthet={tetthet} style={{ position: 'relative', height: H + BUNN, marginTop: kompakt ? 2 : 6 }} aria-label={`Styrke: ${antallSett} sett`}>
      {!kompakt && utlegg.map(({ s, u }) => (
        <span key={`t${s.id}`} style={{ position: 'absolute', left: pct(s.startSek), top: -14, fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', whiteSpace: 'nowrap' }}>
          Styrke · {u.sett.length} sett
        </span>
      ))}
      {/* Spennet som svak ramme - «styrkebåndet» imellom sonefargene i en blandet økt */}
      {utlegg.map(({ s }) => (
        <div key={`r${s.id}`} data-styrke-spenn style={{ position: 'absolute', left: pct(s.startSek), width: bredde(s.startSek, s.startSek + s.sek), top: 0, height: H, borderRadius: 4, background: `${STYRKE_GRAA}24`, border: `1px solid ${STYRKE_GRAA}` }} />
      ))}
      {/* Planens sett som spøkelse - stiplet, dempet, bak */}
      {planUtlegg.flatMap((u, ui) => u.sett.map((st, i) => (
        <div key={`p${ui}-${i}`} data-styrke-plan-sett style={{ position: 'absolute', left: pct(st.fraSek), width: bredde(st.fraSek, st.tilSek), bottom: BUNN, height: `${st.hoyde * H}px`, borderRadius: 3, border: `1px dashed ${STYRKE_GRAA}`, opacity: 0.55, pointerEvents: 'none' }} />
      )))}
      {utlegg.map(({ s, u }) => (
        <div key={s.id}>
          {u.hvile.map((h, i) => (
            <div key={`h${i}`} data-styrke-hvile style={{ position: 'absolute', left: pct(h.fraSek), width: bredde(h.fraSek, h.tilSek), bottom: BUNN, height: 7, borderRadius: 2, background: HVILE_GRAA }} />
          ))}
          {u.sett.map((st, i) => (
            <div key={`s${i}`} data-sett={st.settNr} data-ovelse={st.ovelse} data-kg={st.kg} data-pr={st.pr ? '1' : '0'} title={`${st.ovelse} · sett ${st.settNr}${st.reps != null ? ` · ${st.reps} reps` : ''}${st.kg > 0 ? ` · ${String(st.kg).replace('.', ',')} kg` : ''}${st.tidSek != null ? ` · ${st.tidSek} s` : ''}${st.pr ? ' · PR' : ''}`}
              style={{ position: 'absolute', left: pct(st.fraSek), width: bredde(st.fraSek, st.tilSek), bottom: BUNN, height: `${Math.max(8, st.hoyde * H)}px`, borderRadius: 3, background: STYRKE_GRAA, opacity: 0.92,
                outline: st.pr ? `1.6px solid ${GULL}` : 'none', outlineOffset: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
              {!kompakt && <span style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 600, color: '#F0F0F2', lineHeight: 1, marginTop: 2 }}>{st.merke}</span>}
              {!kompakt && st.kg > 0 && st.hoyde * H >= 26 && <span style={{ fontFamily: FONT, fontSize: 9, color: 'rgba(255,255,255,.62)', lineHeight: 1, marginBottom: 2 }}>{String(st.kg).replace('.', ',')}</span>}
            </div>
          ))}
          {!kompakt && u.klammer.map((k, i) => (
            <div key={`k${i}`} data-klamme={k.ovelse} style={{ position: 'absolute', left: pct(k.fraSek), width: bredde(k.fraSek, k.tilSek), top: H + 5, borderTop: '1px solid var(--kant-7)', textAlign: 'center', fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingTop: 2 }}>
              {k.ovelse}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Hjelper for monteringspunktene: styrkeradenes spenn fra blokker + rader med øvelser. */
export function styrkeSpennAv(
  blokker: { id: string; slag: string; startSek: number; sek: number }[],
  rader: { id: string; exercises?: StrengthExerciseRow[] | null }[],
): StyrkeSpenn[] {
  const ut: StyrkeSpenn[] = []
  for (const b of blokker) {
    if (b.slag !== 'styrke') continue
    const r = rader.find(x => x.id === b.id)
    if (!r?.exercises?.length) continue
    ut.push({ id: b.id, startSek: b.startSek, sek: b.sek, ovelser: r.exercises })
  }
  return ut
}
