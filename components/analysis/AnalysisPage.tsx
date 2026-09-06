'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { HelseOversikt } from '@/components/helse/HelseOversikt'
import {
  getWorkoutStats, getAnalysisOverview,
  getCompetitionAnalysis, getMovementAnalysis, getHealthCorrelations,
  getTemplateAnalysis, getWorkoutsForComparison, getIntensityDistribution,
  getBelastningAnalysis, getTerskelAnalysis, getShootingDepthAnalysis, getPeriodizationOverview,
  getTestsAndPRs, getWeatherAnalysis, getAltitudeHeatAnalysis,
  type WorkoutStats, type AnalysisOverview, type WeatherAnalysis, type AltitudeHeatAnalysis,
  type CompetitionAnalysis, type MovementAnalysis, type HealthCorrelations,
  type TemplateAnalysis, type WorkoutsForComparison, type IntensityDistribution,
  type BelastningAnalysis, type TerskelAnalysis, type ShootingDepthAnalysis, type PeriodizationOverview,
  type TestsAndPRs,
} from '@/app/actions/analysis'
import { SPORTS, SURFACE_SUMMER, SURFACE_WINTER, type Sport } from '@/lib/types'
import { DateRangePicker, type DateRange } from './DateRangePicker'
import { FavoritesProvider, useFavorites } from './FavoritesContext'
import { FavoritterTab } from './FavoritterTab'
import { dataForGraf, losGrafNokkel, type FaneKey } from '@/lib/graf-register'
import { getHelseOversikt, type HelseOversiktData } from '@/app/actions/helse-oversikt'
import type { FavoriteChart } from '@/app/actions/favorites'
import { getHelseBelastning, type HelseBelastning } from '@/app/actions/helse-belastning'
import { OverviewTab } from './OverviewTab'
import { getSkiTestAnalysis, type SkiTestAnalysisData } from '@/app/actions/ski-tests'
import { getNutritionAnalysis, type NutritionAnalysis } from '@/app/actions/nutrition'
import { getKlokkedataTrender, type KlokkedataTrender } from '@/app/actions/klokkedata-trender'
import { getPrestasjonAnalyse, type PrestasjonAnalyse } from '@/app/actions/prestasjon-analyse'

// Lazy-load alle ikke-Oversikt-tabs. Hver tab importerer recharts som er
// ~50-100 KB per chunk — eager import av alle 13 tabs sammen var den største
// enkelt-bidragsyteren til /app/analyse first-load. ssr:false fordi parent
// er 'use client' og tabene først rendres etter klikk.
//
// next/dynamic krever objektliteral som options (kompilerings-tids analyse).
const CompetitionsTab = dynamic(() => import('./CompetitionsTab').then(m => ({ default: m.CompetitionsTab })),
  { loading: () => <LoadingStub label="Laster konkurranser…" />, ssr: false })
const MovementTab = dynamic(() => import('./MovementTab').then(m => ({ default: m.MovementTab })),
  { loading: () => <LoadingStub label="Laster bevegelsesdata…" />, ssr: false })
const TemplateAnalysisTab = dynamic(() => import('./TemplateAnalysisTab').then(m => ({ default: m.TemplateAnalysisTab })),
  { loading: () => <LoadingStub label="Laster mal-analyse…" />, ssr: false })
const CompareWorkoutsTab = dynamic(() => import('./CompareWorkoutsTab').then(m => ({ default: m.CompareWorkoutsTab })),
  { loading: () => <LoadingStub label="Laster økter…" />, ssr: false })
const IntensityTab = dynamic(() => import('./IntensityTab').then(m => ({ default: m.IntensityTab })),
  { loading: () => <LoadingStub label="Laster intensitetsfordeling…" />, ssr: false })
const BelastningTab = dynamic(() => import('./BelastningTab').then(m => ({ default: m.BelastningTab })),
  { loading: () => <LoadingStub label="Laster belastning…" />, ssr: false })
const TerskelTab = dynamic(() => import('./TerskelTab').then(m => ({ default: m.TerskelTab })),
  { loading: () => <LoadingStub label="Laster terskel…" />, ssr: false })
const SkytingTab = dynamic(() => import('./SkytingTab').then(m => ({ default: m.SkytingTab })),
  { loading: () => <LoadingStub label="Laster skyting-dybde…" />, ssr: false })
const PeriodiseringTab = dynamic(() => import('./PeriodiseringTab').then(m => ({ default: m.PeriodiseringTab })),
  { loading: () => <LoadingStub label="Laster årsplan…" />, ssr: false })
