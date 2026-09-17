'use client'

// Y-AKSEN I ØKTGRAFENE (beslutning 17. sep): ÉN komponent for valget
// auto-tett / I1-I5 / fast 40-200, montert i øktgrafen (WorkoutDetailChart -
// oversikten, klokkesync-seksjonen, sammenligningen og Hjem-kortene) og i
// Øktbyggeren. Valget leses med useSyncExternalStore fra lib/puls-akse
// (localStorage) - ingen mount-effekt + setState, samme valg overalt.

import { useSyncExternalStore } from 'react'
import type { HeartZone } from '@/lib/heart-zones'
import { PULS_AKSE_VALG, abonnerPulsAkse, lagrePulsAkse, lesPulsAkse, pulsAkseServer, pulsAkseSpenn, type PulsAkseModus, type Spenn } from '@/lib/puls-akse'

export function usePulsAkse(): PulsAkseModus {
  return useSyncExternalStore(abonnerPulsAkse, lesPulsAkse, pulsAkseServer)
}

/** Skalaregelen til OktKurve: pulsserien (og andre økters puls i samme gruppe) får aksen etter valget; andre serier som før. */
export function skalaForPuls(modus: PulsAkseModus, soner: HeartZone[] | undefined) {
  return (serie: { id: string; gruppe?: string }, spenn: Spenn | null): Spenn | null =>
    // øktgrafen kaller pulsserien 'hr', Øktbyggeren 'puls'; andre økters puls ligger i gruppe 'hr'
    serie.id === 'hr' || serie.id === 'puls' || serie.gruppe === 'hr' ? pulsAkseSpenn(modus, spenn, soner) : spenn
}

export function PulsAkseValg({ kompakt = false }: { kompakt?: boolean }) {
  const modus = usePulsAkse()
  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-pulsakse={modus}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', marginRight: 2 }}>Pulsakse</span>
      <span role="group" aria-label="Pulsaksens spenn" style={{ display: 'inline-flex', border: '1px solid var(--kant-3)', borderRadius: 999, overflow: 'hidden' }}>
        {PULS_AKSE_VALG.map(v => (
          <button key={v.id} type="button" data-pulsakse-valg={v.id} aria-pressed={modus === v.id} title={v.tittel}
            onClick={() => lagrePulsAkse(v.id)}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: kompakt ? 11 : 11.5, letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: kompakt ? '5px 10px' : '6px 12px', minHeight: kompakt ? 30 : 32, cursor: 'pointer', border: 'none',
              background: modus === v.id ? 'var(--accent)' : 'transparent',
              color: modus === v.id ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)',
            }}>
            {v.etikett}
          </button>
        ))}
      </span>
    </div>
  )
}
