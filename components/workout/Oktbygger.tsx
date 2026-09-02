'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  SEGMENT_FARGER, PUNKT_FARGER, segmentBakgrunn, segmentTypeFor, fmtKlokkeSek, pulsIVindu,
} from '@/lib/segmenter'
import {
  plasserRader, kuttRad, radVed, naboEtter, slaaSammenMedNeste, settRadStart, settRadVarighet,
  slettRad, typerForRad, etikettFor, klokkeslettTilSek, sekTilKlokkeslett, type Utkast,
} from '@/lib/oktbygger-rader'
import { OktKurve, type KurveSerie, type KurveHjelpere } from './OktKurve'
import { BlokkLerret } from './BlokkLerret'
import { RundeValg } from './RundeValg'
import { PlanSpokelse, VisPlanBryter } from './PlanSpokelse'
import { hentPlanensRunder, type PlanBlokk } from '@/app/actions/runder'
import { visPlanBak, settVisPlanBak, VIS_PLAN_HENDELSE } from '@/lib/vis-plan'
import { ByggSum } from './ByggSum'
import { lagreVindu, hentVindu } from '@/lib/kurve-zoom'
import { PAUSE_TYPER, type ActivityRow, type ActivityType, type LactateRow, type NutritionEntryRow, type ShootingSeriesRow, type Sport } from '@/lib/types'
import type { HeartZone } from '@/lib/heart-zones'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { IntervallBygger } from './IntervallBygger'
import { PlottTreffPopup } from './PlottTreff'

// ØKTBYGGEREN — omlegging v6. RADENE ER EDITOREN.
//
// Byggeren arbeider på SKJEMAETS egne aktivitetsrader (bolk 3): alt den
// gjør — kutt, grenser som tall, del/slå sammen, type, navn — skriver
// radene i skjemaet, og grafen i oppsummeringskortet tegner de samme
// radene i samme øyeblikk. Ingen egen lagring: økta lagres som vanlig.
//   · HURTIGOPPSETTET (antall × dragtid × sone / pause) — uendret,
//     lib/intervall-generator som før.
//   · KUTT: klikk på kurven i kutt-modus = kuttpunkt; raden som dekker
//     tidspunktet deles i to, begge får start/varighet, samme type og
//     bevegelsesform. Klokkerunder er ferdige kutt.
//   · TALL I RADEN: start/varighet skrivbare — flytter grensen mot naboen,
//     aldri hull, aldri overlapp. Samme grense som skjemaets varighetsfelt.
//   · «Del her» / «Slå sammen med neste» / Slett / type / navn i raden.
//   · ANGRE steg for steg. Ulagrede endringer: skjemaets eget vern.
//
// Pulsen LESES fra vinduet, arves aldri: kutt og grenseflytting tømmer
// ført snitt/maks på de berørte radene, visningen leser det målte, og
// lagringen skriver det på nytt fra samples i full oppløsning.

export function OktbyggerInngang({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        color: 'var(--accent)', background: 'rgba(255,69,0,.08)',
        border: '1px solid var(--accent)', borderRadius: 999,
        padding: '6px 14px', cursor: 'pointer', minHeight: 32,
      }}>
      ⚡ Øktbygger
    </button>
  )
}

