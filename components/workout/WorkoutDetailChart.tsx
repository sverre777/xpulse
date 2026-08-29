'use client'

import { useMemo, useState } from 'react'
import type { Sport } from '@/lib/types'
import {
  SEGMENT_FARGER, segmentBakgrunn, fmtKlokkeSek, pulsIVindu, type Segment,
} from '@/lib/segmenter'
import { OktKurve, type KurveSerie } from './OktKurve'

// Sample-arrays slik de er lagret i workout_samples-tabellen.
type HrSample = { t: number; hr: number }
type WattSample = { t: number; w: number }
type SpeedSample = { t: number; mps: number }
type AltSample = { t: number; alt: number }
type CadSample = { t: number; cad: number }

export interface WorkoutSamples {
  hr_samples: HrSample[] | null
  watt_samples: WattSample[] | null
  pace_samples: SpeedSample[] | null
  speed_samples: SpeedSample[] | null
  altitude_samples: AltSample[] | null
  cadence_samples: CadSample[] | null
}

export interface LapMarker {
  // Sekunder fra økt-start der lap-en starter.
  t_start: number
  index: number
  label?: string
}

export interface LactateMarker {
  // Sekunder fra økt-start.
  t: number
  mmol: number
}

export interface NutritionMarker {
  t: number
  type: string
  carbs_g: number | null
}

export interface ShootingMarker {
  t: number
  hits: number
  shots: number
  position: 'prone' | 'standing'
}

interface Props {
  sport: Sport
  samples: WorkoutSamples
  laps?: LapMarker[]
  lactate?: LactateMarker[]
  nutrition?: NutritionMarker[]
  shooting?: ShootingMarker[]
  segmenter?: Segment[]
  height?: number
}

