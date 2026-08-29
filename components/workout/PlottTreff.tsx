'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  hentPlottTreff, lagrePlottTreff,
  type PlottTreffData, type PlottTreffGruppe,
} from '@/app/actions/plott-treff'
import { SerieListe } from './SerieListe'
import { shootingSummary, derivedBlockPosition, POSITION_COLORS } from '@/lib/shooting'
import { findStandardTest } from '@/lib/shooting-test-templates'
import { listMyShootingTests, type OwnShootingTest } from '@/app/actions/shooting-tests'
import { pulsIVindu, fmtKlokkeSek } from '@/lib/segmenter'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import type { ShootingSeriesRow } from '@/lib/types'

// «Plott treff» (bolk B). Fasit: design/xpulse-plott-treff-design.html.
//
// DET NYE ER SAMLINGEN — IKKE FØRINGEN: selve serie-føringen er SerieListe,
// den samme komponenten skjemaets skyting-rad bruker (høstet i denne bolken,
// regel 18). Ingen redesign av vimpler, vind, sikt, skytetid eller notat.
//
// Det som bygges her: pop-upen, grupperingen per skyting-rad, gruppe-summene
// (regnet ved visning), AUTO-pulsen fra kurven og lagringen i én operasjon.
//
// REGEL 11: skriver de SAMME workout_shooting_series-radene som
// skyting-kortene og statistikken leser — annen inngang til samme data.

export function PlottTreffPopup({
  workoutId, onClose, onLagret,
}: {
  workoutId: string
  onClose: () => void
  /** Hva som faktisk ble lagret — så kallerens draft ikke blir stale
      og overskriver seriene ved neste skjema-lagring. */
  onLagret?: (lagret: Array<{ activityId: string; serier: ShootingSeriesRow[] }>) => void
}) {
  const [data, setData] = useState<PlottTreffData | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const [grupper, setGrupper] = useState<PlottTreffGruppe[]>([])
  const [utgangspunkt, setUtgangspunkt] = useState('')
  const [ownTests, setOwnTests] = useState<OwnShootingTest[]>([])

  useEffect(() => {
    let avbrutt = false
    hentPlottTreff(workoutId)
      .then(d => {
        if (avbrutt) return
        setData(d)
        setGrupper(d?.grupper ?? [])
        setUtgangspunkt(JSON.stringify((d?.grupper ?? []).map(g => g.serier)))
        setLaster(false)
      })
      .catch(() => { if (!avbrutt) { setLaster(false); setFeil('Kunne ikke laste seriene — prøv igjen') } })
    listMyShootingTests()
      .then(res => { if (!avbrutt && Array.isArray(res)) setOwnTests(res) })
      .catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId])

  const endret = useMemo(
    () => utgangspunkt !== '' && JSON.stringify(grupper.map(g => g.serier)) !== utgangspunkt,
    [grupper, utgangspunkt],
  )

  const lukkMedSporsmaal = async () => {
    if (endret) {
      const ok = await xpConfirm('Lukke uten å lagre? Endringene i seriene går tapt.')
      if (!ok) return
    }
    onClose()
  }

  const lagre = async () => {
    setLagrer(true)
    setFeil(null)
    const res = await lagrePlottTreff(workoutId, grupper.map(g => ({
      activityId: g.activityId,
      serier: g.serier,
    })))
    setLagrer(false)
    if (!res.ok) { setFeil(res.error); return }
    onLagret?.(grupper.map(g => ({
      activityId: g.activityId,
      serier: g.serier as unknown as ShootingSeriesRow[],
    })))
    onClose()
  }

  const settSerier = (activityId: string, serier: ShootingSeriesRow[]) => {
    setGrupper(gs => gs.map(g => g.activityId === activityId
      ? { ...g, serier: serier as PlottTreffGruppe['serier'] }
      : g))
  }

  const antallSerier = grupper.reduce((n, g) => n + g.serier.length, 0)

  const body = (
    <div onClick={lukkMedSporsmaal}
      style={{
        // z 210: over «Legg til detaljer» (200) — den kan være åpen under.
        position: 'fixed', inset: 0, zIndex: 210,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '4vh', paddingBottom: '4vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--line2)',
          borderRadius: 14, width: '96%', maxWidth: 780,
        }}>
        <div className="flex items-center gap-3 px-5 py-4 flex-wrap"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 24, letterSpacing: '0.03em' }}>
            Plott treff
          </h2>
          {!laster && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-5-app)' }}>
              {antallSerier} {antallSerier === 1 ? 'serie' : 'serier'} i {grupper.length} {grupper.length === 1 ? 'rad' : 'rader'}
            </span>
          )}
          <span className="ml-auto" style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
            color: 'var(--tekst-8-alt)', maxWidth: 330, textAlign: 'right',
          }}>
            Samme serier som skyting-kortene og statistikken — endringer her slår gjennom overalt
          </span>
        </div>

        <div className="px-5 pb-4" style={{ paddingTop: 6 }}>
          {laster && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', fontSize: 14, padding: '12px 0' }}>
              Laster seriene …
            </p>
          )}
          {!laster && grupper.length === 0 && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14, padding: '12px 0' }}>
              Økta har ingen skyting-rader ennå. Legg til skyting i økta først — så samles alle seriene her.
            </p>
          )}

          {grupper.map((g, gi) => (
            <Gruppe key={g.activityId}
              gruppe={g}
              nr={gi + 1}
              antallLike={grupper.filter(x => gruppeEtikett(x) === gruppeEtikett(g)).length}
              rekkefolge={grupper.filter(x => gruppeEtikett(x) === gruppeEtikett(g)).indexOf(g) + 1}
              hr={data?.hr ?? []}
              ownTests={ownTests}
              onSerier={serier => settSerier(g.activityId, serier)}
            />
          ))}

          {feil && (
            <p className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: '#E23A5A' }}>
              {feil}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 py-4 flex-wrap"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <span className="mr-auto" style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)', maxWidth: 480,
          }}>
            Puls merket <b style={{ color: '#1A6FD4' }}>AUTO</b> er lest fra pulskurven i skytevinduet ·{' '}
            <b style={{ color: '#E8B93C' }}>M</b> = manuelt ført, vinner alltid · alt lagres i én operasjon
          </span>
          <button type="button" onClick={lukkMedSporsmaal} className="xp-pill xp-pill-ghost">
            Avbryt
          </button>
          <button type="button" onClick={lagre} disabled={lagrer || laster || grupper.length === 0}
            className="xp-pill xp-pill-primary">
            {lagrer ? 'Lagrer …' : 'Lagre alle serier ✓'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(body, document.body)
}