export function OktbyggerPopup({
  workoutId, sport, rader, onRader, klokke, erPlanlagt, heartZones, rpe, timeOfDay,
  laktat, onLaktat, ernaering, onErnaering, onRaderFraBasen,
  onClose, onSerierLagret, onOpprett,
}: {
  /** null = økta er ikke lagret ennå: klokkeverktøyene finnes ikke, bare hurtigoppsettet. */
  workoutId: string | null
  sport?: Sport
  /** Skjemaets rader — byggerens eneste sannhet. */
  rader: ActivityRow[]
  onRader: (rader: ActivityRow[]) => void
  /** Klokkedataene skjemaet alt har hentet (samples, totalSek, radinfo). */
  klokke: WorkoutKlokkesyncData | null
  erPlanlagt: boolean
  heartZones: HeartZone[]
  rpe: number | null
  timeOfDay: string
  laktat: LactateRow[]
  onLaktat: (l: LactateRow[]) => void
  ernaering: NutritionEntryRow[]
  onErnaering: (n: NutritionEntryRow[]) => void
  /** Rundebyttet skriver til basen — skjemaet henter radene inn på nytt. */
  onRaderFraBasen: () => Promise<void>
  onClose: () => void
  /** Videresendes fra «Plott treff» når serier lagres derfra. */
  onSerierLagret?: (lagret: Array<{ activityId: string; serier: ShootingSeriesRow[] }>) => void
  /** Hurtigoppsettet leverer genererte rader + forslags-tittel. */
  onOpprett?: (rader: ActivityRow[], tittel: string) => void | Promise<void>
}) {
  const harKurve = !!klokke?.samples && Object.values(klokke.samples).some(v => v && (v as unknown[]).length > 0)
  const grunnlag = useMemo(() => ({
    totalSek: klokke?.totalSek ?? 0, harKurve, radInfo: klokke?.radInfo ?? {},
  }), [klokke, harKurve])
  const plassering = useMemo(() => plasserRader(rader, grunnlag), [rader, grunnlag])
  const totalSek = harKurve
    ? grunnlag.totalSek
    : plassering.reduce((m, u) => Math.max(m, u.startSek + u.varighetSek), 0)

  const [planBlokker, setPlanBlokker] = useState<PlanBlokk[]>([])
  const visPlan = useSyncExternalStore(abonnerVisPlan, visPlanBak, () => false)
  const [valgtRad, setValgtRad] = useState<string | null>(null)
  const [kuttModus, setKuttModus] = useState(false)
  const [visPlottTreff, setVisPlottTreff] = useState(false)
  const [hurtigAapent, setHurtigAapent] = useState(!workoutId || rader.length === 0)
  const [kurve, setKurve] = useState<'puls' | 'fart' | 'watt'>(() =>
    klokke?.samples?.hr_samples?.length ? 'puls' : (klokke?.samples?.pace_samples ?? klokke?.samples?.speed_samples)?.length ? 'fart' : 'watt')
  // ANGRE: forrige radsett, steg for steg. Lever i byggeren til den lukkes.
  const [angreStabel, setAngreStabel] = useState<ActivityRow[][]>([])
  const endre = (neste: ActivityRow[]) => {
    setAngreStabel(st => [...st.slice(-49), rader])
    onRader(neste)
  }
  const angre = () => {
    const forrige = angreStabel[angreStabel.length - 1]
    if (!forrige) return
    setAngreStabel(st => st.slice(0, -1))
    onRader(forrige)
  }

  useEffect(() => {
    if (!workoutId) return
    let avbrutt = false
    hentPlanensRunder(workoutId).then(b => { if (!avbrutt) setPlanBlokker(b) }).catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId])

  const userHasBiathlon = sport === 'biathlon' || rader.some(r => r.activity_type.startsWith('skyting'))
  const skytingRader = rader.filter(r => r.activity_type.startsWith('skyting'))
  const hr = useMemo(() => (klokke?.samples?.hr_samples ?? []).map(p => ({ t: p.t, hr: p.hr })), [klokke])

  /** Klikk på kurven i kutt-modus: raden som dekker tidspunktet deles der. */
  const kuttVed = (sek: number) => {
    const u = radVed(plassering, sek)
    if (!u) return
    endre(kuttRad(rader, plassering, u.id, sek))
    setValgtRad(u.id)
  }

  const endreRad = (id: string, patch: Partial<ActivityRow>) =>
    endre(rader.map(r => (r.id === id ? { ...r, ...patch } : r)))

  // Laktat- og ernæringspunkter bor i skjemaet (samme rader som «Laktat»
  // og «Ernæring» lenger nede) — her får de bare et tidspunkt.
  const startSek = klokkeslettTilSek(timeOfDay)
  const laktatSek = (l: LactateRow) => (l.measured_at_time ? Math.max(0, klokkeslettTilSek(l.measured_at_time) - startSek) : null)
  const settLaktatSek = (id: string, sek: number | null) =>
    onLaktat(laktat.map(l => (l.id === id ? { ...l, measured_at_time: sek == null ? '' : sekTilKlokkeslett(startSek + sek) } : l)))
  const settErnaeringMin = (id: string, min: number | null) =>
    onErnaering(ernaering.map(n => (n.id === id ? { ...n, time_offset_minutes: min == null ? '' : String(min) } : n)))

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
        <div className="flex items-center justify-between px-5 py-4 gap-2 flex-wrap"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.08em' }}>
            Øktbygger
          </h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {angreStabel.length > 0 && (
              <button type="button" onClick={angre} style={pille()}>↶ Angre</button>
            )}
            {workoutId && skytingRader.length > 0 && (
              <button type="button" onClick={() => setVisPlottTreff(true)}
                style={pille('#FF4500')}>
                🎯 Plott treff
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Lukk"
              style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontSize: 20, cursor: 'pointer', minWidth: 36, minHeight: 36 }}>
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ── HURTIGOPPSETTET ── radene går rett i skjemaet. */}
          {onOpprett && sport && (
            <div data-hurtigoppsett>
              <button type="button" onClick={() => setHurtigAapent(v => !v)}
                aria-expanded={hurtigAapent}
                className="w-full flex items-center gap-2 text-left"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  letterSpacing: '0.12em', fontSize: 11.5, textTransform: 'uppercase',
                  color: 'var(--tekst-5-app)', background: 'none', border: 'none',
                  padding: '4px 0', cursor: 'pointer', minHeight: 36,
                }}>
                <span style={{ color: 'var(--accent)' }}>⚡</span> Hurtigoppsett — antall × dragtid × sone / pause
                <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>{hurtigAapent ? '▴' : '▾'}</span>
              </button>
              {hurtigAapent && (
                <IntervallBygger
                  sport={sport}
                  onAvbryt={workoutId ? () => setHurtigAapent(false) : undefined}
                  onOpprett={async (nye, tittel) => {
                    await onOpprett(nye, tittel)
                    onClose()
                  }}
                />
              )}
            </div>
          )}

          {!workoutId && !onOpprett && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Lagre økta først, så kan den bygges i tid her.
            </p>
          )}

          {workoutId && rader.length === 0 && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Økta har ingen aktiviteter ennå — legg til én først, så kan den bygges i tid her.
            </p>
          )}

          {workoutId && rader.length > 0 && (
            <>
              {planBlokker.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <VisPlanBryter paa={visPlan} antall={planBlokker.length} onEndre={p2 => settVisPlanBak(p2)} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>
                    Planens {planBlokker.length} blokker legges bak — da ser du hvor økta forlot planen.
                  </span>
                </div>
              )}
              {/* Rundene: fra klokka, planens runder, eller tilbake (bolk 6).
                  Skriver til basen — radene hentes inn i skjemaet etterpå. */}
              <RundeValg workoutId={workoutId} onEndret={() => {
                setValgtRad(null)
                setAngreStabel([])
                void onRaderFraBasen()
              }} />

              {/* ── VERKTØYENE PÅ KURVEN ── */}
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setKuttModus(v => !v)}
                  aria-pressed={kuttModus} data-kutt-modus
                  style={pille(kuttModus ? 'var(--accent)' : undefined, kuttModus)}>
                  ✂ Kutt {kuttModus ? '· klikk på kurven' : ''}
                </button>
                {(() => {
                  const s = klokke?.samples
                  const valg = ([
                    ['puls', 'Puls', s?.hr_samples?.length ?? 0] as const,
                    ['fart', 'Fart', (s?.pace_samples ?? s?.speed_samples)?.length ?? 0] as const,
                    ['watt', 'Watt', s?.watt_samples?.length ?? 0] as const,
                  ]).filter(([, , n]) => n > 0)
                  if (valg.length < 2) return null
                  return valg.map(([id, navn]) => (
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
                  ))
                })()}
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>
                  {kuttModus
                    ? 'Klikk der økta skal deles — raden som dekker tidspunktet blir to.'
                    : 'Klikk en rad for tall og knapper. Klokkerunder er ferdige kutt.'}
                </span>
              </div>

              <KurveMedRader
                workoutId={workoutId}
                utkast={plassering}
                valgtRad={valgtRad}
                onVelgRad={setValgtRad}
                onKlikk={kuttModus ? kuttVed : undefined}
                erPlanlagt={erPlanlagt}
                samples={klokke?.samples ?? null}
                hr={hr}
                kurve={kurve}
                sport={sport ?? null}
                totalSek={totalSek}
                punkter={[
                  ...laktat.map(l => ({ id: l.id, farge: PUNKT_FARGER.laktat, sek: laktatSek(l), rund: true })),
                  ...ernaering.map(n => ({ id: n.id, farge: PUNKT_FARGER.ernaering, sek: n.time_offset_minutes.trim() ? (parseInt(n.time_offset_minutes) || 0) * 60 : null, rund: false })),
                ]}
                planBlokker={visPlan ? planBlokker : []}
              />

              {!harKurve && (
                <ByggSum utkast={plassering} heartZones={heartZones} rpe={rpe} erPlanlagt={erPlanlagt} />
              )}

              {/* ── RADENE ── tid som tall, del/slå sammen/slett/type/navn. */}
              <div className="space-y-1">
                <Overskrift>Radene — tid, type og navn</Overskrift>
                {plassering.map(u => {
                  const rad = rader.find(r => r.id === u.id)
                  if (!rad) return null
                  return (
                    <Rad key={u.id}
                      u={u}
                      alle={plassering}
                      valgt={valgtRad === u.id}
                      hr={hr}
                      userHasBiathlon={userHasBiathlon}
                      harNabo={!!naboEtter(plassering, u.id)}
                      onVelg={() => setValgtRad(valgtRad === u.id ? null : u.id)}
                      onStart={sek => endre(settRadStart(rader, plassering, u.id, sek))}
                      onVarighet={sek => endre(settRadVarighet(rader, plassering, u.id, sek, totalSek))}
                      onType={t => endreRad(u.id, { activity_type: t })}
                      onNavn={navn => endreRad(u.id, { lap_notes: navn })}
                      onDel={() => endre(kuttRad(rader, plassering, u.id))}
                      onSlaaSammen={() => endre(slaaSammenMedNeste(rader, plassering, u.id))}
                      onSlett={() => { setValgtRad(null); endre(slettRad(rader, plassering, u.id)) }}
                    />
                  )
                })}
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                  Km, puls, bevegelsesform og resten redigeres i aktivitetsradene i skjemaet — det er samme rader.
                </p>
              </div>

              {/* ── Punkter — målingene som er ført, får et tidspunkt ── */}
              {(laktat.length > 0 || ernaering.length > 0) && (
                <div className="space-y-2">
                  <Overskrift>Punkter på kurven</Overskrift>
                  {laktat.map(l => (
                    <PunktRad key={l.id}
                      farge={PUNKT_FARGER.laktat}
                      navn={`Laktat ${l.mmol ? String(l.mmol).replace('.', ',') + ' mmol' : '(uten verdi)'}`}
                      sek={laktatSek(l)}
                      onSek={s => settLaktatSek(l.id, Math.max(0, Math.round(s)))}
                      onPlasser={() => settLaktatSek(l.id, Math.round(totalSek / 2))}
                      onFjern={() => settLaktatSek(l.id, null)}
                    />
                  ))}
                  {ernaering.map(n => (
                    <PunktRad key={n.id}
                      farge={PUNKT_FARGER.ernaering}
                      navn={`Ernæring — ${n.nutrition_type || n.custom_label || 'inntak'}${n.carbs_g ? ` (${n.carbs_g} g)` : ''}`}
                      sek={n.time_offset_minutes.trim() ? (parseInt(n.time_offset_minutes) || 0) * 60 : null}
                      onSek={s => settErnaeringMin(n.id, Math.max(0, Math.round(s / 60)))}
                      onPlasser={() => settErnaeringMin(n.id, Math.round(totalSek / 120))}
                      onFjern={() => settErnaeringMin(n.id, null)}
                    />
                  ))}
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                    Punktene er målingene du allerede har ført — her får de bare et tidspunkt.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
            Endringene ligger i skjemaet — lagre økta som vanlig.
          </span>
          <button type="button" onClick={onClose} className="xp-pill xp-pill-primary">Lukk</button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(body, document.body)}
      {visPlottTreff && workoutId && (
        <PlottTreffPopup
          workoutId={workoutId}
          onClose={() => setVisPlottTreff(false)}
          onLagret={lagret => onSerierLagret?.(lagret)}
        />
      )}
    </>
  )
}

