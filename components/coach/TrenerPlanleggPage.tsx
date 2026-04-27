'use client'

import { useRouter } from 'next/navigation'
import type { Sport, WorkoutTemplate } from '@/lib/types'
import type { PlanTemplate, PeriodizationTemplate } from '@/lib/template-types'
import type { TestTemplate } from '@/app/actions/tests'
import { OktmalTab } from '@/components/coach/OktmalTab'
import { PlanMalTab } from '@/components/coach/PlanMalTab'
import { PeriodiseringMalTab } from '@/components/coach/PeriodiseringMalTab'
import { TestMalTab } from '@/components/coach/TestMalTab'

const COACH_BLUE = '#1A6FD4'

type Tab = 'okt' | 'plan' | 'periodisering' | 'test'

interface Props {
  activeTab: string
  primarySport: Sport
  initialWorkoutTemplates: WorkoutTemplate[]
  initialPlanTemplates: PlanTemplate[]
  initialPeriodizationTemplates: PeriodizationTemplate[]
  initialTestTemplates: TestTemplate[]
}

export function TrenerPlanleggPage({
  activeTab,
  primarySport,
  initialWorkoutTemplates,
  initialPlanTemplates,
  initialPeriodizationTemplates,
  initialTestTemplates,
}: Props) {
  const tab: Tab = activeTab === 'plan' || activeTab === 'periodisering' || activeTab === 'test' ? activeTab : 'okt'
  const router = useRouter()

  const setTab = (t: Tab) => {
    const url = new URL(window.location.href)
    if (t === 'okt') url.searchParams.delete('tab')
    else url.searchParams.set('tab', t)
    router.push(url.pathname + url.search)
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex items-center gap-3 mb-2">
          <span style={{ width: '24px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
            Planlegg
          </h1>
        </div>
        <p className="mb-6 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Bygg øktmaler, plan-maler og årsplan-maler — push til utøvere eller grupper.
        </p>

        <TabBar tab={tab} setTab={setTab} />

        {tab === 'okt' && (
          <OktmalTab
            initialTemplates={initialWorkoutTemplates}
            primarySport={primarySport}
          />
        )}
        {tab === 'plan' && (
          <PlanMalTab
            initialTemplates={initialPlanTemplates}
            primarySport={primarySport}
            workoutTemplates={initialWorkoutTemplates}
          />
        )}
        {tab === 'periodisering' && (
          <PeriodiseringMalTab
            initialTemplates={initialPeriodizationTemplates}
            primarySport={primarySport}
          />
        )}
        {tab === 'test' && (
          <TestMalTab
            initialTemplates={initialTestTemplates}
            primarySport={primarySport}
          />
        )}
      </div>
    </div>
  )
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'okt', label: 'Øktmaler' },
    { key: 'plan', label: 'Plan-maler' },
    { key: 'periodisering', label: 'Årsplan-maler' },
    { key: 'test', label: 'Test-maler' },
  ]
  return (
    <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid #1E1E22' }}>
      {tabs.map(t => {
        const active = t.key === tab
        return (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: active ? COACH_BLUE : '#8A8A96',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active ? COACH_BLUE : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: '-1px',
            }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
