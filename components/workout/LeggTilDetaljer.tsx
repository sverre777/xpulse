'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  hentLeggTilDetaljer, lagreLeggTilDetaljer,
  type LeggTilDetaljerData, type DetaljerRad,
} from '@/app/actions/tidsplassering'
import { SEGMENT_FARGER, fmtKlokkeSek, pulsIVindu } from '@/lib/segmenter'
import { findActivityType, type ActivityType, type ShootingSeriesRow } from '@/lib/types'
import { PlottTreffPopup } from './PlottTreff'

// «Legg til detaljer» (fase 113, bolk 3): pop-upen. Fasit: design/
// xpulse-tidsplassering-design.html V9.3, seksjon 1 + 2 + NOTAT.
//
// Mental modell: «intervall-byggeren, bare for klokkesynk» — byggeren
// tegner strukturen FØR økta, denne tegner den PÅ den gjennomførte, med
// pulskurven som lerret.
//
// - Draggbart vindu KUN på økter uten runder (avgrensningen er hele
//   poenget — finnes runder: omdøp runden, den har alt).
// - SKYTETID-PORTEN: ført skytetid (serienes time_seconds) = vinduslengde
//   og teller i statistikk; uten ført tid er vinduet en ~40 s
//   puls-markering UTENFOR all skytetid-statistikk. Porten avgjøres av
//   skytetid-feltet alene — drag endrer aldri statistikk-status.
// - Punkter (laktat/ernæring) skriver de EKSISTERENDE feltene
//   (measured_at_time / time_offset_minutes) — aldri parallelle kopier.
// - Rekkefølge = sort_order, ren visning.
//
// Inngangene (to piller) rendres statisk med sida og åpner i samme tick
// (regel 20) — datahentingen skjer først når pop-upen står åpen.

const STANDARD_VINDU_SEK = 40
const MIN_VINDU_SEK = 10

export function LeggTilDetaljerInngang({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        color: 'var(--accent)', background: 'rgba(255,69,0,.08)',
        border: '1px solid var(--accent)', borderRadius: 999,
        padding: '6px 14px', cursor: 'pointer', minHeight: 32,
      }}>
      ✚ Legg til detaljer
    </button>
  )
}

interface VinduLokal { startSek: number; varighetSek: number }

