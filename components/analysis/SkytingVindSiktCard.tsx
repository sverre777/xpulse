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
import { SIGHT_LEVELS, windShort } from '@/lib/shooting'
import { ChartWrapper } from './ChartWrapper'
import { ChipSelector } from './ChartControls'
import { COLOR_PRONE, COLOR_STANDING } from './SkytingSummaryCards'

/** Under dette antallet førte skudd sier raden «for lite data». */
const MIN_SKUDD = 20

// SKALAEN ER STANDARD: for en skiskytter er venstre mot høyre i SAMME styrke
// hele poenget med å se på vind, og det må stå i ett bilde — ikke som to
// visninger man sammenligner fra hukommelsen. «Sider hver for seg» nøkler
// derfor radene på FORTEGNET styrke (−5 … 0 … +5). Sammenslåingen er beholdt
// som et eksplisitt valg: den er nyttig når man vil se styrken alene.
type Retning = 'sider' | 'samlet' | 'V' | 'H'
type Kontekst = 'alle' | 'trening' | 'konkurranse'

interface Rad {
  key: string
  label: string
  /** Sorteringsverdi. For vind: fortegnet styrke, så venstre havner over
   *  vindstille og høyre under — skalaen leses ovenfra og ned. */
  order: number
  recL: number; hitL: number
  recS: number; hitS: number
}

function tomRad(key: string, label: string, order: number): Rad {
  return { key, label, order, recL: 0, hitL: 0, recS: 0, hitS: 0 }
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
  const [retning, setRetning] = useState<Retning>('sider')

  const utvalg = useMemo(() => data.series.filter(r => {
    if (kontekst === 'trening') return !r.in_competition
    if (kontekst === 'konkurranse') return r.in_competition
    return true
  }), [data.series, kontekst])

  // ── Vind ──
  const vind = useMemo(() => {
    const rader = new Map<string, Rad>()
    let utelatt = 0
    for (const r of utvalg) {
      if (r.vind_styrke == null) { utelatt++; continue }
      const styrke = Math.max(0, Math.min(5, r.vind_styrke))
      // Vindstille har ingen retning og er referanselinja — den står i ALLE
      // fire valgene, ellers mister man sammenligningsgrunnlaget.
      if (styrke > 0 && (retning === 'V' || retning === 'H') && r.vind_retning !== retning) continue

      let key: string, label: string, order: number
      if (styrke === 0) {
        key = '0'; label = 'Vindstille'; order = 0
      } else if (retning === 'samlet') {
        key = `s${styrke}`; label = `Vimpel ${styrke}`; order = styrke
      } else {
        // Etiketten kommer fra windShort() — samme fasit som chips og
        // tooltips, ingen ny navngiving av vindforhold.
        const dir = r.vind_retning
        const kort = windShort(dir, styrke) ?? String(styrke)
        key = `${dir ?? '?'}${styrke}`
        label = dir === 'V' ? `${kort} ← venstre` : dir === 'H' ? `${kort} → høyre` : kort
        order = dir === 'V' ? -styrke : styrke
      }

      const rad = rader.get(key) ?? tomRad(key, label, order)
      leggTil(rad, r)
      rader.set(key, rad)
    }
    return {
      rader: Array.from(rader.values())
        .sort((a, b) => a.order - b.order)
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
      const rad = rader.get(niva.key) ?? tomRad(niva.key, niva.label, niva.fog)
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
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
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
                { value: 'sider', label: 'Sider hver for seg' },
                { value: 'samlet', label: 'Slått sammen' },
                { value: 'V', label: '← Fra venstre' },
                { value: 'H', label: '→ Fra høyre' },
              ]}
            />
          </div>

          <Blokk
            tittel={retning === 'samlet' ? 'Vind (vimpel) — styrke slått sammen' : 'Vind (vimpel)'}
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {tittel}
      </p>
      {rader.length === 0 ? (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          Ingen serier med dette ført i perioden.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rader.map(rad => (
            <div key={rad.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="shrink-0 sm:w-28 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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
        <p className="text-xs mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
      <span className="shrink-0 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', width: 64 }}>
        {navn}
      </span>
      <div className="flex-1 min-w-0" style={{ height: 10, backgroundColor: 'var(--flate-13)', borderRadius: 999, overflow: 'hidden' }}>
        {nokData && (
          <div style={{ width: `${p}%`, height: '100%', backgroundColor: farge, borderRadius: 999 }} />
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif", width: 118, textAlign: 'right' }}>
        {nokData ? (
          <>
            <b style={{ color: 'var(--tekst-1-app)' }}>{p!.toFixed(1)}%</b>
            <span style={{ color: 'var(--tekst-8-app)' }}> · {rec} skudd</span>
          </>
        ) : (
          <span style={{ color: 'var(--tekst-8-app)' }}>
            {rec === 0 ? '—' : `for lite data · ${rec}`}
          </span>
        )}
      </span>
    </div>
  )
}

function Forklaring() {
  return (
    <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
      Tallene er veiledende, ikke en dom: de sier hvor du har skutt mye og hvor du har skutt lite.
      Serier uten ført vind eller sikt telles aldri som vindstille eller god sikt — de holdes utenfor.
    </p>
  )
}
