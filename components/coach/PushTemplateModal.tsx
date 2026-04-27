'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { SPORTS, WORKOUT_TYPES_BIATHLON } from '@/lib/types'
import type { Sport, WorkoutType } from '@/lib/types'
import {
  pushWorkoutToAthlete,
  pushCompetitionToAthlete,
  pushPlanTemplateToAthlete,
  pushPeriodizationTemplateToAthlete,
  listCoachPlanTemplates,
  listCoachPeriodizationTemplates,
  getPlanTemplateForPush,
  type CoachOwnTemplateSummary,
  type PlanTemplatePushPreview,
} from '@/app/actions/coach-push'
import { addDays, formatNorskKortDato } from '@/lib/template-dates'

const COACH_BLUE = '#1A6FD4'

type Tab = 'okt' | 'konkurranse' | 'plan' | 'periodisering'

interface Props {
  athleteId: string
  athleteName: string
  canEditPlan: boolean
  canEditPeriodization: boolean
  defaultSport: Sport
  returnHref: string
}

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function PushTemplateModal({
  athleteId, athleteName, canEditPlan, canEditPeriodization, defaultSport, returnHref,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(canEditPlan ? 'okt' : (canEditPeriodization ? 'periodisering' : 'okt'))
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  const close = () => router.push(returnHref)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px',
          backgroundColor: '#13131A', border: '1px solid #1E1E22',
        }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1E1E22' }}
        >
          <div>
            <div className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
              Push til utøver
            </div>
            <div
              className="text-lg"
              style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
            >
              {athleteName}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-xs tracking-widest uppercase px-2 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96', background: 'transparent', border: '1px solid #1E1E22',
              cursor: 'pointer',
            }}
          >
            Lukk
          </button>
        </div>

        <div className="flex items-center" style={{ borderBottom: '1px solid #1E1E22' }}>
          <TabButton label="Økt"           active={tab === 'okt'}          onClick={() => setTab('okt')} disabled={!canEditPlan} />
          <TabButton label="Konkurranse"   active={tab === 'konkurranse'}  onClick={() => setTab('konkurranse')} disabled={!canEditPlan} />
          <TabButton label="Plan-mal"      active={tab === 'plan'}         onClick={() => setTab('plan')} disabled={!canEditPlan} />
          <TabButton label="Årsplan" active={tab === 'periodisering'} onClick={() => setTab('periodisering')} disabled={!canEditPeriodization} />
        </div>

        <div className="p-5">
          {feedback && (
            <p
              className="mb-3 text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: feedback.kind === 'ok' ? '#28A86E' : '#E11D48',
                border: `1px solid ${feedback.kind === 'ok' ? '#28A86E' : '#E11D48'}`,
              }}
            >
              {feedback.message}
            </p>
          )}

          {tab === 'okt' && (
            <WorkoutPushForm
              athleteId={athleteId}
              defaultSport={defaultSport}
              isPending={isPending}
              startTransition={startTransition}
              onDone={msg => { setFeedback({ kind: 'ok', message: msg }); router.refresh() }}
              onError={msg => setFeedback({ kind: 'err', message: msg })}
            />
          )}
          {tab === 'konkurranse' && (
            <CompetitionPushForm
              athleteId={athleteId}
              defaultSport={defaultSport}
              isPending={isPending}
              startTransition={startTransition}
              onDone={msg => { setFeedback({ kind: 'ok', message: msg }); router.refresh() }}
              onError={msg => setFeedback({ kind: 'err', message: msg })}
            />
          )}
          {tab === 'plan' && (
            <PlanTemplatePushForm
              athleteId={athleteId}
              isPending={isPending}
              startTransition={startTransition}
              onDone={msg => { setFeedback({ kind: 'ok', message: msg }); router.refresh() }}
              onError={msg => setFeedback({ kind: 'err', message: msg })}
            />
          )}
          {tab === 'periodisering' && (
            <PeriodizationTemplatePushForm
              athleteId={athleteId}
              isPending={isPending}
              startTransition={startTransition}
              onDone={msg => { setFeedback({ kind: 'ok', message: msg }); router.refresh() }}
              onError={msg => setFeedback({ kind: 'err', message: msg })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick, disabled }: {
  label: string; active: boolean; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 px-3 py-2 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: disabled ? '#3A3A42' : (active ? '#F0F0F2' : '#8A8A96'),
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: active ? `2px solid ${COACH_BLUE}` : '2px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function inputStyle(): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif",
    backgroundColor: '#1A1A22',
    color: '#F0F0F2',
    border: '1px solid #1E1E22',
    padding: '6px 8px',
    width: '100%',
    outline: 'none',
  }
}
function labelStyle(): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif",
    color: '#8A8A96',
    fontSize: '13px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '4px',
  }
}