// Økt-grafen (redesign, fasit design/xpulse-oktgraf-design.html).
//
// TO FEIL SOM ER RETTET HER:
//  (a) DOBBEL Y-AKSE (0–160 venstre, 0–600 høyre) brøt konvensjonen og
//      fikk kurver til å se ut som de krysset hverandre. Nå eier ÉN
//      fokus-serie aksen; øvrige påslåtte serier tegnes dempet som
//      formkontekst uten egen akse.
//  (b) ANNOTERINGENE HANG PÅ PULS-SERIEN — skrudde man av puls forsvant
//      skytingen. Skyting, segmenter, punkter og runder er merker på
//      TIDSLINJA og har nå egne av/på-brytere som overlever at puls (og
//      alle andre serier) er av. Puls brukes bare til å REGNE snittpuls.
//
// Tegnemotoren er OktKurve (delt SVG) — se den fila for hvorfor, og for
// nedsamplingen som er innebygd fra første versjon.
export function WorkoutDetailChart({
  sport, samples, laps = [], lactate = [], nutrition = [], shooting = [],
  segmenter = [],
  height = 300,
}: Props) {
  const serier = useMemo(() => byggSerier(sport, samples), [sport, samples])
  const forsteId = serier[0]?.id ?? null

  // Påslåtte serier + hvem som eier aksen. Klikk på en av-chip slår den
  // PÅ og gir den fokus; klikk på fokus-chipen slår serien AV.
  const [paaIds, setPaaIds] = useState<string[]>(() => serier.slice(0, 1).map(s => s.id))
  const [fokusId, setFokusId] = useState<string | null>(forsteId)
  // Annoteringene (fasitens «PÅ GRAFEN»-gruppe) — uavhengige av seriene.
  const [visSkyting, setVisSkyting] = useState(true)
  const [visSegmenter, setVisSegmenter] = useState(true)
  const [visPunkter, setVisPunkter] = useState(true)
  const [visRunder, setVisRunder] = useState(true)
  const [valgtSegment, setValgtSegment] = useState<string | null>(null)

  const totalSek = useMemo(() => {
    let maks = 0
    for (const s of serier) {
      const sist = s.punkter[s.punkter.length - 1]
      if (sist && sist.t > maks) maks = sist.t
    }
    return maks
  }, [serier])

  const velgSerie = (id: string) => {
    const paa = paaIds.includes(id)
    if (paa && fokusId === id) {
      setPaaIds(paaIds.filter(x => x !== id))
      const neste = paaIds.filter(x => x !== id).find(x => !serier.find(s => s.id === x)?.somAreal) ?? null
      setFokusId(neste)
      return
    }
    if (!paa) setPaaIds([...paaIds, id])
    const s = serier.find(x => x.id === id)
    if (!s?.somAreal) setFokusId(id)     // høyde er kontekst, aldri fokus
  }

  const fokus = serier.find(s => s.id === fokusId) ?? null
  const skytevinduer = segmenter.filter(sg => sg.paaKurven)
  const harPunkter = lactate.length > 0 || nutrition.length > 0
  const harSkyting = skytevinduer.length > 0 || (sport === 'biathlon' && shooting.length > 0)

  if (serier.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '14px' }}>
          Ingen sekund-data registrert for denne økten.
          Importer fra Strava eller last opp .fit-fil for å se grafen.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4" style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }}>
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
          Økt-graf
        </p>
        <div className="flex gap-4 flex-wrap">
          {/* DATA — seriene. Serie uten data får ingen chip (aldri en død knapp). */}
          <Gruppe navn="Data">
            {serier.map(s => (
              <Chip key={s.id} farge={s.farge} etikett={s.navn}
                paa={paaIds.includes(s.id)}
                fokus={fokusId === s.id && !s.somAreal}
                onClick={() => velgSerie(s.id)} />
            ))}
          </Gruppe>
          {/* PÅ GRAFEN — annoteringer på tidslinja, uavhengig av seriene. */}
          {(harSkyting || segmenter.length > 0 || harPunkter || laps.length > 1) && (
            <Gruppe navn="På grafen">
              {harSkyting && (
                <Chip farge="#38BDF8" etikett="Skyting" paa={visSkyting} fokus={false}
                  onClick={() => setVisSkyting(v => !v)} />
              )}
              {segmenter.length > 0 && (
                <Chip farge={SEGMENT_FARGER.drag} etikett="Segmenter" paa={visSegmenter} fokus={false}
                  onClick={() => setVisSegmenter(v => !v)} />
              )}
              {harPunkter && (
                <Chip farge="#E23A5A" etikett="Laktat/ernæring" paa={visPunkter} fokus={false}
                  onClick={() => setVisPunkter(v => !v)} />
              )}
              {laps.length > 1 && (
                <Chip farge="var(--tekst-8-alt)" etikett="Runder" paa={visRunder} fokus={false}
                  onClick={() => setVisRunder(v => !v)} />
              )}
            </Gruppe>
          )}
        </div>
      </div>

      <OktKurve
        serier={serier}
        paaIds={paaIds}
        fokusId={fokusId}
        totalSek={totalSek}
        hoyde={height}
        overlay={h => (
          <>
            {/* Rundegrenser */}
            {visRunder && laps.map((lap, i) => i === 0 ? null : (
              <span key={`lap-${i}`} aria-hidden style={{
                position: 'absolute', left: h.pct(lap.t_start), top: 0, bottom: 22,
                width: 1, background: 'var(--tekst-10-alt)', opacity: 0.55,
                borderLeft: '1px dashed var(--tekst-10-alt)',
              }} />
            ))}
            {/* Skytevinduer — egne merker på tidslinja, uavhengig av puls. */}
            {visSkyting && skytevinduer.map(sg => (
              <span key={`v-${sg.aktivitetId}`}
                title={`${sg.etikett}${sg.treff ? ` ${sg.treff}` : ''} · ${fmtKlokkeSek(sg.startSek)}–${fmtKlokkeSek(sg.sluttSek)}`}
                style={{
                  position: 'absolute', left: h.pct(sg.startSek),
                  width: `calc(${h.pct(sg.sluttSek - sg.startSek + h.fraSek)} - 0px)`,
                  minWidth: 6, top: 4, bottom: 26,
                  background: `${SEGMENT_FARGER[sg.type]}24`,
                  border: `1.5px solid ${SEGMENT_FARGER[sg.type]}`,
                  borderRadius: 6, pointerEvents: 'none',
                }}>
                <span style={{
                  position: 'absolute', top: 2, left: 4, whiteSpace: 'nowrap',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: SEGMENT_FARGER[sg.type],
                }}>
                  {sg.etikett}{sg.treff ? ` ${sg.treff}` : ''}
                </span>
              </span>
            ))}
            {/* Punktmarkører (pekelinje og kollisjonshåndtering kommer i bolk 5). */}
            {visPunkter && lactate.map((lac, i) => (
              <span key={`lac-${i}`} title={`Laktat ${lac.mmol} mmol · ${fmtKlokkeSek(lac.t)}`}
                style={{
                  position: 'absolute', left: h.pct(lac.t), top: fokus ? h.yPctForSerie(fokus.id, lac.t) : '20%',
                  transform: 'translate(-50%, -50%)', width: 9, height: 9, borderRadius: '50%',
                  background: '#E23A5A', border: '1.5px solid var(--flate-3)',
                }} />
            ))}
            {visPunkter && nutrition.map((n, i) => (
              <span key={`nut-${i}`} title={`Ernæring — ${n.type} · ${fmtKlokkeSek(n.t)}`}
                style={{
                  position: 'absolute', left: h.pct(n.t), top: fokus ? h.yPctForSerie(fokus.id, n.t) : '20%',
                  transform: 'translate(-50%, -50%) rotate(45deg)', width: 8, height: 8,
                  background: '#FFB300', border: '1.5px solid var(--flate-3)',
                }} />
            ))}
          </>
        )}
      />

      {/* Tallene skal finnes UTEN å treffe kurven (krysshåret kommer i
          bolk 2): fokus-seriens spenn for økta står alltid i tekst her. */}
      {fokus && (() => {
        const v = fokus.punkter.map(p => p.v)
        if (v.length === 0) return null
        const snitt = v.reduce((a, b) => a + b, 0) / v.length
        return (
          <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-5-app)' }}>
            <b style={{ color: fokus.farge }}>{fokus.navn}</b>
            {' · snitt '}<b>{fokus.format(snitt)}</b>
            {' · maks '}<b>{fokus.format(Math.max(...v))}</b>
            {' · lavest '}<b>{fokus.format(Math.min(...v))}</b>
          </p>
        )
      })()}

      {visSegmenter && segmenter.length > 0 && totalSek > 0 && (
        <SegmentBaand
          segmenter={segmenter}
          totalSek={totalSek}
          lactate={visPunkter ? lactate : []}
          nutrition={visPunkter ? nutrition : []}
          hr={samples.hr_samples}
          speed={samples.pace_samples ?? samples.speed_samples}
          sport={sport}
          valgt={valgtSegment}
          onVelg={setValgtSegment}
        />
      )}

      <MarkerLegend
        hasLactate={visPunkter && lactate.length > 0}
        hasNutrition={visPunkter && nutrition.length > 0}
        hasShooting={visSkyting && sport === 'biathlon' && shooting.length > 0}
        hasLaps={visRunder && laps.length > 1}
      />
    </div>
  )
}

