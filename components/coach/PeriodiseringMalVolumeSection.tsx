'use client'

import { useMemo, useState } from 'react'
import type { PeriodizationTemplateVolumePlan } from '@/lib/template-types'
import { addMonths, formatNorskMaaned } from '@/lib/template-dates'
import { parseDecimal } from '@/lib/parse-decimal'

const COACH_BLUE = '#1A6FD4'

// Del E/F: valgfri sone-nedbryting i malen — samme grupper og hellige
// farger som utøverens månedsvolum.
const ZONE_GROUPED: { key: string; color: string }[] = [
  { key: 'I1-2', color: '#28A86E' },
  { key: 'I3',   color: '#E8B93C' },
  { key: 'I4-5', color: '#E23A5A' },
]
const ZONE_DETAILED: { key: string; color: string }[] = [
  { key: 'I1', color: '#28A86E' },
  { key: 'I2', color: '#1A6FD4' },
  { key: 'I3', color: '#E8B93C' },
  { key: 'I4', color: '#FF8C00' },
  { key: 'I5', color: '#E23A5A' },
]

function hasBreakdown(p: PeriodizationTemplateVolumePlan): boolean {
  return (p.zone_hours != null && Object.keys(p.zone_hours).length > 0)
    || (p.movement_hours != null && Object.keys(p.movement_hours).length > 0)
}

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
    // Del E/F: måneden beholdes så lenge den har fordeling, selv uten totaler.
    const isEmpty = next.planned_hours === null && next.planned_km === null
      && !next.notes?.trim() && !hasBreakdown(next)
    const filtered = volumePlans.filter(p => p.month_offset !== offset)
    if (isEmpty) {
      onChange(filtered.sort((a, b) => a.month_offset - b.month_offset))
      return
    }
    onChange([...filtered, next].sort((a, b) => a.month_offset - b.month_offset))
  }

  const labelFor = (offset: number) => {
    if (!startDate) return `Måned ${offset + 1}`
    return formatNorskMaaned(addMonths(startDate, offset))
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: totalMonths }, (_, i) => {
        const plan = byOffset.get(i)
        return (
          <div key={i} className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
            <div className="md:col-span-1">
              <p className="text-xs tracking-widest uppercase mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                {labelFor(i)}
              </p>
              <p className="text-xs"
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
              <label className="block mb-1 text-xs tracking-widest uppercase"
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
            {/* Del E/F: valgfri nedbryting per måned — følger med ved push. */}
            <div className="col-span-2 md:col-span-4">
              <MalVolumeBreakdown
                key={`bd-${i}`}
                plan={plan ?? null}
                plannedHours={plan?.planned_hours ?? null}
                onPatch={patch => updateMonth(i, patch)}
              />
            </div>
          </div>
        )
      })}
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Tomme måneder lagres ikke. La stå tom om du ikke vil sette volum-mål.
      </p>
    </div>
  )
}

