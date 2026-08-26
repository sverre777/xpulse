'use client'

// Gjenbrukbar popup for hjem-kortene. ÉN skjelett-komponent, tre innhold.
//
// Popupen er en VISNING, ikke en arbeidsflate (notat pkt 3): den viser det
// kortet allerede har lastet, og nederst står én lenke videre til der man
// faktisk kan gjøre noe. Ingenting hentes for popupen.
//
// Lukkes med ✕, klikk utenfor og Escape — alle tre, ikke bare én av dem.

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

const FONT = "'Barlow Condensed', sans-serif"

export function KortPopup({
  kicker, tittel, undertittel, videreHref, videreTekst, onClose, children,
}: {
  kicker: string
  tittel: string
  undertittel?: string
  videreHref: string
  videreTekst: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const forrige = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = forrige
    }
  }, [onClose])

  const body = (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--scrim-72)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '6vh 16px', overflowY: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tittel}
        style={{
          // Mobil: full bredde med marg (notat pkt 13).
          width: '100%', maxWidth: 620,
          background: 'var(--card)', border: '1px solid var(--line2)',
          borderRadius: 16, padding: '20px 22px',
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}>
        <div className="flex items-start gap-3"
          style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mut)' }}>
              {kicker}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1.05, letterSpacing: '0.03em', color: 'var(--ink)', marginTop: 7 }}>
              {tittel}
            </div>
            {undertittel && (
              <div style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-alt)', marginTop: 6 }}>
                {undertittel}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mut)', fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 44 }}>
            ✕
          </button>
        </div>

        {children}

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <Link href={videreHref}
            style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent, #FF4500)', textDecoration: 'none' }}>
            {videreTekst} →
          </Link>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(body, document.body)
}

/** Etikett over en seksjon i popupen. */
export function PopupSeksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <span style={{ display: 'block', fontFamily: FONT, fontWeight: 600, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', marginBottom: 10 }}>
        {tittel}
      </span>
      {children}
    </div>
  )
}

/**
 * Tallrad. Fire kolonner på desktop, to på mobil (notat pkt 13).
 * «—» der noe ikke er ført — dempet, så tomme celler ikke leses som 0.
 */
export function PopupTall({ celler }: { celler: { k: string; v: string | null; enhet?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4"
      style={{ gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      {celler.map(c => (
        <div key={c.k} style={{ background: 'var(--card2, var(--card2))', padding: '10px 11px' }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 8.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>
            {c.k}
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, marginTop: 6, color: c.v ? 'var(--ink)' : 'var(--tekst-8-alt)' }}>
            {c.v ?? '—'}
            {c.v && c.enhet && (
              <small style={{ fontFamily: FONT, fontWeight: 600, fontSize: 9, color: 'var(--mut)', marginLeft: 2 }}>{c.enhet}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Sparklinje UTEN akser (notat pkt 11) — en retningsindikator, ikke en graf.
 * Hopper over dager uten verdi i stedet for å tegne dem som null: en linje
 * som stuper til bunnen fordi noe ikke er ført, lyver.
 */
export function Sparkline({ verdier, farge }: { verdier: (number | null)[]; farge: string }) {
  const punkter = verdier
    .map((v, i) => ({ i, v }))
    .filter((p): p is { i: number; v: number } => p.v !== null && Number.isFinite(p.v))
  if (punkter.length < 2) return null
  const W = 220, H = 34
  const xs = punkter.map(p => p.i)
  const vs = punkter.map(p => p.v)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minV = Math.min(...vs), maxV = Math.max(...vs)
  const spennX = maxX - minX || 1
  const spennV = maxV - minV || 1
  const d = punkter
    .map((p, n) => `${n === 0 ? 'M' : 'L'}${(((p.i - minX) / spennX) * W).toFixed(1)},${(H - ((p.v - minV) / spennV) * H).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={farge} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