// ── Én gruppe = én skyting-rad ───────────────────────────────

function Gruppe({
  gruppe, antallLike, rekkefolge, hr, ownTests, onSerier,
}: {
  gruppe: PlottTreffGruppe
  nr: number
  antallLike: number
  rekkefolge: number
  hr: Array<{ t: number; hr: number }>
  ownTests: OwnShootingTest[]
  onSerier: (serier: ShootingSeriesRow[]) => void
}) {
  const serier = gruppe.serier as unknown as ShootingSeriesRow[]
  const sum = shootingSummary(serier)
  const plassert = gruppe.startSek != null && gruppe.sluttSek != null
  const farge = gruppeFarge(gruppe)
  const etikett = gruppeEtikett(gruppe) + (antallLike > 1 ? ` · ${rekkefolge}. skyting` : '')

  // Poeng-kolonnen følger SAMME regel som skjemaet: testrad m/ ring-scoring.
  const std = findStandardTest(gruppe.testRef ?? '')
  const egen = ownTests.find(t => t.id === gruppe.testRef) ?? null
  const scoring = std?.scoring ?? egen?.config.scoring ?? 'treff'
  const showPoints = gruppe.erTest && scoring === 'ring'

  // AUTO-puls: serien får sin del av skytevinduet. Kun når skytingen er
  // plassert i tid OG økta har pulskurve — ellers ingen AUTO i det hele tatt
  // (aldri et tall som ser målt ut, regel 22).
  const autoPuls = useMemo(() => {
    if (!plassert || hr.length === 0) return undefined
    const start = gruppe.startSek!, slutt = gruppe.sluttSek!
    const n = serier.length
    if (n === 0) return undefined
    const bit = (slutt - start) / n
    const kart = new Map<string, number>()
    serier.forEach((s, i) => {
      const p = pulsIVindu(hr, start + i * bit, start + (i + 1) * bit)
      if (p.snitt != null) kart.set(s.id, p.snitt)
    })
    return kart
  }, [plassert, hr, gruppe.startSek, gruppe.sluttSek, serier])

  return (
    <div style={{ marginTop: 18 }}>
      <div className="flex items-center gap-2.5 flex-wrap"
        style={{ padding: '9px 0 8px', borderBottom: '1px solid var(--kant-3)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: farge, flexShrink: 0 }} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          letterSpacing: '0.12em', fontSize: 13, color: farge, textTransform: 'uppercase',
        }}>
          {etikett}
        </span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: plassert ? 'var(--tekst-8-alt)' : 'var(--mut)' }}>
          {plassert
            ? `plassert ${fmtKlokkeSek(gruppe.startSek!)}–${fmtKlokkeSek(gruppe.sluttSek!)} ⌚`
            : 'ikke plassert i tid — puls føres manuelt'}
        </span>
        <span className="ml-auto" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-5-app)' }}>
          {sum.totalSeries > 0 ? (
            <>
              Sum <b style={{ color: 'var(--tekst-1-app)' }}>{sum.recordedHits}/{sum.recordedShots}</b>
              {sum.timeSum != null && sum.totalSeries > 0 && (
                <> · snitt tid <b style={{ color: 'var(--tekst-1-app)' }}>
                  {(Math.round((sum.timeSum / sum.totalSeries) * 10) / 10).toString().replace('.', ',')} s
                </b></>
              )}
            </>
          ) : <>Sum <b style={{ color: 'var(--tekst-1-app)' }}>—</b></>}
        </span>
      </div>

      <div style={{ paddingTop: 4 }}>
        <SerieListe
          series={serier}
          onChange={onSerier}
          planMode={false}
          showPoints={showPoints}
          autoPuls={autoPuls}
        />
      </div>
    </div>
  )
}

function gruppeEtikett(g: PlottTreffGruppe): string {
  const pos = derivedBlockPosition(g.serier as unknown as ShootingSeriesRow[])
  if (pos === 'L') return 'Liggende'
  if (pos === 'S') return 'Stående'
  if (pos === 'kombinert') return 'Kombinert'
  if (g.activityType === 'skyting_liggende') return 'Liggende'
  if (g.activityType === 'skyting_staaende') return 'Stående'
  if (g.activityType === 'skyting_innskyting') return 'Innskyting'
  if (g.activityType === 'skyting_basis') return 'Basisskyting'
  return 'Skyting'
}

function gruppeFarge(g: PlottTreffGruppe): string {
  const pos = derivedBlockPosition(g.serier as unknown as ShootingSeriesRow[])
  if (pos === 'S' || g.activityType === 'skyting_staaende') return '#FF4500'
  if (pos === 'L' || g.activityType === 'skyting_liggende') return '#38BDF8'
  return POSITION_COLORS.L
}