function PrimaryButton({
  label, onClick, disabled,
}: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: COACH_BLUE, color: '#F0F0F2',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

interface CommonFormProps {
  athleteId: string
  isPending: boolean
  startTransition: (cb: () => void | Promise<void>) => void
  onDone: (msg: string) => void
  onError: (msg: string) => void
}

function WorkoutPushForm({
  athleteId, isPending, startTransition, onDone, onError, defaultSport,
}: CommonFormProps & { defaultSport: Sport }) {
  const [date, setDate] = useState(todayIso())
  const [title, setTitle] = useState('')
  const [sport, setSport] = useState<Sport>(defaultSport)
  const [workoutType, setWorkoutType] = useState<WorkoutType>('easy')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [distanceKm, setDistanceKm] = useState('')

  const submit = () => {
    if (!title.trim()) { onError('Tittel er påkrevd'); return }
    startTransition(async () => {
      const res = await pushWorkoutToAthlete({
        athleteId, date, title: title.trim(), sport, workoutType,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        distanceKm: distanceKm ? parseFloat(distanceKm) : null,
      })
      if (res.error) { onError(res.error); return }
      onDone(`Økt sendt til utøver (${date})`)
      setTitle(''); setDurationMinutes(''); setDistanceKm('')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle()}>Dato</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
        </div>
        <div>
          <label style={labelStyle()}>Idrett</label>
          <select value={sport} onChange={e => setSport(e.target.value as Sport)} style={inputStyle()}>
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle()}>Tittel</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()}
          placeholder="f.eks. Intervall 4×4min" />
      </div>
      <div>
        <label style={labelStyle()}>Økttype</label>
        <select value={workoutType} onChange={e => setWorkoutType(e.target.value as WorkoutType)} style={inputStyle()}>
          {WORKOUT_TYPES_BIATHLON.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle()}>Varighet (min)</label>
          <input type="number" min="0" value={durationMinutes}
            onChange={e => setDurationMinutes(e.target.value)} style={inputStyle()} />
        </div>
        <div>
          <label style={labelStyle()}>Distanse (km)</label>
          <input type="number" min="0" step="0.1" value={distanceKm}
            onChange={e => setDistanceKm(e.target.value)} style={inputStyle()} />
        </div>
      </div>
      <div className="flex justify-end mt-2">
        <PrimaryButton label={isPending ? 'Sender…' : 'Push økt'} onClick={submit} disabled={isPending} />
      </div>
    </div>
  )
}

function CompetitionPushForm({
  athleteId, isPending, startTransition, onDone, onError, defaultSport,
}: CommonFormProps & { defaultSport: Sport }) {
  const [date, setDate] = useState(todayIso())
  const [title, setTitle] = useState('')
  const [sport, setSport] = useState<Sport>(defaultSport)
  const [priorityA, setPriorityA] = useState(false)

  const submit = () => {
    if (!title.trim()) { onError('Tittel er påkrevd'); return }
    startTransition(async () => {
      const res = await pushCompetitionToAthlete({
        athleteId, date, title: title.trim(), sport, priorityA,
      })
      if (res.error) { onError(res.error); return }
      onDone(`Konkurranse sendt til utøver (${date})`)
      setTitle(''); setPriorityA(false)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle()}>Dato</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
        </div>
        <div>
          <label style={labelStyle()}>Idrett</label>
          <select value={sport} onChange={e => setSport(e.target.value as Sport)} style={inputStyle()}>
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle()}>Tittel</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()}
          placeholder="f.eks. NM sprint" />
      </div>
      <label className="flex items-center gap-2 mt-1" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={priorityA} onChange={e => setPriorityA(e.target.checked)} />
        <span className="text-xs tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          A-mål (viktig konkurranse)
        </span>
      </label>
      <div className="flex justify-end mt-2">
        <PrimaryButton label={isPending ? 'Sender…' : 'Push konkurranse'} onClick={submit} disabled={isPending} />
      </div>
    </div>
  )
}

function useTemplateList(
  load: () => Promise<CoachOwnTemplateSummary[] | { error: string }>,
) {
  const [list, setList] = useState<CoachOwnTemplateSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await load()
      if (!alive) return
      if ('error' in res) setLoadError(res.error)
      else setList(res)
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { list, loadError }
}

