'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertDayState, deleteDayState } from '@/app/actions/day-states'
import { localISODate } from '@/lib/local-date'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import {
  REST_SUBTYPE_LABELS, SICK_SUBTYPE_LABELS, INJURY_SUBTYPE_LABELS,
  type DayState, type DayStateType,
} from '@/lib/day-state-types'
import {
  ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter,
} from '@/components/periodization/ModalShell'

const FEELING_LABELS: Record<number, string> = {
  1: '😞 Veldig dårlig', 2: '😕 Dårlig', 3: '😐 Ok', 4: '🙂 Bra', 5: '😃 Veldig bra',
}

export function DayStateModal({
  open, onClose, date, stateType, editing, onSaved, targetUserId,
}: {
  open: boolean
  onClose: () => void
  date: string
  stateType: DayStateType
  editing?: DayState | null
  onSaved?: () => void
  targetUserId?: string
}) {
  const router = useRouter()
  const today = localISODate()
  const isRest = stateType === 'hviledag'
  const isInjury = stateType === 'skade'
  const isSick = stateType === 'sykdom'
  // Planlagt KUN for fremtidige datoer. Redigeres en tidligere planlagt
  // hviledag på/etter dagen, normaliseres den til faktisk ved lagring —
  // brukeren skal aldri måtte «markere som gjennomført» manuelt.
  const isPlanned = (editing?.is_planned ?? true) && date > today

  const [subType, setSubType] = useState<string>(editing?.sub_type ?? '')
  const [feeling, setFeeling] = useState<number | ''>(editing?.feeling ?? '')
  const [symptoms, setSymptoms] = useState(editing?.symptoms ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [expectedDaysOff, setExpectedDaysOff] = useState<number | ''>(editing?.expected_days_off ?? '')
  // Flerdags-markering (kun ved NY markering): til-og-med-dato → alle dager
  // i spennet markeres i én operasjon. Hviledag kan planlegges frem i tid;
  // syk/skade kan kun markeres på inntrufne dager (maks i dag).
  const [toDate, setToDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !busy

  // Datoene som markeres: valgt dag + evt. spennet frem til toDate (maks 62).
  const datesToMark = (() => {
    if (editing || !toDate || toDate <= date) return [date]
    const out: string[] = []
    const d = new Date(date + 'T00:00:00')
    const stop = new Date(toDate + 'T00:00:00')
    while (d <= stop && out.length < 62) {
      out.push(localISODate(d))
      d.setDate(d.getDate() + 1)
    }
    return out
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)

    for (const ds of datesToMark) {
      const res = await upsertDayState({
        date: ds,
        state_type: stateType,
        // Per-dag: hviledag frem i tid = planlagt; syk/skade planlegges aldri.
        is_planned: datesToMark.length > 1
          ? (isRest ? ds > today : false)
          : isPlanned,
        sub_type: subType || null,
        feeling: feeling === '' ? null : Number(feeling),
        // Symptomer er kun relevant for sykdom (infeksjon). Skade bruker
        // notes-feltet til å beskrive type/grad og kroppsdel ligger i sub_type.
        symptoms: isSick ? symptoms : null,
        notes,
        // Antatt dager utenfor trening gjelder både sykdom og skade.
        expected_days_off: isRest ? null : (expectedDaysOff === '' ? null : Number(expectedDaysOff)),
        targetUserId,
      })
      if (res.error) { setError(`${ds}: ${res.error}`); setBusy(false); return }
    }
    router.refresh()
    setBusy(false)
    onSaved?.()
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    const label = isRest ? 'hviledag-markeringen'
      : isInjury ? 'skade-markeringen'
      : 'sykdom-markeringen'
    if (!await xpConfirm(`Fjern ${label} for ${date}?`)) return
    setBusy(true); setError(null)
    const res = await deleteDayState(editing.id, targetUserId)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onSaved?.()
    onClose()
  }

  const title = isRest
    ? (editing ? 'Rediger hviledag' : (isPlanned ? 'Planlegg hviledag' : 'Marker hviledag'))
    : isInjury
      ? (editing ? 'Rediger skade' : 'Marker skade')
      : (editing ? 'Rediger sykdom' : 'Marker sykdom')

  const SUBTYPES = isRest ? REST_SUBTYPE_LABELS
    : isInjury ? INJURY_SUBTYPE_LABELS
    : SICK_SUBTYPE_LABELS
  const subTypeLabel = isRest ? 'Type'
    : isInjury ? 'Kroppsdel'
    : 'Type'

  return (
    <ModalShell open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs mb-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {date}{isPlanned ? ' (planlagt)' : ''} — teller ikke som økt i totaler.
        </p>

        {/* Flerdags-markering — kun ved ny markering. */}
        {!editing && (
          <div className="mb-3">
            <FieldLabel>Til og med (valgfritt — marker flere dager)</FieldLabel>
            <input type="date" value={toDate} min={date}
              max={isRest ? undefined : today}
              onChange={e => setToDate(e.target.value)}
              style={INPUT_STYLE} />
            {datesToMark.length > 1 && (
              <p className="text-xs mt-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--accent)' }}>
                {datesToMark.length} dager markeres ({date} → {toDate})
                {isRest && toDate > today ? ' — fremtidige dager blir planlagte' : ''}
              </p>
            )}
          </div>
        )}

        <div className="mb-3">
          <FieldLabel>{subTypeLabel}</FieldLabel>
          <select value={subType} onChange={e => setSubType(e.target.value)} style={INPUT_STYLE}>
            <option value="">—</option>
            {Object.entries(SUBTYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Følelse føres kun på faktiske dager (dagbok) — ikke ved planlegging. */}
        {!isPlanned && (
        <div className="mb-3">
          <FieldLabel>Følelse</FieldLabel>
          <select value={feeling} onChange={e => setFeeling(e.target.value === '' ? '' : Number(e.target.value))}
            style={INPUT_STYLE}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{FEELING_LABELS[n]}</option>
            ))}
          </select>
        </div>
        )}

        {isSick && (
          <div className="mb-3">
            <FieldLabel>Symptomer</FieldLabel>
            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={2}
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
              placeholder="Sår hals, feber, …" />
          </div>
        )}
        {!isRest && (
          <div className="mb-3">
            <FieldLabel>Antatt dager utenfor trening</FieldLabel>
            <input type="number" min={0} max={60}
              value={expectedDaysOff}
              onChange={e => setExpectedDaysOff(e.target.value === '' ? '' : Number(e.target.value))}
              style={INPUT_STYLE} placeholder="f.eks. 3" />
          </div>
        )}

        <div className="mb-1">
          <FieldLabel>Notat</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>

        {error && <ErrorText message={error} />}

        <ModalFooter
          submitLabel={editing ? 'Lagre' : 'Markér'}
          disabled={!canSubmit}
          onCancel={onClose}
          busy={busy}
          onDelete={editing ? handleDelete : undefined}
        />
      </form>
    </ModalShell>
  )
}
