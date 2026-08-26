import { LandingNav } from './LandingNav'
import { LandingFooter } from './LandingFooter'
import { CustomCursor } from '@/components/cursor/CustomCursor'

// Felles wrapper for funksjoner-undersider. Holder bakgrunn, font-arv og
// nav/footer ett sted så hver side bare bryr seg om innhold.

export function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--flate-3)', minHeight: '100vh', color: 'var(--tekst-1-land)' }}
      className="flex flex-col">
      <CustomCursor color="#FF4500" />
      <LandingNav />
      <main className="flex-1">
        {children}
      </main>
      <LandingFooter />
    </div>
  )
}
