'use client'

import { useState, useTransition } from 'react'
import { generateDataExport } from '@/app/actions/data-export'

// Generer JSON-eksport via server-action og last ned via Blob.
// CSV-bundle (ZIP med flere CSV-er) kan legges til senere — krever
// JSZip + per-tabell CSV-konvertering.

export function DataExportButton() {
  const [busy, startBusy] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleExport = () => {
    setError(null)
    startBusy(async () => {
      const res = await generateDataExport()
      if (res.error || !res.json) {
        setError(res.error ?? 'Eksport feilet')
        return
      }
      const blob = new Blob([res.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `x-pulse-data-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  return (
    <>
      <button type="button" onClick={handleExport} disabled={busy}
        className="block w-full text-center px-4 py-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-90"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#FF4500', color: '#FFFFFF', border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
        {busy ? 'Genererer eksport…' : 'Last ned data (JSON)'}
      </button>
      {error && (
        <p className="mt-2 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
            padding: '6px 10px', backgroundColor: 'rgba(225,29,72,0.08)',
            border: '1px solid rgba(225,29,72,0.3)',
          }}>
          {error}
        </p>
      )}
    </>
  )
}
