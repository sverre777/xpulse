'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MenuIcon, CloseIcon, ChevronDownIcon, SearchIcon, MailIcon,
} from '@/components/branding/nav-icons'

// Topbar for funksjoner-undersider. Speilet xpulse.html-stil men i React,
// med Funksjoner-dropdown på desktop og slide-in-panel på mobil.
//
// Navnet er importert som forenklet versjon av landing-html — alle lenker
// peker mot offentlige sider eller /app for innlogging.

const SPORT_LINKS = [
  { slug: 'langrenn',   label: 'Langrenn' },
  { slug: 'skiskyting', label: 'Skiskyting' },
  { slug: 'langlop',    label: 'Langløp' },
  { slug: 'loping',     label: 'Løping' },
  { slug: 'sykling',    label: 'Sykling' },
  { slug: 'triatlon',   label: 'Triatlon' },
] as const

const MODULE_LINKS = [
  { href: '/funksjoner/dagbok-og-plan', label: 'Dagbok og Plan',                soon: false },
  { href: '/funksjoner/analyse',        label: 'Analyse',                       soon: false },
  { href: '/funksjoner/trener',         label: 'Trener',                        soon: false },
  { href: '/funksjoner/klokkesync',     label: 'Klokkesync',                    soon: false },
  { href: '/funksjoner/ai-coach',       label: 'AI Coach',                      soon: true },
] as const

function XLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id="lp-x-tl"><polygon points="0,0 200,200 0,200" /></clipPath>
        <clipPath id="lp-x-br"><polygon points="0,0 200,0 200,200" /></clipPath>
      </defs>
      <g clipPath="url(#lp-x-tl)">
        <path d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z" fill="#FF4500" />
      </g>
      <g clipPath="url(#lp-x-br)">
        <path d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z" fill="#1A6FD4" />
      </g>
    </svg>
  )
}

