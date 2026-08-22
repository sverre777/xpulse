'use client'

// Skyting-seksjonen UNDER DAGBOKEN. To rader: nøkkeltallene øverst og
// «Skudd per uke» under, med én periodevelger som styrer begge.
//
// HVORFOR IKKE CUSTOM-GRAFEN HER: den lå her først, men er for tung under
// kalenderen. Custom-grafen bor nå kun i Analyse → Skyting-dybde — den som
// vil ha den under dagboken kan stjernemerke den (chartKey «skyting_custom»),
// og favoritt-veien er escape-hatchen.
//
// SELVSKJULENDE — MEN PÅ RIKTIG NIVÅ: seksjonen skjules for den som ikke
// driver med skyting i det hele tatt (en løper eller syklist skal ikke få en
// tom skyting-boks under kalenderen). Den skjules IKKE fordi den valgte
// perioden tilfeldigvis er tom: klikker du «Uke» i en uke uten skyting, skal
// grafen stå tom — ikke forsvinne under fingeren på deg.
//
// Skillet gjøres med et klebrig flagg: har vi én gang sett skytedata for
// denne brukeren, blir seksjonen stående. Første lasting bruker standard-
// perioden År, så flagget svarer i praksis på «har du skutt det siste året».
//
// getShootingDepthAnalysis filtrerer selv på biathlon, så dette dekker også
// «skyting finnes bare når skiskyting er primær/sekundær sport»: uten
// biathlon-økter finnes det ingen serier å vise.

import { useEffect, useMemo, useState, useTransition } from 'react'
import { getShootingDepthAnalysis, type ShootingDepthAnalysis } from '@/app/actions/analysis'
import { SkytingSummaryCards } from './SkytingSummaryCards'
import { ShotVolumeChart } from './ShotVolumeChart'
import { ChipSelector } from './ChartControls'
import { rangeFromPreset, shotVolumeGrouping, type DateRange } from './date-range'

// Periodevalgene er høstet fra CalendarAnalysisSnippets (LocalPeriod /
// rangeForPeriod / PERIOD_OPTIONS) i stedet for å finne opp et nytt sett.
// «Egendefinert» er utelatt her: seksjonen skal være en rask oversikt, ikke
// et analyseverktøy — det er custom-grafen i analysen sin oppgave.
type SkytingPeriode = 'week' | '30d' | '3m' | '12m'

const PERIODE_VALG: { value: SkytingPeriode; label: string }[] = [
  { value: 'week', label: 'Uke' },
  { value: '30d',  label: 'Måned' },
  { value: '3m',   label: '3 mnd' },
  { value: '12m',  label: 'År' },
]

function rangeForPeriode(p: SkytingPeriode): DateRange {
  if (p === 'week') {
    // Inneværende uke, mandag–søndag. Samme utregning som snippet-versjonen.
    const today = new Date()
    const dow = (today.getDay() + 6) % 7 // 0 = mandag
    const monday = new Date(today)
    monday.setDate(today.getDate() - dow)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { from: fmt(monday), to: fmt(sunday), preset: 'custom' }
  }
  return rangeFromPreset(p)
}

export function SkytingChartSection({ targetUserId }: { targetUserId?: string }) {
  // Standard År = nøyaktig samme vindu som seksjonen hadde før
  // periodevelgeren fantes, så oppførselen er uendret for den som ikke rører
  // noe.
  const [periode, setPeriode] = useState<SkytingPeriode>('12m')
  const range = useMemo(() => rangeForPeriode(periode), [periode])

  // BEGGE tilstandene bærer hvem de gjelder for. Trenervisningen er ruten
  // /app/trener/[athleteId]/dagbok: bytte av utøver endrer bare rute-
  // parameteren, komponenten står på samme plass i treet, og React beholder
  // state. Uten eierskap fulgte det klebrige flagget med — og en løper fikk
  // skiskytterens skyting-seksjon med «—» og 0, som er nøyaktig det
  // selvskjulingen finnes for å hindre.
  //
  // Eierskap i stedet for nullstilling: da forsvinner seksjonen med én gang
  // id-en ikke stemmer, uten et bilde der den blinker bort og inn igjen.
  // Dataene har samme eier, så heller ikke tallene kan vises for feil utøver
  // i vinduet før det nye svaret lander.
  const brukerNokkel = targetUserId ?? 'meg'
  const [svar, setSvar] = useState<{ forBruker: string; data: ShootingDepthAnalysis } | null>(null)
  const [harSkytedataFor, setHarSkytedataFor] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let avbrutt = false
    startTransition(async () => {
      // sportFilter = null: funksjonen filtrerer selv på biathlon. Sender vi
      // en annen sport inn, svarer den med sportMismatch og tom analyse.
      const res = await getShootingDepthAnalysis(range.from, range.to, null, targetUserId)
      if (avbrutt) return
      // Feil (f.eks. trener uten analysetilgang) skjuler seksjonen i stedet
      // for å rope om det — dette er en bonusflate, ikke en hovedflate.
      if ('error' in res) { setSvar(null); return }
      setSvar({ forBruker: brukerNokkel, data: res })
      if (res.hasData) setHarSkytedataFor(brukerNokkel)
    })
    return () => { avbrutt = true }
  }, [range.from, range.to, targetUserId, brukerNokkel])

  // Vis kun når BÅDE dataene og «har skyting»-flagget gjelder utøveren vi
  // faktisk står på.
  if (!svar || svar.forBruker !== brukerNokkel) return null
  if (harSkytedataFor !== brukerNokkel) return null
  const data = svar.data
  const tomPeriode = !data.hasData

  return (
    <>
      <div className="flex items-center gap-3 mb-4 mt-8">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
          Skyting
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* Én periodevelger for BEGGE radene. Den fysiske «Custom graf» over
            har sin egen — de to er ulike spørsmål, og å tvinge dem sammen
            ville låst den som vil se fysisk år mot skyting uke. */}
        <ChipSelector
          label="Periode"
          value={periode}
          onChange={setPeriode}
          options={PERIODE_VALG}
        />

        {/* Kortene står også i en tom periode — da med «—» og 0, som er et
            ærlig svar. De forsvinner ikke. */}
        <SkytingSummaryCards data={data} />

        {tomPeriode && (
          <div className="p-5 text-center"
            style={{ border: '1px dashed #1E1E22', borderRadius: 'var(--r-card)' }}>
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Ingen skyting ført i denne perioden.
            </p>
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Velg en lengre periode over for å se historikken.
            </p>
          </div>
        )}

        {/* Tittelen utledes av SAMME funksjon som grafen grupperer etter.
            Gjettet vi på periode-nøkkelen i stedet, ville «3 mnd» (90 dager,
            altså ukesøyler) fått tittelen «Skudd per måned». */}
        <ShotVolumeChart
          range={range}
          targetUserId={targetUserId}
          title={shotVolumeGrouping(range) === 'month' ? 'Skudd per måned' : 'Skudd per uke'}
        />
      </div>
    </>
  )
}