export function LeggTilDetaljerPopup({
  workoutId, onClose, onLagret, onSerierLagret,
}: {
  workoutId: string
  onClose: () => void
  onLagret: () => void
  /** Videresendes fra «Plott treff» når serier lagres derfra. */
  onSerierLagret?: (lagret: Array<{ activityId: string; serier: ShootingSeriesRow[] }>) => void
}) {
  const [data, setData] = useState<LeggTilDetaljerData | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)

  // Lokal redigeringstilstand — skrives først ved Lagre.
  const [vinduer, setVinduer] = useState<Map<string, VinduLokal>>(new Map())
  const [fjernet, setFjernet] = useState<Set<string>>(new Set())
  const [laktatSek, setLaktatSek] = useState<Map<string, number | null>>(new Map())
  const [ernaeringMin, setErnaeringMin] = useState<Map<string, number | null>>(new Map())
  const [rekkefolge, setRekkefolge] = useState<string[]>([])
  const [rekkefolgeEndret, setRekkefolgeEndret] = useState(false)
  const [aktivtVindu, setAktivtVindu] = useState<string | null>(null)
  // «Plott treff» åpnes herfra (fasit) — skytingene er nettopp plassert, så
  // AUTO-pulsen er riktig. Lukking returnerer hit med oppdaterte tall.
  const [visPlottTreff, setVisPlottTreff] = useState(false)
  // Kurvevelger (V9.4): hvilken kurve man plasserer PÅ. Vinduer og punkter
  // er de samme uansett — kun lerretet bytter.
  const [kurve, setKurve] = useState<'puls' | 'fart' | 'watt'>('puls')

  useEffect(() => {
    let avbrutt = false
    hentLeggTilDetaljer(workoutId)
      .then(d => {
        if (avbrutt) return
        setData(d)
        setLaster(false)
        if (d) {
          const v = new Map<string, VinduLokal>()
          for (const r of d.rader) {
            if (r.window_start_seconds != null && r.window_duration_seconds != null) {
              v.set(r.id, { startSek: r.window_start_seconds, varighetSek: r.window_duration_seconds })
            }
          }
          setVinduer(v)
          setLaktatSek(new Map(d.laktat.map(l => [l.id, l.sekunder])))
          setErnaeringMin(new Map(d.ernaering.map(n => [n.id, n.minutter])))
          setRekkefolge(d.rader.map(r => r.id))
          if (d.hr.length === 0) setKurve(d.fart.length > 0 ? 'fart' : 'watt')
        }
      })
      .catch(() => { if (!avbrutt) { setLaster(false); setFeil('Kunne ikke laste økta — prøv igjen') } })
    return () => { avbrutt = true }
  }, [workoutId])

  const totalSek = data?.totalSek ?? 0

  const plasserVindu = (rad: DetaljerRad) => {
    // Startforslag: første ledige tredjedel. Lengden er PORTEN: ført
    // skytetid hvis den finnes, ellers standard-markeringen.
    const lengde = rad.skytetidSek ?? STANDARD_VINDU_SEK
    let start = Math.round(totalSek / 3)
    const opptatt = [...vinduer.entries()].filter(([id]) => id !== rad.id && !fjernet.has(id))
    for (let forsok = 0; forsok < 20; forsok++) {
      const kolliderer = opptatt.some(([, v]) =>
        start < v.startSek + v.varighetSek && v.startSek < start + lengde)
      if (!kolliderer) break
      start = Math.min(totalSek - lengde, start + Math.max(60, lengde))
    }
    setVinduer(m => new Map(m).set(rad.id, { startSek: Math.max(0, start), varighetSek: lengde }))
    setFjernet(s => { const n = new Set(s); n.delete(rad.id); return n })
    setAktivtVindu(rad.id)
  }

  const skytingRader = data?.rader.filter(r => (r.activity_type ?? '').startsWith('skyting')) ?? []

  const lagre = async () => {
    if (!data) return
    // Klient-validering av overlapp — samme regel som serveren (regel 22).
    const aktive = [...vinduer.entries()].filter(([id]) => !fjernet.has(id))
    for (let i = 0; i < aktive.length; i++) {
      for (let j = i + 1; j < aktive.length; j++) {
        const a = aktive[i][1], b = aktive[j][1]
        if (a.startSek < b.startSek + b.varighetSek && b.startSek < a.startSek + a.varighetSek) {
          setFeil('To vinduer overlapper — flytt eller kort inn det ene')
          return
        }
      }
    }
    setLagrer(true)
    setFeil(null)
    const input = {
      vinduer: data.rader
        .filter(r => vinduer.has(r.id) || fjernet.has(r.id))
        .map(r => {
          const v = fjernet.has(r.id) ? null : vinduer.get(r.id) ?? null
          return { activityId: r.id, startSek: v?.startSek ?? null, varighetSek: v?.varighetSek ?? null }
        })
        .filter(v => {
          const opprinnelig = data.rader.find(r => r.id === v.activityId)!
          return v.startSek !== opprinnelig.window_start_seconds
            || v.varighetSek !== opprinnelig.window_duration_seconds
        }),
      rekkefolge: rekkefolgeEndret ? rekkefolge : null,
      laktat: data.laktat
        .filter(l => (laktatSek.get(l.id) ?? null) !== l.sekunder)
        .map(l => ({ id: l.id, sekunder: laktatSek.get(l.id) ?? null })),
      ernaering: data.ernaering
        .filter(n => (ernaeringMin.get(n.id) ?? null) !== n.minutter)
        .map(n => ({ id: n.id, minutter: ernaeringMin.get(n.id) ?? null })),
    }
    const res = await lagreLeggTilDetaljer(workoutId, input)
    setLagrer(false)
    if (!res.ok) { setFeil(res.error); return }
    onLagret()
    onClose()
  }

  const body = (
    <div onClick={onClose}
      style={{
        // z 200: økt-modalen ligger på 100 (samme stige som utstyrsvelgeren).
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--line2)',
          borderRadius: 14, width: '94%', maxWidth: 640,
        }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.08em' }}>
            Legg til detaljer
          </h2>
          {/* Fasit: «Plott treff» ligger synlig HER når økta har skyting —
              man plasserer skytingene i tid og fører treffene uten å lukke.
              Samme komponent som fra knapperaden (regel 11). */}
          {skytingRader.length > 0 && (
            <button type="button" onClick={() => setVisPlottTreff(true)}
              className="ml-auto mr-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.1em', fontSize: 12, textTransform: 'uppercase',
                color: '#FF4500', background: 'none', border: '1.5px solid #FF4500',
                borderRadius: 999, padding: '6px 14px', cursor: 'pointer', minHeight: 34,
              }}>
              🎯 Plott treff
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontSize: 20, cursor: 'pointer', minWidth: 36, minHeight: 36 }}>
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {laster && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', fontSize: 14 }}>
              Laster kurven …
            </p>
          )}
          {!laster && (!data || (data.hr.length === 0 && data.fart.length === 0 && data.watt.length === 0)) && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Økta mangler pulskurve — «Legg til detaljer» trenger klokkesynkede sekund-data.
            </p>
          )}

          {data && (data.hr.length > 0 || data.fart.length > 0 || data.watt.length > 0) && (
            <>
              {(() => {
                const valg = ([
                  ['puls', 'Puls', data.hr.length] as const,
                  ['fart', 'Fart', data.fart.length] as const,
                  ['watt', 'Watt', data.watt.length] as const,
                ]).filter(([, , n]) => n > 0)
                // Kurver uten data vises ikke — aldri en tom fane (V9.4).
                if (valg.length < 2) return null
                return (
                  <div className="flex gap-1.5">
                    {valg.map(([id, navn]) => (
                      <button key={id} type="button" onClick={() => setKurve(id)}
                        className="text-xs tracking-widest uppercase"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                          color: kurve === id ? KURVE_FARGER[id] : 'var(--tekst-8-alt)',
                          background: 'none',
                          border: `1px solid ${kurve === id ? KURVE_FARGER[id] : 'var(--kant-3)'}`,
                          borderRadius: 999, padding: '4px 12px', cursor: 'pointer', minHeight: 30,
                        }}>
                        {navn}
                      </button>
                    ))}
                  </div>
                )
              })()}
              <KurveMedVinduer
                hr={data.hr}
                fart={data.fart}
                watt={data.watt}
                hoyde={data.hoyde}
                kurve={kurve}
                sport={data.sport}
                totalSek={totalSek}
                rader={data.rader}
                vinduer={vinduer}
                fjernet={fjernet}
                laktat={data.laktat}
                ernaering={data.ernaering}
                laktatSek={laktatSek}
                ernaeringMin={ernaeringMin}
                aktivtVindu={aktivtVindu}
                harRunder={data.harRunder}
                onVindu={(id, v) => { setVinduer(m => new Map(m).set(id, v)); setAktivtVindu(id) }}
                onLaktat={(id, sek) => setLaktatSek(m => new Map(m).set(id, sek))}
                onErnaering={(id, min) => setErnaeringMin(m => new Map(m).set(id, min))}
              />

              {/* ── Skyting / vinduer ── */}
              {data.harRunder ? (
                <Hint>
                  Økta har runder fra klokka — skytevinduene er låst til rundene.
                  Vil du markere en skyting: omdøp runden i redigering, den har tid og puls.
                </Hint>
              ) : skytingRader.length === 0 ? (
                <Hint>
                  Ingen skyting-rader å plassere. Legg til skyting i redigeringen først —
                  så kan den settes inn på kurven her.
                </Hint>
              ) : (
                <div className="space-y-2">
                  <Overskrift>Plasser i tid</Overskrift>
                  {/* Radene og kurven er ÉN visning av samme data (V9.4):
                      drag på kurven oppdaterer raden live, og tids-feltene i
                      raden flytter vinduet på kurven. Ingen «lagre og se». */}
                  {skytingRader.map(r => {
                    const v = fjernet.has(r.id) ? null : vinduer.get(r.id) ?? null
                    const typeLabel = finnEtikett(r)
                    const puls = v ? pulsIVindu(data.hr, v.startSek, v.startSek + v.varighetSek) : null
                    return (
                      <div key={r.id} className="flex items-center gap-x-3 gap-y-1 flex-wrap"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
                        <span style={{ minWidth: 130 }}>{typeLabel}</span>
                        {v ? (
                          <>
                            <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>
                              plassert {fmtKlokkeSek(v.startSek)}–{fmtKlokkeSek(v.startSek + v.varighetSek)} ⌚
                            </b>
                            {puls?.snitt != null && (
                              <span style={{ fontSize: 12.5 }}>snitt {puls.snitt}</span>
                            )}
                            <span style={{ fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>start</span>
                            <TidInput sek={v.startSek}
                              onSek={sek => {
                                const start = Math.max(0, Math.min(totalSek - v.varighetSek, sek))
                                setVinduer(m => new Map(m).set(r.id, { startSek: start, varighetSek: v.varighetSek }))
                                setAktivtVindu(r.id)
                              }} />
                            <span style={{ fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>varighet</span>
                            <TidInput sek={v.varighetSek}
                              onSek={sek => {
                                const varighet = Math.max(MIN_VINDU_SEK, Math.min(totalSek - v.startSek, sek))
                                setVinduer(m => new Map(m).set(r.id, { startSek: v.startSek, varighetSek: varighet }))
                                setAktivtVindu(r.id)
                              }} />
                            <span style={{ fontSize: 12.5, color: 'var(--tekst-8-alt)', flexBasis: '100%' }}>
                              {r.skytetidSek != null
                                ? `ført skytetid ${fmtKlokkeSek(r.skytetidSek)} — teller i statistikken`
                                : 'kun puls-markering — utenfor skytetid-statistikk'}
                            </span>
                            <button type="button" className="xp-pill xp-pill-ghost"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => {
                                setFjernet(s => new Set(s).add(r.id))
                                if (aktivtVindu === r.id) setAktivtVindu(null)
                              }}>
                              Fjern
                            </button>
                          </>
                        ) : (
                          <button type="button" className="xp-pill xp-pill-ghost"
                            style={{ padding: '4px 12px', fontSize: 12 }}
                            onClick={() => plasserVindu(r)}>
                            Plasser på kurven
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Punkter ── */}
              {(data.laktat.length > 0 || data.ernaering.length > 0) && (
                <div className="space-y-2">
                  <Overskrift>Punkter på kurven</Overskrift>
                  {data.laktat.map(l => {
                    const sek = laktatSek.get(l.id) ?? null
                    return (
                      <PunktRad key={l.id}
                        farge="#E23A5A"
                        navn={`Laktat ${String(l.mmol).replace('.', ',')} mmol`}
                        tid={sek != null ? fmtKlokkeSek(sek) : null}
                        onPlasser={() => setLaktatSek(m => new Map(m).set(l.id, Math.round(totalSek / 2)))}
                        onFjern={() => setLaktatSek(m => new Map(m).set(l.id, null))}
                      />
                    )
                  })}
                  {data.ernaering.map(n => {
                    const min = ernaeringMin.get(n.id) ?? null
                    return (
                      <PunktRad key={n.id}
                        farge="#FFB300"
                        navn={`Ernæring — ${n.type}${n.carbs_g != null ? ` (${n.carbs_g} g)` : ''}`}
                        tid={min != null ? fmtKlokkeSek(min * 60) : null}
                        onPlasser={() => setErnaeringMin(m => new Map(m).set(n.id, Math.round(totalSek / 120)))}
                        onFjern={() => setErnaeringMin(m => new Map(m).set(n.id, null))}
                      />
                    )
                  })}
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                    Punktene er målingene du allerede har ført — her får de bare et tidspunkt.
                    Nye målinger føres i redigeringen som før.
                  </p>
                </div>
              )}

              {/* ── Rekkefølge ── */}
              {data.rader.length > 1 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Overskrift>Rekkefølge</Overskrift>
                    {[...vinduer.entries()].some(([id]) => !fjernet.has(id)) && (
                      <button type="button" className="xp-pill xp-pill-ghost"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => {
                          // FORSLAG fra tidsplasseringen (V9.4): sorter på
                          // vindus-start; rader uten vindu beholder rekkefølgen
                          // seg imellom. Fortsatt ren visning — kan overstyres.
                          const startFor = (id: string) =>
                            !fjernet.has(id) && vinduer.has(id) ? vinduer.get(id)!.startSek : null
                          const ny = [...rekkefolge].sort((a, b) => {
                            const sa = startFor(a), sb = startFor(b)
                            if (sa == null && sb == null) return rekkefolge.indexOf(a) - rekkefolge.indexOf(b)
                            if (sa == null) return 1
                            if (sb == null) return -1
                            return sa - sb
                          })
                          setRekkefolge(ny)
                          setRekkefolgeEndret(true)
                        }}>
                        Sortér etter tid
                      </button>
                    )}
                  </div>
                  <RekkefolgeListe
                    rader={data.rader}
                    rekkefolge={rekkefolge}
                    onEndre={ny => { setRekkefolge(ny); setRekkefolgeEndret(true) }}
                  />
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                    Rekkefølgen styrer bare visningen — aldri tidene.
                  </p>
                </div>
              )}
            </>
          )}

          {feil && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: '#E23A5A' }}>
              {feil}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <button type="button" onClick={onClose} className="xp-pill xp-pill-ghost">
            Avbryt
          </button>
          <button type="button" onClick={lagre} disabled={lagrer || !data}
            className="xp-pill xp-pill-primary">
            {lagrer ? 'Lagrer …' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(body, document.body)}
      {visPlottTreff && (
        <PlottTreffPopup
          workoutId={workoutId}
          onClose={() => setVisPlottTreff(false)}
          onLagret={lagret => {
            // Skytetiden er PORTEN — den kan nettopp ha endret seg. Patches
            // lokalt fra det som ble lagret, så vindus-dragene brukeren har
            // gjort her ikke kastes av en re-henting.
            setData(d => d && ({
              ...d,
              rader: d.rader.map(r => {
                const t = lagret.find(l => l.activityId === r.id)
                if (!t) return r
                const sum = t.serier.reduce((n, s) => {
                  const v = parseFloat(String(s.time_seconds).replace(',', '.'))
                  return Number.isFinite(v) ? n + v : n
                }, 0)
                return { ...r, skytetidSek: sum > 0 ? sum : null }
              }),
            }))
            onSerierLagret?.(lagret)
          }}
        />
      )}
    </>
  )
}

// ── Kurven med draggbare vinduer og punkter ─────────────────
// Lerretet kan være puls, fart eller watt (V9.4) — vinduer og punkter er
// de samme uansett valg. Høyde tegnes som stille bakgrunnsprofil når den
// finnes (målt 29. aug: altitude_samples er punkt-for-punkt-kurve i 69 av
// 89 samples-rader). Leser-raden viser snittpuls OG snittfart samtidig,
// uavhengig av valgt lerret.

const KURVE_HOYDE = 190

export const KURVE_FARGER = {
  puls: '#FF4500',
  fart: '#3DD68C',
  watt: '#FFB300',
} as const

type KurveValg = keyof typeof KURVE_FARGER

function KurveMedVinduer({
  hr, fart, watt, hoyde, kurve, sport, totalSek, rader, vinduer, fjernet,
  laktat, ernaering, laktatSek, ernaeringMin,
  aktivtVindu, harRunder, onVindu, onLaktat, onErnaering,
}: {
  hr: Array<{ t: number; hr: number }>
  fart: Array<{ t: number; mps: number }>
  watt: Array<{ t: number; w: number }>
  hoyde: Array<{ t: number; alt: number }>
  kurve: KurveValg
  sport: string | null
  totalSek: number
  rader: DetaljerRad[]
  vinduer: Map<string, VinduLokal>
  fjernet: Set<string>
  laktat: Array<{ id: string; mmol: number }>
  ernaering: Array<{ id: string; type: string }>
  laktatSek: Map<string, number | null>
  ernaeringMin: Map<string, number | null>
  aktivtVindu: string | null
  harRunder: boolean
  onVindu: (id: string, v: VinduLokal) => void
  onLaktat: (id: string, sek: number) => void
  onErnaering: (id: string, min: number) => void
}) {
  const boks = useRef<HTMLDivElement | null>(null)
  const drag = useRef<
    | { slag: 'flytt'; id: string; grepSek: number }
    | { slag: 'venstre' | 'hoyre'; id: string }
    | { slag: 'laktat' | 'ernaering'; id: string }
    | null
  >(null)

  // Aktiv serie som generisk {t, v}-liste.
  const serie = useMemo((): Array<{ t: number; v: number }> => {
    if (kurve === 'puls') return hr.map(p => ({ t: p.t, v: p.hr }))
    if (kurve === 'fart') return fart.map(p => ({ t: p.t, v: p.mps }))
    return watt.map(p => ({ t: p.t, v: p.w }))
  }, [kurve, hr, fart, watt])

  const sti = useMemo(() => tilSti(serie, totalSek, false), [serie, totalSek])
  const hoydeSti = useMemo(
    () => (hoyde.length > 2 ? tilSti(hoyde.map(p => ({ t: p.t, v: p.alt })), totalSek, true) : null),
    [hoyde, totalSek],
  )

  const sekFraX = (clientX: number): number => {
    const el = boks.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const andel = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return Math.round(andel * totalSek)
  }

  const paaFlytt = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const sek = sekFraX(e.clientX)
    if (d.slag === 'laktat') { onLaktat(d.id, sek); return }
    if (d.slag === 'ernaering') { onErnaering(d.id, Math.round(sek / 60)); return }
    const v = vinduer.get(d.id)
    if (!v) return
    if (d.slag === 'flytt') {
      const start = Math.max(0, Math.min(totalSek - v.varighetSek, sek - d.grepSek))
      onVindu(d.id, { startSek: start, varighetSek: v.varighetSek })
    } else if (d.slag === 'venstre') {
      const nyStart = Math.max(0, Math.min(v.startSek + v.varighetSek - MIN_VINDU_SEK, sek))
      onVindu(d.id, { startSek: nyStart, varighetSek: v.startSek + v.varighetSek - nyStart })
    } else {
      const nySlutt = Math.min(totalSek, Math.max(v.startSek + MIN_VINDU_SEK, sek))
      onVindu(d.id, { startSek: v.startSek, varighetSek: nySlutt - v.startSek })
    }
  }

  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / Math.max(1, totalSek)) * 100))}%`
  // Punktene ligger PÅ den valgte kurven — y følger lerretet.
  const verdiYPct = (t: number): string => {
    if (serie.length === 0) return '50%'
    const naermest = serie.reduce((best, p) => Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best, serie[0])
    let lo = Infinity, hi = -Infinity
    for (const p of serie) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v }
    const span = Math.max(1e-6, hi - lo)
    const y = 12 + (1 - (naermest.v - lo) / span) * (KURVE_HOYDE - 24)
    return `${(y / KURVE_HOYDE) * 100}%`
  }

  const aktivt = aktivtVindu != null && !fjernet.has(aktivtVindu) ? vinduer.get(aktivtVindu) : null
  const aktivPuls = aktivt ? pulsIVindu(hr, aktivt.startSek, aktivt.startSek + aktivt.varighetSek) : null
  const aktivFart = aktivt ? snittIVindu(fart.map(p => ({ t: p.t, v: p.mps })), aktivt.startSek, aktivt.startSek + aktivt.varighetSek) : null

  return (
    <div>
      <div ref={boks}
        onPointerMove={paaFlytt}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { drag.current = null }}
        style={{
          position: 'relative', height: KURVE_HOYDE, touchAction: 'none',
          background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 10,
        }}>
        <svg viewBox={`0 0 1000 ${KURVE_HOYDE}`} preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden' }}>
          {hoydeSti && (
            <path d={hoydeSti} fill="var(--tekst-8-alt)" opacity={0.13} stroke="none" />
          )}
          <path d={sti} fill="none" stroke={KURVE_FARGER[kurve]} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Vinduer (kun økter uten runder — ellers tegnes de i lesevisningen). */}
        {!harRunder && rader.map(r => {
          const v = fjernet.has(r.id) ? null : vinduer.get(r.id)
          if (!v) return null
          const farge = vinduFarge(r)
          const erAktivt = aktivtVindu === r.id
          return (
            <div key={r.id}
              style={{
                position: 'absolute', top: 4, bottom: 4,
                left: pct(v.startSek), width: pct(v.varighetSek),
                background: `${farge}24`, border: `1.5px solid ${farge}`,
                borderRadius: 8, cursor: 'grab',
                boxShadow: erAktivt ? `0 0 0 2px ${farge}55` : 'none',
              }}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                drag.current = { slag: 'flytt', id: r.id, grepSek: sekFraX(e.clientX) - v.startSek }
              }}>
              <span style={{
                position: 'absolute', top: 3, left: 6, fontSize: 10, letterSpacing: '0.08em',
                fontFamily: "'Barlow Condensed', sans-serif", color: farge, textTransform: 'uppercase',
                whiteSpace: 'nowrap', pointerEvents: 'none',
              }}>
                {finnEtikett(r)}
              </span>
              {/* Håndtak — ≥36px treffflate, plassert HELT utenfor vinduet så
                  smale vinduer (kort skytetid) fortsatt kan flyttes med grep
                  i selve kroppen. Stripen ligger inntil kanten. */}
              {(['venstre', 'hoyre'] as const).map(side => (
                <div key={side}
                  onPointerDown={e => {
                    e.stopPropagation()
                    e.currentTarget.setPointerCapture?.(e.pointerId)
                    drag.current = { slag: side, id: r.id }
                  }}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, width: 36,
                    [side === 'venstre' ? 'left' : 'right']: -36,
                    cursor: 'ew-resize', display: 'flex', alignItems: 'center',
                    justifyContent: side === 'venstre' ? 'flex-end' : 'flex-start',
                  }}>
                  <span style={{ width: 5, height: 26, borderRadius: 3, background: farge }} />
                </div>
              ))}
            </div>
          )
        })}

        {/* Punkter: draggbare prikker PÅ kurven. */}
        {laktat.map(l => {
          const sek = laktatSek.get(l.id) ?? null
          if (sek == null) return null
          return (
            <button key={l.id} type="button"
              aria-label={`Laktat ${l.mmol} mmol — dra for å flytte`}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                drag.current = { slag: 'laktat', id: l.id }
              }}
              style={{
                position: 'absolute', left: pct(sek), top: verdiYPct(sek),
                transform: 'translate(-50%, -50%)',
                width: 14, height: 14, borderRadius: '50%', padding: 0,
                background: '#E23A5A', border: '2px solid var(--flate-3)',
                cursor: 'grab', touchAction: 'none',
              }} />
          )
        })}
        {ernaering.map(n => {
          const min = ernaeringMin.get(n.id) ?? null
          if (min == null) return null
          return (
            <button key={n.id} type="button"
              aria-label={`Ernæring ${n.type} — dra for å flytte`}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                drag.current = { slag: 'ernaering', id: n.id }
              }}
              style={{
                position: 'absolute', left: pct(min * 60), top: verdiYPct(min * 60),
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: 12, height: 12, padding: 0,
                background: '#FFB300', border: '2px solid var(--flate-3)',
                cursor: 'grab', touchAction: 'none',
              }} />
          )
        })}
      </div>

      <div className="flex justify-between mt-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, color: 'var(--tekst-8-alt)' }}>
        <span>0:00</span>
        <span>{fmtKlokkeSek(Math.round(totalSek / 2))}</span>
        <span>{fmtKlokkeSek(totalSek)}</span>
      </div>

      {/* Live-leser for aktivt vindu: puls OG fart samtidig (V9.4). */}
      {aktivt && (
        <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
          Vindu <b>{fmtKlokkeSek(aktivt.startSek)}–{fmtKlokkeSek(aktivt.startSek + aktivt.varighetSek)}</b>
          {' · '}varighet <b>{fmtKlokkeSek(aktivt.varighetSek)}</b>
          {aktivPuls?.snitt != null
            ? <>{' · puls snitt '}<b>{aktivPuls.snitt}</b>{aktivPuls.inn != null ? <>{' · inn '}<b>{aktivPuls.inn}</b></> : null}</>
            : <>{' · puls: for lite data'}</>}
          {aktivFart != null && <>{' · fart '}<b>{fmtFartVerdi(aktivFart, sport)}</b></>}
        </p>
      )}
    </div>
  )
}

/** Generisk serie → SVG-sti. `somFlate` lukker mot bunnen (høydeprofil). */
function tilSti(serie: Array<{ t: number; v: number }>, totalSek: number, somFlate: boolean): string {
  if (serie.length === 0) return ''
  const steg = Math.max(1, Math.floor(serie.length / 300))
  const punkter = serie.filter((_, i) => i % steg === 0)
  let lo = Infinity, hi = -Infinity
  for (const p of punkter) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v }
  if (!Number.isFinite(lo)) return ''
  const span = Math.max(1e-6, hi - lo)
  const deler = punkter.map((p, i) => {
    const x = (p.t / Math.max(1, totalSek)) * 1000
    const y = 12 + (1 - (p.v - lo) / span) * (KURVE_HOYDE - 24)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  if (somFlate) {
    const sisteX = ((punkter[punkter.length - 1].t / Math.max(1, totalSek)) * 1000).toFixed(1)
    const forsteX = ((punkter[0].t / Math.max(1, totalSek)) * 1000).toFixed(1)
    deler.push(`L${sisteX} ${KURVE_HOYDE}`, `L${forsteX} ${KURVE_HOYDE}`, 'Z')
  }
  return deler.join(' ')
}

/** Snitt av en generisk {t, v}-serie i [start, slutt] — null under 2 punkter. */
function snittIVindu(serie: Array<{ t: number; v: number }>, startSek: number, sluttSek: number): number | null {
  let sum = 0, n = 0
  for (const p of serie) {
    if (p.t < startSek) continue
    if (p.t > sluttSek) break
    sum += p.v; n++
  }
  return n < 2 ? null : sum / n
}

function fmtFartVerdi(mps: number, sport: string | null): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const sekPerKm = 1000 / mps
  const m = Math.floor(sekPerKm / 60)
  const sek = Math.round(sekPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}

// ── Rekkefølge (pointer-basert vertikal dra — virker på touch) ──

function RekkefolgeListe({
  rader, rekkefolge, onEndre,
}: {
  rader: DetaljerRad[]
  rekkefolge: string[]
  onEndre: (ny: string[]) => void
}) {
  const [drasId, setDrasId] = useState<string | null>(null)
  const radHoyde = 44

  const flyttTil = (fraId: string, clientY: number, liste: HTMLElement) => {
    const r = liste.getBoundingClientRect()
    const idx = Math.max(0, Math.min(rekkefolge.length - 1, Math.floor((clientY - r.top) / radHoyde)))
    const fraIdx = rekkefolge.indexOf(fraId)
    if (fraIdx === idx || fraIdx < 0) return
    const ny = [...rekkefolge]
    ny.splice(fraIdx, 1)
    ny.splice(idx, 0, fraId)
    onEndre(ny)
  }

  const raderIOrden = rekkefolge
    .map(id => rader.find(r => r.id === id))
    .filter((r): r is DetaljerRad => !!r)

  return (
    <div
      onPointerMove={e => { if (drasId) flyttTil(drasId, e.clientY, e.currentTarget) }}
      onPointerUp={() => setDrasId(null)}
      onPointerLeave={() => setDrasId(null)}
      style={{ touchAction: drasId ? 'none' : 'auto' }}>
      {raderIOrden.map(r => (
        <div key={r.id}
          className="flex items-center gap-3"
          style={{
            height: radHoyde - 4, marginBottom: 4, padding: '0 10px',
            background: drasId === r.id ? 'rgba(255,69,0,.08)' : 'var(--flate-12-alt)',
            border: `1px solid ${drasId === r.id ? 'var(--accent)' : 'var(--kant-3)'}`,
            borderRadius: 8,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)',
          }}>
          <span
            onPointerDown={e => {
              e.currentTarget.setPointerCapture?.(e.pointerId)
              setDrasId(r.id)
            }}
            style={{ cursor: 'grab', color: 'var(--tekst-8-alt)', fontSize: 16, padding: '8px 6px', touchAction: 'none' }}>
            ⣿
          </span>
          <span style={{ color: 'var(--tekst-1-app)' }}>{finnEtikett(r)}</span>
          {r.duration_seconds != null && r.duration_seconds > 0 && (
            <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)', fontSize: 13 }}>
              {fmtKlokkeSek(r.duration_seconds)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Småting ──────────────────────────────────────────────────

function Overskrift({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
      {children}
    </p>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, lineHeight: 1.5,
      color: 'var(--tekst-8-alt)', border: '1px dashed var(--kant-3)', borderRadius: 8, padding: '10px 12px',
    }}>
      {children}
    </p>
  )
}

function PunktRad({
  farge, navn, tid, onPlasser, onFjern,
}: {
  farge: string
  navn: string
  tid: string | null
  onPlasser: () => void
  onFjern: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: farge }} />
      <span style={{ minWidth: 150 }}>{navn}</span>
      {tid ? (
        <>
          <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{tid}</b>
          <span style={{ fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>dra prikken på kurven for å flytte</span>
          <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={onFjern}>
            Fjern tidspunkt
          </button>
        </>
      ) : (
        <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
          onClick={onPlasser}>
          Plasser på kurven
        </button>
      )}
    </div>
  )
}

// Redigerbart tidsfelt (mm:ss eller t:mm:ss) — den andre veien i
// live-synkroniseringen: raden flytter markøren på kurven.
function TidInput({ sek, onSek }: { sek: number; onSek: (sek: number) => void }) {
  const [tekst, setTekst] = useState<string | null>(null)
  const bruk = () => {
    if (tekst == null) return
    const deler = tekst.trim().split(':').map(Number)
    if (deler.length >= 2 && deler.every(d => Number.isFinite(d) && d >= 0)) {
      const nySek = deler.length === 3
        ? deler[0] * 3600 + deler[1] * 60 + deler[2]
        : deler[0] * 60 + deler[1]
      onSek(nySek)
    }
    setTekst(null)
  }
  return (
    <input type="text" inputMode="numeric"
      value={tekst ?? fmtKlokkeSek(sek)}
      onFocus={e => { setTekst(fmtKlokkeSek(sek)); e.currentTarget.select() }}
      onChange={e => setTekst(e.target.value)}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
        width: 62, textAlign: 'center', minHeight: 32,
        color: 'var(--tekst-1-app)', background: 'var(--flate-12-alt)',
        border: '1px solid var(--kant-3)', borderRadius: 6,
      }} />
  )
}

function vinduFarge(r: DetaljerRad): string {
  const ps = r.prone_shots ?? 0, ss = r.standing_shots ?? 0
  if (ps > 0 && ss === 0) return SEGMENT_FARGER.skyting_ligg
  if (ss > 0 && ps === 0) return SEGMENT_FARGER.skyting_staa
  if (r.activity_type === 'skyting_liggende') return SEGMENT_FARGER.skyting_ligg
  if (r.activity_type === 'skyting_staaende') return SEGMENT_FARGER.skyting_staa
  return SEGMENT_FARGER.skyting_annet
}

function finnEtikett(r: DetaljerRad): string {
  const type = findActivityType((r.activity_type ?? '') as ActivityType)
  const base = type?.label ?? (r.activity_type || 'Aktivitet')
  if ((r.activity_type ?? '').startsWith('skyting')) {
    const ps = r.prone_shots ?? 0, ss = r.standing_shots ?? 0
    if (ps > 0 && ss === 0) return `Skyting · ligg ${r.prone_hits ?? 0}/${ps}`
    if (ss > 0 && ps === 0) return `Skyting · stå ${r.standing_hits ?? 0}/${ss}`
    if (ps > 0 && ss > 0) return `Skyting L ${r.prone_hits ?? 0}/${ps} · S ${r.standing_hits ?? 0}/${ss}`
    return base
  }
  if (r.activity_type === 'aktivitet' && r.movement_name) return r.movement_name
  return base
}
