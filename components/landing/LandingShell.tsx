import { LandingNav, type LandingNavAktiv } from './LandingNav'
import { LandingFooter } from './LandingFooter'
import { LANDING_CSS } from './landing-css'

// Felles skall for undersidene (funksjoner/*). Holder CSS-en, topplinja og
// bunnlinja ett sted - hver side leverer bare innhold (bolk B1).

export function LandingShell({ children, aktiv }: { children: React.ReactNode; aktiv?: LandingNavAktiv }) {
  return (
    <div className="lp flex flex-col" style={{ minHeight: '100vh' }}>
      {/* href + precedence gjør at React løfter stilen opp i <head> og deduper den.
          Uten det ble CSS-en først anvendt ETTER første maling, og hele sida hoppet
          (målt CLS 0,19 på mobil). */}
      <style href="lp-landing" precedence="default" dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <LandingNav aktiv={aktiv} />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  )
}
