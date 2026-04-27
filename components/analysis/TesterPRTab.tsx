'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { TestsAndPRs, TestResultRow, TestProgressionSeries, PersonalRecordRow } from '@/app/actions/analysis'
import {
  SPORTS, TEST_PR_SPORTS_AND_SUBCATEGORIES, findTestPRSport,
} from '@/lib/types'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'
import { PersonalRecordModal, type PRPreset } from './PersonalRecordModal'

// Forhåndsutfylte PR-kategorier. Dekker de vanligste PR-typene på tvers
// av utholdenhet, styrke og laboratorie-tester. Bruker den nye
// TestPRSport + subcategory-modellen.
const PR_PRESETS: { label: string; preset: PRPreset }[] = [
  { label: 'Knebøy 1RM', preset: { sport: 'styrke', subcategory: 'Knebøy 1RM', unit: 'kg', placeholder: 'f.eks. 120' } },
  { label: 'Markløft 1RM', preset: { sport: 'styrke', subcategory: 'Markløft 1RM', unit: 'kg', placeholder: 'f.eks. 160' } },
  { label: 'Benkpress 1RM', preset: { sport: 'styrke', subcategory: 'Benkpress 1RM', unit: 'kg', placeholder: 'f.eks. 90' } },
  { label: 'Pull-ups maks', preset: { sport: 'styrke', subcategory: 'Pull-ups maks reps', unit: 'reps', placeholder: 'f.eks. 18' } },
  { label: 'VO2max', preset: { sport: 'lop', subcategory: 'Egen', custom_label: 'VO2max (labtest)', unit: 'ml/kg/min', placeholder: 'f.eks. 68' } },
  { label: 'FTP', preset: { sport: 'sykling', subcategory: 'Egen', custom_label: 'FTP (20-min)', unit: 'watt', placeholder: 'f.eks. 320' } },
  { label: '5 km vei', preset: { sport: 'lop', subcategory: 'Vei', unit: 'sek', placeholder: 'sekunder, f.eks. 1122' } },
  { label: '10 km vei', preset: { sport: 'lop', subcategory: 'Vei', unit: 'sek', placeholder: 'sekunder' } },
  { label: 'CMJ', preset: { sport: 'spenst', subcategory: 'CMJ', unit: 'cm', placeholder: 'f.eks. 42' } },
]

// Blå aksent matcher TestDataModule-visualspråket.
const TEST_BLUE = '#1A6FD4'
const GOLD = '#D4A017'

const SPORT_COLOR: Record<string, string> = {
  // Sport (eldre rader)
  running: '#FF4500',
  cross_country_skiing: '#1A6FD4',
  biathlon: '#E11D48',
  triathlon: '#8B5CF6',
  cycling: '#28A86E',
  long_distance_skiing: '#D4A017',
  endurance: '#8A8A96',
  // TestPRSport (ny modell)
  lop: '#FF4500',
  sykling: '#28A86E',
  svomming: '#1A6FD4',
  langrenn: '#1A6FD4',
  skiskyting: '#E11D48',
  styrke: '#D4A017',
  spenst: '#A855F7',
  skyting: '#0EA5E9',
  annet: '#8A8A96',
}

// Sport-feltet kan inneholde TestPRSport (ny) eller Sport (eldre rader).
// Slå opp i begge tabeller, med TestPRSport først.
function labelSport(s: string): string {
  const tp = findTestPRSport(s)
  if (tp) return tp.label
  return SPORTS.find(x => x.value === s)?.label ?? s
}

// Liste over alle Test/PR-sport-verdier som kan bli brukt som filter.
const ALL_SPORT_VALUES: string[] = [
  ...TEST_PR_SPORTS_AND_SUBCATEGORIES.map(s => s.value),
  ...SPORTS.map(s => s.value),
]
void ALL_SPORT_VALUES

function formatValue(v: number, unit: string | null): string {
  if (!isFinite(v)) return '—'
  if (unit === 'sek' || unit === 'tid') {
    const m = Math.floor(v / 60)
    const s = Math.floor(v % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2).replace(/\.?0+$/, '')
}

const EMPTY = (
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
      Ingen tester eller PR-er i valgt periode.
    </p>
  </div>
)

function ProgressionChart({ series }: { series: TestProgressionSeries }) {
  const data = series.points.map(p => ({
    date: p.date, value: p.value, workout_id: p.workout_id,
  }))
  const color = SPORT_COLOR[series.sport] ?? TEST_BLUE
  return (
    <ChartWrapper
      chartKey={`tester_pr_${series.sport}_${series.test_type}`}
      title={`${series.test_type} — ${labelSport(series.sport)}`}
      subtitle={series.unit ? `Enhet: ${series.unit}` : undefined}
      height={240}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} />
          <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR}
            tickFormatter={(v: number) => formatValue(v, series.unit)} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [formatValue(Number(v), series.unit), series.unit ?? 'verdi']}
          />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }} />
          <Line type="monotone" dataKey="value" name={series.test_type}
            stroke={color} strokeWidth={2} dot={{ r: 4, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

// Indikator-badge for hvor en PR-rad kommer fra:
// "Manuell"  = lagt inn via PR-modal uten knytning til økt
// "Økt"      = stammer fra workout (workout_id satt)
function PRSourceBadge({ pr }: { pr: PersonalRecordRow }) {
  const isLinked = !!pr.workout_id
  const label = isLinked ? 'Økt' : 'Manuell'
  const color = isLinked ? TEST_BLUE : '#8A8A96'
  return (
    <span className="ml-2 px-1.5 py-0.5 text-[9px] tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color, border: `1px solid ${color}55`,
      }}>
      {label}
    </span>
  )
}

