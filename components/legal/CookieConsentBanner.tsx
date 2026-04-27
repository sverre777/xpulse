'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'xpulse-consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      // localStorage utilgjengelig (SSR/private mode) — ikke vis banner.
    }
  }, [])

  const accept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        accepted: true,
        ts: new Date().toISOString(),
      }))
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie-samtykke"
      className="fixed inset-x-0 bottom-0 z-50 px-4 py-4"
      style={{
        backgroundColor: '#0D0D11',
        borderTop: '1px solid #1E1E22',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <p
            className="text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', lineHeight: 1.5 }}
          >
            X-PULSE bruker kun strengt nødvendige cookies for innlogging og funksjonalitet.
            Vi bruker ingen analyse- eller markedsføringscookies. Les mer i{' '}
            <Link
              href="/cookies"
              className="underline transition-opacity hover:opacity-80"
              style={{ color: '#FF4500' }}
            >
              cookie-erklæringen
            </Link>{' '}
            og{' '}
            <Link
              href="/personvern"
              className="underline transition-opacity hover:opacity-80"
              style={{ color: '#FF4500' }}
            >
              personvernerklæringen
            </Link>.
          </p>
        </div>
        <button
          type="button"
          onClick={accept}
          className="px-6 py-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-80 whitespace-nowrap"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500',
            color: '#F0F0F2',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          OK, forstått
        </button>
      </div>
    </div>
  )
}
