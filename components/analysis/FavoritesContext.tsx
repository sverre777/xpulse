'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { toggleFavoriteChart } from '@/app/actions/favorites'

// Delt tilstand for stjerne-markerte grafer i Analyse. Leses av StarButton
// (i ChartWrapper) og av FavoriteChartsSection på Oversikt-fanen.

interface FavoritesContextValue {
  favorites: Set<string>
  orderedKeys: string[]
  toggle: (chartKey: string) => Promise<void>
  isPending: boolean
  error: string | null
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({
  initialFavorites,
  children,
}: {
  initialFavorites: string[]
  children: ReactNode
}) {
  const [orderedKeys, setOrderedKeys] = useState<string[]>(initialFavorites)
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const favorites = useMemo(() => new Set(orderedKeys), [orderedKeys])

  const toggle = useCallback(async (chartKey: string) => {
    const key = chartKey.trim()
    if (key === '') return

    // Optimistisk oppdatering: flip umiddelbart, rull tilbake ved feil.
    const wasFavorite = orderedKeys.includes(key)
    const optimistic = wasFavorite
      ? orderedKeys.filter(k => k !== key)
      : [...orderedKeys, key]
    setOrderedKeys(optimistic)
    setPending(true)
    setError(null)

    const res = await toggleFavoriteChart(key)
    setPending(false)

    if ('error' in res) {
      setOrderedKeys(orderedKeys)
      setError(res.error)
      return
    }
    // Server kan ha havnet i motsatt tilstand enn antatt — juster hvis nødvendig.
    if (res.favorited !== !wasFavorite) {
      setOrderedKeys(res.favorited ? [...orderedKeys, key] : orderedKeys.filter(k => k !== key))
    }
  }, [orderedKeys])

  const value = useMemo<FavoritesContextValue>(() => ({
    favorites, orderedKeys, toggle, isPending, error,
  }), [favorites, orderedKeys, toggle, isPending, error])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    // Graceful fallback: tillat ChartWrapper-bruk utenfor provider (f.eks. storybook).
    return {
      favorites: new Set(),
      orderedKeys: [],
      toggle: async () => {},
      isPending: false,
      error: null,
    }
  }
  return ctx
}
