'use client'

import { useMemo } from 'react'
import type { PeriodizationTemplateVolumePlan } from '@/lib/template-types'
import { addMonths, formatNorskMaaned } from '@/lib/template-dates'

const COACH_BLUE = '#1A6FD4'

interface Props {
  durationDays: number
  startDate: string | null
  volumePlans: PeriodizationTemplateVolumePlan[]
  onChange: (next: PeriodizationTemplateVolumePlan[]) => void
}

export function PeriodiseringMalVolumeSection({
  durationDays, startDate, volumePlans, onChange,
}: Props) {
  const totalMonths = Math.max(1, Math.ceil(durationDays / 30))

  // Map current plans by month_offset for quick lookup.
  const byOffset = useMemo(() => {
    const m = new Map<number, PeriodizationTemplateVolumePlan>()
    for (const p of volumePlans) m.set(p.month_offset, p)
    return m
  }, [volumePlans])

  const updateMonth = (offset: number, patch: Partial<Omit<PeriodizationTemplateVolumePlan, 'month_offset'>>) => {
    const existing = byOffset.get(offset) ?? {
      month_offset: offset,
      planned_hours: null,
      planned_km: null,
      notes: null,
    }
    const next: PeriodizationTemplateVolumePlan = { ...existing, ...patch, month_offset: offset }
    const isEmpty = next.planned_hours === null && next.planned_km === null && !next.notes?.trim()
    const filtered = volumePlans.filter(p => p.month_offset !== offset)
    if (isEmpty) {
      onChange(filtered.sort((a, b) => a.month_offset - b.month_offset))
      return
    }
    onChange([...filtered, next].sort((a, b) => a.month_offset - b.month_offset))
  }

  const labelFor = (offset: number) => {
    if (!startDate) return `Måned ${offset + 1}`
    // Adder hele måneder fra startDate så hver iterasjon treffer riktig kalendermåned.
    const target = addMonths(startDate, offset)
    return `Måned ${offset + 1} (${formatNorskMaaned(target)})`
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: totalMonths }, (_, i) => {
        const plan = byOffset.get(i)
        return (
          <div key={i} className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2"
            style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
            <div className="md:col-span-1">
              <p className="text-[10px] tracking-widest uppercase mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                {labelFor(i)}
              </p>
              <p className="text-[10px]"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {plan ? 'Planlagt' : 'Ingen plan'}
              </p>
            </div>
            <NumField label="Timer"
              value={plan?.planned_hours ?? null}
              onChange={v => updateMonth(i, { planned_hours: v })} />
            <NumField label="km"
              value={plan?.planned_km ?? null}
              onChange={v => updateMonth(i, { planned_km: v })} />
            <div>
              <label className="block mb-1 text-[10px] tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Notat
              </label>
              <input
                value={plan?.notes ?? ''}
                onChange={e => updateMonth(i, { notes: e.target.value || null })}
                style={iSt}
                placeholder="…"
              />
            </div>
          </div>
        )
      })}
      <p className="text-[11px]"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Tomme måneder lagres ikke. La stå tom om du ikke vil sette volum-mål.
      </p>
    </div>
  )
}

function NumField({
  label, value, onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div>
      <label className="block mb-1 text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      <input
        type="number"
        min={0}
        step="0.1"
        value={value ?? ''}
        onChange={e => {
          const v = e.target.value
          if (v === '') { onChange(null); return }
          const n = parseFloat(v)
          onChange(Number.isFinite(n) && n >= 0 ? n : null)
        }}
        style={iSt}
      />
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}
