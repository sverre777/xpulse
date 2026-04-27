'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePersonalRecord, deletePersonalRecord, type PersonalRecordInput } from '@/app/actions/tests'
import type { PersonalRecordRow } from '@/app/actions/analysis'
import type { TestPRSport } from '@/lib/types'
import {
  TestPRInputForm, validateTestPRForm, deriveTestType,
  emptyTestPRFormValue, type TestPRFormValue,
} from '@/components/test-pr/TestPRInputForm'
import { LogToDagbokToggle } from '@/components/test-pr/LogToDagbokToggle'

const GOLD = '#D4A017'

// Forhåndsutfylte hurtig-PR fra TesterPRTab. Mappes inn i TestPRFormValue
// slik at brukeren får et godt utgangspunkt.
export interface PRPreset {
  // TestPRSport-verdi (lop, sykling, styrke, …) eller null = ingen sport.
  sport?: TestPRSport
  subcategory?: string
  custom_label?: string
  unit?: string
  placeholder?: string
}

interface Props {
  existing?: PersonalRecordRow
  preset?: PRPreset
  // targetUserId tillater trener å lagre PR direkte på utøvers konto
  // (krever can_edit_plan via resolveTargetUser).
  targetUserId?: string
  onClose: () => void
  onSaved: () => void
}

function presetToFormValue(p: PRPreset | undefined): TestPRFormValue {
  const base = emptyTestPRFormValue()
  return {
    ...base,
    sport: p?.sport ?? '',
    subcategory: p?.subcategory ?? '',
    custom_label: p?.custom_label ?? '',
    unit: p?.unit ?? '',
  }
}

function existingToFormValue(row: PersonalRecordRow): TestPRFormValue {
  // Eldre rader har Sport-verdier ('running' osv.) i sport-feltet og
  // ingen subcategory. Vises som tom sport — bruker velger på nytt
  // ved redigering for å konformere til ny modell.
  const tpSports = ['lop','sykling','svomming','langrenn','skiskyting','triathlon','styrke','spenst','skyting','annet']
  const sport = (tpSports.includes(row.sport) ? row.sport : '') as TestPRSport | ''
  return {
    sport,
    subcategory: row.subcategory ?? '',
    custom_label: row.custom_label ?? '',
    value: String(row.value),
    unit: row.unit,
    notes: row.notes ?? '',
    achieved_at: row.achieved_at,
    equipment: '',
    conditions: '',
  }
}

export function PersonalRecordModal({ existing, preset, targetUserId, onClose, onSaved }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<TestPRFormValue>(() =>
    existing ? existingToFormValue(existing) : presetToFormValue(preset),
  )
  // Toggle: kun synlig for nye PR-er. Ved redigering er PR allerede lagret.
  const [logToDagbok, setLogToDagbok] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    const validationError = validateTestPRForm(form)
    if (validationError) { setError(validationError); return }

    if (!form.sport) { setError('Sport mangler'); return }
    const numericValue = parseFloat(form.value.replace(',', '.'))
    const recordType = deriveTestType(form)
    const input: PersonalRecordInput = {
      id: existing?.id,
      sport: form.sport,
      subcategory: form.subcategory || null,
      custom_label: form.custom_label || null,
      record_type: recordType || form.subcategory || form.custom_label || 'Test',
      value: numericValue,
      unit: form.unit,
      achieved_at: form.achieved_at,
      notes: form.notes,
      is_manual: true,
      log_to_dagbok: !existing && logToDagbok,
    }
    setError(null)
    startTransition(async () => {
      const res = await savePersonalRecord(input, targetUserId)
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onSaved()
    })
  }

  const remove = () => {
    if (!existing) return
    if (!confirm('Slette denne Test/PR-en?')) return
    setError(null)
    startTransition(async () => {
      const res = await deletePersonalRecord(existing.id, targetUserId)
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg p-5"
        style={{ backgroundColor: '#13131A', border: `1px solid ${GOLD}55` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ width: '16px', height: '2px', backgroundColor: GOLD, display: 'inline-block' }} />
            <h3 className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
              {existing ? 'Rediger Test/PR' : 'Ny Test/PR'}
            </h3>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', minHeight: '36px' }}>
            Lukk
          </button>
        </div>

        <TestPRInputForm
          value={form}
          onChange={setForm}
          mode="manual"
          title={existing ? 'Rediger Test/PR' : 'Ny Test/PR'}
          valuePlaceholder={preset?.placeholder ?? 'f.eks. 320 eller 18.42'}
        />

        {!existing && (
          <LogToDagbokToggle
            checked={logToDagbok}
            onChange={setLogToDagbok}
          />
        )}

        {error && (
          <p className="text-xs mt-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between">
          {existing ? (
            <button type="button" onClick={remove} disabled={isPending}
              className="px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent', border: '1px solid #E11D48',
                color: '#E11D48', minHeight: '40px',
              }}>
              Slett
            </button>
          ) : <span />}
          <button type="button" onClick={save} disabled={isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: GOLD, border: `1px solid ${GOLD}`,
              color: '#0A0A0B', minHeight: '40px',
            }}>
            {isPending ? 'Lagrer…' : existing ? 'Oppdater' : 'Lagre Test/PR'}
          </button>
        </div>
      </div>
    </div>
  )
}
