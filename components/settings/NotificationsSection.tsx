'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateNotificationSettings } from '@/app/actions/settings'

interface Props {
  initial: {
    coach_comment: boolean
    new_message: boolean
    plan_pushed: boolean
    weekly_summary: boolean
    product_updates: boolean
  }
}

const ITEMS: { key: keyof Props['initial']; label: string; desc: string }[] = [
  { key: 'coach_comment',   label: 'Trener-kommentarer',   desc: 'E-post når treneren legger igjen en kommentar.' },
  { key: 'new_message',     label: 'Nye meldinger',         desc: 'E-post ved ny melding i innboksen.' },
  { key: 'plan_pushed',     label: 'Plan oppdatert',        desc: 'E-post når trener pusher endringer i planen din.' },
  { key: 'weekly_summary',  label: 'Ukentlig oppsummering', desc: 'E-post hver søndag med ukens trening.' },
  { key: 'product_updates', label: 'Produkt-oppdateringer', desc: 'E-post om nye funksjoner i X-PULSE.' },
]

export function NotificationsSection({ initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  const toggle = (key: keyof Props['initial']) => {
    const next = { ...state, [key]: !state[key] }
    setState(next)
    setError(null)
    startTransition(async () => {
      const fieldKey = `notify_email_${key}` as const
      const res = await updateNotificationSettings({ [fieldKey]: next[key] })
      if (res.error) {
        setError(res.error)
        setState(state)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="p-6 mt-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Varsler
      </p>

      <div className="space-y-3">
        {ITEMS.map(item => (
          <div key={item.key} className="flex items-start justify-between gap-4">
            <div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                {item.label}
              </p>
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {item.desc}
              </p>
            </div>
            <Toggle active={state[item.key]} disabled={pending} onClick={() => toggle(item.key)} />
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function Toggle({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: active ? '#FF4500' : '#262629',
        border: 'none',
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        marginTop: '2px',
      }}>
      <span style={{
        position: 'absolute',
        top: '3px',
        left: active ? '23px' : '3px',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: '#F0F0F2',
        transition: 'left 0.15s',
      }} />
    </button>
  )
}
