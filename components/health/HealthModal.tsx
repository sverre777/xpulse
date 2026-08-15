'use client'

import { useEffect, useState } from 'react'
import { getDailyHealth } from '@/app/actions/health'
import { getDailySleep, type DailySleepRecord } from '@/app/actions/sleep'
import { getDailyHealthMetrics, type DailyHealthMetrics } from '@/app/actions/health-metrics'
import { HealthDayExtras } from './HealthDayExtras'
import { HealthForm } from './HealthForm'
import type { DailyHealth } from '@/lib/types'

// Helse-føring som modal, på linje med recovery, hviledag/sykdom og skade.
// Samme skall og samme oppførsel som RecoveryModal: klikk utenfor eller × for
// å lukke, Escape lukker, innhold scroller inne i modalen på lav skjerm.
//
// Skjemaet er det SAMME som på /app/health/[date] — ingen kopi. HealthForm tar
// onSaved/onCancel når det ligger i en modal; uten dem oppfører siden seg
// nøyaktig som før. Lagringen går gjennom samme server-action til samme
// tabell, så alt som leser helse-data ser de samme tallene som i dag.

interface Props {
  date: string
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function HealthModal({ date, open, onClose, onSaved }: Props) {
  const [existing, setExisting] = useState<DailyHealth | null>(null)
  const [sleep, setSleep] = useState<DailySleepRecord | null>(null)
  const [metrics, setMetrics] = useState<DailyHealthMetrics | null>(null)
  const [loading, setLoading] = useState(false)

  // Henter dagens verdier når modalen åpnes, så «Rediger» viser det som
  // allerede er ført. Nullstilles ved lukking så neste dato ikke arver.
  useEffect(() => {
    let cancelled = false
    if (!open) {
      setExisting(null)
      setSleep(null)
      setMetrics(null)
      setLoading(false)
      return
    }
    setLoading(true)
    // Begge lagene hentes samtidig: daily_health (dagens føring) og
    // sleep_records (de utvidede feltene med kilde per verdi).
    Promise.all([getDailyHealth(date), getDailySleep(date), getDailyHealthMetrics(date)])
      .then(([health, sleepRow, metricRow]) => {
        if (cancelled) return
        setExisting((health as DailyHealth | null) ?? null)
        setSleep(sleepRow)
        setMetrics(metricRow)
      })
      .catch(() => { if (!cancelled) { setExisting(null); setSleep(null); setMetrics(null) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, date])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const d = new Date(date + 'T12:00:00')
  const dateLabel = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

  const handleSaved = () => {
    onSaved?.()
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#28A86E', display: 'inline-block' }} />
            <div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em', margin: 0 }}>
                Helse
              </h2>
              <p className="capitalize" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 12, margin: 0 }}>
                {dateLabel}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{
              color: '#555560', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '22px', lineHeight: 1, minWidth: 44, minHeight: 44,
            }}>
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 14 }}>
            Henter dagens verdier …
          </p>
        ) : (
          <>
            <HealthForm
              date={date}
              existing={existing}
              sleep={sleep}
              metrics={metrics}
              onSaved={handleSaved}
              onCancel={onClose}
            />
            <HealthDayExtras date={date} />
          </>
        )}
      </div>
    </div>
  )
}
