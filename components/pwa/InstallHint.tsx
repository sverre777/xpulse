'use client'

import { useEffect, useRef, useState } from 'react'

// Diskret «Legg til på hjemskjerm»-hint for mobilbrukere i appen.
// - Vises ALDRI på desktop, i installert app (display-mode: standalone),
//   eller etter at brukeren har lukket det (localStorage).
// - Android/Chrome: fanger beforeinstallprompt og tilbyr ekte install-knapp.
// - iOS Safari: har ikke install-API — viser kort instruksjon i stedet.

const DISMISS_KEY = 'xp-pwa-hint-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export function InstallHint() {
  const [mode, setMode] = useState<'hidden' | 'ios' | 'android'>('hidden')
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
      if (standalone) return
      const ua = navigator.userAgent
      const isIOS = /iPhone|iPad|iPod/.test(ua)
      const isAndroid = /Android/.test(ua)
      if (!isIOS && !isAndroid) return

      if (isIOS) {
        setMode('ios')
        return
      }
      // Android: vis kun når nettleseren faktisk tilbyr installasjon.
      const onPrompt = (e: Event) => {
        e.preventDefault()
        promptRef.current = e as BeforeInstallPromptEvent
        setMode('android')
      }
      window.addEventListener('beforeinstallprompt', onPrompt)
      return () => window.removeEventListener('beforeinstallprompt', onPrompt)
    } catch {
      // hint er ren pynt — aldri krasj
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* privat modus o.l. */ }
    setMode('hidden')
  }

  const install = async () => {
    try { await promptRef.current?.prompt() } catch { /* bruker avbrøt */ }
    dismiss()
  }

  if (mode === 'hidden') return null

  return (
    <div
      className="fixed bottom-3 inset-x-3 z-40 md:hidden xp-fade-in"
      role="complementary"
      aria-label="Legg til på hjemskjerm"
    >
      <div
        className="flex items-center gap-3 p-3"
        style={{ backgroundColor: '#13131A', border: '1px solid #262629', borderLeft: '3px solid #FF4500' }}
      >
        <img src="/x-pulse-icon-64.png" alt="" width={28} height={28} aria-hidden="true" />
        <p
          className="flex-1 m-0"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C9C9CE', fontSize: 13, lineHeight: 1.5 }}
        >
          {mode === 'android'
            ? 'Legg X-PULSE på hjemskjermen for raskere tilgang.'
            : 'Legg X-PULSE på hjemskjermen: trykk Del-ikonet og velg «Legg til på Hjem-skjerm».'}
        </p>
        {mode === 'android' && (
          <button
            type="button"
            onClick={install}
            className="px-3 py-2 text-xs tracking-widest uppercase shrink-0"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              backgroundColor: '#FF4500', color: '#F0F0F2', border: 'none', cursor: 'pointer',
            }}
          >
            Installer
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Lukk"
          className="shrink-0"
          style={{
            background: 'none', border: 'none', color: '#8A8A96',
            fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '6px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
