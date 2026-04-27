'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { login, AuthState } from '@/app/actions/auth'
import { AuthCard } from '@/components/AuthCard'
import { FormField } from '@/components/FormField'
import { PublicFooter } from '@/components/legal/PublicFooter'

const initialState: AuthState = {}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <>
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      <AuthCard title="Logg inn" subtitle="Velkommen tilbake">
        <form action={formAction} className="flex flex-col gap-5">
          <FormField
            label="E-post"
            name="email"
            type="email"
            placeholder="navn@eksempel.no"
            required
            autoComplete="email"
          />
          <FormField
            label="Passord"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          {state?.error && (
            <p
              className="text-sm px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#FF4500',
                backgroundColor: 'rgba(255,69,0,0.1)',
                border: '1px solid rgba(255,69,0,0.3)',
              }}
            >
              {state.error}
            </p>
          )}

          <div className="mt-2">
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
              {pending ? 'Logger inn...' : 'Logg inn'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p
            className="text-sm tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Har du ikke konto?{' '}
            <Link
              href="/app/register"
              className="transition-opacity hover:opacity-80"
              style={{ color: '#FF4500' }}
            >
              Registrer deg
            </Link>
          </p>
        </div>
      </AuthCard>
    </main>
    <PublicFooter />
    </>
  )
}
