'use client'

import { useState } from 'react'
import type { ShootingSeriesRow } from '@/lib/types'
import { shootingSummary, POSITION_COLORS } from '@/lib/shooting'
import { ringValueFromPoint, isShotHit, sightLabel, windShort } from '@/lib/shooting'
import { WindSightModal, VimpelIcon, type WindSightValue } from '@/components/workout/WindSightModal'
import { ShotPlotModal } from '@/components/workout/ShotPlotModal'

// Serie-føringen for én skyting-rad — HØSTET ordrett ut av
// ActivitiesSection/ShootingFields (regel 18: mønsteret fantes, men var
// låst inne i skjemaet). Markupen er FLYTTET, ikke redesignet: samme
// vimpler, vind/sikt, skuddplott, skytetid, notat og sum-strip.
//
// Brukes nå BEGGE steder (regel 11 — én komponent, ikke to varianter):
//   · skjemaets skyting-rad (ActivitiesSection)
//   · «Plott treff»-pop-upen, én gang per skyting-rad
//
// Nytt her (bolk B): autoPuls — AUTO-forslag lest fra pulskurven for
// serier uten ført puls. VISES kun, lagres aldri av seg selv (regel 11):
// tallet står ved siden av feltet med AUTO-merke, og «Bruk» skriver det
// eksplisitt inn i feltet. Skriver brukeren selv, er det M og vinner.

interface Props {
  series: ShootingSeriesRow[]
  onChange: (series: ShootingSeriesRow[]) => void
  planMode: boolean
  showPoints: boolean
  /** serie-id → AUTO-puls fra kurven (kun der serien mangler ført puls). */
  autoPuls?: Map<string, number>
  /** Row-nivå-innhold under sum-stripen (f.eks. «bruk serie-summen»). */
  etterSum?: React.ReactNode
}

