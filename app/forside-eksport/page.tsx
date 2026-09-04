'use client'

// FORSIDENS EKSPORT-SIDE (regel 11: én komponent, flere monteringspunkter).
// Monterer de EKTE app-komponentene med fiktive data. scripts/forside-
// eksport.mjs åpner sida i lys og mørk, serialiserer hvert [data-eksport]
// til statisk HTML og legger det inn i public/xpulse.html. Sida er for
// utvikling — den returnerer 404 i produksjon.

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PlanGraf, planNokkeltallCeller, Nokkeltall } from '@/components/workout/PlanGraf'
import { byggPlanBlokker } from '@/lib/plan-graf'
import { WorkoutDetailChart, Detaljrad } from '@/components/workout/WorkoutDetailChart'
import { AktivitetKnapperad } from '@/components/workout/AktivitetKnapperad'
import { IntervallBygger } from '@/components/workout/IntervallBygger'
import { HelseOversikt } from '@/components/helse/HelseOversikt'
import { SamletBryter } from '@/components/workout/SamletBryter'
import { WorkoutChip, CalendarActionsStubProvider } from '@/components/calendar/Calendar'
import { KompaktKurverProvider } from '@/components/calendar/kompakt-kurver'
import { SeasonCanvas } from '@/components/periodization/SeasonCanvas'
import { Gruppe as PlottTreffGruppeVisning } from '@/components/workout/PlottTreff'
import { RpeSkala } from '@/components/ui/RpeSkala'
import { fraTidspunktNotater } from '@/components/workout/Punkt'
import {
  oktaRader, oktaPlanBlokker, oktaSegmenter, oktaSamples, oktaLaps, OKTA_LAKTAT, OKTA_ERNAERING, OKTA_TOTAL,
  kalenderUke, helseData, aarsplan, plottTreffGruppe, standardoktBlokker,
} from '@/lib/forside-eksport-data'
import type { PlanBlokk } from '@/app/actions/runder'

/** Smal variant (?smal=1): alle flater 340 px brede — mobilens ekte, responsive
    rendering av samme komponent. Forsiden laster den under 560 px. */
