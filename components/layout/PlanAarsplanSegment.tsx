'use client'

// NAVIGASJON v2 bolk 7: «Plan | Årsplan»-segmentet øverst på Plan- og Årsplan-siden
// på PC (velger HVA). På app-mobil ligger det samme segmentet i glass-topplinja.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useErMobilNav } from '@/lib/er-app'

export function PlanAarsplanSegment() {
  const mobil = useErMobilNav()
  const pathname = usePathname() ?? ''
  if (mobil) return null
  const plan = pathname.startsWith('/app/plan')
  return (
    <div className="xp-seg-pill" role="group" aria-label="Plan eller årsplan" data-plan-segment>
      <Link href="/app/plan" data-plan-seg="plan" className={plan ? 'on' : undefined} style={{ textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>Plan</Link>
      <Link href="/app/periodisering" data-plan-seg="aarsplan" className={!plan ? 'on' : undefined} style={{ textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>Årsplan</Link>
    </div>
  )
}