// ── Serie-modellen ───────────────────────────────────────────
// Sport-reglene er de samme som før: watt skjules der det sjelden er
// meningsfylt, og tempo vises som hastighet for sykling/triatlon.
function byggSerier(sport: Sport, s: WorkoutSamples): KurveSerie[] {
  const ut: KurveSerie[] = []
  const wattRelevant = sport === 'cycling' || sport === 'triathlon' ||
    sport === 'long_distance_skiing' || sport === 'cross_country_skiing' ||
    sport === 'biathlon' || sport === 'running'

  if (s.hr_samples?.length) {
    ut.push({
      id: 'hr', navn: 'Puls', farge: '#E23A5A',
      punkter: s.hr_samples.map(p => ({ t: p.t, v: p.hr })),
      format: v => `${Math.round(v)}`,
    })
  }
  if (s.watt_samples?.length && wattRelevant) {
    ut.push({
      id: 'watt', navn: 'Watt', farge: '#E8B93C',
      punkter: s.watt_samples.map(p => ({ t: p.t, v: p.w })),
      format: v => `${Math.round(v)}`,
    })
  }
  const fart = s.pace_samples ?? s.speed_samples
  if (fart?.length) {
    const kmt = sport === 'cycling' || sport === 'triathlon'
    ut.push({
      id: 'fart', navn: kmt ? 'Hastighet' : 'Tempo', farge: '#28A86E',
      punkter: fart.map(p => ({ t: p.t, v: p.mps })),
      format: v => {
        if (kmt) return `${(v * 3.6).toFixed(1)}`
        if (v <= 0.1) return '—'
        const sek = 1000 / v
        return `${Math.floor(sek / 60)}:${String(Math.round(sek % 60)).padStart(2, '0')}`
      },
    })
  }
  if (s.cadence_samples?.length) {
    ut.push({
      id: 'kadens', navn: 'Kadens', farge: '#1A6FD4',
      punkter: s.cadence_samples.map(p => ({ t: p.t, v: p.cad })),
      format: v => `${Math.round(v)}`,
    })
  }
  if (s.altitude_samples?.length) {
    ut.push({
      id: 'hoyde', navn: 'Høyde', farge: 'var(--tekst-5-app)',
      punkter: s.altitude_samples.map(p => ({ t: p.t, v: p.alt })),
      format: v => `${Math.round(v)}`,
      somAreal: true,
    })
  }
  return ut
}

