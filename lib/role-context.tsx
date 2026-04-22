'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Role } from './types'

export interface RoleContextValue {
  activeRole: Role
  hasAthleteRole: boolean
  hasCoachRole: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({
  value,
  children,
}: {
  value: RoleContextValue
  children: ReactNode
}) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

// Returnerer aktiv rolle + hvilke roller brukeren har tilgang til.
// Kaster hvis brukt utenfor RoleProvider — komponenter som trenger dette
// skal alltid rendres innenfor en authed layout der provideren er satt.
export function useActiveRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error('useActiveRole must be used within a RoleProvider')
  }
  return ctx
}

// Ikke-kastende variant — for komponenter som kan rendres både innenfor
// og utenfor authed-layouten (f.eks. rene landingssider).
export function useOptionalActiveRole(): RoleContextValue | null {
  return useContext(RoleContext)
}