function PRRow({ pr, onEdit }: { pr: PersonalRecordRow; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit}
      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-white/5 transition-colors"
      style={{ borderBottom: '1px solid #1E1E22' }}>
      <div>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
          {pr.custom_label || pr.record_type}
          <PRSourceBadge pr={pr} />
        </p>
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {pr.achieved_at}{pr.notes ? ` · ${pr.notes}` : ''}
        </p>
      </div>
      <p className="text-xl"
        style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}>
        {formatValue(pr.value, pr.unit)}
        <span className="ml-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {pr.unit}
        </span>
      </p>
    </button>
  )
}

function TestRowItem({ row }: { row: TestResultRow }) {
  return (
    <Link href={`/app/dagbok/${row.workout_id}`}
      className="block px-4 py-3 hover:bg-white/5 transition-colors"
      style={{ borderBottom: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: TEST_BLUE }}>
            {row.test_type} — {labelSport(row.sport)}
          </p>
          <p className="text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {row.date}{row.title ? ` · ${row.title}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}>
            {row.primary_result != null ? formatValue(row.primary_result, row.primary_unit) : '—'}
            {row.primary_unit && (
              <span className="ml-1 text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {row.primary_unit}
              </span>
            )}
          </p>
        </div>
      </div>
      {(row.conditions || row.equipment) && (
        <p className="mt-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {[row.equipment, row.conditions].filter(Boolean).join(' · ')}
        </p>
      )}
    </Link>
  )
}

