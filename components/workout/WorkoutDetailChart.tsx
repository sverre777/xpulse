'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Sport } from '@/lib/types'
import {
  SEGMENT_FARGER, PUNKT_FARGER, SKYTE_FARGER, erSkytesegment, skyteMarkor, segmentBakgrunn, fmtKlokkeSek, pulsIVindu,
  grupperSegmenter, type Segment,
} from '@/lib/segmenter'
import { OktKurve, verdiVed, type KurveSerie } from './OktKurve'
import { KurveBrush } from './KurveBrush'
import { hentKurveVindu } from '@/app/actions/workout-klokkesync'
import { lagreVindu, hentVindu } from '@/lib/kurve-zoom'
import { PlanSpokelse } from './PlanSpokelse'
import { hentPlanensRunder, type PlanBlokk } from '@/app/actions/runder'
import { visPlanBak, settVisPlanBak, abonnerVisPlan } from '@/lib/vis-plan'
import { computeZoneSecondsFromSamples, type HeartZone, type ExtendedZoneName } from '@/lib/heart-zones'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { beregnSoneTss } from '@/lib/belastning'
import { RpeSkala, rpeFarge } from '@/components/ui/RpeSkala'

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
  /** Trengs for å hente finere data ved zoom (serveren sender oversikt). */
  workoutId?: string
  samples: WorkoutSamples
  laps?: LapMarker[]
  lactate?: LactateMarker[]
  nutrition?: NutritionMarker[]
  shooting?: ShootingMarker[]
  segmenter?: Segment[]
  height?: number
  /** 'full' = øktas hovedside (med nøkkeltallsrad). 'skjema' = i
      oppsummeringskortet i skjemaet — der eier kortet nøkkeltallsraden. */
  tetthet?: 'full' | 'skjema'
  heartZones?: HeartZone[]
  /** Opplevd belastning (workouts.rpe) og skriveren — samme felt som
      skjemaet fører lenger nede. Uten onRpe er cellen ren lesing. */
  rpe?: number | null
  onRpe?: (v: number | null) => void
  /** NP fra serveren (watt-metrikker) — vises ved siden av snittwatt. */
  np?: number | null
  /** Planens tall når økta er koblet til en plan (bolk 5/7). */
  planVarighetSek?: number | null
  forventetRpe?: number | null
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
// BOLK 2 (omlegging v6): nøkkeltallsraden for hele økta, punktetiketter
// med pekelinje over grafen, gruppeklammer og direkte etiketter på
// segmentbåndet, og båndet følger zoomen. Samme komponent på hovedsida,
// i skjemaets oppsummeringskort (live) og — som KompaktKurve — i
// oversikten.
//
// Tegnemotoren er OktKurve (delt SVG) — se den fila for hvorfor, og for
// nedsamplingen som er innebygd fra første versjon.
export function WorkoutDetailChart({
  sport, workoutId, samples, laps = [], lactate = [], nutrition = [], shooting = [],
  segmenter = [],
  height = 300, tetthet = 'full', heartZones = [], rpe = null, onRpe, np = null,
  planVarighetSek = null, forventetRpe = null,
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
  // Planen bak (bolk 7) — samme bryter og samme lag som i Øktbyggeren.
  // Valget deles med byggeren (lib/vis-plan), så flatene aldri står uenige.
  const [planBlokker, setPlanBlokker] = useState<PlanBlokk[]>([])
  // Huskes per økt, standard PÅ når økta har plan (bolk 7).
  const [visPlan, setVisPlan] = useState(true)

  useEffect(() => {
    const oppdater = () => setVisPlan(visPlanBak(workoutId))
    oppdater()
    return abonnerVisPlan(oppdater)
  }, [workoutId])

  useEffect(() => {
    if (!workoutId) return
    let avbrutt = false
    hentPlanensRunder(workoutId)
      .then(b => { if (!avbrutt) setPlanBlokker(b) })
      .catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId])
  const [valgtSegment, setValgtSegment] = useState<string | null>(null)
  // Krysshårets tidspunkt. Panelet under grafen er FASIT for verdier —
  // aksene er bare kontekst (fasiten). Uten krysshår viser cellene øktas
  // snitt, så tallene finnes selv om man aldri berører kurven.
  const [krysshaarSek, setKrysshaarSek] = useState<number | null>(null)
  // Zoom-vinduet. null = hele økta. Deles med Øktbyggeren via
  // lib/kurve-zoom, så pop-upen åpner på samme utsnitt.
  const [vindu, setVindu] = useState<[number, number] | null>(
    () => (workoutId ? hentVindu(workoutId) : null),
  )
  // Finere data for det synlige vinduet: serveren sender bare en oversikt
  // (~900 kolonner) for hele økta, så innzooming ville ellers vist den
  // samme grovheten forstørret.
  const [vindusSamples, setVindusSamples] = useState<WorkoutSamples | null>(null)

  // Seriene for det synlige vinduet (finere data fra serveren ved zoom).
  const vindusSerier = useMemo(
    () => (vindusSamples ? byggSerier(sport, vindusSamples) : null),
    [sport, vindusSamples],
  )

  const totalSek = useMemo(() => {
    let maks = 0
    for (const s of serier) {
      const sist = s.punkter[s.punkter.length - 1]
      if (sist && sist.t > maks) maks = sist.t
    }
    return maks
  }, [serier])

  // Ett sted som setter zoom: fanger «hele økta» (da ryddes vindusdataene
  // og delt tilstand nullstilles) og lagrer nivået for Øktbyggeren.
  const settVindu = (v: [number, number] | null) => {
    const heleOkta = !v || (v[0] <= 0.5 && v[1] >= totalSek - 0.5)
    if (heleOkta) {
      setVindu(null)
      setVindusSamples(null)
      if (workoutId) lagreVindu(workoutId, [0, totalSek])
      return
    }
    setVindu(v)
    if (workoutId) lagreVindu(workoutId, v)
  }


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
  const harPunkter = lactate.length > 0 || nutrition.length > 0 || (visSkyting && segmenter.some(sg => erSkytesegment(sg.type)))
  const harSkyting = skytevinduer.length > 0 || (sport === 'biathlon' && shooting.length > 0)
  // Aksen strekkes til planens slutt når planen vises og er lengre enn
  // økta (bolk 7): da stikker spøkelset ut forbi der økta stoppet, og
  // avviket leses uten lesepanel. Kortere plan stopper av seg selv.
  const aksSek = useMemo(() => {
    if (!visPlan || planBlokker.length === 0) return totalSek
    return Math.max(totalSek, ...planBlokker.map(b => b.sluttSek))
  }, [visPlan, planBlokker, totalSek])
  const synlig: [number, number] = vindu ?? [0, Math.max(1, aksSek)]

  useEffect(() => {
    // Nullstilling skjer i handlerne som fjerner zoomen (ikke her — en
    // synkron setState i en effekt gir kaskade-renders).
    if (!workoutId || !vindu) return
    let avbrutt = false
    hentKurveVindu(workoutId, vindu[0], vindu[1])
      .then(d => { if (!avbrutt) setVindusSamples(d) })
      .catch(() => { if (!avbrutt) setVindusSamples(null) })
    return () => { avbrutt = true }
  }, [workoutId, vindu])

  // Punktene som etiketter over grafen (pekelinje ned til kurven).
  const punkter: Punkt[] = useMemo(() => {
    const ut: Punkt[] = [
      ...lactate.map((l, i) => ({
        id: `lac-${i}`, slag: 'laktat' as const, t: l.t,
        tittel: `Laktat ${String(l.mmol).replace('.', ',')}`,
        farge: PUNKT_FARGER.laktat,
      })),
      ...nutrition.map((n, i) => ({
        id: `nut-${i}`, slag: 'ernaering' as const, t: n.t,
        tittel: `${n.type}${n.carbs_g != null ? ` · ${n.carbs_g} g` : ''}`,
        farge: PUNKT_FARGER.ernaering,
      })),
      // Rettelse 1: skyting er nøytral på tidslinja — markøren over bærer
      // posisjon og treff, med pekelinje som de andre punktene.
      ...(visSkyting ? segmenter.filter(sg => erSkytesegment(sg.type)).map(sg => ({
        id: `sky-${sg.aktivitetId}`, slag: 'skyting' as const, t: sg.startSek,
        tittel: skyteMarkor(sg.type, sg.etikett, sg.treff),
        farge: 'var(--tekst-1-app)',
      })) : []),
    ]
    return ut.sort((a, b) => a.t - b.t)
  }, [lactate, nutrition, segmenter, visSkyting])

  const segmentVed = (t: number) => segmenter.find(x => t >= x.startSek && t <= x.sluttSek) ?? null

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

  const skjema = tetthet === 'skjema'

  return (
    <div className={skjema ? '' : 'p-4'} data-oktgraf
      style={skjema ? undefined : { backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }}>
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        {!skjema && (
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
            Økt-graf
          </p>
        )}
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
          {(harSkyting || segmenter.length > 0 || harPunkter || laps.length > 1 || planBlokker.length > 0) && (
            <Gruppe navn="På grafen">
              {harSkyting && (
                <Chip farge={SKYTE_FARGER.ligg} etikett="Skyting" paa={visSkyting} fokus={false}
                  onClick={() => setVisSkyting(v => !v)} />
              )}
              {segmenter.length > 0 && (
                <Chip farge={SEGMENT_FARGER.drag} etikett="Segmenter" paa={visSegmenter} fokus={false}
                  onClick={() => setVisSegmenter(v => !v)} />
              )}
              {harPunkter && (
                <Chip farge={PUNKT_FARGER.laktat} etikett="Laktat/ernæring" paa={visPunkter} fokus={false}
                  onClick={() => setVisPunkter(v => !v)} />
              )}
              {laps.length > 1 && (
                <Chip farge="var(--tekst-8-alt)" etikett="Runder" paa={visRunder} fokus={false}
                  onClick={() => setVisRunder(v => !v)} />
              )}
              {/* Finnes ingen plan, står bryteren ikke der (aldri en død knapp). */}
              {planBlokker.length > 0 && (
                <Chip farge="var(--accent)" etikett="Vis plan" paa={visPlan} fokus={false}
                  onClick={() => setVisPlan(settVisPlanBak(workoutId, !visPlan))} />
              )}
            </Gruppe>
          )}
        </div>
      </div>

      {/* Etikettbåndet over grafen — reservert så snart økta HAR punkter,
          slik at grafen aldri hopper når etikettene tegnes (regel 20). */}
      {harPunkter && (
        <PunktEtiketter
          punkter={visPunkter ? punkter : []}
          synlig={synlig}
          segmentVed={segmentVed}
        />
      )}

      <OktKurve
        serier={vindusSerier ?? serier}
        paaIds={paaIds}
        fokusId={fokusId}
        totalSek={aksSek}
        hoyde={skjema ? Math.min(height, 240) : height}
        vindu={vindu ?? undefined}
        onVindu={v => settVindu(v)}
        krysshaarSek={krysshaarSek}
        onKrysshaar={setKrysshaarSek}
        overlay={h => (
          <>
            {/* Planen bak alt annet — dekor, tar aldri et klikk. */}
            {visPlan && <PlanSpokelse blokker={planBlokker} pct={h.pct} />}
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
            {/* Pekelinjene ender i en prikk PÅ kurven i punktets farge. */}
            {visPunkter && punkter.map(p => {
              if (p.t < h.fraSek || p.t > h.tilSek) return null
              const y = fokus ? h.yPctForSerie(fokus.id, p.t) : '20%'
              return (
                <span key={p.id} aria-hidden>
                  <span style={{
                    position: 'absolute', left: h.pct(p.t), top: 0, height: y,
                    width: 1, background: p.farge, opacity: 0.5, pointerEvents: 'none',
                  }} />
                  <span style={{
                    position: 'absolute', left: h.pct(p.t), top: y,
                    transform: 'translate(-50%, -50%)', width: 9, height: 9, borderRadius: '50%',
                    background: p.farge, border: '1.5px solid var(--flate-3)', pointerEvents: 'none',
                  }} />
                </span>
              )
            })}
          </>
        )}
      />

      {/* Brush: hvor i økta er vi? Vises kun når det er noe å navigere i. */}
      {totalSek > 0 && (
        <>
          <KurveBrush
            serie={serier.find(x => x.id === fokusId && !x.somAreal) ?? serier.find(x => !x.somAreal) ?? null}
            segmenter={visSegmenter ? segmenter : []}
            totalSek={totalSek}
            vindu={vindu ?? [0, totalSek]}
            onVindu={v => settVindu(v)}
          />
          <div className="flex gap-2 flex-wrap mt-1.5">
            <button type="button"
              onClick={() => settVindu(null)}
              disabled={!vindu}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: vindu ? 'var(--accent)' : 'var(--tekst-8-app)',
                background: 'none', border: `1px solid ${vindu ? 'var(--accent)' : 'var(--kant-3)'}`,
                borderRadius: 999, padding: '5px 12px', minHeight: 32,
                cursor: vindu ? 'pointer' : 'default', opacity: vindu ? 1 : 0.5,
              }}>
              Hele økta
            </button>
            {/* «Zoom til segment» — når et segment er valgt i båndet. */}
            {valgtSegment && (() => {
              const sg = segmenter.find(x => x.aktivitetId === valgtSegment)
              if (!sg) return null
              return (
                <button type="button"
                  onClick={() => {
                    const luft = Math.max(10, (sg.sluttSek - sg.startSek) * 0.25)
                    const v: [number, number] = [
                      Math.max(0, sg.startSek - luft),
                      Math.min(totalSek, sg.sluttSek + luft),
                    ]
                    setVindu(v)
                    if (workoutId) lagreVindu(workoutId, v)
                  }}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: SEGMENT_FARGER[sg.type], background: 'none',
                    border: `1px solid ${SEGMENT_FARGER[sg.type]}`,
                    borderRadius: 999, padding: '5px 12px', minHeight: 32, cursor: 'pointer',
                  }}>
                  Zoom til {sg.etikett}
                </button>
              )
            })()}
            {vindu && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5,
                color: 'var(--tekst-8-alt)', alignSelf: 'center',
              }}>
                Viser {fmtKlokkeSek(vindu[0])}–{fmtKlokkeSek(vindu[1])} av {fmtKlokkeSek(totalSek)}
              </span>
            )}
          </div>
        </>
      )}

      {/* LESEPANELET erstatter den andre y-aksen (fasiten): tid + én celle
          per påslått serie + gjeldende segment. Krysshåret oppdaterer alle
          cellene samtidig. Uten krysshår står øktas snitt i hver celle, så
          ingen informasjon finnes KUN i en hover. */}
      <Lesepanel
        serier={serier}
        paaIds={paaIds}
        segmenter={segmenter}
        totalSek={totalSek}
        krysshaarSek={krysshaarSek}
      />

      {/* NØKKELTALLSRADEN — «hva ble ØKTA» (lesepanelet svarer «hva skjedde
          HER»). To rader, ulik jobb; de slås aldri sammen. I skjemaet eier
          oppsummeringskortet denne raden (samme komponent). */}
      {!skjema && (
        <Nokkeltall
          celler={nokkeltallFraKlokke({ samples, heartZones, np, planVarighetSek })}
          rpe={rpe}
          onRpe={onRpe}
          forventetRpe={forventetRpe}
        />
      )}

      {visSegmenter && segmenter.length > 0 && totalSek > 0 && (
        <SegmentBaand
          segmenter={segmenter}
          synlig={synlig}
          hr={samples.hr_samples}
          watt={samples.watt_samples}
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

// ── Nøkkeltallsraden ─────────────────────────────────────────
// Speilbildet av plan-grafens rad: samme komponent, samme rekkefølge.
// Alt BEREGNES ved visning fra samples — ingen lagrede kopier. Mangler et
// tall (ingen watt, ingen plan), finnes ikke cellen — aldri «—» der det
// aldri kan komme et tall. Kun opplevd belastning er ført av brukeren, og
// den kan settes rett i raden (klikk → skala, samme skala som i skjemaet).

export interface NokkeltallCelle {
  id: string
  etikett: string
  verdi: string
  hale?: string
  farge?: string
}

export function fmtVarighetLang(sek: number): string {
  const m = Math.round(sek / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}t ${String(m % 60).padStart(2, '0')}`
}

/** Sonen med mest tid — ved uavgjort vinner den høyeste. */
export function hovedsoneFra(soneSek: Partial<Record<ExtendedZoneName, number>>): ExtendedZoneName | null {
  const rekke: ExtendedZoneName[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']
  let beste: ExtendedZoneName | null = null
  for (const s of rekke) {
    const v = soneSek[s] ?? 0
    if (v > 0 && (beste == null || v >= (soneSek[beste] ?? 0))) beste = s
  }
  return beste
}

export function nokkeltallFraKlokke({ samples, heartZones, np, planVarighetSek }: {
  samples: WorkoutSamples
  heartZones: HeartZone[]
  np?: number | null
  planVarighetSek?: number | null
}): NokkeltallCelle[] {
  const celler: NokkeltallCelle[] = []
  const hr = samples.hr_samples ?? []
  let slutt = 0
  for (const serie of [samples.hr_samples, samples.watt_samples, samples.pace_samples, samples.speed_samples, samples.altitude_samples]) {
    const sist = serie?.[serie.length - 1]
    if (sist && sist.t > slutt) slutt = sist.t
  }
  if (slutt > 0) {
    celler.push({
      id: 'varighet', etikett: 'Varighet', verdi: fmtVarighetLang(slutt),
      hale: planVarighetSek != null && planVarighetSek > 0 ? `· plan ${fmtVarighetLang(planVarighetSek)}` : undefined,
    })
  }
  if (hr.length > 1 && heartZones.length > 0) {
    const soner = computeZoneSecondsFromSamples(hr, heartZones)
    const hoved = hovedsoneFra(soner)
    if (hoved) celler.push({ id: 'hovedsone', etikett: 'Hovedsone', verdi: hoved, farge: ZONE_COLORS_V2[hoved] })
    const tss = beregnSoneTss(soner)
    if (tss > 0) celler.push({ id: 'tss', etikett: 'Belastning', verdi: String(Math.round(tss)), hale: 'TSS' })
  }
  if (hr.length > 1) {
    const snitt = snittAv(hr.map(p => ({ t: p.t, v: p.hr })))
    const maks = hr.reduce((m, p) => Math.max(m, p.hr), 0)
    if (snitt != null) celler.push({ id: 'puls', etikett: 'Snittpuls', verdi: String(Math.round(snitt)), hale: `· maks ${maks}` })
  }
  const watt = samples.watt_samples ?? []
  if (watt.length > 1) {
    const snitt = snittAv(watt.map(p => ({ t: p.t, v: p.w })))
    if (snitt != null) celler.push({ id: 'watt', etikett: 'Snittwatt', verdi: String(Math.round(snitt)), hale: np != null ? `· NP ${Math.round(np)}` : undefined })
  }
  // Belastning står etter puls/watt i fasitens rekkefølge.
  const i = celler.findIndex(c => c.id === 'tss')
  if (i >= 0) { const [c] = celler.splice(i, 1); celler.push(c) }
  return celler
}

/** Tidsvektet snitt av en {t, v}-serie — nedsamplede punkter er ujevnt fordelt. */
function snittAv(serie: Array<{ t: number; v: number }>): number | null {
  if (serie.length < 2) return null
  let sum = 0, vekt = 0
  for (let i = 1; i < serie.length; i++) {
    const dt = serie[i].t - serie[i - 1].t
    if (dt <= 0 || dt > 60) continue
    sum += serie[i].v * dt; vekt += dt
  }
  return vekt > 0 ? sum / vekt : null
}

export function Nokkeltall({ celler, rpe = null, onRpe, forventetRpe = null, rpeEtikett = 'Opplevd' }: {
  celler: NokkeltallCelle[]
  rpe?: number | null
  onRpe?: (v: number | null) => void
  forventetRpe?: number | null
  /** «Opplevd» på gjennomført, «Forventet» i plan. */
  rpeEtikett?: string
}) {
  const [skalaAapen, setSkalaAapen] = useState(false)
  if (celler.length === 0 && rpe == null && !onRpe) return null
  const celle: React.CSSProperties = {
    flex: '1 1 110px', padding: '9px 12px', borderRight: '1px solid var(--line2)', minWidth: 0,
  }
  const k: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
    letterSpacing: '0.13em', fontSize: 10, color: 'var(--tekst-5-app)', textTransform: 'uppercase',
  }
  const v: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: '0.02em', lineHeight: 1.25, color: 'var(--tekst-1-app)' }
  const hale: React.CSSProperties = { fontSize: 11, color: 'var(--tekst-5-app)', fontFamily: 'inherit', letterSpacing: 0 }
  return (
    <div data-nokkeltall className="mt-2">
      <div style={{
        display: 'flex', flexWrap: 'wrap', border: '1px solid var(--line2)',
        borderRadius: 11, overflow: 'hidden', background: 'var(--flate-14)',
      }}>
        {celler.map(c => (
          <div key={c.id} style={celle}>
            <div style={k}>{c.etikett}</div>
            <div style={{ ...v, color: c.farge ?? v.color }}>
              {c.verdi}{c.hale && <small style={hale}> {c.hale}</small>}
            </div>
          </div>
        ))}
        {(rpe != null || onRpe) && (
          <button type="button" disabled={!onRpe}
            onClick={() => onRpe && setSkalaAapen(a => !a)}
            aria-expanded={onRpe ? skalaAapen : undefined}
            title={onRpe ? 'Klikk for å sette belastningen' : undefined}
            style={{
              ...celle, borderRight: 0, background: 'var(--flate-12-alt)', textAlign: 'left',
              border: 'none', cursor: onRpe ? 'pointer' : 'default', minHeight: 44,
            }}>
            <div style={k}>
              {rpeEtikett}{onRpe && <span style={{ color: 'var(--accent)' }}> · føres</span>}
            </div>
            <div style={{ ...v, color: rpe != null ? rpeFarge(rpe) : 'var(--tekst-5-app)' }}>
              {rpe != null ? rpe : '—'}
              <small style={hale}> /10{forventetRpe != null ? ` · forventet ${forventetRpe}` : ''}</small>
            </div>
          </button>
        )}
      </div>
      {onRpe && skalaAapen && (
        <div className="mt-1.5">
          <RpeSkala value={rpe ?? null} onChange={val => { onRpe(val); setSkalaAapen(false) }} kompakt etikett={`${rpeEtikett} belastning 1–10`} />
        </div>
      )}
    </div>
  )
}

// ── Punktetiketter med pekelinje ─────────────────────────────
// Referansen (Enduranced): etikett ØVER grafen med tynn pekelinje ned til
// nøyaktig tidspunkt. Navn + verdi i fet, kontekst («etter drag 2 · 8:00»)
// under. Etiketter nær hverandre i tid skyves ned et nivå — aldri overlapp,
// aldri skjult tekst. Tett klynge slås sammen til «3 målinger» og folder
// seg ut ved klikk.

interface Punkt { id: string; slag: 'laktat' | 'ernaering' | 'skyting'; t: number; tittel: string; farge: string }

const ETIKETT_BREDDE_PCT = 13   // anslått bredde på en etikett, i % av flata
const NIVAA_HOYDE = 30
const MAKS_NIVAAER = 3

function PunktEtiketter({ punkter, synlig, segmentVed }: {
  punkter: Punkt[]
  synlig: [number, number]
  segmentVed: (t: number) => Segment | null
}) {
  const [utfoldet, setUtfoldet] = useState<string | null>(null)
  const [fra, til] = synlig
  const spenn = Math.max(1, til - fra)
  const pct = (t: number) => ((t - fra) / spenn) * 100

  // 1) Klynger: punkter innenfor 3 % av bredden slås sammen.
  type Klynge = { id: string; punkter: Punkt[]; x: number }
  const klynger: Klynge[] = []
  for (const p of punkter.filter(p => p.t >= fra && p.t <= til)) {
    const x = pct(p.t)
    const siste = klynger[klynger.length - 1]
    if (siste && x - siste.x < 3 && utfoldet !== siste.id) {
      siste.punkter.push(p)
      siste.x = (siste.x * (siste.punkter.length - 1) + x) / siste.punkter.length
    } else {
      klynger.push({ id: p.id, punkter: [p], x })
    }
  }
  // 2) Nivåer: hver etikett får det laveste nivået der den ikke overlapper.
  const sluttPerNivaa: number[] = []
  const plassert = klynger.map(kl => {
    const venstre = kl.x - ETIKETT_BREDDE_PCT / 2
    let nivaa = sluttPerNivaa.findIndex(s => s <= venstre)
    if (nivaa < 0) nivaa = Math.min(sluttPerNivaa.length, MAKS_NIVAAER - 1)
    sluttPerNivaa[nivaa] = Math.max(sluttPerNivaa[nivaa] ?? -Infinity, kl.x + ETIKETT_BREDDE_PCT / 2)
    return { ...kl, nivaa }
  })
  const antallNivaaer = plassert.length ? Math.max(...plassert.map(p => p.nivaa + 1)) : 1
  const hoyde = antallNivaaer * NIVAA_HOYDE + 4

  return (
    <div data-punktetiketter style={{ position: 'relative', height: hoyde, marginBottom: 2 }}>
      {plassert.map(kl => {
        const top = kl.nivaa * NIVAA_HOYDE
        const en = kl.punkter.length === 1 ? kl.punkter[0] : null
        const farge = en?.farge ?? 'var(--tekst-5-app)'
        const seg = en ? segmentVed(en.t) : null
        const kontekst = en
          ? `${seg ? `${seg.etikett.toLowerCase()} · ` : ''}${fmtKlokkeSek(en.t)}`
          : `${fmtKlokkeSek(kl.punkter[0].t)}–${fmtKlokkeSek(kl.punkter[kl.punkter.length - 1].t)}`
        const innhold = (
          <>
            <span style={{
              display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: farge, whiteSpace: 'nowrap',
            }}>
              {en ? en.tittel : `${kl.punkter.length} målinger`}
            </span>
            <span style={{
              display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5,
              color: 'var(--tekst-8-alt)', whiteSpace: 'nowrap',
            }}>
              {kontekst}
            </span>
          </>
        )
        return (
          <div key={kl.id} style={{ position: 'absolute', left: `${Math.max(0, Math.min(100, kl.x))}%`, top }}>
            {/* Pekelinja fortsetter fra etiketten ned til plot-flata (der
                overlayet tegner resten, i samme x). */}
            <span aria-hidden style={{
              position: 'absolute', left: 0, top: NIVAA_HOYDE - 4, height: hoyde - top - NIVAA_HOYDE + 4,
              width: 1, background: farge, opacity: 0.5,
            }} />
            {en ? (
              <div style={{ transform: 'translateX(-50%)', textAlign: 'center', lineHeight: 1.15 }}>{innhold}</div>
            ) : (
              <button type="button" onClick={() => setUtfoldet(kl.id)}
                title="Vis hver måling"
                style={{
                  transform: 'translateX(-50%)', textAlign: 'center', lineHeight: 1.15,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 28,
                }}>
                {innhold}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Lesepanel({ serier, paaIds, segmenter, totalSek, krysshaarSek }: {
  serier: KurveSerie[]
  paaIds: string[]
  segmenter: Segment[]
  totalSek: number
  krysshaarSek: number | null
}) {
  const segmentHer = krysshaarSek != null
    ? segmenter.find(x => krysshaarSek >= x.startSek && krysshaarSek <= x.sluttSek) ?? null
    : null
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        borderTop: '1px solid var(--kant-3)', paddingTop: 8,
      }}>
      <Celle etikett="Tid" farge="var(--tekst-1-app)"
        verdi={krysshaarSek != null ? fmtKlokkeSek(krysshaarSek) : `0:00–${fmtKlokkeSek(totalSek)}`} />
      {serier.filter(serie => paaIds.includes(serie.id)).map(serie => {
        const snitt = snittAv(serie.punkter)
        const vis = krysshaarSek != null ? verdiVed(serie, krysshaarSek) : snitt
        return (
          <Celle key={serie.id} etikett={serie.navn} farge={serie.farge}
            verdi={vis != null ? serie.format(vis) : '—'}
            hale={krysshaarSek == null ? 'snitt' : undefined} />
        )
      })}
      {segmenter.length > 0 && (
        <Celle etikett="Segment"
          farge={segmentHer ? SEGMENT_FARGER[segmentHer.type] : 'var(--tekst-8-alt)'}
          verdi={segmentHer ? segmentHer.etikett : `${segmenter.length} segmenter`}
          hale={segmentHer ? `${fmtKlokkeSek(segmentHer.startSek)}–${fmtKlokkeSek(segmentHer.sluttSek)}` : undefined} />
      )}
    </div>
  )
}

function Celle({ etikett, verdi, farge, hale }: {
  etikett: string; verdi: string; farge: string; hale?: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span style={{
        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--tekst-8-alt)',
      }}>
        {etikett}
      </span>
      <b style={{ color: farge, fontWeight: 700 }}>{verdi}</b>
      {hale && <span style={{ fontSize: 11.5, color: 'var(--tekst-8-alt)' }}>{hale}</span>}
    </span>
  )
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
      {hasLactate && <span style={{ color: PUNKT_FARGER.laktat }}>● Laktat</span>}
      {hasNutrition && <span style={{ color: PUNKT_FARGER.ernaering }}>● Ernæring</span>}
      {hasShooting && <span><span style={{ color: '#3DD68C' }}>●</span>/<span style={{ color: '#FF4500' }}>●</span> Skyting (treff/bom)</span>}
    </div>
  )
}

// ── Segmentbånd (fasit 1c + gruppeklammer) ───────────────────
// Kollapset lesevisning: båndet under kurven viser radene som segmenter i
// tid, følger zoomen, og hold/tapp på et segment gir leser-linja under
// (tid · varighet · snittpuls · treff). Repeterte segmenter samles under
// én klamme («8 × 40/20»); zoomer man inn nok, løses klammen opp i
// enkeltsegmenter med egne etiketter. Etikett direkte på båndet der det
// er plass — identitet bæres aldri av farge alene.

const BAAND_HOYDE = 16
/** Segment ≥ denne andelen av synlig bredde får etikett rett på båndet. */
const ETIKETT_ANDEL = 0.08
/** Er alle segmentene i en gruppe ≥ denne andelen, løses klammen opp. */
const OPPLOSNING_ANDEL = 0.06

function SegmentBaand({
  segmenter, synlig, hr, watt, speed, sport, valgt, onVelg,
}: {
  segmenter: Segment[]
  synlig: [number, number]
  hr: HrSample[] | null
  watt: WattSample[] | null
  speed: SpeedSample[] | null
  sport: Sport
  valgt: string | null
  onVelg: (id: string | null) => void
}) {
  const [fra, til] = synlig
  const spenn = Math.max(1, til - fra)
  const pct = (t: number) => `${Math.max(0, Math.min(100, ((t - fra) / spenn) * 100))}%`
  const andel = (a: number, b: number) => (Math.min(b, til) - Math.max(a, fra)) / spenn
  const [hovedGruppe, setHovedGruppe] = useState<number | null>(null)

  const grupper = useMemo(() => grupperSegmenter(segmenter), [segmenter])
  // Klammer som skal stå: de som ikke er «oppløst» av zoomen.
  const klammer = grupper.filter(g => {
    if (g.sluttSek < fra || g.startSek > til) return false
    const minste = Math.min(...segmenter.slice(g.fra, g.til + 1).map(s => andel(s.startSek, s.sluttSek)))
    return minste < OPPLOSNING_ANDEL
  })
  const iKlamme = (i: number) => klammer.find(g => i >= g.fra && i <= g.til) ?? null
  const valgtSegment = segmenter.find(sg => sg.aktivitetId === valgt) ?? null
  const hovedet = hovedGruppe != null ? klammer[hovedGruppe] ?? null : null

  return (
    <div data-segmentbaand>
      {/* Selve båndet. */}
      <div style={{ position: 'relative', height: BAAND_HOYDE, marginTop: 6 }}
        onMouseLeave={() => onVelg(null)}>
        {segmenter.map((sg, i) => {
          if (sg.sluttSek < fra || sg.startSek > til) return null
          // Et 40-sekunders vindu er under 1 % av en to-timers økt: uten
          // hjelp blir veksling og skyting både usynlige og uklikkbare.
          // SMALE segmenter får minstebredde (synlighet) + en utvidet
          // treffflate på 36 px (konvensjonen) — og HØYERE z-index, ellers
          // stjeler de brede naboenes treffflater klikket (målt: klikk på
          // et 10 px veksling-segment havnet på Sykkel-segmentet ved siden).
          const a = andel(sg.startSek, sg.sluttSek)
          const smalt = a < 0.03
          const gruppe = iKlamme(i)
          const dempet = (valgt != null && valgt !== sg.aktivitetId)
            || (hovedet != null && !(i >= hovedet.fra && i <= hovedet.til))
          const start = Math.max(sg.startSek, fra), slutt = Math.min(sg.sluttSek, til)
          return (
          <button key={sg.aktivitetId} type="button"
            onMouseEnter={() => onVelg(sg.aktivitetId)}
            onClick={() => onVelg(valgt === sg.aktivitetId ? null : sg.aktivitetId)}
            aria-label={`${sg.etikett} ${fmtKlokkeSek(sg.startSek)}–${fmtKlokkeSek(sg.sluttSek)}`}
            style={{
              position: 'absolute',
              left: pct(start),
              width: `calc(${pct(slutt - start + fra)} - 2px)`,
              minWidth: 10,
              height: BAAND_HOYDE, top: 0, padding: '0 4px',
              zIndex: smalt ? 3 : 1,
              background: segmentBakgrunn(sg.type),
              opacity: dempet ? 0.45 : 0.9,
              border: 'none', borderRadius: 3, cursor: 'pointer',
              outline: 'none', overflow: 'hidden', textAlign: 'left',
              boxShadow: valgt === sg.aktivitetId ? `0 0 0 2px ${SEGMENT_FARGER[sg.type]}` : 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--tekst-1-ren)', lineHeight: `${BAAND_HOYDE}px`,
              whiteSpace: 'nowrap',
            }}>
            {/* Direkte etikett der det er plass — i en klamme bærer klammen navnet. */}
            {!gruppe && a >= ETIKETT_ANDEL ? sg.etikett : ''}
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

      {/* Gruppeklammer under båndet — én etikett for en repetert blokk. */}
      {klammer.length > 0 && (
        <div style={{ position: 'relative', height: 26 }}>
          {klammer.map((g, gi) => {
            const start = Math.max(g.startSek, fra), slutt = Math.min(g.sluttSek, til)
            const farge = SEGMENT_FARGER[g.type]
            return (
              <button key={`${g.fra}-${g.til}`} type="button"
                onMouseEnter={() => setHovedGruppe(gi)}
                onMouseLeave={() => setHovedGruppe(null)}
                onFocus={() => setHovedGruppe(gi)}
                onBlur={() => setHovedGruppe(null)}
                aria-label={`${g.etikett} · ${fmtKlokkeSek(g.startSek)}–${fmtKlokkeSek(g.sluttSek)}`}
                style={{
                  position: 'absolute', left: pct(start), width: `calc(${pct(slutt - start + fra)} - 2px)`,
                  top: 2, height: 24, padding: 0, background: 'none', border: 'none', cursor: 'default',
                  borderLeft: `1px solid ${hovedet === g ? farge : 'var(--tekst-8-alt)'}`,
                  borderRight: `1px solid ${hovedet === g ? farge : 'var(--tekst-8-alt)'}`,
                  borderBottom: `1px solid ${hovedet === g ? farge : 'var(--tekst-8-alt)'}`,
                  borderRadius: '0 0 4px 4px', minWidth: 14,
                }}>
                <span style={{
                  position: 'absolute', left: '50%', bottom: -2, transform: 'translate(-50%, 100%)',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.06em', color: hovedet === g ? farge : 'var(--tekst-5-app)',
                  whiteSpace: 'nowrap', background: 'var(--flate-12-alt)', padding: '0 4px',
                }}>
                  {g.etikett}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {klammer.length > 0 && <div style={{ height: 14 }} />}

      {/* Leser-linje for valgt segment / gruppe («hold over»-raden i fasiten). */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        color: 'var(--tekst-5-app)', minHeight: 20, paddingTop: 4,
      }}>
        {hovedet && !valgtSegment && (() => {
          const deler = segmenter.slice(hovedet.fra, hovedet.til + 1)
          const arbeid = deler.filter(s => s.type !== 'pause')
          const total = deler.reduce((s, x) => s + (x.sluttSek - x.startSek), 0)
          const pulser = arbeid.map(s => pulsIVindu(hr, s.startSek, s.sluttSek).snitt).filter((v): v is number => v != null)
          const snittPuls = pulser.length ? Math.round(pulser.reduce((a, b) => a + b, 0) / pulser.length) : null
          const wattSnitt = watt && watt.length > 1
            ? snittAv(watt.filter(w => arbeid.some(s => w.t >= s.startSek && w.t <= s.sluttSek)).map(w => ({ t: w.t, v: w.w })))
            : null
          return (
            <span>
              <b style={{ color: SEGMENT_FARGER[hovedet.type] }}>{hovedet.etikett}</b>
              {' · '}{fmtKlokkeSek(hovedet.startSek)}–{fmtKlokkeSek(hovedet.sluttSek)}
              {' · totalt '}{fmtKlokkeSek(total)}
              {snittPuls != null ? <>{' · snittpuls i dragene '}{snittPuls}</> : null}
              {wattSnitt != null ? <>{' · snittwatt '}{Math.round(wattSnitt)}</> : null}
            </span>
          )
        })()}
        {valgtSegment && (() => {
          const puls = pulsIVindu(hr, valgtSegment.startSek, valgtSegment.sluttSek)
          return (
            <span>
              <b style={{ color: SEGMENT_FARGER[valgtSegment.type] }}>{valgtSegment.etikett}</b>
              {' · '}{fmtKlokkeSek(valgtSegment.startSek)}–{fmtKlokkeSek(valgtSegment.sluttSek)}
              {' · '}{fmtKlokkeSek(valgtSegment.sluttSek - valgtSegment.startSek)}
              {puls.snitt != null ? <>{' · snitt '}{puls.snitt}</> : <>{' · puls: for lite data'}</>}
              {(() => {
                const f = snittFartIVindu(speed, valgtSegment.startSek, valgtSegment.sluttSek)
                return f != null ? <>{' · '}{fmtFart(f, sport)}</> : null
              })()}
              {valgtSegment.treff ? <>{' · '}{valgtSegment.treff}</> : null}
            </span>
          )
        })()}
        {!valgtSegment && !hovedet && (
          <span style={{ color: 'var(--tekst-8-alt)' }}>
            Hold over et segment: tid · varighet · snittpuls{segmenter.some(sg => sg.treff) ? ' · treff' : ''}
            {klammer.length > 0 ? ' — eller en klamme for hele gruppa' : ''}
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

function snittFartIVindu(arr: SpeedSample[] | null, fra: number, til: number): number | null {
  if (!arr || arr.length === 0) return null
  return snittAv(arr.filter(p => p.t >= fra && p.t <= til).map(p => ({ t: p.t, v: p.mps })))
}

function fmtFart(mps: number, sport: Sport): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const secPerKm = 1000 / mps
  const m = Math.floor(secPerKm / 60)
  const sek = Math.round(secPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}

// ── Kompakt kurve — oversikten (kalender, øktliste) ──────────
// Samme kurve i miniatyr: pulsen som tynn linje og segmentbåndet under.
// Ingen kontroller, ingen etiketter — bare formen, så et blikk på
// kalenderen viser om økta var jevn eller hadde drag.

export function KompaktKurve({ hr, totalSek, segmenter, hoyde = 30, plan = [] }: {
  hr: Array<{ t: number; hr: number }>
  totalSek: number
  segmenter: Segment[]
  hoyde?: number
  /** Planens blokker som spøkelse bak (bolk 7) — uten bryter i oversikten. */
  plan?: Array<{ startSek: number; sluttSek: number; sone: string | null; type: string }>
}) {
  const B = 320
  const sti = useMemo(() => {
    if (hr.length < 2 || totalSek <= 0) return ''
    let lo = Infinity, hi = -Infinity
    for (const p of hr) { if (p.hr < lo) lo = p.hr; if (p.hr > hi) hi = p.hr }
    const spenn = Math.max(1, hi - lo)
    const H = hoyde - 6
    return hr.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${((p.t / totalSek) * B).toFixed(1)} ${(1 + (1 - (p.hr - lo) / spenn) * (H - 2)).toFixed(1)}`,
    ).join(' ')
  }, [hr, totalSek, hoyde])
  if (totalSek <= 0 || (hr.length < 2 && segmenter.length === 0)) return null
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / totalSek) * 100))}%`
  const spokelser: PlanBlokk[] = plan.map((p, i) => ({ id: `p${i}`, type: p.type, navn: null, startSek: p.startSek, sluttSek: p.sluttSek, sone: p.sone }))
  return (
    <div data-kompakt-kurve aria-hidden style={{ position: 'relative', height: hoyde, marginTop: 3 }}>
      {spokelser.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hoyde - 6 }}>
          <PlanSpokelse blokker={spokelser} pct={pct} dempet={0.22} />
        </div>
      )}
      {sti && (
        <svg viewBox={`0 0 ${B} ${hoyde - 6}`} preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, width: '100%', height: hoyde - 6 }}>
          <path d={sti} fill="none" stroke="#E23A5A" strokeWidth={1.2} opacity={0.85} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {segmenter.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 }}>
          {segmenter.map(sg => (
            <span key={sg.aktivitetId} style={{
              position: 'absolute', left: pct(sg.startSek),
              width: `calc(${pct(sg.sluttSek - sg.startSek)} - 1px)`, minWidth: 2,
              top: 0, bottom: 0, borderRadius: 1, background: segmentBakgrunn(sg.type), opacity: 0.9,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