const TesterPRTab = dynamic(() => import('./TesterPRTab').then(m => ({ default: m.TesterPRTab })),
  { loading: () => <LoadingStub label="Laster tester og PR…" />, ssr: false })
const SkiTesterTab = dynamic(() => import('./SkiTesterTab').then(m => ({ default: m.SkiTesterTab })),
  { loading: () => <LoadingStub label="Laster ski-tester…" />, ssr: false })
const ErneringTab = dynamic(() => import('./ErneringTab').then(m => ({ default: m.ErneringTab })),
  { loading: () => <LoadingStub label="Laster ernærings-data…" />, ssr: false })
const KlokkedataTrenderTab = dynamic(() => import('./KlokkedataTrenderTab').then(m => ({ default: m.KlokkedataTrenderTab })),
  { loading: () => <LoadingStub label="Laster klokkedata-trender…" />, ssr: false })
const PrestasjonTab = dynamic(() => import('./PrestasjonTab').then(m => ({ default: m.PrestasjonTab })),
  { loading: () => <LoadingStub label="Laster prestasjonsmål…" />, ssr: false })
const SesongSammenligning = dynamic(() => import('./SesongSammenligning').then(m => ({ default: m.SesongSammenligning })),
  { loading: () => <LoadingStub label="Laster sesongsammenligning…" />, ssr: false })
const WeatherTab = dynamic(() => import('./WeatherTab').then(m => ({ default: m.WeatherTab })),
  { loading: () => <LoadingStub label="Laster vær/føre-analyse…" />, ssr: false })
const AltitudeHeatTab = dynamic(() => import('./AltitudeHeatTab').then(m => ({ default: m.AltitudeHeatTab })),
  { loading: () => <LoadingStub label="Laster høyde/varme-analyse…" />, ssr: false })
const StandardSessionsTab = dynamic(() => import('./StandardSessionsTab').then(m => ({ default: m.StandardSessionsTab })),
  { loading: () => <LoadingStub label="Laster standardøkter…" />, ssr: false })

// Favoritter først (Analyse v2 bolk 1) — standard landing når brukeren har minst
// én favoritt. mal_analyse/periodisering er skjulte dyplenke-faner.
type Tab =
  | 'favoritter'
  | 'oversikt'
  | 'klokkedata'
  | 'belastning'
  | 'prestasjon'
  | 'terskel'
  | 'skyting'
  | 'sammenlign'
  | 'standardokter'
  | 'mal_analyse'
  | 'konkurranser'
  | 'tester_pr'
  | 'ski_tester'
  | 'helse'
  | 'ernering'
  | 'vaer'
  | 'hoyde_varme'
  | 'per_bevegelsesform'
  | 'intensitet'
  | 'periodisering'

// Standard-bevegelse basert på brukerens primære sport.
function defaultMovementForSport(sport: Sport): string {
  switch (sport) {
    case 'running': return 'Løping'
    case 'cross_country_skiing': return 'Langrenn'
    case 'biathlon': return 'Langrenn'
    case 'triathlon': return 'Løping'
    case 'cycling': return 'Sykling'
    case 'long_distance_skiing': return 'Langrenn'
    case 'endurance': return 'Løping'
  }
}

const TABS: [Tab, string][] = [
  ['favoritter', 'Favoritter'],
  ['oversikt', 'Oversikt'],
  ['klokkedata', 'Klokkedata-trender'],
  ['belastning', 'Belastning'],
  ['prestasjon', 'Prestasjon'],
  ['terskel', 'Terskel'],
  ['skyting', 'Skyting-dybde'],
  ['sammenlign', 'Sammenligning'],
  ['standardokter', 'Standardøkter'],
  ['konkurranser', 'Konkurranser'],
  ['tester_pr', 'Tester & PR'],
  ['ski_tester', 'Ski-tester'],
  ['helse', 'Helse'],
  ['ernering', 'Ernæring'],
  ['vaer', 'Vær/føre'],
  ['hoyde_varme', 'Høyde & varme'],
  ['per_bevegelsesform', 'Per bevegelsesform'],
  ['intensitet', 'Intensitetsfordeling'],
]

const TAB_KEYS = new Set<string>(TABS.map(([k]) => k))

function SammenlignSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '32px', height: '3px', backgroundColor: accent, display: 'inline-block' }} />
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
          fontSize: '24px', letterSpacing: '0.06em',
        }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function LoadingStub({ label }: { label: string }) {
  return (
    <div className="py-16 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
      <p className="text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
        {label}
      </p>
    </div>
  )
}

