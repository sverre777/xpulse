'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AthletePermissions } from '@/app/actions/coach-athlete'

const COACH_BLUE = '#1A6FD4'

interface Props {
  athleteId: string
  permissions: AthletePermissions
}

interface TabDef {
  slug: string
  label: string
  enabled: boolean
  hint?: string
}

export function AthleteTabsNav({ athleteId, permissions }: Props) {
  const pathname = usePathname()
  const base = `/app/trener/${athleteId}`

  const tabs: TabDef[] = [
    { slug: 'plan',          label: 'Plan',          enabled: true },
    { slug: 'dagbok',        label: 'Dagbok',        enabled: permissions.can_view_dagbok, hint: 'Ingen lesetilgang' },
    { slug: 'analyse',       label: 'Analyse',       enabled: permissions.can_view_analysis, hint: 'Ingen analysetilgang' },
    { slug: 'periodisering', label: 'Årsplan', enabled: true },
    { slug: 'historikk',     label: 'Historikk',     enabled: permissions.can_view_dagbok, hint: 'Følger dagbok-tilgang' },
    { slug: 'utstyr',        label: 'Utstyr',        enabled: permissions.can_view_dagbok, hint: 'Følger dagbok-tilgang' },
  ]

  return (
    <div
      className="flex overflow-x-auto mb-4"
      style={{ borderBottom: '1px solid #1E1E22' }}
    >
      {tabs.map(tab => {
        const href = `${base}/${tab.slug}`
        const active = pathname === href || pathname.startsWith(href + '/')
        if (!tab.enabled) {
          return (
            <span
              key={tab.slug}
              title={tab.hint}
              className="px-4 py-3 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#3A3A42',
                borderBottom: '2px solid transparent',
                cursor: 'not-allowed',
              }}
            >
              {tab.label}
            </span>
          )
        }
        return (
          <Link
            key={tab.slug}
            href={href}
            className="px-4 py-3 text-sm tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: active ? '#F0F0F2' : '#8A8A96',
              borderBottom: active ? `2px solid ${COACH_BLUE}` : '2px solid transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
