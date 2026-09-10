'use client'

// Førstegangsvarselet (prestasjonsmodellen bolk 6): liten, vennlig
// banner — cookie-banner-størrelse, aldri en blokkerende modal. Vises
// til utøveren har satt minst ÉN terskel ELLER lukket den; lukkingen
// huskes SERVER-SIDE (profiles.profilvarsel_lukket_at) så den aldri
// maser igjen — heller ikke på andre enheter. Kryss og knapp svarer i
// samme tick (regel 20): banneren skjules optimistisk, lagringen går
// i bakgrunnen.

import { useState } from 'react'
import Link from 'next/link'
import { lukkProfilvarsel } from '@/app/actions/settings'

export function ProfilVarselBanner() {
  const [skjult, setSkjult] = useState(false)
  if (skjult) return null

  const lukk = () => {
    setSkjult(true)
    void lukkProfilvarsel()
  }

  return (
    <div
      role="region"
      aria-label="Profil-påminnelse"
      className="fixed inset-x-0 z-40 px-4 py-3 flex items-center justify-center gap-3 flex-wrap"
      style={{
        // Over glasslinja, ikke under den. Med bottom-0 lå banneret rett bak
        // navlinja: den oransje knappen skinte gjennom glasset (nav-en har
        // backdrop-filter), og banneret stakk 17 px opp og 12 px ned utenfor
        // den avrundede rammen i full bredde - det så ut som en oransje
        // firkant i venstre kant (Sverre 10. sep). --xp-bunnlinje settes av
        // GlassLinje; uten app-nav faller den til 0 og banneret ligger nederst
        // som før.
        bottom: 'calc(var(--xp-bunnlinje, 0px) + 12px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'var(--flate-3)',
        borderTop: '1px solid var(--kant-3)',
        boxShadow: '0 -6px 24px rgba(0,0,0,0.25)',
      }}>
      <span className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)' }}>
        Legg inn tersklene og profilen din - da blir soner og analyse riktige.
      </span>
      <Link href="/app/innstillinger/profil/terskler"
        onClick={lukk}
        className="text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          backgroundColor: '#FF4500', color: 'var(--tekst-1-ren)',
          borderRadius: 999, padding: '8px 16px', textDecoration: 'none',
        }}>
        Til profilen →
      </Link>
      <button type="button" onClick={lukk} aria-label="Lukk påminnelsen"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--tekst-5-app)', fontSize: 18, lineHeight: 1,
          padding: '6px 8px',
        }}>
        ✕
      </button>
    </div>
  )
}