function pille(farge?: string, fylt = false): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    letterSpacing: '0.1em', fontSize: 12, textTransform: 'uppercase',
    color: fylt ? 'var(--tekst-1-ren)' : (farge ?? 'var(--tekst-1-app)'),
    background: fylt ? (farge ?? 'var(--accent)') : 'none',
    border: `1.5px solid ${farge ?? 'var(--line2)'}`, borderRadius: 999,
    padding: '6px 14px', cursor: 'pointer', minHeight: 36, whiteSpace: 'nowrap',
  }
}

/** Abonnerer på «vis plan»-valget — samme hendelse som bryteren sender. */
function abonnerVisPlan(oppdater: () => void): () => void {
  window.addEventListener(VIS_PLAN_HENDELSE, oppdater)
  window.addEventListener('storage', oppdater)
  return () => {
    window.removeEventListener(VIS_PLAN_HENDELSE, oppdater)
    window.removeEventListener('storage', oppdater)
  }
}

// ── Kurven med radene som bånd ───────────────────────────────

const KURVE_HOYDE = 190

// Samme fargefasit som økt-grafen (design/xpulse-oktgraf-design.html).
export const KURVE_FARGER = {
  puls: '#E23A5A',
  fart: '#28A86E',
  watt: '#E8B93C',
} as const