export function TesterPRTab({ data, targetUserId }: { data: TestsAndPRs; targetUserId?: string }) {
  const [sportTab, setSportTab] = useState<string>('all')
  const [prModal, setPrModal] = useState<
    | { mode: 'new'; preset?: PRPreset }
    | { mode: 'edit'; row: PersonalRecordRow }
    | null
  >(null)

  const filteredTests = useMemo(
    () => sportTab === 'all' ? data.tests : data.tests.filter(t => t.sport === sportTab),
    [data.tests, sportTab],
  )
  const filteredPRs = useMemo(
    () => sportTab === 'all' ? data.personalRecords : data.personalRecords.filter(p => p.sport === sportTab),
    [data.personalRecords, sportTab],
  )
  const filteredProgressions = useMemo(
    () => sportTab === 'all' ? data.progressions : data.progressions.filter(s => s.sport === sportTab),
    [data.progressions, sportTab],
  )

  // Gruppering av PR-er pr (sport, subcategory). Test-rader (workout-koblede)
  // kan også vises i samme tre når PR-rad mangler — men typisk er PR-er
  // master-listen. Vi grupperer kun PR-er her; tests vises i egen tidslinje.
  const groupedPRs = useMemo(() => {
    type Group = { sport: string; subcategory: string; rows: PersonalRecordRow[] }
    const map = new Map<string, Group>()
    for (const pr of filteredPRs) {
      const subKey = pr.subcategory || pr.custom_label || pr.record_type || '—'
      const key = `${pr.sport}::${subKey}`
      let g = map.get(key)
      if (!g) {
        g = { sport: pr.sport, subcategory: subKey, rows: [] }
        map.set(key, g)
      }
      g.rows.push(pr)
    }
    // Sorter rader nyligst først, så grupper alfabetisk per sport-label.
    for (const g of map.values()) {
      g.rows.sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))
    }
    return Array.from(map.values()).sort((a, b) => {
      const sa = labelSport(a.sport)
      const sb = labelSport(b.sport)
      if (sa !== sb) return sa.localeCompare(sb)
      return a.subcategory.localeCompare(b.subcategory)
    })
  }, [filteredPRs])

  const sportsInUse = useMemo(() => {
    const set = new Set<string>()
    for (const t of data.tests) set.add(t.sport)
    for (const p of data.personalRecords) set.add(p.sport)
    return Array.from(set)
  }, [data])

  const headerBar = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {sportsInUse.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto">
          <button type="button" onClick={() => setSportTab('all')}
            className="px-3 py-1 text-xs tracking-widest uppercase whitespace-nowrap"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: sportTab === 'all' ? TEST_BLUE + '33' : 'transparent',
              border: `1px solid ${sportTab === 'all' ? TEST_BLUE : '#1E1E22'}`,
              color: sportTab === 'all' ? TEST_BLUE : '#8A8A96',
              minHeight: '36px',
            }}>
            Alle
          </button>
          {sportsInUse.map(s => (
            <button key={s} type="button" onClick={() => setSportTab(s)}
              className="px-3 py-1 text-xs tracking-widest uppercase whitespace-nowrap"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: sportTab === s ? TEST_BLUE + '33' : 'transparent',
                border: `1px solid ${sportTab === s ? TEST_BLUE : '#1E1E22'}`,
                color: sportTab === s ? TEST_BLUE : '#8A8A96',
                minHeight: '36px',
              }}>
              {labelSport(s)}
            </button>
          ))}
        </div>
      ) : <span />}
      <button type="button" onClick={() => setPrModal({ mode: 'new' })}
        className="px-3 py-1 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: GOLD + '22', border: `1px solid ${GOLD}`,
          color: GOLD, minHeight: '36px',
        }}>
        + Ny PR
      </button>
    </div>
  )

  const presetBar = (
    <div>
      <p className="mb-2 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Hurtig-PR
      </p>
      <div className="flex gap-2 flex-wrap">
        {PR_PRESETS.map(p => (
          <button key={p.label} type="button"
            onClick={() => setPrModal({ mode: 'new', preset: p.preset })}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: 'transparent', border: `1px solid ${GOLD}44`,
              color: GOLD, minHeight: '32px',
            }}>
            + {p.label}
          </button>
        ))}
      </div>
    </div>
  )

  const modal = prModal && (
    <PersonalRecordModal
      existing={prModal.mode === 'edit' ? prModal.row : undefined}
      preset={prModal.mode === 'new' ? prModal.preset : undefined}
      targetUserId={targetUserId}
      onClose={() => setPrModal(null)}
      onSaved={() => setPrModal(null)}
    />
  )

  if (!data.hasData) {
    return (
      <div className="space-y-6">
        {headerBar}
        {presetBar}
        {EMPTY}
        {modal}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {headerBar}
      {presetBar}

      {groupedPRs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span style={{ width: '16px', height: '2px', backgroundColor: GOLD, display: 'inline-block' }} />
            <h2 className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
              Personlige rekorder
            </h2>
          </div>
          {/* Gruppert per sport → underkategori. Hver rad har badge for
              kilde (manuell vs koblet til økt). */}
          {Object.entries(
            groupedPRs.reduce<Record<string, typeof groupedPRs>>((acc, g) => {
              (acc[g.sport] ??= []).push(g)
              return acc
            }, {})
          ).map(([sport, groups]) => (
            <div key={sport}>
              <p className="mb-2 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: SPORT_COLOR[sport] ?? '#8A8A96' }}>
                <span style={{
                  display: 'inline-block', width: '8px', height: '8px',
                  backgroundColor: SPORT_COLOR[sport] ?? '#8A8A96', marginRight: '6px',
                }} />
                {labelSport(sport)}
              </p>
              <div style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
                {groups.map(g => (
                  <div key={`${g.sport}::${g.subcategory}`}>
                    <p className="px-4 py-2 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: '#8A8A96',
                        backgroundColor: '#16161A',
                        borderBottom: '1px solid #1E1E22',
                      }}>
                      {g.subcategory}
                    </p>
                    {g.rows.map(pr => <PRRow key={pr.id} pr={pr} onEdit={() => setPrModal({ mode: 'edit', row: pr })} />)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {filteredProgressions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ width: '16px', height: '2px', backgroundColor: TEST_BLUE, display: 'inline-block' }} />
            <h2 className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: TEST_BLUE }}>
              Progresjon
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProgressions.map(s => (
              <ProgressionChart key={`${s.sport}::${s.test_type}`} series={s} />
            ))}
          </div>
        </section>
      )}

      {filteredTests.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ width: '16px', height: '2px', backgroundColor: TEST_BLUE, display: 'inline-block' }} />
            <h2 className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: TEST_BLUE }}>
              Test-tidslinje
            </h2>
          </div>
          <div style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
            {filteredTests.map(t => <TestRowItem key={t.id} row={t} />)}
          </div>
        </section>
      )}

      {filteredPRs.length === 0 && filteredTests.length === 0 && (
        <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
            Ingen tester eller PR-er for valgt sport.
          </p>
        </div>
      )}
      {modal}
    </div>
  )
}
