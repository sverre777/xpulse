'use client'

// Brukerens sporter som kontekst (Sverre 5. sep 2026, «skyting kun for
// skiskyttere»): layouten setter den innloggedes sporter; sider som viser
// en UTØVER i trenervisning legger et nytt lag med utøverens sporter, så
// alt under leser riktig person. Komponenter kan alltid sende inn en
// eksplisitt liste (prop) som vinner over konteksten.
import { createContext, useContext } from 'react'
import type { Sport } from '@/lib/types'
import { harSkiskyting } from '@/lib/har-skiskyting'

const BrukerSporterContext = createContext<Sport[]>([])

export function BrukerSporterProvider({ sporter, children }: { sporter: Sport[]; children: React.ReactNode }) {
  return <BrukerSporterContext.Provider value={sporter}>{children}</BrukerSporterContext.Provider>
}

export function useBrukerSporter(override?: readonly Sport[] | null): Sport[] {
  const fraKontekst = useContext(BrukerSporterContext)
  return override && override.length > 0 ? [...override] : fraKontekst
}

/** Har personen vi ser på skiskyting? Prop (override) vinner over konteksten. */
export function useHarSkiskyting(override?: readonly Sport[] | null): boolean {
  return harSkiskyting(useBrukerSporter(override))
}
