'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { toggleFavoriteChart, reorderFavoriteCharts, saveFavoriteConfig, type FavoriteChart, type FavorittConfig } from '@/app/actions/favorites'

// Delt tilstand for stjerne-markerte grafer i Analyse. Leses av StarButton
// (i ChartWrapper/MetricCard) og av Favoritter-fanen (bolk 1). Optimistisk:
// stjerne og rekkefølge flippes lokalt først, rulles tilbake ved feil.

interface FavoritesContextValue {
  favorites: Set<string>
  orderedKeys: string[]
  /** Lagret oppsett per custom-favoritt (fase 122). */
  configs: Record<string, FavorittConfig | null>
  /** Stjerne av/på; config = grafens gjeldende oppsett når den stjernes. */
  toggle: (chartKey: string, config?: FavorittConfig | null) => Promise<void>
  /** Nytt oppsett på en allerede stjernet graf. */
  setConfig: (chartKey: string, config: FavorittConfig | null) => Promise<void>
  /** Ny rekkefølge (Favoritter-fanen, dra-og-slipp). */
  reorder: (keys: string[]) => Promise<void>
  /** Trenervisning: utøverens favoritter, lesing — ingen stjerne, dra eller fjern. */
  readOnly: boolean
  isPending: boolean
  error: string | null
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({
  initialFavorites,
  readOnly = false,
  children,
}: {
  initialFavorites: Pick<FavoriteChart, 'chart_key' | 'config'>[]
  readOnly?: boolean
  children: ReactNode
}) {
  const [orderedKeys, setOrderedKeys] = useState<string[]>(initialFavorites.map(f => f.chart_key))
  const [configs, setConfigs] = useState<Record<string, FavorittConfig | null>>(Object.fromEntries(initialFavorites.map(f => [f.chart_key, f.config ?? null])))
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const favorites = useMemo(() => new Set(orderedKeys), [orderedKeys])

  const toggle = useCallback(async (chartKey: string, config?: FavorittConfig | null) => {
    const key = chartKey.trim()
    if (key === '' || readOnly) return

    // Optimistisk oppdatering: flip umiddelbart, rull tilbake ved feil.
    const wasFavorite = orderedKeys.includes(key)
    const optimistic = wasFavorite
      ? orderedKeys.filter(k => k !== key)
      : [...orderedKeys, key]
    setOrderedKeys(optimistic)
    if (!wasFavorite) setConfigs(c => ({ ...c, [key]: config ?? null }))
    setPending(true)
    setError(null)

    const res = await toggleFavoriteChart(key, config ?? null)
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
  }, [orderedKeys, readOnly])

  const setConfig = useCallback(async (chartKey: string, config: FavorittConfig | null) => {
    if (readOnly) return
    setConfigs(c => ({ ...c, [chartKey]: config }))
    const res = await saveFavoriteConfig(chartKey, config)
    if (res.error) setError(res.error)
  }, [readOnly])

  const reorder = useCallback(async (keys: string[]) => {
    if (readOnly) return
    const forrige = orderedKeys
    setOrderedKeys(keys)
    setError(null)
    const res = await reorderFavoriteCharts(keys)
    if (res.error) { setOrderedKeys(forrige); setError(res.error) }
  }, [orderedKeys, readOnly])

  const value = useMemo<FavoritesContextValue>(() => ({
    favorites, orderedKeys, configs, toggle, setConfig, reorder, readOnly, isPending, error,
  }), [favorites, orderedKeys, configs, toggle, setConfig, reorder, readOnly, isPending, error])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    // Graceful fallback: tillat ChartWrapper-bruk utenfor provider (f.eks. storybook).
    return {
      favorites: new Set(),
      orderedKeys: [],
      configs: {},
      toggle: async () => {},
      setConfig: async () => {},
      reorder: async () => {},
      readOnly: false,
      isPending: false,
      error: null,
    }
  }
  return ctx
}
