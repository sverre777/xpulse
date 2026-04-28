import { LandingNav } from './LandingNav'
import { LandingFooter } from './LandingFooter'

// Felles wrapper for funksjoner-undersider. Holder bakgrunn, font-arv og
// nav/footer ett sted så hver side bare bryr seg om innhold.

export function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#0A0A0B', minHeight: '100vh', color: '#F2F0EC' }}
      className="flex flex-col">
      <LandingNav />
      <main className="flex-1">
        {children}
      </main>
      <LandingFooter />
    </div>
  )
}
