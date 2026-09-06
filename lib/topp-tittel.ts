'use client'

// NAVIGASJON v2 bolk 2: sidetittel for glass-topplinja. Rutekartet gir tittel
// for hovedsidene; undersider (trener inne på utøver, økt-sider) kan overstyre
// med settToppTittel() i en effekt. Modul-lager + useSyncExternalStore — ingen
// context-provider å tre gjennom fire layouter.

import { useSyncExternalStore } from 'react'

export interface ToppTittel {
  tittel: string
  undertekst?: string | null
  /** Tilbake-pil i stedet for logo (undersider). href = dit pila går. */
  tilbake?: string | null
}

let overstyring: ToppTittel | null = null
const lyttere = new Set<() => void>()
const varsle = () => { for (const l of lyttere) l() }

export function settToppTittel(t: ToppTittel | null): void { overstyring = t; varsle() }
export function useToppTittelOverstyring(): ToppTittel | null {
  return useSyncExternalStore(l => { lyttere.add(l); return () => { lyttere.delete(l) } }, () => overstyring, () => null)
}

const UKEDAG = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
function isoUke(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7))
  const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
  return Math.ceil((((x.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

/** Tittel + undertekst fra ruta (uke fra ?cd= der det finnes). */
export function tittelForRute(pathname: string, cd: string | null, rolle: 'athlete' | 'coach'): ToppTittel {
  const naa = new Date()
  const dato = cd && /^\d{4}-\d{2}-\d{2}$/.test(cd) ? new Date(cd + 'T12:00:00') : naa
  const uke = `uke ${isoUke(dato)}`
  const idag = `${UKEDAG[naa.getDay()]} ${naa.getDate()}. ${MND[naa.getMonth()]} · uke ${isoUke(naa)}`
  const p = pathname
  if (rolle === 'coach') {
    if (p === '/app/trener') return { tittel: 'Hjem', undertekst: idag }
    if (p.startsWith('/app/trener/planlegg')) return { tittel: 'Planlegg', undertekst: 'maler · push' }
    if (p.startsWith('/app/trener/kalender')) return { tittel: 'Kalender', undertekst: 'alle utøvere' }
    if (p.startsWith('/app/trener/sammenligne')) return { tittel: 'Sammenligne', undertekst: null }
    if (p.startsWith('/app/trener/utovere')) return { tittel: 'Utøvere', undertekst: null, tilbake: '/app/mer' }
  }
  if (p === '/app/oversikt' || p === '/app') return { tittel: 'Hjem', undertekst: idag }
  if (p.startsWith('/app/plan')) return { tittel: 'Plan', undertekst: uke }
  if (p.startsWith('/app/periodisering')) return { tittel: 'Årsplan', undertekst: String(dato.getFullYear()) }
  if (p.startsWith('/app/dagbok')) return { tittel: 'Dagbok', undertekst: uke }
  if (p.startsWith('/app/analyse')) return { tittel: 'Analyse', undertekst: null }
  if (p === '/app/mer') return { tittel: 'Mer', undertekst: null }
  if (p.startsWith('/app/okt/')) return { tittel: 'Live styrke', undertekst: null, tilbake: '/app/dagbok' }
  if (p.startsWith('/app/maler')) return { tittel: 'Maler & standardøkter', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/utstyr')) return { tittel: 'Utstyr & skipark', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/ai-coach')) return { tittel: 'AI-coach', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/innboks')) return { tittel: 'Innboks', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/innstillinger/klokkesync')) return { tittel: 'Klokkesync', undertekst: null, tilbake: '/app/innstillinger' }
  if (p.startsWith('/app/innstillinger/profil')) return { tittel: 'Profil', undertekst: null, tilbake: '/app/innstillinger' }
  if (p.startsWith('/app/innstillinger')) return { tittel: 'Innstillinger', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/historikk')) return { tittel: 'Historikk', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/health/')) return { tittel: 'Helse', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/abonnement')) return { tittel: 'Abonnement', undertekst: null, tilbake: '/app/mer' }
  if (p.startsWith('/app/trener/')) return { tittel: 'Utøver', undertekst: null, tilbake: '/app/trener' }
  return { tittel: 'X-PULSE', undertekst: null, tilbake: rolle === 'coach' ? '/app/trener' : '/app/oversikt' }
}
