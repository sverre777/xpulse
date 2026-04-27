'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveDefaultPermissions,
  type DefaultPermissions,
} from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initial: DefaultPermissions
}

export function DefaultPermissionsSection({ initial }: Props) {
  const router = useRouter()
  const [perms, setPerms] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const toggle = (key: keyof DefaultPermissions) => {
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next)
    setSaved(false)
    startTransition(async () => {
      const res = await saveDefaultPermissions(next)
      if (res.error) {
        setError(res.error)
        setPerms(perms)
      } else {
        setError(null)
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <section
      className="p-5"
      style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}
    >
      <p className="text-sm mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Disse rettighetene blir foreslått automatisk når en utøver kobles til deg.
        Utøveren kan justere før godkjenning.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <PermToggle
          label="Plan (se + endre)"
          checked={perms.canEditPlan}
          disabled={isPending}
          onToggle={() => toggle('canEditPlan')}
        />
        <PermToggle
          label="Dagbok (se)"
          checked={perms.canViewDagbok}
          disabled={isPending}
          onToggle={() => toggle('canViewDagbok')}
        />
        <PermToggle
          label="Analyse (se)"
          checked={perms.canViewAnalysis}
          disabled={isPending}
          onToggle={() => toggle('canViewAnalysis')}
        />
        <PermToggle
          label="Årsplan (se + endre)"
          checked={perms.canEditPeriodization}
          disabled={isPending}
          onToggle={() => toggle('canEditPeriodization')}
        />
      </div>

      {error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
          Lagret
        </p>
      )}
    </section>
  )
}

function PermToggle({
  label, checked, onToggle, disabled,
}: { label: string; checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <label
      className="flex items-center gap-2 px-3 py-2"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid #1E1E22',
        backgroundColor: checked ? 'rgba(26,111,212,0.1)' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        style={{ accentColor: COACH_BLUE }}
      />
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {label}
      </span>
    </label>
  )
}