type KurveValg = keyof typeof KURVE_FARGER

interface Punkt { id: string; farge: string; sek: number | null; rund: boolean }

function KurveMedRader({
  workoutId, utkast, valgtRad, onVelgRad, onKlikk, erPlanlagt,
  samples, hr, kurve, sport, totalSek, punkter, planBlokker,
}: {
  workoutId: string
  utkast: Utkast[]
  valgtRad: string | null
  onVelgRad: (id: string | null) => void
  /** Kutt-modus: klikk i flata → tidspunkt. */
  onKlikk?: (sek: number) => void
  erPlanlagt: boolean
  samples: WorkoutKlokkesyncData['samples']
  hr: Array<{ t: number; hr: number }>
  kurve: KurveValg
  sport: string | null
  totalSek: number
  punkter: Punkt[]
  planBlokker: PlanBlokk[]
}) {
  const kurveSerier: KurveSerie[] = useMemo(() => {
    const ut: KurveSerie[] = []
    const fart = samples?.pace_samples ?? samples?.speed_samples ?? []
    const watt = samples?.watt_samples ?? []
    const hoyde = samples?.altitude_samples ?? []
    if (hr.length > 0) ut.push({
      id: 'puls', navn: 'Puls', farge: KURVE_FARGER.puls,
      punkter: hr.map(p => ({ t: p.t, v: p.hr })), format: (v: number) => `${Math.round(v)}`,
    })
    if (fart.length > 0) ut.push({
      id: 'fart', navn: 'Fart', farge: KURVE_FARGER.fart,
      punkter: fart.map(p => ({ t: p.t, v: p.mps })), format: (v: number) => fmtFartVerdi(v, sport),
    })
    if (watt.length > 0) ut.push({
      id: 'watt', navn: 'Watt', farge: KURVE_FARGER.watt,
      punkter: watt.map(p => ({ t: p.t, v: p.w })), format: (v: number) => `${Math.round(v)}`,
    })
    if (hoyde.length > 2) ut.push({
      id: 'hoyde', navn: 'Høyde', farge: 'var(--tekst-5-app)',
      punkter: hoyde.map(p => ({ t: p.t, v: p.alt })), format: (v: number) => `${Math.round(v)}`,
      somAreal: true,
    })
    return ut
  }, [samples, hr, sport])

  const [vindu, setVindu] = useState<[number, number] | null>(() => hentVindu(workoutId))

  const tallFor = (u: Utkast) => {
    const fort = (v: string) => { const n = parseInt(v); return Number.isFinite(n) ? n : null }
    const f = { snitt: fort(u.snittpuls), maks: fort(u.makspuls) }
    if (f.snitt != null || f.maks != null) return f
    if (hr.length === 0) return f
    if (PAUSE_TYPER.has(u.type) || u.type.startsWith('skyting')) return { snitt: null, maks: null }
    const m = pulsIVindu(hr, u.startSek, u.startSek + u.varighetSek)
    return { snitt: m.snitt, maks: m.maks }
  }

  // «plan: 8 min» — blokka må dekke radens midtpunkt og være av samme type.
  const planTekstFor = (u: Utkast) => {
    if (planBlokker.length === 0) return null
    const midt = u.startSek + u.varighetSek / 2
    const minType = segmentTypeFor(u.type, u.bevegelsesform)
    const b = planBlokker.find(x => midt >= x.startSek && midt < x.sluttSek && segmentTypeFor(x.type, '') === minType)
    if (!b) return null
    const planSek = b.sluttSek - b.startSek
    if (Math.abs(planSek - u.varighetSek) < 5) return null
    return `plan: ${fmtKlokkeSek(planSek)}`
  }

  const overlay = (h: KurveHjelpere, paaKurve: boolean) => (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: onKlikk ? 'none' : undefined }}>
      <PlanSpokelse blokker={planBlokker} pct={h.pct} />
      <RadLag utkast={utkast} valgtId={valgtRad} h={h} onVelg={onVelgRad}
        tallFor={tallFor} planTekstFor={planTekstFor} klikkbar={!onKlikk} />
      {punkter.map(p => {
        if (p.sek == null) return null
        const y = paaKurve ? h.yPctForSerie(kurve, p.sek) : '18%'
        return (
          <span key={p.id} style={{
            position: 'absolute', left: h.pct(p.sek), top: y,
            transform: `translate(-50%, -50%)${p.rund ? '' : ' rotate(45deg)'}`,
            width: p.rund ? 12 : 11, height: p.rund ? 12 : 11, borderRadius: p.rund ? '50%' : 2,
            background: erPlanlagt ? 'transparent' : p.farge,
            border: `2px ${erPlanlagt ? 'dashed' : 'solid'} ${erPlanlagt ? p.farge : 'var(--flate-3)'}`,
            pointerEvents: 'none', zIndex: 5,
          }} />
        )
      })}
    </div>
  )

  const harKurve = kurveSerier.some(k => !k.somAreal && k.punkter.length > 0)
  if (!harKurve) {
    return <BlokkLerret totalSek={totalSek} planlagt={erPlanlagt} overlay={h => overlay(h, false)} onKlikk={onKlikk} />
  }

  const valgt = utkast.find(u => u.id === valgtRad) ?? null
  return (
    <div style={{ cursor: onKlikk ? 'crosshair' : undefined }}>
      <OktKurve
        serier={kurveSerier}
        paaIds={kurveSerier.filter(x => x.id === kurve || x.somAreal).map(x => x.id)}
        fokusId={kurve}
        totalSek={totalSek}
        hoyde={KURVE_HOYDE}
        vindu={vindu ?? undefined}
        onKlikk={onKlikk}
        onVindu={v => {
          const heleOkta = v[0] <= 0.5 && v[1] >= totalSek - 0.5
          setVindu(heleOkta ? null : v)
          lagreVindu(workoutId, heleOkta ? [0, totalSek] : v)
        }}
        overlay={h => overlay(h, true)}
      />
      {valgt && (() => {
        const puls = pulsIVindu(hr, valgt.startSek, valgt.startSek + valgt.varighetSek)
        return (
          <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
            <b>{etikettFor(valgt, utkast)}</b>
            {' '}{fmtKlokkeSek(valgt.startSek)}–{fmtKlokkeSek(valgt.startSek + valgt.varighetSek)}
            {' · varighet '}<b>{fmtKlokkeSek(valgt.varighetSek)}</b>
            {puls.snitt != null
              ? <>{' · puls snitt '}<b>{puls.snitt}</b>{puls.inn != null ? <>{' · inn '}<b>{puls.inn}</b></> : null}</>
              : <>{' · puls: for lite data'}</>}
            {valgt.type.startsWith('skyting') && (
              <span style={{ color: 'var(--tekst-8-alt)' }}>
                {' · '}{valgt.skytetidSek != null
                  ? `ført skytetid ${fmtKlokkeSek(valgt.skytetidSek)} — teller i statistikken`
                  : 'kun puls-markering — utenfor skytetid-statistikk'}
              </span>
            )}
          </p>
        )
      })()}
    </div>
  )
}

