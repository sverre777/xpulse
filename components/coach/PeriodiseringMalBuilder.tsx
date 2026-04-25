'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  savePeriodizationTemplate, updatePeriodizationTemplate,
} from '@/app/actions/periodization-templates'
import type {
  PeriodizationTemplate, PeriodizationTemplateData,
  PeriodizationTemplateKeyDate, PeriodizationTemplatePeriod,
} from '@/lib/template-types'
import { SPORTS, type Sport, PERIOD_SPORT_CATEGORIES, sportToCategory } from '@/lib/types'
import { confirmDiscardIfDirty, useBeforeUnloadGuard } from '@/lib/dirty-guard'

const COACH_BLUE = '#1A6FD4'
const GOLD = '#D4A017'

const PHASE_TYPES: { value: string; label: string }[] = [
  { value: 'base',        label: 'Grunntrening' },
  { value: 'specific',    label: 'Spesifikk' },
  { value: 'competition', label: 'Konkurranse' },
  { value: 'recovery',    label: 'Restitusjon' },
  { value: '',            label: 'Annet' },
]

const INTENSITIES: { value: string; label: string }[] = [
  { value: 'rolig',  label: 'Rolig' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard' },
]

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'competition_a', label: 'A-konkurranse' },
  { value: 'competition_b', label: 'B-konkurranse' },
  { value: 'competition_c', label: 'C-konkurranse' },
  { value: 'test',          label: 'Testløp' },
  { value: 'camp',          label: 'Samling' },
  { value: 'other',         label: 'Annet' },
]

const PRIORITIES: { value: string; label: string }[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
]

interface Props {
  editing?: PeriodizationTemplate | null
  defaultSport?: Sport
  onClose: () => void
}

const EMPTY_DATA: PeriodizationTemplateData = {
  season: { name: '', goal_main: null, goal_secondary: null, sport: null, kpi_notes: null },
  periods: [],
  key_dates: [],
}

