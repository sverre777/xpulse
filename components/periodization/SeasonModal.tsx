'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSeason, updateSeason, deleteSeason, type Season } from '@/app/actions/seasons'
import { ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter } from './ModalShell'

export function SeasonModal({
  open, onClose, editing, targetUserId, basePath = '/app/periodisering',
}: {
  open: boolean
  onClose: () => void
  editing?: Season | null
  targetUserId?: string
  basePath?: string
}) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [startDate, setStartDate] = useState(editing?.start_date ?? '')
  const [endDate, setEndDate] = useState(editing?.end_date ?? '')
  const [goalMain, setGoalMain] = useState(editing?.goal_main ?? '')
  const [goalDetails, setGoalDetails] = useState(editing?.goal_details ?? '')
  const [kpiNotes, setKpiNotes] = useState(editing?.kpi_notes ?? '')
  // Kø #47 bolk 7: valgfritt årsskuddmål (skiskyting) — tomt = ikke satt.
  const [shotGoal, setShotGoal] = useState(editing?.annual_shot_goal != null ? String(editing.annual_shot_goal) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && startDate && endDate && endDate > startDate && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    const payload = {
      name, start_date: startDate, end_date: endDate,
      goal_main: goalMain, goal_details: goalDetails, kpi_notes: kpiNotes,
      annual_shot_goal: shotGoal.trim() === '' ? null : Math.max(1, Math.round(Number(shotGoal)) || 0) || null,
      targetUserId,
    }
    const res = editing
      ? await updateSeason(editing.id, payload)
      : await createSeason(payload)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    if (!editing && 'id' in res && res.id) {
      router.push(`${basePath}?s=${res.id}`)
    }
    setBusy(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Slette sesongen "${editing.name}"? Alle perioder og nøkkeldatoer slettes også.`)) return
    setBusy(true); setError(null)
    const res = await deleteSeason(editing.id, targetUserId)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.push(basePath)
    router.refresh()
    setBusy(false)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} title={editing ? 'Rediger sesong' : 'Ny sesong'}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <FieldLabel>Navn</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="Sesong 2026/27" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Startdato</FieldLabel>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel>Sluttdato</FieldLabel>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3">
          <FieldLabel>Hovedmål</FieldLabel>
          <input type="text" value={goalMain} onChange={e => setGoalMain(e.target.value)} style={INPUT_STYLE} placeholder="Topp 10 på NM Sprint" />
        </div>
        <div className="mb-3">
          <FieldLabel>Delmål</FieldLabel>
          <textarea value={goalDetails} onChange={e => setGoalDetails(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        <div className="mb-3">
          <FieldLabel>KPI-notater</FieldLabel>
          <textarea value={kpiNotes} onChange={e => setKpiNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} placeholder="VO2max 72, 100 km/uke i base, …" />
        </div>
        <div className="mb-1">
          <FieldLabel>🎯 Årsskuddmål (valgfritt)</FieldLabel>
          <input type="number" inputMode="numeric" min={1} step={100}
            value={shotGoal} onChange={e => setShotGoal(e.target.value)}
            style={INPUT_STYLE} placeholder="f.eks. 12000" />
          <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', lineHeight: 1.5 }}>
            OLT/NSSF-styringstall for skiskyting — veiledning, aldri alarm.
            Vises som fremdriftsbar i skyting-analysen. Tomt = skjult.
          </p>
        </div>
        {error && <ErrorText message={error} />}
        <ModalFooter
          submitLabel={editing ? 'Lagre' : 'Opprett'}
          disabled={!canSubmit}
          onCancel={onClose}
          busy={busy}
          onDelete={editing ? handleDelete : undefined}
        />
      </form>
    </ModalShell>
  )
}
