'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { register, AuthState } from '@/app/actions/auth'
import { AuthCard } from '@/components/AuthCard'
import { FormField } from '@/components/FormField'
import { PublicFooter } from '@/components/legal/PublicFooter'
import { SPORTS } from '@/lib/types'

const initialState: AuthState = {}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, initialState)

  return (
    <>
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      <AuthCard title="Opprett konto" subtitle="Velg din rolle og kom i gang">
        <form action={formAction} className="flex flex-col gap-5">
          <FormField
            label="Fullt navn"
            name="full_name"
            type="text"
            placeholder="Ola Nordmann"
            required
            autoComplete="name"
          />
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
            placeholder="Minst 8 tegn"
            required
            autoComplete="new-password"
          />

          {/* Primary sport */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Primærsport
            </label>
            <select name="primary_sport" required
              style={{
                backgroundColor: '#1C1C21', border: '1px solid #222228',
                color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '15px', padding: '12px 16px', outline: 'none',
              }}>
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Role selector — dual-role: velg én eller begge. */}
          <div className="flex flex-col gap-2">
            <span
              className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              Dine roller
            </span>
            <div className="grid grid-cols-2 gap-3">
              <RoleOption
                name="wants_athlete"
                label="Utøver"
                description="Logg og analyser treningen din"
                accentColor="#FF4500"
                defaultChecked
              />
              <RoleOption
                name="wants_coach"
                label="Trener"
                description="Følg opp utøverne dine"
                accentColor="#1A6FD4"
              />
            </div>
            <p
              className="text-xs mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
            >
              Du kan velge begge — veksle senere i toppen av appen.
            </p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="accept_terms"
              required
              className="mt-1"
              style={{ accentColor: '#FF4500' }}
            />
            <span
              className="text-xs tracking-wide"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.4 }}
            >
              Jeg har lest og godtar{' '}
              <Link href="/vilkar" target="_blank" className="underline transition-opacity hover:opacity-80" style={{ color: '#FF4500' }}>
                brukervilkårene
              </Link>
              {' '}og{' '}
              <Link href="/personvern" target="_blank" className="underline transition-opacity hover:opacity-80" style={{ color: '#FF4500' }}>
                personvernerklæringen
              </Link>.
            </span>
          </label>

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
              {pending ? 'Oppretter konto...' : 'Opprett konto'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p
            className="text-sm tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Har du allerede konto?{' '}
            <Link
              href="/app"
              className="transition-opacity hover:opacity-80"
              style={{ color: '#FF4500' }}
            >
              Logg inn
            </Link>
          </p>
        </div>
      </AuthCard>
    </main>
    <PublicFooter />
    </>
  )
}

function RoleOption({
  name,
  label,
  description,
  accentColor,
  defaultChecked,
}: {
  name: string
  label: string
  description: string
  accentColor: string
  defaultChecked?: boolean
}) {
  return (
    <label
      className="relative flex flex-col gap-1 p-4 cursor-pointer"
      style={{
        border: `1px solid #222228`,
        backgroundColor: '#1C1C21',
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="sr-only peer"
      />
      <span
        className="absolute inset-0 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
        style={{
          border: `2px solid ${accentColor}`,
          backgroundColor: `${accentColor}15`,
        }}
      />
      <span
        className="relative text-lg font-semibold tracking-widest uppercase z-10"
        style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2' }}
      >
        {label}
      </span>
      <span
        className="relative text-xs tracking-wide z-10"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
      >
        {description}
      </span>
    </label>
  )
}