function Kort({ navn, bredde = 620, children }: { navn: string; bredde?: number; children: React.ReactNode }) {
  const smal = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('smal') === '1'
  return (
    <section style={{ marginBottom: 40 }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', margin: '0 0 6px' }}>{navn}</p>
      <div data-eksport={navn} style={{ width: smal ? Math.min(bredde, 340) : bredde, maxWidth: '100%' }}>{children}</div>
    </section>
  )
}

function ForsideEksportInnhold() {
  const sp = useSearchParams()
  const tema = sp.get('tema') === 'lys' ? 'lys' : 'mork'
  const [klar, setKlar] = useState(false)
  useEffect(() => {
    document.documentElement.dataset.tema = tema
    try { localStorage.setItem('xpulse-tema', tema) } catch { /* privat modus */ }
    setKlar(true)
  }, [tema])

  const rader = useMemo(() => oktaRader(), [])
  const plan = useMemo(() => oktaPlanBlokker(), [])
  const segmenter = useMemo(() => oktaSegmenter(), [])
  const samples = useMemo(() => oktaSamples(), [])
  const laps = useMemo(() => oktaLaps(), [])
  const uke = useMemo(() => kalenderUke(), [])
  const helse = useMemo(() => helseData(), [])
  const aars = useMemo(() => aarsplan(), [])
  const plott = useMemo(() => plottTreffGruppe(), [])
  const standardokt = useMemo(() => standardoktBlokker(), [])
  // Planens blokker bak kurven: samme økt som plan, med tidsvinduer.
  const planBak: PlanBlokk[] = useMemo(() => byggPlanBlokker(plan).map((b, i) => (
    { id: `pb-${i}`, type: b.type, navn: b.navn, startSek: b.startSek, sluttSek: b.startSek + b.sek, sone: b.sone ? String(b.sone) : null }
  )), [plan])
  const ingen = () => {}

  if (process.env.NODE_ENV === 'production') return <p style={{ padding: 40 }}>Ikke tilgjengelig.</p>

  return (
    <main data-eksport-klar={klar ? '1' : undefined} style={{ padding: '32px 28px', background: 'var(--flate-3)', color: 'var(--tekst-1-app)', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em', marginBottom: 24 }}>Forside-eksport · {tema}</h1>

      <Kort navn="kalender-uke" bredde={660}>
        <CalendarActionsStubProvider>
          <KompaktKurverProvider byDate={{}}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
              {uke.map(d => (
                <div key={d.dato} data-eksport-dag={d.dato} style={{ minWidth: 0 }}>
                  {d.okter.map(w => <WorkoutChip key={w.id} w={w} dateStr={d.dato} mode="dagbok" />)}
                </div>
              ))}
            </div>
          </KompaktKurverProvider>
        </CalendarActionsStubProvider>
      </Kort>

      <Kort navn="telefon-uke" bredde={300}>
        <CalendarActionsStubProvider>
          <KompaktKurverProvider byDate={{}}>
            {uke.map(d => (
              <div key={d.dato} data-eksport-dag={d.dato} style={{ marginBottom: 6 }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--tekst-5-app)', margin: '0 0 3px' }}>{d.dag}</p>
                {d.okter.map(w => <WorkoutChip key={w.id} w={w} dateStr={d.dato} mode="dagbok" kompakt={false} />)}
              </div>
            ))}
          </KompaktKurverProvider>
        </CalendarActionsStubProvider>
      </Kort>

      <Kort navn="oktkort-plan" bredde={330}>
        <CalendarActionsStubProvider><KompaktKurverProvider byDate={{}}>
          <WorkoutChip w={{ ...uke[3].okter[0], is_planned: true, is_completed: false }} dateStr={uke[3].dato} mode="plan" kompakt={false} />
        </KompaktKurverProvider></CalendarActionsStubProvider>
      </Kort>
      <Kort navn="oktkort-gjennomfort" bredde={330}>
        <CalendarActionsStubProvider><KompaktKurverProvider byDate={{}}>
          <WorkoutChip w={{ ...uke[3].okter[0], rpe: 7 } as typeof uke[3]['okter'][0]} dateStr={uke[3].dato} mode="dagbok" kompakt={false} />
        </KompaktKurverProvider></CalendarActionsStubProvider>
      </Kort>
      <Kort navn="standardokt-stripe" bredde={500}>
        <PlanGraf blokker={standardokt} tetthet="kompakt" hoyde={40} />
      </Kort>

      <Kort navn="oktkart" bredde={500}>
        <PlanGraf blokker={plan} tetthet="full" punkter={fraTidspunktNotater([{ id: 'p1', sek: 1200 + 600 + 60 + 120 + 600 + 30, type: 'laktat', tekst: '', planlagt: true }])} />
        <Nokkeltall celler={planNokkeltallCeller(plan)} rpe={6} rpeEtikett="Forventet" />
      </Kort>

      <Kort navn="oktgraf" bredde={540}>
        <WorkoutDetailChart kurveStandard sport="biathlon" samples={samples} laps={laps} lactate={OKTA_LAKTAT} nutrition={OKTA_ERNAERING} shooting={[]}
          segmenter={segmenter} heartZones={[]} np={238} rpe={7} onRpe={ingen} forventetRpe={6} planBlokkerInn={planBak}
          handlinger={{ onOktbygger: ingen, onPlottTreff: ingen, onSettLaktat: ingen, onNotat: ingen }} />
      </Kort>

      <Kort navn="oktgraf-skjema" bredde={500}>
        <WorkoutDetailChart kurveStandard tetthet="skjema" sport="biathlon" samples={samples} laps={laps} lactate={OKTA_LAKTAT} nutrition={OKTA_ERNAERING} shooting={[]}
          segmenter={segmenter} heartZones={[]} np={238} planBlokkerInn={planBak} />
      </Kort>

      <Kort navn="knapperad" bredde={500}>
        <AktivitetKnapperad isPlanMode harSkyting userHasBiathlon onOktbygger={ingen} onLeggTilAktivitet={ingen} onLeggTilSkyting={ingen} />
      </Kort>

      <Kort navn="hurtigoppsett" bredde={500}>
        <IntervallBygger sport="biathlon" onOpprett={ingen}
          forhandsutfylt={{ rader: [{ antall: 2, dragSek: 600, sone: 'I3', pauseSek: 180 }, { antall: 3, dragSek: 300, sone: 'I4', pauseSek: 120 }], oppvarmingSek: 1200, nedjoggSek: 900, skyting: 'L-S', tittel: '2 × 10 min I3 / 3 min + 3 × 5 min I4' } as unknown as Parameters<typeof IntervallBygger>[0]['forhandsutfylt']} />
      </Kort>

      <Kort navn="helse" bredde={500}>
        <HelseOversikt forhandsdata={helse} sluttDato="2026-09-04" />
      </Kort>

      <Kort navn="samlet-bryter" bredde={300}>
        <SamletBryter visning="samlet" onVisning={ingen} />
      </Kort>

      <Kort navn="aarsplan" bredde={500}>
        <SeasonCanvas season={aars.season} periods={aars.periods} markings={aars.markings} keyDates={aars.keyDates} canEdit={false}
          onPickPeriod={ingen} onPickMarking={ingen} onDrawMarking={ingen} />
      </Kort>

      <Kort navn="plott-treff" bredde={700}>
        <PlottTreffGruppeVisning gruppe={plott} nr={2} antallLike={2} rekkefolge={2} hr={samples.hr_samples ?? []} ownTests={[]} onSerier={ingen} />
      </Kort>

      <Kort navn="detaljrad" bredde={540}>
        <Detaljrad rpe={7} onRpe={ingen} lactate={OKTA_LAKTAT} nutrition={OKTA_ERNAERING} segmenter={segmenter}
          handlinger={{ onOktbygger: ingen, onPlottTreff: ingen, onSettLaktat: ingen, onNotat: ingen }} />
      </Kort>

      <Kort navn="rpe-skala" bredde={420}>
        <RpeSkala value={7} onChange={ingen} kompakt etikett="Opplevd belastning 1–10" />
      </Kort>

      <p style={{ fontSize: 12, color: 'var(--tekst-8-alt)' }}>Total øktlengde {Math.round(OKTA_TOTAL / 60)} min · {rader.length} rader</p>
    </main>
  )
}

/** useSearchParams krever en Suspense-grense ved prerender (Next 16). */
export default function ForsideEksportSide() {
  return <Suspense fallback={null}><ForsideEksportInnhold /></Suspense>
}