export function LandingNav() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <nav
        className="flex items-center justify-between px-6 lg:px-14 py-6"
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'linear-gradient(to bottom, rgba(11,19,21,0.85), rgba(11,19,21,0.6))',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #262629',
        }}
      >
        <Link href="/xpulse.html"
          className="inline-flex items-center gap-2"
          aria-label="X-PULSE"
          style={{ textDecoration: 'none' }}
        >
          <XLogo size={32} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600, fontSize: '18px', letterSpacing: '0.4em',
            color: '#F2F0EC', textTransform: 'uppercase',
          }}>PULSE</span>
        </Link>

        <ul className="hidden lg:flex items-center gap-8 list-none m-0 p-0">
          <li className="relative group">
            <button type="button"
              className="inline-flex items-center gap-1.5"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(242,240,236,0.55)', padding: 0,
              }}
              aria-haspopup="true"
            >
              Funksjoner
              <ChevronDownIcon size={12} className="group-hover:rotate-180 transition-transform" />
            </button>
            <div
              className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all"
              style={{
                position: 'absolute', top: 'calc(100% + 14px)', left: 0,
                minWidth: '220px', background: '#111113', border: '1px solid #262629',
                padding: '8px 0',
              }}
            >
              {SPORT_LINKS.map(s => (
                <Link key={s.slug} href={`/funksjoner/${s.slug}`}
                  style={{
                    display: 'block', padding: '11px 20px',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(242,240,236,0.6)', textDecoration: 'none',
                  }}
                >
                  {s.label}
                </Link>
              ))}
              <div style={{ height: 1, background: '#262629', margin: '6px 12px' }} />
              {MODULE_LINKS.map(m => (
                <Link key={m.href} href={m.href}
                  style={{
                    display: 'block', padding: '11px 20px',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(242,240,236,0.6)', textDecoration: 'none',
                  }}
                >
                  {m.label}
                  {m.soon && (
                    <span style={{
                      display: 'inline-block', marginLeft: 6, padding: '1px 6px',
                      background: 'rgba(245,197,66,0.15)', border: '1px solid rgba(245,197,66,0.4)',
                      color: '#F5C542', fontSize: 9, letterSpacing: '1.5px',
                      verticalAlign: 'middle',
                    }}>
                      Q3 2026
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </li>
          <li><Link href="/xpulse.html#priser" style={navLinkStyle}>Priser</Link></li>
          <li><Link href="/xpulse.html#faq"    style={navLinkStyle}>FAQ</Link></li>
          <li><Link href="/app"                style={navLinkStyle}>Logg inn</Link></li>
          <li>
            <Link href="/xpulse.html#priser"
              style={{
                background: '#FF4500', color: '#F2F0EC', padding: '9px 20px',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}>
              Start gratis prøve
            </Link>
          </li>
        </ul>

        <button type="button"
          onClick={() => setPanelOpen(true)}
          className="lg:hidden"
          aria-label="Åpne meny"
          style={{ background: 'none', border: 'none', color: '#F2F0EC', padding: 6, cursor: 'pointer' }}
        >
          <MenuIcon size={26} />
        </button>
      </nav>

      {panelOpen && (
        <div
          role="dialog" aria-modal="true" aria-label="Hovedmeny"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: '#060607', padding: 24,
            display: 'flex', flexDirection: 'column', gap: 20,
            overflowY: 'auto',
          }}
        >
          <div className="flex items-center justify-between">
            <Link href="/xpulse.html" onClick={() => setPanelOpen(false)}
              className="inline-flex items-center gap-2"
              style={{ textDecoration: 'none' }}
            >
              <XLogo size={32} />
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600, fontSize: '18px', letterSpacing: '0.4em',
                color: '#F2F0EC', textTransform: 'uppercase',
              }}>PULSE</span>
            </Link>
            <button type="button" onClick={() => setPanelOpen(false)}
              aria-label="Lukk meny"
              style={{ background: 'none', border: 'none', color: '#F2F0EC', padding: 6, cursor: 'pointer' }}
            >
              <CloseIcon size={26} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Link href="/app" onClick={() => setPanelOpen(false)} style={panelIconStyle}>
              <MailIcon size={22} />
              Logg inn
            </Link>
            <Link href="/xpulse.html#faq" onClick={() => setPanelOpen(false)} style={panelIconStyle}>
              <SearchIcon size={22} />
              FAQ
            </Link>
            <a href="mailto:support@x-pulse.no" style={panelIconStyle}>
              <MailIcon size={22} />
              Kontakt
            </a>
          </div>

          <details>
            <summary style={{ ...panelLinkStyle, listStyle: 'none' }}>
              Funksjoner
              <ChevronDownIcon size={14} />
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[...SPORT_LINKS.map(s => ({ href: `/funksjoner/${s.slug}`, label: s.label })), ...MODULE_LINKS].map(l => (
                <Link key={l.href} href={l.href} onClick={() => setPanelOpen(false)}
                  style={{
                    padding: '14px 28px', background: '#111113',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'rgba(242,240,236,0.7)', textDecoration: 'none',
                    borderTop: '1px solid #262629',
                  }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </details>

          <Link href="/xpulse.html#priser" onClick={() => setPanelOpen(false)} style={panelLinkStyle}>Priser</Link>
          <Link href="/xpulse.html#faq" onClick={() => setPanelOpen(false)} style={panelLinkStyle}>FAQ</Link>

          <Link href="/xpulse.html#priser" onClick={() => setPanelOpen(false)}
            style={{
              marginTop: 'auto', padding: 18, background: '#FF4500',
              color: '#F2F0EC', textAlign: 'center', textDecoration: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: '13px', letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
            Start 30 dagers gratis prøve
          </Link>
        </div>
      )}
    </>
  )
}

const navLinkStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
  fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'rgba(242,240,236,0.55)', textDecoration: 'none',
}

const panelIconStyle: React.CSSProperties = {
  padding: '14px 8px', background: '#1A1A1E', border: '1px solid #262629',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  color: '#F2F0EC', textDecoration: 'none',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
  fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
}

const panelLinkStyle: React.CSSProperties = {
  padding: '18px 16px', background: '#1A1A1E',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
  fontSize: '14px', letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#F2F0EC', textDecoration: 'none',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer',
}