function PlanTemplatePushForm({ athleteId, isPending, startTransition, onDone, onError }: CommonFormProps) {
  const { list, loadError } = useTemplateList(listCoachPlanTemplates)
  const [templateId, setTemplateId] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [preview, setPreview] = useState<PlanTemplatePushPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  // Hold cache av endrede datoer per indeks. Tomt felt = bruk beregnet dato.
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [showDateTable, setShowDateTable] = useState(false)

  useEffect(() => {
    if (list && list.length > 0 && !templateId) setTemplateId(list[0].id)
  }, [list, templateId])

  // Last preview når valgt mal endres. Reset overrides og start-modus.
  useEffect(() => {
    if (!templateId) return
    let alive = true
    setPreview(null); setPreviewError(null); setOverrides({})
    ;(async () => {
      const res = await getPlanTemplateForPush(templateId)
      if (!alive) return
      if ('error' in res) { setPreviewError(res.error); return }
      setPreview(res)
      // Hvis malen har lagret startdato, default til den (trener kan overstyre).
      if (res.startDate) setStartDate(res.startDate)
    })()
    return () => { alive = false }
  }, [templateId])

  if (loadError) {
    return <p className="text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>{loadError}</p>
  }
  if (list === null) {
    return <p className="text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>Laster maler…</p>
  }
  if (list.length === 0) {
    return (
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Ingen plan-maler ennå. Lag maler fra ditt eget Plan-tab for å kunne pushe dem til utøvere.
      </p>
    )
  }

  const usingOriginalStart = !!(preview?.startDate && startDate === preview.startDate)
  const computedDateForWorkout = (dayOffset: number) => addDays(startDate, dayOffset)

  const submit = () => {
    if (!templateId) { onError('Velg en mal'); return }
    if (!startDate) { onError('Startdato er påkrevd'); return }
    startTransition(async () => {
      const res = await pushPlanTemplateToAthlete({
        athleteId, templateId, startDate,
        workoutDateOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      })
      if (res.error) { onError(res.error); return }
      const r = res.report
      const skippedTotal = (r?.skippedDayStates ?? 0) + (r?.skippedPeriodNotes ?? 0) + (r?.skippedFocusPoints ?? 0)
      const skipNote = skippedTotal > 0 ? ` · ${skippedTotal} eksisterende beholdt` : ''
      onDone(`Plan sendt (${r?.createdCount ?? 0} økter fra ${startDate})${skipNote}`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label style={labelStyle()}>Mal</label>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={inputStyle()}>
          {list.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.durationDays ? ` (${t.durationDays} dager)` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle()}>Startdato</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle()} />
        {preview?.startDate && (
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => setStartDate(preview.startDate ?? startDate)}
              disabled={usingOriginalStart}
              className="text-xs tracking-widest uppercase px-2 py-1"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: usingOriginalStart ? '#8A8A96' : COACH_BLUE,
                background: 'transparent',
                border: `1px solid ${usingOriginalStart ? '#1E1E22' : COACH_BLUE}`,
                cursor: usingOriginalStart ? 'default' : 'pointer',
              }}
            >
              {usingOriginalStart ? `Bruker malens dato (${preview.startDate})` : `Bruk malens dato (${preview.startDate})`}
            </button>
          </div>
        )}
      </div>

      {previewError && (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {previewError}
        </p>
      )}

      {preview && preview.workouts.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDateTable(s => !s)}
            className="text-xs tracking-widest uppercase px-2 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96', background: 'transparent', border: '1px solid #1E1E22',
              cursor: 'pointer',
            }}
          >
            {showDateTable ? `Skjul dato-tabell (${preview.workouts.length})` : `Juster datoer per økt (${preview.workouts.length})`}
          </button>
          {showDateTable && (
            <div className="mt-2"
              style={{
                border: '1px solid #1E1E22', maxHeight: '260px', overflowY: 'auto',
              }}>
              <table className="w-full text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                <thead style={{ backgroundColor: '#1A1A22' }}>
                  <tr>
                    <Th>Økt</Th>
                    <Th>Original dag</Th>
                    <Th>Beregnet</Th>
                    <Th>Bruk</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.workouts.map(w => {
                    const computed = computedDateForWorkout(w.dayOffset)
                    const value = overrides[w.index] ?? computed
                    const isOverride = !!overrides[w.index] && overrides[w.index] !== computed
                    return (
                      <tr key={w.index} style={{ borderTop: '1px solid #1E1E22' }}>
                        <Td>
                          <span className="block truncate" style={{ maxWidth: '160px' }}>
                            {w.title}
                          </span>
                          <span className="text-xs" style={{ color: '#555560' }}>
                            {w.sport} · {w.workoutType}
                          </span>
                        </Td>
                        <Td><span style={{ color: '#8A8A96' }}>Dag {w.dayOffset + 1}</span></Td>
                        <Td>
                          <span style={{ color: isOverride ? '#8A8A96' : '#F0F0F2' }}>
                            {formatNorskKortDato(computed)}
                          </span>
                        </Td>
                        <Td>
                          <input
                            type="date"
                            value={value}
                            onChange={e => {
                              const next = e.target.value
                              setOverrides(prev => {
                                const cp = { ...prev }
                                if (!next || next === computed) delete cp[w.index]
                                else cp[w.index] = next
                                return cp
                              })
                            }}
                            style={{
                              ...inputStyle(),
                              padding: '4px 6px',
                              borderColor: isOverride ? COACH_BLUE : '#1E1E22',
                            }}
                          />
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Eksisterende hviledager, perioden-notater og fokuspunkter på utøveren beholdes — bare nye legges til.
      </p>

      <div className="flex justify-end mt-2">
        <PrimaryButton label={isPending ? 'Sender…' : 'Push plan'} onClick={submit} disabled={isPending} />
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-2 py-1.5 text-xs tracking-widest uppercase"
      style={{ color: '#8A8A96', fontWeight: 'normal' }}>
      {children}
    </th>
  )
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 align-top">{children}</td>
}

function PeriodizationTemplatePushForm({ athleteId, isPending, startTransition, onDone, onError }: CommonFormProps) {
  const { list, loadError } = useTemplateList(listCoachPeriodizationTemplates)
  const [templateId, setTemplateId] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [allowOverlap, setAllowOverlap] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<{ id: string; name: string; start_date: string; end_date: string }[] | null>(null)

  useEffect(() => {
    if (list && list.length > 0 && !templateId) setTemplateId(list[0].id)
  }, [list, templateId])

  // Når valgt mal endres: hvis malen har lagret startdato, default til den.
  useEffect(() => {
    if (!templateId || !list) return
    const t = list.find(x => x.id === templateId)
    if (t?.startDate) setStartDate(t.startDate)
    setAllowOverlap(false); setOverlapWarning(null)
  }, [templateId, list])

  if (loadError) {
    return <p className="text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>{loadError}</p>
  }
  if (list === null) {
    return <p className="text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>Laster maler…</p>
  }
  if (list.length === 0) {
    return (
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Ingen årsplan-maler ennå.
      </p>
    )
  }

  const selected = list.find(t => t.id === templateId) ?? null
  const usingOriginalStart = !!(selected?.startDate && startDate === selected.startDate)

  const submit = () => {
    if (!templateId) { onError('Velg en mal'); return }
    if (!startDate) { onError('Startdato er påkrevd'); return }
    startTransition(async () => {
      const res = await pushPeriodizationTemplateToAthlete({
        athleteId, templateId, startDate, allowOverlap,
      })
      if (res.error) { onError(res.error); return }
      if (res.overlap && res.overlap.length > 0) {
        setOverlapWarning(res.overlap)
        return
      }
      setOverlapWarning(null)
      onDone(`Årsplan opprettet fra ${startDate}`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label style={labelStyle()}>Mal</label>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={inputStyle()}>
          {list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle()}>Startdato</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle()} />
        {selected?.startDate && (
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => setStartDate(selected.startDate ?? startDate)}
              disabled={usingOriginalStart}
              className="text-xs tracking-widest uppercase px-2 py-1"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: usingOriginalStart ? '#8A8A96' : COACH_BLUE,
                background: 'transparent',
                border: `1px solid ${usingOriginalStart ? '#1E1E22' : COACH_BLUE}`,
                cursor: usingOriginalStart ? 'default' : 'pointer',
              }}
            >
              {usingOriginalStart ? `Bruker malens dato (${selected.startDate})` : `Bruk malens dato (${selected.startDate})`}
            </button>
          </div>
        )}
      </div>

      {overlapWarning && overlapWarning.length > 0 && (
        <div className="text-xs px-3 py-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#E0A030',
            border: '1px solid #E0A03066', background: '#1A1410',
          }}>
          <p className="mb-1">Utøveren har allerede sesong som overlapper:</p>
          <ul className="list-disc pl-4">
            {overlapWarning.map(s => (
              <li key={s.id}>{s.name} ({s.start_date}–{s.end_date})</li>
            ))}
          </ul>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={allowOverlap}
              onChange={e => setAllowOverlap(e.target.checked)} />
            <span>Behold begge — opprett ny sesong likevel</span>
          </label>
        </div>
      )}

      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Eksisterende sesonger og perioder beholdes — den nye legges ved siden av.
      </p>

      <div className="flex justify-end mt-2">
        <PrimaryButton label={isPending ? 'Sender…' : 'Push årsplan'} onClick={submit} disabled={isPending} />
      </div>
    </div>
  )
}
