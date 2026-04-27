'use client'

import { useMemo, useState } from 'react'
import type {
  PlanTemplateData, PlanTemplateFocusPoint,
} from '@/lib/template-types'

const COACH_BLUE = '#1A6FD4'
const GOLD = '#D4A017'

type FocusScope = 'day' | 'week' | 'month'

interface Props {
  durationDays: number
  data: PlanTemplateData
  onChange: (next: PlanTemplateData) => void
}

export function PlanMalNotesSection({ durationDays, data, onChange }: Props) {
  const totalWeeks = Math.max(1, Math.ceil(durationDays / 7))
  const totalMonths = Math.max(1, Math.ceil(durationDays / 30))

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection title={`Uke-notater (${countNonEmpty(data.week_notes)} / ${totalWeeks})`}>
        <NoteList
          count={totalWeeks}
          notes={data.week_notes}
          labelFor={(i) => `Uke ${i + 1}`}
          onChange={(next) => onChange({ ...data, week_notes: next })}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Måneds-notater (${countNonEmpty(data.month_notes)} / ${totalMonths})`}>
        <NoteList
          count={totalMonths}
          notes={data.month_notes}
          labelFor={(i) => `Måned ${i + 1}`}
          onChange={(next) => onChange({ ...data, month_notes: next })}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Fokuspunkter (${data.focus_points.length})`}>
        <FocusPointsEditor
          durationDays={durationDays}
          totalWeeks={totalWeeks}
          totalMonths={totalMonths}
          focusPoints={data.focus_points}
          onChange={(next) => onChange({ ...data, focus_points: next })}
        />
      </CollapsibleSection>
    </div>
  )
}

function countNonEmpty(rec: Record<string, string>): number {
  let n = 0
  for (const v of Object.values(rec)) if (v.trim()) n += 1
  return n
}

function CollapsibleSection({
  title, children,
}: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #1E1E22' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#C0C0CC',
          background: '#13131A',
          border: 'none',
          cursor: 'pointer',
        }}>
        <span>{title}</span>
        <span style={{ color: '#555560', fontSize: '14px' }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-3" style={{ background: '#0D0D11' }}>{children}</div>}
    </div>
  )
}

function NoteList({
  count, notes, labelFor, onChange,
}: {
  count: number
  notes: Record<string, string>
  labelFor: (i: number) => string
  onChange: (next: Record<string, string>) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => {
        const key = String(i)
        const value = notes[key] ?? ''
        return (
          <div key={key}>
            <label className="block mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {labelFor(i)}
            </label>
            <textarea
              value={value}
              onChange={e => {
                const next = { ...notes }
                if (e.target.value.trim()) next[key] = e.target.value
                else delete next[key]
                onChange(next)
              }}
              rows={2}
              style={iSt}
              placeholder="Fokus, beskjed til utøver, …"
            />
          </div>
        )
      })}
    </div>
  )
}

function FocusPointsEditor({
  durationDays, totalWeeks, totalMonths, focusPoints, onChange,
}: {
  durationDays: number
  totalWeeks: number
  totalMonths: number
  focusPoints: PlanTemplateFocusPoint[]
  onChange: (next: PlanTemplateFocusPoint[]) => void
}) {
  const sorted = useMemo(() => {
    return focusPoints
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.period_offset - b.period_offset)
  }, [focusPoints])

  const addPoint = (scope: FocusScope) => {
    onChange([
      ...focusPoints,
      {
        scope,
        period_offset: 0,
        content: '',
        sort_order: focusPoints.length,
      },
    ])
  }

  const updatePoint = (i: number, patch: Partial<PlanTemplateFocusPoint>) => {
    const next = focusPoints.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const removePoint = (i: number) => {
    onChange(focusPoints.filter((_, idx) => idx !== i).map((f, idx) => ({ ...f, sort_order: idx })))
  }

  const maxFor = (scope: FocusScope) => {
    if (scope === 'day') return Math.max(0, durationDays - 1)
    if (scope === 'week') return Math.max(0, totalWeeks - 1)
    return Math.max(0, totalMonths - 1)
  }

  const labelFor = (scope: FocusScope, offset: number) => {
    if (scope === 'day') return `Dag ${offset + 1}`
    if (scope === 'week') return `Uke ${offset + 1}`
    return `Måned ${offset + 1}`
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.length === 0 ? (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen fokuspunkter ennå. Legg til ett under for å fremheve mål, fokusområder eller beskjeder for spesifikke dager, uker eller måneder.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {focusPoints.map((f, i) => (
            <div key={i} className="p-3 flex flex-col gap-2"
              style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1 text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    Type
                  </label>
                  <select value={f.scope}
                    onChange={e => {
                      const next = e.target.value as FocusScope
                      const max = next === 'day' ? durationDays - 1
                        : next === 'week' ? totalWeeks - 1 : totalMonths - 1
                      updatePoint(i, { scope: next, period_offset: Math.min(f.period_offset, Math.max(0, max)) })
                    }}
                    style={iSt}>
                    <option value="day">Dag</option>
                    <option value="week">Uke</option>
                    <option value="month">Måned</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {labelFor(f.scope, f.period_offset)}
                  </label>
                  <input type="number" min={0} max={maxFor(f.scope)}
                    value={f.period_offset}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      updatePoint(i, { period_offset: Number.isFinite(v) ? Math.max(0, Math.min(maxFor(f.scope), v)) : 0 })
                    }}
                    style={iSt} />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
                  Fokus
                </label>
                <textarea
                  value={f.content}
                  onChange={e => updatePoint(i, { content: e.target.value })}
                  rows={2}
                  style={iSt}
                  placeholder="F.eks. Roterende styrketrening, høyere I3-volum, fokus på løpsteknikk …"
                />
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => removePoint(i)}
                  className="px-3 py-1 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: '#FF4500',
                    background: 'none', border: '1px solid #FF450066',
                    cursor: 'pointer',
                  }}>
                  Fjern
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <AddBtn onClick={() => addPoint('day')}>+ Dags-fokus</AddBtn>
        <AddBtn onClick={() => addPoint('week')}>+ Uke-fokus</AddBtn>
        <AddBtn onClick={() => addPoint('month')}>+ Måneds-fokus</AddBtn>
      </div>
    </div>
  )
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: COACH_BLUE,
        background: 'none', border: `1px solid ${COACH_BLUE}66`,
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}