function Gruppe({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: 'var(--tekst-8-alt)', marginRight: 2,
      }}>
        {navn}
      </span>
      {children}
    </div>
  )
}

function Chip({ farge, etikett, paa, fokus, onClick }: {
  farge: string; etikett: string; paa: boolean; fokus: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      aria-pressed={paa}
      title={fokus ? `${etikett} — eier y-aksen` : paa ? `${etikett} — klikk for fokus` : `${etikett} — av`}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        border: `1px solid ${paa ? farge : 'var(--kant-3)'}`,
        // Fokus-chipen har lys ramme (fasiten) — den eier aksen.
        boxShadow: fokus ? '0 0 0 1.5px var(--tekst-1-app)' : 'none',
        color: paa ? farge : 'var(--tekst-8-app)',
        background: 'none', padding: '5px 10px', minHeight: 36, cursor: 'pointer',
        opacity: paa ? 1 : 0.6, borderRadius: 999,
      }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, marginRight: 6,
        backgroundColor: paa ? farge : 'transparent', border: `1px solid ${farge}`,
        verticalAlign: 'middle',
      }} />
      {etikett}
    </button>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function MarkerLegend({
  hasLactate, hasNutrition, hasShooting, hasLaps,
}: {
  hasLactate: boolean; hasNutrition: boolean; hasShooting: boolean; hasLaps: boolean
}) {
  if (!hasLactate && !hasNutrition && !hasShooting && !hasLaps) return null
  return (
    <div className="flex gap-4 mt-2 flex-wrap text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
      {hasLaps && <span>┊ Lap-grense</span>}
      {hasLactate && <span style={{ color: '#E23A5A' }}>● Laktat</span>}
      {hasNutrition && <span style={{ color: '#FFB300' }}>● Ernæring</span>}
      {hasShooting && <span><span style={{ color: '#3DD68C' }}>●</span>/<span style={{ color: '#FF4500' }}>●</span> Skyting (treff/bom)</span>}
    </div>
  )
}

function findValueAt(arr: HrSample[] | null, t: number): number | null {
  if (!arr || arr.length === 0) return null
  // Binærsøk er ikke verdt det her (≤ tusenvis av punkter, og dette skjer
  // for noen få markører totalt).
  let best = arr[0]
  let bestDiff = Math.abs(best.t - t)
  for (const r of arr) {
    const d = Math.abs(r.t - t)
    if (d < bestDiff) { best = r; bestDiff = d }
  }
  return best.hr
}

// ── Segmentbånd (fasit 1c) ───────────────────────────────────
// Kollapset lesevisning: båndet under kurven viser radene som segmenter i
// tid, punktmarkører (laktat/ernæring) ligger OVER båndet, og hold/tapp på
// et segment eller punkt gir leser-linja under (tid · varighet · snittpuls ·
// treff). Skytevinduer får i tillegg faste leser-rader (fasit 1b).
//
// Den nye kurven tegner i full bredde (ingen akse-marg — y-etikettene
// ligger oppå flata), så båndet står rett under kurven uten innrykk.
const BAAND_INNRYKK_VENSTRE = 0
const BAAND_INNRYKK_HOYRE = 0

