'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { WeeklyReflection, WeeklyReflectionInput } from '@/lib/weekly-reflection-types'
import { getWeeklyReflection, upsertWeeklyReflection } from '@/app/actions/weekly-reflections'

interface Props {
  year: number
  weekNumber: number
  // Året og uken som identifiserer inneværende uke — brukes til fremtids-sperre.
  currentYear: number
  currentWeek: number
  targetUserId?: string
}

const WARN = '#D4A017'
const DANGER = '#E11D48'
const OK = '#28A86E'

// Fargeskala basert på om høy verdi er "dårlig" (load/stress) eller "bra" (energy).
function scoreColor(n: number | null, highIsBad: boolean): string {
  if (n == null) return '#2A2A30'
  if (highIsBad) {
    if (n <= 3) return OK
    if (n <= 6) return WARN
    return DANGER
  } else {
    if (n <= 3) return DANGER
    if (n <= 6) return WARN
    return OK
  }
}

function ScoreRow({
  label, value, highIsBad, onChange, disabled,
}: {
  label: string
  value: number | null
  highIsBad: boolean
  onChange: (n: number | null) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {label}
        </span>
        {value != null && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: scoreColor(value, highIsBad), fontSize: '16px' }}>
            {value}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected ? null : n)}
              className="flex-1 text-xs"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: selected ? scoreColor(n, highIsBad) : 'transparent',
                color: selected ? '#0A0A0B' : '#8A8A96',
                border: `1px solid ${selected ? scoreColor(n, highIsBad) : '#1E1E22'}`,
                padding: '4px 0',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}>
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function WeeklyReflectionSection({
  year, weekNumber, currentYear, currentWeek, targetUserId,
}: Props) {
  const isFuture = year > currentYear || (year === currentYear && weekNumber > currentWeek)

  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState<WeeklyReflection | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const injuryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isFuture) { setLoaded(true); return }
    let cancelled = false
    setLoaded(false)
    getWeeklyReflection(year, weekNumber, targetUserId).then(res => {
      if (cancelled) return
      if (res && typeof res === 'object' && 'error' in res) {
        setError(res.error)
        setLoaded(true)
        return
      }
      setData(res as WeeklyReflection | null)
      const hasAny = res != null
      setOpen(hasAny)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [year, weekNumber, isFuture, targetUserId])

  if (isFuture) return null

  const save = (patch: WeeklyReflectionInput) => {
    const merged: WeeklyReflectionInput = {
      perceived_load: patch.perceived_load !== undefined ? patch.perceived_load : data?.perceived_load ?? null,
      energy:         patch.energy !== undefined         ? patch.energy         : data?.energy ?? null,
      stress:         patch.stress !== undefined         ? patch.stress         : data?.stress ?? null,
      comment:        patch.comment !== undefined        ? patch.comment        : data?.comment ?? null,
      injury_notes:   patch.injury_notes !== undefined   ? patch.injury_notes   : data?.injury_notes ?? null,
    }
    startTransition(async () => {
      setError(null)
      const res = await upsertWeeklyReflection(year, weekNumber, merged, targetUserId)
      if (res.error) { setError(res.error); return }
      // Oppdater lokal state uten ekstra round-trip.
      setData(prev => ({
        id: res.id ?? prev?.id ?? '',
        user_id: prev?.user_id ?? '',
        year, week_number: weekNumber,
        perceived_load: merged.perceived_load ?? null,
        energy: merged.energy ?? null,
        stress: merged.stress ?? null,
        comment: merged.comment ?? null,
        injury_notes: merged.injury_notes ?? null,
        created_at: prev?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      setSavedAt(Date.now())
    })
  }

  const hasAny = !!data && (data.perceived_load != null || data.energy != null || data.stress != null || (data.comment && data.comment.trim()) || (data.injury_notes && data.injury_notes.trim()))
  const accent = hasAny ? OK : '#1E1E22'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0A0A0B',
    border: '1px solid #1E1E22',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '13px',
    padding: '6px 8px',
    outline: 'none',
    resize: 'vertical',
  }

  return (
    <div style={{
      backgroundColor: '#0D0D11',
      border: '1px solid #1E1E22',
      borderLeft: `3px solid ${accent}`,
    }}>
      <button type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left p-2"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Ukes-tilbakeblikk
          </span>
          {loaded && hasAny && data && (
            <span className="flex items-center gap-2 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {data.perceived_load != null && (
                <span style={{ color: scoreColor(data.perceived_load, true) }}>
                  Følt {data.perceived_load}
                </span>
              )}
              {data.energy != null && (
                <span style={{ color: scoreColor(data.energy, false) }}>
                  · Overskudd {data.energy}
                </span>
              )}
              {data.stress != null && (
                <span style={{ color: scoreColor(data.stress, true) }}>
                  · Stress {data.stress}
                </span>
              )}
              {data.injury_notes && data.injury_notes.trim() && (
                <span style={{ color: DANGER }} title="Skade/plage registrert">⚠</span>
              )}
            </span>
          )}
        </div>
        <span style={{ color: '#555560', fontSize: '14px', lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>

      {open && loaded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <ScoreRow
              label="Følt belastning"
              value={data?.perceived_load ?? null}
              highIsBad={true}
              onChange={n => save({ perceived_load: n })}
              disabled={pending}
            />
            <ScoreRow
              label="Overskudd"
              value={data?.energy ?? null}
              highIsBad={false}
              onChange={n => save({ energy: n })}
              disabled={pending}
            />
            <ScoreRow
              label="Stress"
              value={data?.stress ?? null}
              highIsBad={true}
              onChange={n => save({ stress: n })}
              disabled={pending}
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase block mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Ukens kommentar
            </label>
            <textarea
              defaultValue={data?.comment ?? ''}
              rows={2}
              placeholder="Hvordan opplevde du uken?"
              style={inputStyle}
              onChange={e => {
                const v = e.target.value
                if (commentTimer.current) clearTimeout(commentTimer.current)
                commentTimer.current = setTimeout(() => save({ comment: v }), 700)
              }}
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase flex items-center gap-1 mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              <span style={{ color: DANGER }}>⚠</span> Skade eller plage <span style={{ color: '#555560' }}>(valgfri)</span>
            </label>
            <textarea
              defaultValue={data?.injury_notes ?? ''}
              rows={2}
              placeholder="Noter eventuelle plager eller skader."
              style={inputStyle}
              onChange={e => {
                const v = e.target.value
                if (injuryTimer.current) clearTimeout(injuryTimer.current)
                injuryTimer.current = setTimeout(() => save({ injury_notes: v }), 700)
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            <span style={{ color: pending ? '#FF4500' : '#555560' }}>
              {pending ? 'Lagrer...' : savedAt ? 'Lagret' : 'Autolagres ved endring'}
            </span>
            {error && <span style={{ color: DANGER }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
