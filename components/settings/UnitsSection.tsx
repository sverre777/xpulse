'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUnitsSettings } from '@/app/actions/settings'
import type { PaceUnit } from '@/lib/pace-utils'

type DistanceUnit = 'km' | 'mi'
type TemperatureUnit = 'c' | 'f'
type WeightUnit = 'kg' | 'lb'

interface Props {
  initialPaceUnit: PaceUnit | null
  initialDistanceUnit?: DistanceUnit | null
  initialTemperatureUnit?: TemperatureUnit | null
  initialWeightUnit?: WeightUnit | null
}

export function UnitsSection({
  initialPaceUnit,
  initialDistanceUnit,
  initialTemperatureUnit,
  initialWeightUnit,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pace, setPace] = useState<PaceUnit>(initialPaceUnit ?? 'min_per_km')
  const [distance, setDistance] = useState<DistanceUnit>(initialDistanceUnit ?? 'km')
  const [temperature, setTemperature] = useState<TemperatureUnit>(initialTemperatureUnit ?? 'c')
  const [weight, setWeight] = useState<WeightUnit>(initialWeightUnit ?? 'kg')
  const [savedFlash, setSavedFlash] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const save = (input: Parameters<typeof updateUnitsSettings>[0]) => {
    setError(null)
    startTransition(async () => {
      const res = await updateUnitsSettings(input)
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

      <Row label="Fart / pace"
        hint="Default visning av fart/pace. Kan overstyres per aktivitet.">
        <UnitButton active={pace === 'min_per_km'} disabled={pending}
          onClick={() => { setPace('min_per_km'); save({ pace: 'min_per_km' }) }}>min/km</UnitButton>
        <UnitButton active={pace === 'km_per_h'} disabled={pending}
          onClick={() => { setPace('km_per_h'); save({ pace: 'km_per_h' }) }}>km/t</UnitButton>
      </Row>

      <Row label="Distanse">
        <UnitButton active={distance === 'km'} disabled={pending}
          onClick={() => { setDistance('km'); save({ distance: 'km' }) }}>km</UnitButton>
        <UnitButton active={distance === 'mi'} disabled={pending}
          onClick={() => { setDistance('mi'); save({ distance: 'mi' }) }}>mi</UnitButton>
      </Row>

      <Row label="Temperatur">
        <UnitButton active={temperature === 'c'} disabled={pending}
          onClick={() => { setTemperature('c'); save({ temperature: 'c' }) }}>°C</UnitButton>
        <UnitButton active={temperature === 'f'} disabled={pending}
          onClick={() => { setTemperature('f'); save({ temperature: 'f' }) }}>°F</UnitButton>
      </Row>

      <Row label="Vekt">
        <UnitButton active={weight === 'kg'} disabled={pending}
          onClick={() => { setWeight('kg'); save({ weight: 'kg' }) }}>kg</UnitButton>
        <UnitButton active={weight === 'lb'} disabled={pending}
          onClick={() => { setWeight('lb'); save({ weight: 'lb' }) }}>lb</UnitButton>
      </Row>

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
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      {hint && (
        <p className="text-xs mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {hint}
        </p>
      )}
      <div className="flex gap-1">{children}</div>
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
        minWidth: '80px',
      }}>
      {children}
    </button>
  )
}
