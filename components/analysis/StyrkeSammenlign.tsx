'use client'

// STYRKE BOLK 5b - SAMMENLIGN LIKE STYRKEØKTER: samme øvelser side om side
// over 2-4 gjennomføringer. Fasit: design/xpulse-styrke-design.html g4.
// Eldst dempet, nyeste i aksentfargen - samme språk som sesongsammenligningen
// bruker for dempet fjorår. Bredde = kg mot tyngste i sammenligningen;
// kroppsvekt tegnes som kort strek med teksten «kroppsvekt».
// PR (beslutning 18. sep): mot HELE historikken FØR hver økt (getBesteForExercises
// med økta selv utenfor - samme som plan mot faktisk), aldri «i utvalget». To
// merker uten ny farge: gull ring = tyngste vekt noen gang, gull stiplet ring =
// beste vekt × reps. Regnes av erPr (ÉN kilde).

import { useEffect, useState } from 'react'
import { ChartWrapper } from './ChartWrapper'
import { sammenlignOvelser, type SammenlignOkt, type BesteKart } from '@/lib/styrke-sammenlign'
import { fmtKg } from '@/lib/live-styrke'
import { getBesteForExercises } from '@/app/actions/strength-session'

const FONT = "'Barlow Condensed', sans-serif"
const ORANSJE = '#FF4500'
const GULL = '#D4A017'
/** Eldst -> nyest: dempet grå, mellomgrå, aksent. Fire økter: to dempede. */
const FARGER: Record<number, string[]> = {
  2: ['var(--tekst-8-app)', ORANSJE],
  3: ['var(--tekst-10)', 'var(--tekst-5-app)', ORANSJE],
  4: ['var(--tekst-10)', 'var(--tekst-8-app)', 'var(--tekst-5-app)', ORANSJE],
}
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const fmtDato = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()}. ${MND[d.getMonth()]}` }

export function StyrkeSammenlign({ okter, targetUserId }: { okter: SammenlignOkt[]; targetUserId?: string }) {
  const med = okter.filter(o => o.exercises.some(e => e.sets.some(s => (s.reps ?? 0) > 0 || (s.weight_kg ?? 0) > 0)))
  const utvalg = med.slice(0, 4)
  const nokkel = utvalg.map(o => o.id).join('|')
  // Beste FØR hver økt - ett oppslag per økt (2-4), samme action som plan mot faktisk.
  const [beste, setBeste] = useState<{ nokkel: string; data: Record<string, BesteKart> } | null>(null)
  useEffect(() => {
    if (utvalg.length < 2) return
    let live = true
    const navn = Array.from(new Set(utvalg.flatMap(o => o.exercises.map(e => e.exercise_name.trim()).filter(Boolean))))
    Promise.all(utvalg.map(o => getBesteForExercises(navn, targetUserId, o.id).then(b => [o.id, b] as const)))
      .then(par => { if (live) setBeste({ nokkel, data: Object.fromEntries(par) }) })
      .catch(() => {})
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nokkel, targetUserId])
  if (utvalg.length < 2) return null
  const { okter: sortert, rader, maksKg } = sammenlignOvelser(utvalg, beste?.nokkel === nokkel ? beste.data : {})
  const farger = FARGER[sortert.length] ?? FARGER[4]
  return (
    <ChartWrapper chartKey="sammenlign_styrke" title="Styrke: øvelse for øvelse" height="auto"
      subtitle={`${sortert.length} gjennomføringer · bredde = tyngste vekt i økta · gull ring = tyngste vekt noen gang · stiplet gull = beste vekt × reps`}>
      <div data-styrke-sammenlign data-okter={sortert.length} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }}>
          {sortert.map((o, i) => <span key={o.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: farger[i], display: 'inline-block' }} />{fmtDato(o.date)}</span>)}
        </div>
        {rader.map(r => (
          <div key={r.ovelse} data-sammenlign-ovelse={r.ovelse} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 120px) 1fr', gap: 10, alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <b style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tekst-3-app)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.ovelse}</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {r.celler.map((c, i) => {
                const nyest = i === r.celler.length - 1
                const bredde = c.kg == null ? 0 : c.kg > 0 && maksKg > 0 ? Math.max(4, (c.kg / maksKg) * 82) : 3
                return (
                  <div key={i} data-sammenlign-celle data-kg={c.kg ?? ''} data-pr={c.prVekt ? '1' : '0'} data-pr-vxr={c.prVxR ? '1' : '0'} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 14 }}>
                    {c.kg == null ? (
                      <span style={{ fontFamily: FONT, fontSize: 10.5, color: 'var(--tekst-10)' }}>ikke ført</span>
                    ) : (
                      <>
                        <div style={{ width: `${bredde}%`, height: 11, borderRadius: 2, background: farger[i], opacity: nyest ? 0.95 : 0.65, outline: c.prVekt ? `1.6px solid ${GULL}` : c.prVxR ? `1.6px dashed ${GULL}` : 'none', outlineOffset: 1 }} />
                        <span style={{ fontFamily: FONT, fontSize: 10.5, color: nyest ? 'var(--tekst-3-app)' : 'var(--tekst-8-app)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {c.kroppsvekt ? 'kroppsvekt' : `${fmtKg(c.kg)} kg`}{c.reps ? ` · ${c.reps} reps` : ''}{c.prVekt ? ' ★ tyngste' : c.prVxR ? ' ★ vekt × reps' : ''}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </ChartWrapper>
  )
}
