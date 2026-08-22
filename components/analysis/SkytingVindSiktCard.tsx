'use client'

// TREFF% I VIND OG SIKT.
//
// Vind og sikt fantes bare som FILTRE i custom-grafen. Det som manglet var
// statistikken: hva gjør vinden faktisk med treffprosenten min.
//
// Radene er tegnet som måler-søyler i HTML, ikke i recharts. Grunnen er krav
// 3 og 4: hver rad må vise antall førte skudd, og under terskelen skal det
// stå «for lite data» i stedet for et tall. En søyle som er borte fordi
// grunnlaget er tynt, og en søyle som er borte fordi man bommet på alt, ser
// like ut i et diagram — her sier raden det med ord.
//
// Datamodellen (verifisert i koden, ikke antatt):
//  · vind_styrke er vimpelverdi 0–5, klampet ved lagring
//    (app/actions/workouts.ts) — 0 = vindstille.
//  · vind_retning er 'V' | 'H', og tvinges til null når styrken er 0.
//  · sikt er SightKey — SIGHT_LEVELS i lib/shooting.ts er fasiten.
//  · null betyr IKKE FØRT, ikke vindstille. Slike serier holdes utenfor, og
//    kortet sier hvor mange som ble utelatt — ellers ser tallene mer
//    komplette ut enn de er.
//  · Treff% regnes på prone_recorded_shots / standing_recorded_shots, aldri
//    på totalskudd (kun-førte-regelen).

import { useMemo, useState } from 'react'
import type { ShootingDepthAnalysis, ShootingSeriesRow } from '@/app/actions/analysis'
import { SIGHT_LEVELS } from '@/lib/shooting'
import { ChartWrapper } from './ChartWrapper'
import { ChipSelector } from './ChartControls'
import { COLOR_PRONE, COLOR_STANDING } from './SkytingSummaryCards'

/** Under dette antallet førte skudd sier raden «for lite data». */
const MIN_SKUDD = 20

type Retning = 'alle' | 'V' | 'H'
type Kontekst = 'alle' | 'trening' | 'konkurranse'

interface Rad {
  key: string
  label: string
  recL: number; hitL: number
  recS: number; hitS: number
}

function tomRad(key: string, label: string): Rad {
  return { key, label, recL: 0, hitL: 0, recS: 0, hitS: 0 }
}

function leggTil(rad: Rad, r: ShootingSeriesRow) {
  rad.recL += r.prone_recorded_shots
  rad.hitL += r.prone_hits
  rad.recS += r.standing_recorded_shots
  rad.hitS += r.standing_hits
}

function pct(hits: number, rec: number): number | null {
  return rec > 0 ? Math.round((hits / rec) * 1000) / 10 : null
}