// ── Radene som bånd på lerretet — lesevisning, klikk velger raden ──

function RadLag({ utkast, valgtId, h, onVelg, tallFor, planTekstFor, klikkbar }: {
  utkast: Utkast[]
  valgtId: string | null
  h: KurveHjelpere
  onVelg: (id: string | null) => void
  tallFor: (u: Utkast) => { snitt: number | null; maks: number | null }
  planTekstFor: (u: Utkast) => string | null
  klikkbar: boolean
}) {
  return (
    <>
      {[...utkast].sort((a, b) => a.startSek - b.startSek).map(u => {
        const type = segmentTypeFor(u.type, u.bevegelsesform)
        const farge = SEGMENT_FARGER[type]
        const valgt = valgtId === u.id
        const andel = u.varighetSek / Math.max(1, h.tilSek - h.fraSek)
        const smalt = andel < 0.03
        const t = tallFor(u)
        const plan = planTekstFor(u)
        return (
          <button key={u.id} type="button" tabIndex={klikkbar ? 0 : -1}
            onClick={e => { e.stopPropagation(); onVelg(valgt ? null : u.id) }}
            aria-label={`${etikettFor(u, utkast)} ${fmtKlokkeSek(u.startSek)}–${fmtKlokkeSek(u.startSek + u.varighetSek)}`}
            style={{
              position: 'absolute', left: h.pct(u.startSek),
              width: `calc(${h.pct(h.fraSek + u.varighetSek)} - 1px)`, minWidth: 10,
              top: 6, bottom: 26, padding: 0, borderRadius: 6,
              zIndex: smalt ? 4 : 2,
              background: segmentBakgrunn(type), opacity: valgt ? 0.34 : 0.18,
              border: `1.5px solid ${farge}`,
              boxShadow: valgt ? `0 0 0 2px ${farge}66` : 'none',
              cursor: klikkbar ? 'pointer' : 'inherit',
              pointerEvents: klikkbar ? 'auto' : 'none',
            }}>
            <span style={{
              position: 'absolute', top: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: farge,
            }}>
              {smalt ? '' : etikettFor(u, utkast)}
              {!smalt && (t.snitt != null || t.maks != null) && (
                <span style={{ color: 'var(--tekst-5-app)' }}>
                  {t.snitt != null ? ` · snitt ${t.snitt}` : ''}
                  {t.maks != null ? ` · maks ${t.maks}` : ''}
                </span>
              )}
            </span>
            {!smalt && plan && (
              <span style={{
                position: 'absolute', bottom: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5,
                letterSpacing: '0.05em', color: 'var(--tekst-8-alt)', fontStyle: 'italic',
              }}>
                {plan}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

// ── Én rad i lista — tall og knapper ─────────────────────────

function Rad({
  u, alle, valgt, hr, userHasBiathlon, harNabo,
  onVelg, onStart, onVarighet, onType, onNavn, onDel, onSlaaSammen, onSlett,
}: {
  u: Utkast
  alle: Utkast[]
  valgt: boolean
  hr: Array<{ t: number; hr: number }>
  userHasBiathlon: boolean
  harNabo: boolean
  onVelg: () => void
  onStart: (sek: number) => void
  onVarighet: (sek: number) => void
  onType: (t: ActivityType) => void
  onNavn: (navn: string) => void
  onDel: () => void
  onSlaaSammen: () => void
  onSlett: () => void
}) {
  const farge = SEGMENT_FARGER[segmentTypeFor(u.type, u.bevegelsesform)]
  const puls = pulsIVindu(hr, u.startSek, u.startSek + u.varighetSek)
  const knapp: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11.5,
    letterSpacing: '0.08em', textTransform: 'uppercase', background: 'none',
    border: '1px solid var(--line2)', color: 'var(--tekst-1-app)',
    borderRadius: 999, padding: '6px 12px', minHeight: 36, cursor: 'pointer',
  }
  return (
    <div data-oktbygger-rad data-valgt={valgt ? '1' : '0'}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
        color: 'var(--tekst-5-app)', background: valgt ? 'var(--flate-12-alt)' : 'none',
        border: `1px solid ${valgt ? farge : 'var(--kant-3)'}`,
        borderLeft: `3px solid ${farge}`,
        borderRadius: 8, padding: '8px 10px',
      }}>
      <div role="button" tabIndex={0} onClick={onVelg}
        onKeyDown={e => {
          // Enter i et tidsfelt inni raden skal IKKE velge/avvelge raden
          // (målt: Enter i «start» vippet valget) — bare raden selv.
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVelg() }
        }}
        className="flex items-center gap-3 flex-wrap text-left"
        style={{ minHeight: 36, cursor: 'pointer' }}>
        <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600, minWidth: 96 }}>{etikettFor(u, alle)}</b>
        <span>{fmtKlokkeSek(u.startSek)}–{fmtKlokkeSek(u.startSek + u.varighetSek)}</span>
        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>start</span>
        <TidInput sek={u.startSek} onSek={onStart} />
        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>varighet</span>
        <TidInput sek={u.varighetSek} onSek={onVarighet} />
        {(u.snittpuls || puls.snitt != null) && (
          <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>
            snitt {u.snittpuls || puls.snitt}{u.snittpuls ? '' : ' · målt'}
          </span>
        )}
      </div>
      {valgt && (
        <div className="flex gap-2 flex-wrap items-center mt-2">
          <select value={u.type}
            onChange={e => onType(e.target.value as ActivityType)}
            aria-label="Type"
            style={{ ...knapp, paddingRight: 8 }}>
            {typerForRad(userHasBiathlon, u.type).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <NavnFelt navn={u.navn} plassholder={etikettFor(u, alle)} onNavn={onNavn} />
          <button type="button" style={knapp} onClick={onDel} disabled={u.varighetSek < 10}
            title="Deler raden på midten — begge får start og varighet">
            Del her
          </button>
          {harNabo && (
            <button type="button" style={knapp} onClick={onSlaaSammen}>Slå sammen med neste</button>
          )}
          <button type="button" style={{ ...knapp, color: '#E23A5A', borderColor: '#E23A5A55' }} onClick={onSlett}>
            Slett
          </button>
        </div>
      )}
    </div>
  )
}

/** Navnet skrives lokalt og legges på angre-stabelen først når man går
    videre — ellers ville hvert tastetrykk vært et angre-steg. */
function NavnFelt({ navn, plassholder, onNavn }: {
  navn: string; plassholder: string; onNavn: (navn: string) => void
}) {
  const [tekst, setTekst] = useState<string | null>(null)
  const bruk = () => {
    if (tekst != null && tekst !== navn) onNavn(tekst)
    setTekst(null)
  }
  return (
    <input value={tekst ?? navn}
      onChange={e => setTekst(e.target.value)}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      placeholder={plassholder}
      aria-label="Navn på raden"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, minHeight: 36,
        background: 'var(--flate-14)', border: '1px solid var(--kant-3)',
        borderRadius: 8, color: 'var(--tekst-1-app)', padding: '6px 10px', width: 160,
      }} />
  )
}

function fmtFartVerdi(mps: number, sport: string | null): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const sekPerKm = 1000 / mps
  const m = Math.floor(sekPerKm / 60)
  const sek = Math.round(sekPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}

// Redigerbart tidsfelt (mm:ss eller t:mm:ss).
function TidInput({ sek, onSek }: { sek: number; onSek: (sek: number) => void }) {
  const [tekst, setTekst] = useState<string | null>(null)
  // Enter fulgt av blur skal gi ÉN skriving, ikke to (angre-stabelen fikk
  // et tomt steg). Utkastet leses fra en ref som nulles i det den brukes.
  const utkast = useRef<string | null>(null)
  const bruk = () => {
    const t = utkast.current
    if (t == null) return
    utkast.current = null
    const deler = t.trim().split(':').map(Number)
    if (deler.length >= 2 && deler.every(d => Number.isFinite(d) && d >= 0)) {
      onSek(deler.length === 3 ? deler[0] * 3600 + deler[1] * 60 + deler[2] : deler[0] * 60 + deler[1])
    }
    setTekst(null)
  }
  return (
    <input type="text" inputMode="numeric"
      value={tekst ?? fmtKlokkeSek(sek)}
      onClick={e => e.stopPropagation()}
      onFocus={e => { e.stopPropagation(); utkast.current = fmtKlokkeSek(sek); setTekst(utkast.current); e.currentTarget.select() }}
      onChange={e => { utkast.current = e.target.value; setTekst(e.target.value) }}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        width: 62, textAlign: 'center', minHeight: 36,
        color: 'var(--tekst-1-app)', background: 'var(--flate-14)',
        border: '1px solid var(--kant-3)', borderRadius: 6,
      }} />
  )
}

function Overskrift({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
      {children}
    </p>
  )
}

function PunktRad({ farge, navn, sek, onSek, onPlasser, onFjern }: {
  farge: string
  navn: string
  sek: number | null
  onSek: (sek: number) => void
  onPlasser: () => void
  onFjern: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: farge }} />
      <span style={{ minWidth: 150 }}>{navn}</span>
      {sek != null ? (
        <>
          <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>tidspunkt</span>
          <TidInput sek={sek} onSek={onSek} />
          <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onFjern}>
            Fjern tidspunkt
          </button>
        </>
      ) : (
        <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onPlasser}>
          Plasser på kurven
        </button>
      )}
    </div>
  )
}