function SegmentBaand({
  segmenter, totalSek, lactate, nutrition, hr, speed, sport, valgt, onVelg,
}: {
  segmenter: Segment[]
  totalSek: number
  lactate: LactateMarker[]
  nutrition: NutritionMarker[]
  hr: HrSample[] | null
  speed: SpeedSample[] | null
  sport: Sport
  valgt: string | null
  onVelg: (id: string | null) => void
}) {
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / totalSek) * 100))}%`

  const valgtSegment = segmenter.find(sg => sg.aktivitetId === valgt) ?? null
  const valgtLaktat = valgt?.startsWith('lac-') ? lactate[Number(valgt.slice(4))] : null
  const valgtNutrition = valgt?.startsWith('nut-') ? nutrition[Number(valgt.slice(4))] : null

  return (
    <div style={{ marginLeft: BAAND_INNRYKK_VENSTRE, marginRight: BAAND_INNRYKK_HOYRE }}>
      {/* Punktmarkører OVER båndet — punkt = tidspunkt + verdi, aldri
          varighet (fasit-notatet). */}
      {(lactate.length > 0 || nutrition.length > 0) && (
        <div style={{ position: 'relative', height: 14 }}>
          {lactate.map((lac, i) => (
            <button key={`lac-${i}`} type="button"
              onMouseEnter={() => onVelg(`lac-${i}`)}
              onClick={() => onVelg(valgt === `lac-${i}` ? null : `lac-${i}`)}
              aria-label={`Laktat ${lac.mmol} mmol ved ${fmtKlokkeSek(lac.t)}`}
              style={{
                position: 'absolute', left: pct(lac.t), transform: 'translateX(-50%)',
                width: 9, height: 9, borderRadius: '50%', padding: 0,
                background: '#E23A5A', border: '1px solid var(--flate-3)',
                cursor: 'pointer', top: 2,
              }} />
          ))}
          {nutrition.map((n, i) => (
            <button key={`nut-${i}`} type="button"
              onMouseEnter={() => onVelg(`nut-${i}`)}
              onClick={() => onVelg(valgt === `nut-${i}` ? null : `nut-${i}`)}
              aria-label={`Ernæring ved ${fmtKlokkeSek(n.t)}`}
              style={{
                position: 'absolute', left: pct(n.t), transform: 'translateX(-50%) rotate(45deg)',
                width: 8, height: 8, padding: 0,
                background: '#FFB300', border: '1px solid var(--flate-3)',
                cursor: 'pointer', top: 2,
              }} />
          ))}
        </div>
      )}

      {/* Selve båndet. */}
      <div style={{ position: 'relative', height: 14 }}
        onMouseLeave={() => onVelg(null)}>
        {segmenter.map(sg => {
          // Et 40-sekunders vindu er under 1 % av en to-timers økt: uten
          // hjelp blir veksling og skyting både usynlige og uklikkbare.
          // SMALE segmenter får minstebredde (synlighet) + en utvidet
          // treffflate på 36 px (konvensjonen) — og HØYERE z-index, ellers
          // stjeler de brede naboenes treffflater klikket (målt: klikk på
          // et 10 px veksling-segment havnet på Sykkel-segmentet ved siden).
          // Brede segmenter beholder eksakte grenser og trenger ingen av
          // delene.
          const andel = (sg.sluttSek - sg.startSek) / Math.max(1, totalSek)
          const smalt = andel < 0.03
          return (
          <button key={sg.aktivitetId} type="button"
            onMouseEnter={() => onVelg(sg.aktivitetId)}
            onClick={() => onVelg(valgt === sg.aktivitetId ? null : sg.aktivitetId)}
            aria-label={`${sg.etikett} ${fmtKlokkeSek(sg.startSek)}–${fmtKlokkeSek(sg.sluttSek)}`}
            style={{
              position: 'absolute',
              left: pct(sg.startSek),
              width: `calc(${pct(sg.sluttSek - sg.startSek)} - 2px)`,
              minWidth: 10,
              height: 14, top: 0, padding: 0,
              zIndex: smalt ? 3 : 1,
              background: segmentBakgrunn(sg.type),
              opacity: valgt == null || valgt === sg.aktivitetId ? 0.9 : 0.45,
              border: 'none', borderRadius: 3, cursor: 'pointer',
              outline: 'none',
              boxShadow: valgt === sg.aktivitetId ? `0 0 0 2px ${SEGMENT_FARGER[sg.type]}` : 'none',
            }}>
            {smalt && (
              <span aria-hidden style={{
                position: 'absolute', top: -11, bottom: -11, left: -6, right: -6,
                minWidth: 36, display: 'block',
              }} />
            )}
          </button>
          )
        })}
      </div>

      {/* Leser-linje for valgt segment/punkt («hold over»-raden i fasiten). */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        color: 'var(--tekst-5-app)', minHeight: 20, paddingTop: 4,
      }}>
        {valgtSegment && (() => {
          const puls = pulsIVindu(hr, valgtSegment.startSek, valgtSegment.sluttSek)
          return (
            <span>
              <b style={{ color: SEGMENT_FARGER[valgtSegment.type] }}>{valgtSegment.etikett}</b>
              {' · '}{fmtKlokkeSek(valgtSegment.startSek)}–{fmtKlokkeSek(valgtSegment.sluttSek)}
              {' · '}{fmtKlokkeSek(valgtSegment.sluttSek - valgtSegment.startSek)}
              {puls.snitt != null ? <>{' · snitt '}{puls.snitt}</> : <>{' · puls: for lite data'}</>}
              {valgtSegment.treff ? <>{' · '}{valgtSegment.treff}</> : null}
            </span>
          )
        })()}
        {valgtLaktat && (
          <span>
            <b style={{ color: '#E23A5A' }}>Laktat {String(valgtLaktat.mmol).replace('.', ',')} mmol</b>
            {' · '}{fmtKlokkeSek(valgtLaktat.t)}
            {(() => {
              const p = findValueAt(hr, valgtLaktat.t)
              return p != null ? <>{' · puls '}{p}</> : null
            })()}
            {(() => {
              const f = naermesteFart(speed, valgtLaktat.t)
              return f != null ? <>{' · '}{fmtFart(f, sport)}</> : null
            })()}
          </span>
        )}
        {valgtNutrition && (
          <span>
            <b style={{ color: '#FFB300' }}>Ernæring — {valgtNutrition.type}</b>
            {' · '}{fmtKlokkeSek(valgtNutrition.t)}
            {valgtNutrition.carbs_g != null ? <>{' · '}{valgtNutrition.carbs_g} g karbo</> : null}
          </span>
        )}
        {!valgtSegment && !valgtLaktat && !valgtNutrition && (
          <span style={{ color: 'var(--tekst-8-alt)' }}>
            Hold over et segment: tid · varighet · snittpuls{segmenter.some(sg => sg.treff) ? ' · treff' : ''}
          </span>
        )}
      </div>

      {/* Faste leser-rader for skytevinduene (fasit 1b). */}
      {segmenter.filter(sg => sg.paaKurven).length > 0 && (
        <div className="mt-1 space-y-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>
          {segmenter.filter(sg => sg.paaKurven).map(sg => {
            const puls = pulsIVindu(hr, sg.startSek, sg.sluttSek)
            return (
              <div key={`leser-${sg.aktivitetId}`} style={{ color: 'var(--tekst-8-alt)' }}>
                <span style={{ color: SEGMENT_FARGER[sg.type] }}>{sg.etikett}:</span>{' '}
                <b style={{ color: 'var(--tekst-5-app)', fontWeight: 600 }}>
                  {fmtKlokkeSek(sg.startSek)}–{fmtKlokkeSek(sg.sluttSek)}
                  {puls.inn != null ? ` · puls inn ${puls.inn}` : ''}
                  {puls.snitt != null ? ` · snitt ${puls.snitt}` : ' · puls: for lite data'}
                  {sg.treff ? ` · ${sg.treff}` : ''}
                </b>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function naermesteFart(arr: SpeedSample[] | null, t: number): number | null {
  if (!arr || arr.length === 0) return null
  let best = arr[0]
  let bestDiff = Math.abs(best.t - t)
  for (const r of arr) {
    const d = Math.abs(r.t - t)
    if (d < bestDiff) { best = r; bestDiff = d }
  }
  return best.mps
}

function fmtFart(mps: number, sport: Sport): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const secPerKm = 1000 / mps
  const m = Math.floor(secPerKm / 60)
  const sek = Math.round(secPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}
