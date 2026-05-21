'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { resetPassword, type PasswordResetState } from '@/app/actions/auth'
import { FormField } from '@/components/FormField'

const initialState: PasswordResetState = {}

export function NyttPassordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormField
        label="Nytt passord"
        name="password"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      <FormField
        label="Bekreft nytt passord"
        name="confirm"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />

      {state?.error && (
        <p className="text-sm px-3 py-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#FF4500',
            backgroundColor: 'rgba(255,69,0,0.1)',
            border: '1px solid rgba(255,69,0,0.3)',
          }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: pending ? '#7A2200' : '#FF4500',
          color: '#F0F0F2',
          cursor: pending ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : 1,
          border: 'none',
        }}
      >
        {pending ? 'Oppdaterer …' : 'Sett nytt passord'}
      </button>

      <div className="text-center">
        <Link href="/app"
          className="text-sm transition-opacity hover:opacity-80"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          ← Tilbake til innlogging
        </Link>
      </div>
    </form>
  )
}