export function AnalysisPage({
  initialStats, initialOverview, initialRange, initialFavorites = [], targetUserId, canSeeHealthData = true, harSkiskyting = false,
}: {
  /** Skyting kun for skiskyttere: «Skyting-dybde» og skytefavoritter bare når personen har skiskyting. */
  harSkiskyting?: boolean
  initialStats: WorkoutStats
  initialOverview: AnalysisOverview
  initialRange: DateRange
  /** Fase 122: nøkkel + lagret oppsett. I trenervisning er dette UTØVERENS favoritter (lesing). */
  initialFavorites?: Pick<FavoriteChart, 'chart_key' | 'config'>[]
  // Når satt: trener ser/redigerer utøverens analyse. Sendes med til
  // TesterPRTab → PersonalRecordModal slik at trener-PR lagres på utøver.
  targetUserId?: string
  // Trener-view: false hvis utøveren ikke har opt'et inn på helsedata-deling
  // for denne treneren. Skjuler "Helse"-tab og filtrerer helse-KPIer fra
  // OverviewTab. Self-view: alltid true.
  canSeeHealthData?: boolean
}) {
  return (
    <FavoritesProvider readOnly={!!targetUserId} initialFavorites={harSkiskyting ? initialFavorites : initialFavorites.filter(f => !f.chart_key.startsWith('skyting'))}>
      <AnalysisPageInner
        harSkiskyting={harSkiskyting}
        initialStats={initialStats}
        initialOverview={initialOverview}
        initialRange={initialRange}
        targetUserId={targetUserId}
        canSeeHealthData={canSeeHealthData}
      />
    </FavoritesProvider>
  )
}