export function SkytingVindSiktCard({ data }: { data: ShootingDepthAnalysis }) {
  const [kontekst, setKontekst] = useState<Kontekst>('alle')
  const [retning, setRetning] = useState<Retning>('alle')

  const utvalg = useMemo(() => data.series.filter(r => {
    if (kontekst === 'trening') return !r.in_competition
    if (kontekst === 'konkurranse') return r.in_competition
    return true
  }), [data.series, kontekst])

  // ── Vind ──
  const vind = useMemo(() => {
    const rader = new Map<number, Rad>()
    let utelatt = 0
    for (const r of utvalg) {
      if (r.vind_styrke == null) { utelatt++; continue }
      const styrke = Math.max(0, Math.min(5, r.vind_styrke))
      // Vindstille har ingen retning og er referanselinja — den står uansett
      // hvilken side man ser på, ellers mister man sammenligningsgrunnlaget.
      if (styrke > 0 && retning !== 'alle' && r.vind_retning !== retning) continue
      const rad = rader.get(styrke)
        ?? tomRad(String(styrke), styrke === 0 ? 'Vindstille' : `Vimpel ${styrke}`)
      leggTil(rad, r)
      rader.set(styrke, rad)
    }
    return {
      rader: Array.from(rader.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, rad]) => rad)
        .filter(rad => rad.recL > 0 || rad.recS > 0),
      utelatt,
    }
  }, [utvalg, retning])

  // ── Sikt ──
  const sikt = useMemo(() => {
    const rader = new Map<string, Rad>()
    let utelatt = 0
    for (const r of utvalg) {
      if (r.sikt == null) { utelatt++; continue }
      const niva = SIGHT_LEVELS.find(s => s.key === r.sikt)
      if (!niva) { utelatt++; continue }
      const rad = rader.get(niva.key) ?? tomRad(niva.key, niva.label)
      leggTil(rad, r)
      rader.set(niva.key, rad)
    }
    return {
      // Rekkefølgen er SIGHT_LEVELS sin — god sikt først, tettest tåke sist.
      rader: SIGHT_LEVELS
        .map(n => rader.get(n.key))
        .filter((rad): rad is Rad => !!rad && (rad.recL > 0 || rad.recS > 0)),
      utelatt,
    }
  }, [utvalg])

  // Selvskjulende: har ingen serier i perioden ført vind ELLER sikt, finnes
  // det ingenting å si her.
  if (vind.rader.length === 0 && sikt.rader.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Treff% i vind og sikt
        </p>
      </div>
      <ChartWrapper
        chartKey="skyting_wind_accuracy"
        title="Treff% i vind og sikt"
        subtitle={`Liggende og stående side om side · under ${MIN_SKUDD} førte skudd vises «for lite data» i stedet for et tall`}
        height="auto"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end flex-wrap">
            <ChipSelector
              label="Økter"
              value={kontekst}
              onChange={setKontekst}
              options={[
                { value: 'alle', label: 'Alle' },
                { value: 'trening', label: 'Trening' },
                { value: 'konkurranse', label: 'Konkurranse' },
              ]}
            />
            <ChipSelector
              label="Vindretning"
              value={retning}
              onChange={setRetning}
              options={[
                { value: 'alle', label: 'Samlet' },
                { value: 'V', label: '← Fra venstre' },
                { value: 'H', label: '→ Fra høyre' },
              ]}
            />
          </div>

          <Blokk
            tittel="Vind (vimpel)"
            rader={vind.rader}
            utelatt={vind.utelatt}
            utelattTekst="uten ført vind"
          />
          <Blokk
            tittel="Sikt"
            rader={sikt.rader}
            utelatt={sikt.utelatt}
            utelattTekst="uten ført sikt"
          />

          <Forklaring />
        </div>
      </ChartWrapper>
    </div>
  )
}

function Blokk({ tittel, rader, utelatt, utelattTekst }: {
  tittel: string
  rader: Rad[]
  utelatt: number
  utelattTekst: string
}) {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {tittel}
      </p>
      {rader.length === 0 ? (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen serier med dette ført i perioden.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rader.map(rad => (
            <div key={rad.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="shrink-0 sm:w-28 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {rad.label}
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <Maler navn="Liggende" farge={COLOR_PRONE} rec={rad.recL} hits={rad.hitL} />
                <Maler navn="Stående" farge={COLOR_STANDING} rec={rad.recS} hits={rad.hitS} />
              </div>
            </div>
          ))}
        </div>
      )}
      {utelatt > 0 && (
        <p className="text-xs mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {utelatt} serie{utelatt === 1 ? '' : 'r'} {utelattTekst} er holdt utenfor.
        </p>
      )}
    </div>
  )
}

// Én måler-rad. Tallet står ALLTID sammen med antall skudd: en 100 %-rad
// bygget på fem skudd skal ikke se ut som en bygget på hundre.
function Maler({ navn, farge, rec, hits }: {
  navn: string; farge: string; rec: number; hits: number
}) {
  const p = pct(hits, rec)
  const nokData = rec >= MIN_SKUDD && p != null
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', width: 64 }}>
        {navn}
      </span>
      <div className="flex-1 min-w-0" style={{ height: 10, backgroundColor: '#15151A', borderRadius: 999, overflow: 'hidden' }}>
        {nokData && (
          <div style={{ width: `${p}%`, height: '100%', backgroundColor: farge, borderRadius: 999 }} />
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif", width: 118, textAlign: 'right' }}>
        {nokData ? (
          <>
            <b style={{ color: '#F0F0F2' }}>{p!.toFixed(1)}%</b>
            <span style={{ color: '#555560' }}> · {rec} skudd</span>
          </>
        ) : (
          <span style={{ color: '#555560' }}>
            {rec === 0 ? '—' : `for lite data · ${rec}`}
          </span>
        )}
      </span>
    </div>
  )
}

function Forklaring() {
  return (
    <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      Tallene er veiledende, ikke en dom: de sier hvor du har skutt mye og hvor du har skutt lite.
      Serier uten ført vind eller sikt telles aldri som vindstille eller god sikt — de holdes utenfor.
    </p>
  )
}
