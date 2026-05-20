'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, type PasswordResetState } from '@/app/actions/auth'
import { AuthCard } from '@/components/AuthCard'
import { FormField } from '@/components/FormField'
import { PublicFooter } from '@/components/legal/PublicFooter'

const initialState: PasswordResetState = {}

export default function GlemtPassordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)

  return (
    <>
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      <AuthCard title="Tilbakestill passord" subtitle="Skriv inn e-postadressen din">
        {state?.sent ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm px-3 py-3"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#28A86E',
                backgroundColor: 'rgba(40,168,110,0.1)',
                border: '1px solid rgba(40,168,110,0.3)',
              }}>
              Sjekk e-posten din — vi har sendt deg en link for å sette nytt passord.
              Linken er gyldig i 1 time.
            </p>
            <Link href="/app"
              className="text-center text-sm tracking-widest uppercase py-3 transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#F0F0F2',
                textDecoration: 'none',
              }}>
              Tilbake til innlogging
            </Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-5">
            <p className="text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Vi sender deg en link på e-post som du kan bruke til å sette et nytt passord.
            </p>
            <FormField
              label="E-post"
              name="email"
              type="email"
              placeholder="navn@eksempel.no"
              required
              autoComplete="email"
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
              {pending ? 'Sender …' : 'Send link'}
            </button>

            <div className="text-center">
              <Link href="/app"
                className="text-sm transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                ← Tilbake til innlogging
              </Link>
            </div>
          </form>
        )}
      </AuthCard>
    </main>
    <PublicFooter />
    </>
  )
}