export function SerieListe({ series, onChange, planMode, showPoints, autoPuls, etterSum = null }: Props) {
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)
  const [plotTarget, setPlotTarget] = useState<'all' | string | null>(null)
  const [windTarget, setWindTarget] = useState<string | null>(null)

  const sum = shootingSummary(series)

  const updSeries = (id: string, patch: Partial<ShootingSeriesRow>) =>
    onChange(series.map(s => s.id === id ? { ...s, ...patch } : s))
  const removeSeries = (id: string) =>
    onChange(series.filter(s => s.id !== id))
  const addSeries = () => {
    const last = series[series.length - 1]
    onChange([...series, {
      id: crypto.randomUUID(),
      position: last?.position ?? 'L',
      shots: '5', hits: '', time_seconds: '', avg_heart_rate: '', max_heart_rate: '',
      note: '', shot_plot: null, points: '',
      vind_retning: null, vind_styrke: null, sikt: null,
    }])
  }
  const onUpdate = (patch: { shooting_series?: ShootingSeriesRow[] }) => {
    if (patch.shooting_series) onChange(patch.shooting_series)
  }

  const merkeSt: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
    fontSize: 10.5, borderRadius: 5, padding: '2px 7px', border: '1px solid',
    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
  }

  const nSt: React.CSSProperties = {
    backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderRadius: 8,
    color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    padding: '8px 6px', minHeight: 40, textAlign: 'center', outline: 'none',
  }

  return (
    <>
      {/* Serie-rader: nr · L/S · skudd · treff · tid · puls · 📝 · ✕.
          Under 680px bryter puls-gruppen til egen linje (w-full). */}
      {series.map((s, i) => (
        <div key={s.id} style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
          <div className="flex flex-wrap items-center" style={{ gap: 6, padding: '6px 0' }}>
            <span style={{ width: 16, textAlign: 'right', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)', flexShrink: 0 }}>
              {i + 1}
            </span>
            <div className="flex" style={{ borderRadius: 9, overflow: 'hidden', border: '1px solid var(--line2)', flexShrink: 0 }}>
              {(['L', 'S'] as const).map(pos => (
                <button key={pos} type="button"
                  onClick={() => updSeries(s.id, { position: pos })}
                  aria-label={pos === 'L' ? 'Liggende' : 'Stående'}
                  style={{
                    minWidth: 40, minHeight: 40, border: 'none', cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
                    background: s.position === pos ? POSITION_COLORS[pos] : 'var(--card2)',
                    color: s.position === pos ? 'var(--flate-3)' : 'var(--mut)',
                  }}>
                  {pos}
                </button>
              ))}
            </div>
            <input value={s.shots} onChange={e => updSeries(s.id, { shots: e.target.value })}
              placeholder="Skudd" title="Skudd (5–8 v/ stafett-ekstraskudd)"
              inputMode="numeric" style={{ ...nSt, width: 58 }} />
            {!planMode && (
              <input value={s.hits} onChange={e => updSeries(s.id, { hits: e.target.value })}
                placeholder="Treff" title="Treff (valgfritt — teller i % kun når ført)"
                inputMode="numeric" style={{ ...nSt, width: 58 }} />
            )}
            {!planMode && (
              <input value={s.time_seconds} onChange={e => updSeries(s.id, { time_seconds: e.target.value })}
                placeholder="Tid s" title="Skytetid for serien (sekunder)"
                inputMode="decimal" style={{ ...nSt, width: 62 }} />
            )}
            {showPoints && (
              <input value={s.points} onChange={e => updSeries(s.id, { points: e.target.value })}
                placeholder="Poeng" title="Ring-/poengsum for serien (kan leses fra 🎯-plottet)"
                inputMode="decimal" style={{ ...nSt, width: 62, borderColor: '#D4A01755' }} />
            )}
            {showPoints && s.shot_plot?.some(p => p != null) && (
              <button type="button"
                onClick={() => updSeries(s.id, {
                  points: String((s.shot_plot ?? []).reduce((acc, pt) => acc + (pt ? ringValueFromPoint(pt) : 0), 0)),
                })}
                title="Les poeng fra skuddplottet (ringverdi per skudd)"
                className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017', background: 'none', border: '1px solid #D4A01755', borderRadius: 8, padding: '0 8px', minHeight: 40, cursor: 'pointer' }}>
                ⤓🎯
              </button>
            )}
            {!planMode && (
              <div className="flex items-center w-full min-[680px]:w-auto" style={{ gap: 6 }}>
                <input value={s.avg_heart_rate} onChange={e => updSeries(s.id, { avg_heart_rate: e.target.value })}
                  placeholder="Puls" title="Snittpuls under serien"
                  inputMode="numeric" style={{ ...nSt, width: 60 }} />
                <input value={s.max_heart_rate} onChange={e => updSeries(s.id, { max_heart_rate: e.target.value })}
                  placeholder="Maks" title="Makspuls under serien"
                  inputMode="numeric" style={{ ...nSt, width: 60 }} />
                {/* AUTO/M (bolk B): AUTO er lest fra kurven og bare VIST — «Bruk»
                    skriver den eksplisitt inn (regel 11). Ført puls er M og vinner. */}
                {autoPuls && (s.avg_heart_rate.trim() !== '' ? (
                  <span title="Manuelt ført puls — vinner alltid"
                    style={{ ...merkeSt, color: '#E8B93C', borderColor: 'rgba(232,185,60,.5)' }}>
                    M
                  </span>
                ) : autoPuls.get(s.id) != null ? (
                  <button type="button"
                    onClick={() => updSeries(s.id, { avg_heart_rate: String(autoPuls.get(s.id)) })}
                    title="Lest fra pulskurven i skytevinduet — trykk for å føre den inn"
                    style={{ ...merkeSt, color: '#1A6FD4', borderColor: 'rgba(26,111,212,.5)', cursor: 'pointer', background: 'none', minHeight: 40 }}>
                    AUTO {autoPuls.get(s.id)}
                  </button>
                ) : null)}
                <button type="button" aria-label="Skuddplott for serien"
                  onClick={() => setPlotTarget(s.id)}
                  title="Plott hvor skuddene satt (valgfritt)"
                  style={{
                    minWidth: 40, minHeight: 40, borderRadius: 8, cursor: 'pointer',
                    background: s.shot_plot?.some(p => p) ? '#2A1E10' : 'var(--card2)',
                    border: `1px solid ${s.shot_plot?.some(p => p) ? '#FF8C0066' : 'var(--line2)'}`,
                    fontSize: 14,
                  }}>
                  🎯
                </button>
                {/* Kø #49: vind & sikt — lite symbol mellom plotting og
                    notat (brukerplassering 2026-08-16). */}
                {(() => {
                  const hasWind = s.vind_styrke != null || s.sikt != null
                  const parts = [
                    s.vind_styrke != null ? windShort(s.vind_retning, s.vind_styrke) : null,
                    sightLabel(s.sikt),
                  ].filter(Boolean)
                  return (
                    <button type="button" aria-label="Vind og sikt for serien"
                      onClick={() => setWindTarget(s.id)}
                      title={hasWind
                        ? `Vind & sikt: ${parts.join(' · ')} — trykk for å endre`
                        : 'Før vind og sikt for serien (valgfritt)'}
                      className="inline-flex items-center justify-center"
                      style={{
                        minWidth: 40, minHeight: 40, borderRadius: 8, cursor: 'pointer',
                        background: hasWind ? 'var(--tonet-lilla-2)' : 'var(--card2)',
                        border: `1px solid ${hasWind ? '#E23A5A55' : 'var(--line2)'}`,
                        opacity: hasWind ? 1 : 0.75,
                      }}>
                      <VimpelIcon retning={s.vind_retning} styrke={s.vind_styrke ?? 0} size={22} />
                    </button>
                  )
                })()}
                <button type="button" aria-label="Notat for serien"
                  onClick={() => setNoteOpenId(noteOpenId === s.id ? null : s.id)}
                  style={{
                    minWidth: 40, minHeight: 40, borderRadius: 8, cursor: 'pointer',
                    background: noteOpenId === s.id || s.note ? 'var(--tonet-gronn-2)' : 'var(--card2)',
                    border: '1px solid var(--line2)', fontSize: 14,
                  }}>
                  📝
                </button>
                <button type="button" aria-label="Fjern serie"
                  onClick={() => removeSeries(s.id)}
                  style={{ minWidth: 40, minHeight: 40, borderRadius: 8, cursor: 'pointer', background: 'none', border: '1px solid var(--line2)', color: 'var(--mut)', fontSize: 13 }}>
                  ✕
                </button>
              </div>
            )}
            {planMode && (
              <button type="button" aria-label="Fjern serie"
                onClick={() => removeSeries(s.id)}
                style={{ minWidth: 40, minHeight: 40, borderRadius: 8, cursor: 'pointer', background: 'none', border: '1px solid var(--line2)', color: 'var(--mut)', fontSize: 13 }}>
                ✕
              </button>
            )}
          </div>
          {!planMode && (noteOpenId === s.id || s.note) && (
            <input value={s.note} onChange={e => updSeries(s.id, { note: e.target.value })}
              placeholder="Notat for serien (vind, ankomstpuls, …)"
              style={{ ...nSt, width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6 }} />
          )}
        </div>
      ))}

      <button type="button" onClick={addSeries} className="xp-add w-full" style={{ marginTop: series.length > 0 ? 4 : 0 }}>
        + Legg til serie
      </button>

      {/* Sum-strip (delt «kun førte»-beregning). */}
      {sum.totalSeries > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2"
          style={{ borderTop: '1px solid var(--line)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', color: 'var(--tekst-5-app)' }}>
          <span><b style={{ color: 'var(--tekst-1-app)' }}>{sum.shots}</b> skudd</span>
          {!planMode && (
            <span>
              Treff <b style={{ color: 'var(--tekst-1-app)' }}>{sum.recordedHits}</b>/{sum.recordedShots} ført
              {sum.pct != null && <> · <b style={{ color: 'var(--tekst-1-app)' }}>{Math.round(sum.pct)} %</b></>}
            </span>
          )}
          {!planMode && sum.timeSum != null && (
            <span>Skytetid <b style={{ color: 'var(--tekst-1-app)' }}>{Math.round(sum.timeSum)}s</b></span>
          )}
          {!planMode && sum.avgHr != null && (
            <span>Snittpuls <b style={{ color: 'var(--tekst-1-app)' }}>{sum.avgHr}</b></span>
          )}
          {!planMode && sum.maxHr != null && (
            <span>Makspuls <b style={{ color: 'var(--tekst-1-app)' }}>{sum.maxHr}</b></span>
          )}
          {showPoints && (() => {
            const pts = series.reduce((acc, s) => {
              const v = parseFloat((s.points || '').replace(',', '.'))
              return Number.isFinite(v) ? acc + v : acc
            }, 0)
            return pts > 0
              ? <span>Poeng <b style={{ color: '#D4A017' }}>{Math.round(pts * 10) / 10}</b></span>
              : null
          })()}
        </div>
      )}
      {etterSum}
      {/* Bulk-plotting: alle serier i samme popup m/ farge per serie.
          Fylt + synlig (brukerønske 2026-08-16) — plott-oransje aksent. */}
      {!planMode && series.filter(s => (parseInt(s.shots) || 0) > 0).length > 1 && (
        <button type="button" onClick={() => setPlotTarget('all')}
          className="mt-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: '#FF8C00', background: '#2A1E10', border: '1px solid #FF8C0066', borderRadius: 8, cursor: 'pointer', padding: '9px 14px', minHeight: 40, letterSpacing: '0.06em' }}>
          🎯 Plott alle serier
        </button>
      )}

      {/* Kø #49: vind & sikt-popupen. Forrige series verdi foreslås
          (forhåndsvalgt) — lagres først når brukeren trykker Lagre. */}
      {windTarget && (() => {
        const idx = series.findIndex(s => s.id === windTarget)
        if (idx < 0) return null
        const s = series[idx]
        let suggestion: WindSightValue | null = null
        for (let j = idx - 1; j >= 0; j--) {
          const p = series[j]
          if (p.vind_styrke != null || p.sikt != null) {
            suggestion = { vind_retning: p.vind_retning, vind_styrke: p.vind_styrke, sikt: p.sikt }
            break
          }
        }
        return (
          <WindSightModal
            serieNo={idx + 1}
            position={s.position}
            value={{ vind_retning: s.vind_retning, vind_styrke: s.vind_styrke, sikt: s.sikt }}
            suggestion={suggestion}
            onSave={v => { updSeries(s.id, v); setWindTarget(null) }}
            onClose={() => setWindTarget(null)}
          />
        )
      })()}

      {plotTarget && (() => {
        const targets = plotTarget === 'all'
          ? series.filter(s => (parseInt(s.shots) || 0) > 0)
          : series.filter(s => s.id === plotTarget)
        if (targets.length === 0) return null
        return (
          <ShotPlotModal
            series={targets}
            seriesNumbers={targets.map(s => series.indexOf(s) + 1)}
            onSave={updates => onUpdate({
              shooting_series: series.map(s => {
                const u = updates.find(x => x.id === s.id)
                if (!u) return s
                const plot = u.shot_plot.some(p => p != null) ? u.shot_plot : null
                const next = { ...s, shot_plot: plot }
                // Auto-treff fra plottet (BOM-REGELEN: senter utenfor stiplet
                // sone = bom for L, utenfor skiva for S) — KUN når ALLE
                // skuddene i serien er plottet; delvis plotting rører ikke
                // manuelt førte treff.
                const shotsN = parseInt(s.shots) || 0
                if (plot && shotsN > 0 && plot.slice(0, shotsN).every(p => p != null)) {
                  next.hits = String(plot.slice(0, shotsN)
                    .reduce((acc, p) => acc + (p && isShotHit(p, s.position) ? 1 : 0), 0))
                }
                return next
              }),
            })}
            onClose={() => setPlotTarget(null)}
          />
        )
      })()}
    </>
  )
}