function AnalysisPageInner({
  initialStats, initialOverview, initialRange, targetUserId, canSeeHealthData, harSkiskyting = false,
}: {
  harSkiskyting?: boolean
  initialStats: WorkoutStats
  initialOverview: AnalysisOverview
  initialRange: DateRange
  targetUserId?: string
  canSeeHealthData: boolean
}) {
  const { orderedKeys: favoriteKeys } = useFavorites()
  const searchParams = useSearchParams()
  const initialTab: Tab = (() => {
    const t = searchParams?.get('tab')
    if (t && TAB_KEYS.has(t)) return t as Tab
    // Bolk 1: Favoritter er standard landing når det finnes minst én favoritt.
    return favoriteKeys.length > 0 ? 'favoritter' : 'oversikt'
  })()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [range, setRangeState] = useState<DateRange>(initialRange)
  const [stats, setStats] = useState<WorkoutStats>(initialStats)
  const [overview, setOverview] = useState<AnalysisOverview>(initialOverview)
  const [sportFilter, setSportFilterState] = useState<Sport | null>(null)
  // Fase 16b: føre-filter for belastning/intensitet-fanene (klient-valgt).
  const [surfaceFilter, setSurfaceFilterState] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Bolk 1: ÉN cache for fanenes datasett — én server-action per sett, hentet
  // lazy når fanen (eller en favoritt) trenger det, nullstilt ved periode-,
  // sport- og føre-bytte. Generasjonstelleren kaster svar fra forrige filter.
  type FaneData = {
    klokkedata: KlokkedataTrender; belastning: BelastningAnalysis; prestasjon: PrestasjonAnalyse; terskel: TerskelAnalysis
    skyting: ShootingDepthAnalysis; sammenlign: WorkoutsForComparison; mal_analyse: TemplateAnalysis; periodisering: PeriodizationOverview
    konkurranser: CompetitionAnalysis; tester_pr: TestsAndPRs; ski_tester: SkiTestAnalysisData; helse: HelseOversiktData
    helse_korrelasjon: HealthCorrelations; helse_belastning: HelseBelastning; ernering: NutritionAnalysis; vaer: WeatherAnalysis; hoyde_varme: AltitudeHeatAnalysis
    per_bevegelsesform: MovementAnalysis; intensitet: IntensityDistribution
  }
  type FaneDataKey = keyof FaneData
  const [cache, setCache] = useState<Partial<FaneData>>({})
  const paagaar = useRef(new Set<string>())
  const generasjon = useRef(0)
  const resetLazyCache = () => { generasjon.current += 1; paagaar.current.clear(); setCache({}) }

  const setRange = (r: DateRange) => { resetLazyCache(); setRangeState(r) }
  const setSportFilter = (s: Sport | null) => { resetLazyCache(); setSportFilterState(s) }
  const setSurfaceFilter = (s: string | null) => { resetLazyCache(); setSurfaceFilterState(s) }
  // Føre-filteret gjelder kun belastning/intensitet (der vi har bygd det inn).
  const surfaceFilterApplies = tab === 'belastning' || tab === 'intensitet'

  // Hopp KUN over refetch på første render (mount) — server-data er allerede
  // lastet for initialRange. Tidligere hoppet vi over hver gang range tilfeldigvis
  // var lik initialRange, noe som ga STALE tall når man byttet periode og så
  // TILBAKE til startperioden (f.eks. 30d→7d→30d viste fortsatt 7d-tallene).
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      // Hopp over kun hvis vi fortsatt står på utgangspunktet (ingen filter satt).
      if (range.from === initialRange.from && range.to === initialRange.to && sportFilter === null) return
    }
    startTransition(async () => {
      setError(null)
      const [s, o] = await Promise.all([
        getWorkoutStats(range.from, range.to),
        getAnalysisOverview(range.from, range.to, sportFilter),
      ])
      if ('error' in s) { setError(s.error); return }
      if ('error' in o) { setError(o.error); return }
      setStats(s)
      setOverview(o)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, sportFilter])

  const hentFaneData = (k: FaneDataKey): Promise<unknown> => {
    switch (k) {
      case 'klokkedata': return getKlokkedataTrender(range.from, range.to, sportFilter, targetUserId)
      case 'belastning': return getBelastningAnalysis(range.from, range.to, sportFilter, targetUserId, surfaceFilter)
      case 'prestasjon': return getPrestasjonAnalyse(range.from, range.to, targetUserId)
      case 'terskel': return getTerskelAnalysis(range.from, range.to, sportFilter)
      case 'skyting': return getShootingDepthAnalysis(range.from, range.to, sportFilter)
      case 'sammenlign': return getWorkoutsForComparison(range.from, range.to, { sport: sportFilter })
      case 'mal_analyse': return getTemplateAnalysis(range.from, range.to, sportFilter)
      case 'periodisering': return getPeriodizationOverview(range.from, range.to, sportFilter)
      case 'konkurranser': return getCompetitionAnalysis(range.from, range.to, sportFilter)
      case 'tester_pr': return getTestsAndPRs(sportFilter)
      case 'ski_tester': return getSkiTestAnalysis(range.from, range.to)
      case 'helse': return getHelseOversikt(range.from, range.to, targetUserId)
      case 'helse_korrelasjon': return getHealthCorrelations(range.from, range.to)
      case 'helse_belastning': return getHelseBelastning(range.from, range.to, targetUserId)
      case 'ernering': return getNutritionAnalysis(range.from, range.to, targetUserId)
      case 'vaer': return getWeatherAnalysis(range.from, range.to, targetUserId)
      case 'hoyde_varme': return getAltitudeHeatAnalysis(range.from, range.to, targetUserId)
      case 'per_bevegelsesform': return getMovementAnalysis(range.from, range.to, defaultMovementForSport(overview.primarySport), targetUserId)
      case 'intensitet': return getIntensityDistribution(range.from, range.to, sportFilter, targetUserId, surfaceFilter)
    }
  }
  const hent = (k: FaneDataKey) => {
    if (cache[k] !== undefined || paagaar.current.has(k)) return
    paagaar.current.add(k)
    const gen = generasjon.current
    startTransition(async () => {
      setError(null)
      const res = await hentFaneData(k)
      if (gen !== generasjon.current) return   // filteret er byttet mens vi ventet
      paagaar.current.delete(k)
      if (res && typeof res === 'object' && 'error' in res) { setError(String((res as { error: string }).error)); return }
      setCache(c => ({ ...c, [k]: res }))
    })
  }

  // Lazy-henting: fanen som er åpen — eller, i Favoritter, settene
  // favorittene peker til (aldri alt). Helse og Standardøkter henter selv.
  useEffect(() => {
    const trengs = new Set<FaneDataKey>()
    if (tab === 'favoritter') {
      for (const key of favoriteKeys) {
        const d = dataForGraf(losGrafNokkel(key))
        if (d && d !== 'selv' && d !== 'oversikt') trengs.add(d as FaneDataKey)
      }
    } else if (tab === 'sammenlign') { trengs.add('sammenlign'); trengs.add('mal_analyse'); trengs.add('periodisering') }
    else if (tab === 'belastning') { trengs.add('belastning'); trengs.add('helse_belastning') }
    else if (tab !== 'oversikt' && tab !== 'helse' && tab !== 'standardokter') trengs.add(tab as FaneDataKey)
    for (const k of trengs) hent(k)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, favoriteKeys, cache, range.from, range.to, sportFilter, surfaceFilter])

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '36px', letterSpacing: '0.08em' }}>
            Analyse
          </h1>
        </div>

        {/* Trener-view: hvis utøveren ikke har opt'et inn på helsedata-deling
            for denne treneren, skjuler vi "Helse"-tab og filtrerer helse-KPIer
            fra OverviewTab. Info-banner gjør synlig hva som er filtrert. */}
        {!canSeeHealthData && (
          <div className="mb-4 p-3"
            style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid #1A6FD4' }}>
            <p className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#1A6FD4', letterSpacing: '0.08em' }}>
              Helsedata (HRV, søvn, vekt, hvilepuls) er skjult for deg — utøveren har valgt å ikke dele helsemålinger med deg.
            </p>
          </div>
        )}

        {/* Tabs — horisontal scroll på mobil, flex-wrap på desktop. */}
        <div className="flex gap-1 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {TABS.filter(([key]) => (key !== 'helse' || canSeeHealthData) && (key !== 'skyting' || harSkiskyting)).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-4 py-2 text-sm tracking-widest uppercase whitespace-nowrap"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: tab === key ? 'var(--accent)' : 'transparent',
                border: `1px solid ${tab === key ? 'var(--accent)' : 'var(--line2)'}`,
                borderRadius: 999,
                color: tab === key ? 'var(--tekst-1-app)' : 'var(--tekst-8-app)',
                minHeight: '44px',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Periode + sport-filter. Filter gjelder alle faner. */}
        <div className="mb-6 p-4 flex flex-col md:flex-row md:items-end md:gap-6 gap-4"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Periode {isPending && <span className="ml-2 normal-case" style={{ color: '#FF4500' }}>…laster</span>}
            </p>
            <DateRangePicker value={range} onChange={r => setRange(r)} />
          </div>
          <div className="md:min-w-[180px]">
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Sport
            </p>
            <select
              value={sportFilter ?? ''}
              onChange={e => setSportFilter(e.target.value === '' ? null : e.target.value as Sport)}
              className="w-full px-3 py-2 text-sm"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'var(--flate-3)', color: 'var(--tekst-1-app)',
                border: '1px solid var(--kant-3)', minHeight: '44px',
              }}
            >
              <option value="">Alle</option>
              {SPORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {surfaceFilterApplies && (
            <div className="md:min-w-[180px]">
              <p className="text-xs tracking-widest uppercase mb-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                Føre
              </p>
              <select
                value={surfaceFilter ?? ''}
                onChange={e => setSurfaceFilter(e.target.value === '' ? null : e.target.value)}
                className="w-full px-3 py-2 text-sm"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: 'var(--flate-3)', color: 'var(--tekst-1-app)',
                  border: '1px solid var(--kant-3)', minHeight: '44px',
                }}
              >
                <option value="">Alle</option>
                <optgroup label="Barmark">
                  {SURFACE_SUMMER.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Snø">
                  {SURFACE_WINTER.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 mb-4" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px' }}>
              {error}
            </p>
          </div>
        )}

        {/* key={tab} remonter innholdet ved fanebytte → kort fade-inn. */}
        <div key={tab} className="xp-tab-in">
        {tab === 'favoritter' && (
          <FavoritterTab
            dataFor={k => k === 'oversikt' ? { stats, overview } : cache[k as FaneDataKey]}
            ctx={{ range, targetUserId, canSeeHealthData }}
            harSkiskyting={harSkiskyting}
            onOpenTab={(f: FaneKey) => { if (TAB_KEYS.has(f) || f === 'mal_analyse' || f === 'periodisering') setTab(f as Tab) }}
          />
        )}
        {tab === 'oversikt' && (
          <div className="space-y-5">
            <OverviewTab stats={stats} overview={overview} analysisRange={range} targetUserId={targetUserId} canSeeHealthData={canSeeHealthData} />
            {/* Sesong mot sesong (bolk 4) — samme komponent står også
                nederst under Årsplan (avtalt unntak fra én-plassering). */}
            <SesongSammenligning targetUserId={targetUserId} />
          </div>
        )}
        {tab === 'konkurranser' && (
          cache.konkurranser
            ? <CompetitionsTab data={cache.konkurranser} sportFilter={sportFilter} />
            : <LoadingStub label="Laster konkurranser…" />
        )}
        {tab === 'per_bevegelsesform' && (
          cache.per_bevegelsesform
            ? <MovementTab
                initialData={cache.per_bevegelsesform}
                from={range.from}
                to={range.to}
                availableMovements={cache.per_bevegelsesform.availableMovements}
                targetUserId={targetUserId}
              />
            : <LoadingStub label="Laster bevegelsesdata…" />
        )}
        {/* Helse-fanen = den nye helseflaten (HelseOversikt) — erstattet
            HealthTab-trendene/korrelasjonene 27. aug (helse-designet). */}
        {tab === 'helse' && <HelseOversikt targetUserId={targetUserId} chartKey="helse_oversikt" />}
        {tab === 'ernering' && (
          cache.ernering
            ? <ErneringTab data={cache.ernering} />
            : <LoadingStub label="Laster ernærings-data…" />
        )}
        {tab === 'vaer' && <WeatherTab data={cache.vaer ?? null} />}
        {tab === 'hoyde_varme' && <AltitudeHeatTab data={cache.hoyde_varme ?? null} />}
        {tab === 'mal_analyse' && (
          // Skjult dyplenke-fane (Favoritter «Åpne i fane» og gamle lenker).
          // Innholdet står også i sammenlign-fanen — samles i Standardøkter i bolk 6.
          cache.mal_analyse
            ? <TemplateAnalysisTab data={cache.mal_analyse} />
            : <LoadingStub label="Laster mal-analyse…" />
        )}
        {tab === 'sammenlign' && (
          <div className="space-y-8">
            <SammenlignSection title="Økt-sammenligning" accent="#FF4500">
              {cache.sammenlign
                ? <CompareWorkoutsTab initialData={cache.sammenlign} from={range.from} to={range.to} targetUserId={targetUserId} />
                : <LoadingStub label="Laster økter…" />}
            </SammenlignSection>

            <SammenlignSection title="Mal-analyse" accent="#1A6FD4">
              {cache.mal_analyse
                ? <TemplateAnalysisTab data={cache.mal_analyse} />
                : <LoadingStub label="Laster mal-analyse…" />}
            </SammenlignSection>

            <SammenlignSection title="Årsplan-analyse" accent="#28A86E">
              {cache.periodisering
                ? <PeriodiseringTab data={cache.periodisering} />
                : <LoadingStub label="Laster årsplan-analyse…" />}
            </SammenlignSection>
          </div>
        )}
        {tab === 'intensitet' && (
          cache.intensitet
            ? <IntensityTab data={cache.intensitet} />
            : <LoadingStub label="Laster intensitetsfordeling…" />
        )}
        {tab === 'belastning' && (
          cache.belastning
            ? <BelastningTab data={cache.belastning} helse={cache.helse_belastning ?? null} />
            : <LoadingStub label="Laster belastning…" />
        )}
        {tab === 'terskel' && (
          cache.terskel
            ? <TerskelTab data={cache.terskel} />
            : <LoadingStub label="Laster terskel…" />
        )}
        {tab === 'skyting' && (
          cache.skyting
            ? <SkytingTab data={cache.skyting} range={range} targetUserId={targetUserId} />
            : <LoadingStub label="Laster skyting-dybde…" />
        )}
        {/* Kø #48 bolk 3: standardøkt-biblioteket (selv-hentende). */}
        {tab === 'standardokter' && (
          <StandardSessionsTab targetUserId={targetUserId} />
        )}
        {tab === 'periodisering' && (
          cache.periodisering
            ? <PeriodiseringTab data={cache.periodisering} />
            : <LoadingStub label="Laster årsplan…" />
        )}
        {tab === 'tester_pr' && (
          cache.tester_pr
            ? <TesterPRTab data={cache.tester_pr} targetUserId={targetUserId} />
            : <LoadingStub label="Laster tester og PR…" />
        )}
        {tab === 'ski_tester' && (
          cache.ski_tester
            ? <SkiTesterTab data={cache.ski_tester} />
            : <LoadingStub label="Laster ski-tester…" />
        )}
        {tab === 'klokkedata' && (
          cache.klokkedata
            ? <KlokkedataTrenderTab data={cache.klokkedata} />
            : <LoadingStub label="Laster klokkedata-trender…" />
        )}
        {tab === 'prestasjon' && (
          cache.prestasjon
            ? <PrestasjonTab data={cache.prestasjon} />
            : <LoadingStub label="Laster prestasjonsmål…" />
        )}
        </div>
      </div>
    </div>
  )
}
