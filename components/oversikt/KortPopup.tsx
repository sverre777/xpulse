'use client'

// Gjenbrukbar popup for hjem-kortene. ÉN skjelett-komponent, tre innhold.
//
// Popupen er en VISNING, ikke en arbeidsflate (notat pkt 3): den viser det
// kortet allerede har lastet, og nederst står én lenke videre til der man
// faktisk kan gjøre noe. Ingenting hentes for popupen.
//
// Lukkes med ✕, klikk utenfor og Escape — alle tre, ikke bare én av dem.
//
// MOBIL (Sverre 5. sep, Hjem v2-fasiten): ≤ 620 px er popupen et FULLSKJERM-
// ARK — fixed inset 0, full bredde, ingen vannrett scroll, safe-area, lukk-
// krysset øverst til høyre alltid synlig (sticky hode), body-scroll låst bak.
// Én felles ramme for alle «Vis mer» på Hjem (Ukens totaler, Siste hardøkt,
// Helse) — klassene .xp-popup* i globals.css.

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

const FONT = "'Barlow Condensed', sans-serif"

export function KortPopup({
  kicker, tittel, undertittel, videreHref, videreTekst, onClose, children, bred = false,
}: {
  /** HJEM v2 bolk 4: bred popup (graf + to kolonner + serietabell). Mobil: fullskjerm-ark. */
  bred?: boolean
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
    <div onClick={onClose} className="xp-popup-scrim" data-popup-scrim>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tittel}
        className={`xp-popup${bred ? ' xp-popup-bred' : ''}`} data-kort-popup>
        <div className="xp-popup-hode flex items-start gap-3">
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
          <button type="button" onClick={onClose} aria-label="Lukk" data-popup-lukk
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
 * Tallrad. Fire kolonner på desktop, TRE på mobil (Sverre 5. sep) med
 * auto-høyde. «—» der noe ikke er ført — dempet, så tomme celler ikke
 * leses som 0. Mobil: en rad (3 ruter) der ALLE er «—» skjules.
 */
export function PopupTall({ celler }: { celler: { k: string; v: string | null; enhet?: string }[] }) {
  // Mobilradene er grupper på tre i rekkefølge — ruter i en rad uten ett
  // eneste tall merkes og skjules av CSS ved ≤ 620 px.
  const skjulMobil = new Set<number>()
  for (let i = 0; i < celler.length; i += 3) {
    const rad = celler.slice(i, i + 3)
    if (rad.every(c => !c.v)) for (let j = i; j < i + rad.length; j++) skjulMobil.add(j)
  }
  return (
    <div className="xp-popup-tall" data-popup-tall>
      {celler.map((c, i) => (
        <div key={c.k} data-tom={c.v ? '0' : '1'} data-skjul-mobil={skjulMobil.has(i) ? '1' : undefined} style={{ background: 'var(--card2, var(--card2))', padding: '10px 11px', minWidth: 0 }}>
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