// Del E/F: kompakt fordeling-editor for én mal-måned. Skriver rene
// tall-records ({etikett: timer}) rett på volum-planen; tomme felt
// fjernes. Myk validering «fordelt X av Y t» — aldri blokkerende.
function MalVolumeBreakdown({
  plan, plannedHours, onPatch,
}: {
  plan: PeriodizationTemplateVolumePlan | null
  plannedHours: number | null
  onPatch: (patch: Partial<Omit<PeriodizationTemplateVolumePlan, 'month_offset'>>) => void
}) {
  const zh = plan?.zone_hours ?? null
  const mh = plan?.movement_hours ?? null
  const [open, setOpen] = useState(false)
  const [zoneMode, setZoneMode] = useState<'gruppert' | 'detaljert'>(
    zh && ZONE_DETAILED.some(z => z.key !== 'I3' && zh[z.key] != null) ? 'detaljert' : 'gruppert')
  const zoneKeys = zoneMode === 'gruppert' ? ZONE_GROUPED : ZONE_DETAILED

  const setZone = (key: string, raw: string) => {
    const next: Record<string, number> = { ...(zh ?? {}) }
    const n = raw === '' ? NaN : parseDecimal(raw)
    if (Number.isFinite(n) && n > 0) next[key] = n
    else delete next[key]
    onPatch({ zone_hours: Object.keys(next).length > 0 ? next : null })
  }
  const movEntries = Object.entries(mh ?? {})
  const setMov = (entries: [string, number][]) => {
    const rec: Record<string, number> = {}
    for (const [k, v] of entries) if (k.trim() && Number.isFinite(v) && v > 0) rec[k.trim()] = v
    onPatch({ movement_hours: Object.keys(rec).length > 0 ? rec : null })
  }

  const zoneSum = Object.values(zh ?? {}).reduce((s, n) => s + n, 0)
  const movSum = Object.values(mh ?? {}).reduce((s, n) => s + n, 0)
  const fmtN = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 })
  const softColor = (sum: number) =>
    plannedHours != null && sum > plannedHours ? '#FF8C00' : '#555560'

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}
        className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.06em' }}>
        {open ? '▾' : '▸'} Fordeling
        {!open && (zoneSum > 0 || movSum > 0) && (
          <span style={{ color: '#555560' }}>
            {zoneSum > 0 ? ` · soner ${fmtN(zoneSum)} t` : ''}
            {movSum > 0 ? ` · bev.form ${fmtN(movSum)} t` : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(['gruppert', 'detaljert'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => {
                  if (zoneMode === m) return
                  setZoneMode(m)
                  onPatch({ zone_hours: null })
                }}
                className="text-xs px-2 py-0.5"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: zoneMode === m ? '#F0F0F2' : '#555560',
                  background: zoneMode === m ? '#1A1A22' : 'none',
                  border: `1px solid ${zoneMode === m ? '#2A2A32' : '#1E1E22'}`,
                  cursor: 'pointer',
                }}>
                {m === 'gruppert' ? 'I1–2 / I3 / I4–5' : 'I1…I5'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {zoneKeys.map(z => (
              <div key={z.key} style={{ width: 74 }}>
                <label className="block mb-1 text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: z.color }}>
                  {z.key}
                </label>
                <input
                  type="number" min={0} step="0.5"
                  value={zh?.[z.key] ?? ''}
                  onChange={e => setZone(z.key, e.target.value)}
                  placeholder="t" style={iSt} />
              </div>
            ))}
          </div>
          {zoneSum > 0 && plannedHours != null && (
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: softColor(zoneSum) }}>
              Soner: fordelt {fmtN(zoneSum)} av {fmtN(plannedHours)} t
            </p>
          )}
          <div className="space-y-1">
            {movEntries.map(([mName, mVal], i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={mName}
                  onChange={e => setMov(movEntries.map((x, xi) => xi === i ? [e.target.value, x[1]] : x))}
                  placeholder="Bevegelsesform" style={{ ...iSt, maxWidth: 220 }} />
                <input type="number" min={0} step="0.5" value={mVal}
                  onChange={e => {
                    const n = parseDecimal(e.target.value)
                    setMov(movEntries.map((x, xi) => xi === i ? [x[0], Number.isFinite(n) ? n : 0] : x))
                  }}
                  placeholder="t" style={{ ...iSt, width: 72 }} />
                <button type="button" aria-label="Fjern"
                  onClick={() => setMov(movEntries.filter((_, xi) => xi !== i))}
                  style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button"
              onClick={() => onPatch({ movement_hours: { ...(mh ?? {}), 'Ny bevegelsesform': 1 } })}
              className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: '1px dashed #1E1E22', padding: '3px 8px', cursor: 'pointer' }}>
              + Bevegelsesform
            </button>
            {movSum > 0 && plannedHours != null && (
              <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: softColor(movSum) }}>
                Bev.form: fordelt {fmtN(movSum)} av {fmtN(plannedHours)} t
              </p>
            )}
          </div>
        </div>
      )}
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
      <label className="block mb-1 text-xs tracking-widest uppercase"
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
          const n = parseDecimal(v)
          onChange(Number.isFinite(n) && n >= 0 ? n : null)
        }}
        style={iSt}
      />
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}
