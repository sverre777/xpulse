'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDefaultPaceUnit } from '@/app/actions/settings'
import type { PaceUnit } from '@/lib/pace-utils'

interface Props {
  initialPaceUnit: PaceUnit | null
}

export function UnitsSection({ initialPaceUnit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [unit, setUnit] = useState<PaceUnit>(initialPaceUnit ?? 'min_per_km')
  const [savedFlash, setSavedFlash] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const save = (next: PaceUnit) => {
    setUnit(next)
    setError(null)
    startTransition(async () => {
      const res = await saveDefaultPaceUnit(next)
      if (res.error) { setError(res.error); return }
      setSavedFlash(true)
      router.refresh()
      setTimeout(() => setSavedFlash(false), 1500)
    })
  }

  return (
    <div className="p-6 mt-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Måleenheter
      </p>

      <div>
        <p className="text-xs mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Default visning av fart/pace. Kan overstyres per aktivitet.
        </p>

        <div className="flex gap-1">
          <UnitButton active={unit === 'min_per_km'} disabled={pending}
            onClick={() => save('min_per_km')}>min/km</UnitButton>
          <UnitButton active={unit === 'km_per_h'} disabled={pending}
            onClick={() => save('km_per_h')}>km/t</UnitButton>
        </div>

        {error && (
          <p className="mt-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </p>
        )}
        {savedFlash && !error && (
          <p className="mt-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
            Lagret
          </p>
        )}
      </div>
    </div>
  )
}

function UnitButton({
  active, disabled, onClick, children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        background: active ? '#1A1A1E' : 'none',
        border: '1px solid ' + (active ? '#FF4500' : '#262629'),
        color: active ? '#FF4500' : '#8A8A96',
        padding: '8px 16px',
        cursor: disabled ? 'default' : 'pointer',
        minHeight: '40px',
        minWidth: '90px',
      }}>
      {children}
    </button>
  )
}
