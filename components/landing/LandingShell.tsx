import { LandingNav, type LandingNavAktiv } from './LandingNav'
import { LandingFooter } from './LandingFooter'
import { LANDING_CSS } from './landing-css'

// Felles skall for undersidene (funksjoner/*). Holder CSS-en, topplinja og
// bunnlinja ett sted - hver side leverer bare innhold (bolk B1).

export function LandingShell({ children, aktiv }: { children: React.ReactNode; aktiv?: LandingNavAktiv }) {
  return (
    <div className="lp flex flex-col" style={{ minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <LandingNav aktiv={aktiv} />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  )
}