export function PeriodiseringMalBuilder({ editing, defaultSport, onClose }: Props) {
  const router = useRouter()
  const defaultCat = editing?.category
    ?? (defaultSport ? sportToCategory(defaultSport) : 'Løping')
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [category, setCategory] = useState<string>(defaultCat)
  const [durationDays, setDurationDays] = useState<number>(editing?.duration_days ?? 210)
  const [data, setData] = useState<PeriodizationTemplateData>(() => {
    if (!editing?.periodization_data) return EMPTY_DATA
    const pd = editing.periodization_data
    return {
      ...pd,
      season: {
        name: pd.season?.name ?? '',
        goal_main: pd.season?.goal_main ?? null,
        goal_secondary: pd.season?.goal_secondary ?? null,
        sport: pd.season?.sport ?? null,
        kpi_notes: pd.season?.kpi_notes ?? null,
      },
    }
  })
  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [initialSnapshot] = useState<string>(() => JSON.stringify({
    name: editing?.name ?? '',
    description: editing?.description ?? '',
    category: defaultCat,
    durationDays: editing?.duration_days ?? 210,
    data: editing?.periodization_data ?? EMPTY_DATA,
  }))
  const dirty = useMemo(
    () => JSON.stringify({ name, description, category, durationDays, data }) !== initialSnapshot,
    [name, description, category, durationDays, data, initialSnapshot],
  )

  const requestClose = useCallback(() => {
    if (!confirmDiscardIfDirty(dirty)) return
    onClose()
  }, [dirty, onClose])

  useBeforeUnloadGuard(dirty)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [requestClose])

  const totalWeeks = Math.ceil(durationDays / 7)

  const updateSeason = (patch: Partial<PeriodizationTemplateData['season']>) => {
    setData(d => ({ ...d, season: { ...d.season, ...patch } }))
  }

  const addPeriod = () => {
    setData(d => ({
      ...d,
      periods: [...d.periods, {
        start_offset: 0,
        end_offset: Math.min(durationDays - 1, 13),
        name: 'Ny periode',
        phase_type: 'base',
        intensity: 'medium',
        notes: null,
        sort_order: d.periods.length,
      }],
    }))
  }
  const updatePeriod = (i: number, patch: Partial<PeriodizationTemplatePeriod>) => {
    setData(d => {
      const next = d.periods.slice()
      next[i] = { ...next[i], ...patch }
      return { ...d, periods: next }
    })
  }
  const removePeriod = (i: number) => {
    setData(d => ({ ...d, periods: d.periods.filter((_, idx) => idx !== i) }))
  }

  const addKeyDate = () => {
    setData(d => ({
      ...d,
      key_dates: [...d.key_dates, {
        day_offset: 0,
        title: 'Ny hendelse',
        date_type: 'competition_a',
        priority: 'a',
        sport: null,
        notes: null,
        is_peak_target: false,
        location: null,
        distance_format: null,
      }],
    }))
  }
  const updateKeyDate = (i: number, patch: Partial<PeriodizationTemplateKeyDate>) => {
    setData(d => {
      const next = d.key_dates.slice()
      next[i] = { ...next[i], ...patch }
      return { ...d, key_dates: next }
    })
  }
  const removeKeyDate = (i: number) => {
    setData(d => ({ ...d, key_dates: d.key_dates.filter((_, idx) => idx !== i) }))
  }

  const handleSave = () => {
    if (!name.trim()) { setErr('Navn er påkrevd'); return }
    if (durationDays < 1) { setErr('Varighet må være minst én dag'); return }
    for (const p of data.periods) {
      if (p.end_offset < p.start_offset) {
        setErr(`Periode "${p.name}" har sluttdag før startdag`); return
      }
      if (p.start_offset < 0 || p.end_offset >= durationDays) {
        setErr(`Periode "${p.name}" er utenfor varigheten`); return
      }
    }
    for (const k of data.key_dates) {
      if (k.day_offset < 0 || k.day_offset >= durationDays) {
        setErr(`Hendelse "${k.title}" er utenfor varigheten`); return
      }
    }
    setErr(null)

    const payload: PeriodizationTemplateData = {
      season: {
        ...data.season,
        name: data.season.name || name.trim(),
      },
      periods: data.periods
        .slice()
        .sort((a, b) => a.start_offset - b.start_offset)
        .map((p, i) => ({ ...p, sort_order: i })),
      key_dates: data.key_dates.slice().sort((a, b) => a.day_offset - b.day_offset),
    }

    startTransition(async () => {
      if (editing) {
        const res = await updatePeriodizationTemplate(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          category,
          duration_days: durationDays,
          periodization_data: payload,
        })
        if (res.error) { setErr(res.error); return }
      } else {
        const res = await savePeriodizationTemplate({
          name: name.trim(),
          description: description.trim() || null,
          category,
          duration_days: durationDays,
          periodization_data: payload,
        })
        if (res.error) { setErr(res.error); return }
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      onClick={requestClose}
      className="px-2 md:px-3"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 90, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12px', paddingBottom: '12px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '960px', width: '100%',
          margin: '0 auto', marginBottom: '24px',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <span className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
            {editing ? 'Rediger årsplan-mal' : 'Ny årsplan-mal'}
          </span>
          <button type="button" onClick={requestClose} aria-label="Lukk"
            style={{
              color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 28, lineHeight: 1, padding: 0,
              minHeight: '44px', minWidth: '44px',
            }}>
            ×
          </button>
        </div>

        <div className="p-4 md:p-5 flex flex-col gap-6">
          {err && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                border: '1px solid #E11D48',
              }}>
              {err}
            </p>
          )}

          <section>
            <SectionTitle>Malinfo</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Navn">
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="F.eks. 30-ukers langrennsesong"
                  style={iSt} />
              </Field>
              <Field label="Sport-kategori">
                <select value={category} onChange={e => setCategory(e.target.value)} style={iSt}>
                  {PERIOD_SPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Beskrivelse">
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={2} style={iSt} />
              </Field>
              <Field label="Varighet (dager)">
                <input type="number" min={1} max={730}
                  value={durationDays}
                  onChange={e => setDurationDays(parseInt(e.target.value) || 1)}
                  style={iSt} />
                <p className="text-[10px] mt-1 tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  ≈ {totalWeeks} uker
                </p>
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Sesong-info</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Sesongnavn">
                <input
                  value={data.season.name}
                  onChange={e => updateSeason({ name: e.target.value })}
                  placeholder="Samme som mal-navn hvis tomt"
                  style={iSt} />
              </Field>
              <Field label="Hovedmål">
                <input
                  value={data.season.goal_main ?? ''}
                  onChange={e => updateSeason({ goal_main: e.target.value || null })}
                  placeholder="F.eks. Topp form til NM"
                  style={iSt} />
              </Field>
              <Field label="Delmål">
                <textarea
                  value={data.season.goal_secondary ?? ''}
                  onChange={e => updateSeason({ goal_secondary: e.target.value || null })}
                  rows={2}
                  style={{ ...iSt, resize: 'vertical' }} />
              </Field>
              <Field label="Sesong-sport (valgfri)">
                <select
                  value={data.season.sport ?? ''}
                  onChange={e => updateSeason({ sport: (e.target.value || null) as string | null })}
                  style={iSt}>
                  <option value="">—</option>
                  {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="KPI-notater (valgfri)">
                  <textarea
                    value={data.season.kpi_notes ?? ''}
                    onChange={e => updateSeason({ kpi_notes: e.target.value || null })}
                    rows={2}
                    placeholder="VO2max 72, 100 km/uke i base, …"
                    style={{ ...iSt, resize: 'vertical' }} />
                </Field>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle compact>Perioder</SectionTitle>
              <BtnSm onClick={addPeriod}>+ Ny periode</BtnSm>
            </div>
            {data.periods.length === 0 ? (
              <EmptyHint>Ingen perioder ennå.</EmptyHint>
            ) : (
              <div className="flex flex-col gap-2">
                {data.periods.map((p, i) => (
                  <PeriodRow
                    key={i}
                    period={p}
                    max={durationDays - 1}
                    onChange={(patch) => updatePeriod(i, patch)}
                    onRemove={() => removePeriod(i)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle compact>Nøkkel-datoer / konkurranser</SectionTitle>
              <BtnSm onClick={addKeyDate}>+ Ny hendelse</BtnSm>
            </div>
            {data.key_dates.length === 0 ? (
              <EmptyHint>Ingen nøkkel-datoer ennå.</EmptyHint>
            ) : (
              <div className="flex flex-col gap-2">
                {data.key_dates.map((k, i) => (
                  <KeyDateRow
                    key={i}
                    keyDate={k}
                    max={durationDays - 1}
                    onChange={(patch) => updateKeyDate(i, patch)}
                    onRemove={() => removeKeyDate(i)}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
            <button type="button" onClick={requestClose}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #222228', cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="button" onClick={handleSave} disabled={isPending}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: COACH_BLUE, color: '#F0F0F2',
                border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}>
              {isPending ? 'Lagrer…' : (editing ? 'Lagre endringer' : 'Lagre mal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PeriodRow({
  period, max, onChange, onRemove,
}: {
  period: PeriodizationTemplatePeriod
  max: number
  onChange: (patch: Partial<PeriodizationTemplatePeriod>) => void
  onRemove: () => void
}) {
  const startLabel = offsetToWeekDayLabel(period.start_offset)
  const endLabel = offsetToWeekDayLabel(period.end_offset)
  return (
    <div className="p-3 flex flex-col gap-2"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="Navn">
          <input value={period.name}
            onChange={e => onChange({ name: e.target.value })}
            style={iSt} />
        </Field>
        <Field label="Fase">
          <select value={period.phase_type}
            onChange={e => onChange({ phase_type: e.target.value })}
            style={iSt}>
            {PHASE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label={`Startdag (${startLabel})`}>
          <input type="number" min={0} max={max} value={period.start_offset}
            onChange={e => onChange({ start_offset: parseInt(e.target.value) || 0 })}
            style={iSt} />
        </Field>
        <Field label={`Sluttdag (${endLabel})`}>
          <input type="number" min={0} max={max} value={period.end_offset}
            onChange={e => onChange({ end_offset: parseInt(e.target.value) || 0 })}
            style={iSt} />
        </Field>
        <Field label="Belastning">
          <select value={period.intensity}
            onChange={e => onChange({ intensity: e.target.value })}
            style={iSt}>
            {INTENSITIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </Field>
        <Field label="Notat">
          <input value={period.notes ?? ''}
            onChange={e => onChange({ notes: e.target.value || null })}
            style={iSt} />
        </Field>
      </div>
      <div className="flex justify-end">
        <BtnSm onClick={onRemove} danger>Fjern periode</BtnSm>
      </div>
    </div>
  )
}

function KeyDateRow({
  keyDate, max, onChange, onRemove,
}: {
  keyDate: PeriodizationTemplateKeyDate
  max: number
  onChange: (patch: Partial<PeriodizationTemplateKeyDate>) => void
  onRemove: () => void
}) {
  const dayLabel = offsetToWeekDayLabel(keyDate.day_offset)
  return (
    <div className="p-3 flex flex-col gap-2"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="Tittel">
          <input value={keyDate.title}
            onChange={e => onChange({ title: e.target.value })}
            style={iSt} />
        </Field>
        <Field label={`Dag (${dayLabel})`}>
          <input type="number" min={0} max={max} value={keyDate.day_offset}
            onChange={e => onChange({ day_offset: parseInt(e.target.value) || 0 })}
            style={iSt} />
        </Field>
        <Field label="Type">
          <select value={keyDate.date_type}
            onChange={e => onChange({ date_type: e.target.value })}
            style={iSt}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Prioritet">
          <select value={keyDate.priority}
            onChange={e => onChange({ priority: e.target.value })}
            style={iSt}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Sport">
          <select value={keyDate.sport ?? ''}
            onChange={e => onChange({ sport: e.target.value || null })}
            style={iSt}>
            <option value="">—</option>
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Sted (valgfri)">
          <input value={keyDate.location ?? ''}
            onChange={e => onChange({ location: e.target.value || null })}
            style={iSt} />
        </Field>
        <Field label="Distanse/format (valgfri)">
          <input value={keyDate.distance_format ?? ''}
            placeholder="10 km, sprint, …"
            onChange={e => onChange({ distance_format: e.target.value || null })}
            style={iSt} />
        </Field>
        <Field label="Notat">
          <input value={keyDate.notes ?? ''}
            onChange={e => onChange({ notes: e.target.value || null })}
            style={iSt} />
        </Field>
      </div>
      <label className="flex items-start gap-2 cursor-pointer mt-1">
        <input type="checkbox" checked={!!keyDate.is_peak_target}
          onChange={e => onChange({ is_peak_target: e.target.checked })}
          style={{ marginTop: '3px', accentColor: GOLD }} />
        <span>
          <span className="block text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
            Form-topp-mål
          </span>
          <span className="block text-[11px]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Markér som peiling for toppform. Gir gull-glød i utøverens kalender.
          </span>
        </span>
      </label>
      <div className="flex justify-end">
        <BtnSm onClick={onRemove} danger>Fjern hendelse</BtnSm>
      </div>
    </div>
  )
}

function SectionTitle({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <h3 className={compact ? 'text-xs tracking-widest uppercase' : 'text-xs tracking-widest uppercase mb-3'}
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {children}
    </h3>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-4 text-xs text-center"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
        border: '1px dashed #1E1E22',
      }}>
      {children}
    </p>
  )
}

function BtnSm({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1 text-[11px] tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: danger ? '#FF4500' : '#8A8A96',
        background: 'none', border: `1px solid ${danger ? '#FF450066' : '#222228'}`,
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function offsetToWeekDayLabel(offset: number): string {
  const week = Math.floor(offset / 7) + 1
  const day = (offset % 7) + 1
  return `Uke ${week}, dag ${day}`
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
