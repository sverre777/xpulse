import type { ReactNode } from 'react'
import { LandingShell } from '@/components/landing/LandingShell'

export function LegalLayout({
  title, updatedAt, children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <LandingShell>
    <main
      className="px-4 py-12"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-5xl md:text-6xl mb-2"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.08em' }}
        >
          {title}
        </h1>
        <p
          className="text-xs tracking-widest uppercase mb-10"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
        >
          Sist oppdatert: {updatedAt}
        </p>

        <div
          className="flex flex-col gap-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '16px', lineHeight: 1.6 }}
        >
          {children}
        </div>
      </div>
    </main>
    </LandingShell>
  )
}

export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-2xl mt-6 mb-1"
      style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.05em' }}
    >
      {children}
    </h2>
  )
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

export function LegalUL({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1 pl-5" style={{ listStyleType: 'disc' }}>{children}</ul>
}

export function LegalLI({ children }: { children: ReactNode }) {
  return <li>{children}</li>
}
