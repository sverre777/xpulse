'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/settings'
import type { Sport } from '@/lib/types'
import { SPORTS } from '@/lib/types'
import { ProfileImageUploader } from './ProfileImageUploader'

interface Props {
  initialFirstName: string | null
  initialLastName: string | null
  initialFullName: string | null
  initialBirthYear: number | null
  initialPrimarySport: Sport | null
  initialGender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  initialCountry: string | null
  initialProfileImageUrl: string | null
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Mann',
  female: 'Kvinne',
  other: 'Annet',
  prefer_not_to_say: 'Vil ikke oppgi',
}

const COUNTRIES = [
  { code: 'NO', name: 'Norge' },
  { code: 'SE', name: 'Sverige' },
  { code: 'DK', name: 'Danmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IS', name: 'Island' },
  { code: 'DE', name: 'Tyskland' },
  { code: 'GB', name: 'Storbritannia' },
  { code: 'US', name: 'USA' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'Frankrike' },
  { code: 'IT', name: 'Italia' },
  { code: 'ES', name: 'Spania' },
  { code: 'CH', name: 'Sveits' },
  { code: 'AT', name: 'Østerrike' },
]

export function ProfileSection(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState(props.initialFirstName ?? '')
  const [lastName, setLastName] = useState(props.initialLastName ?? '')
  const [birthYear, setBirthYear] = useState(props.initialBirthYear?.toString() ?? '')
  const [primarySport, setPrimarySport] = useState<string>(props.initialPrimarySport ?? '')
  const [gender, setGender] = useState<string>(props.initialGender ?? '')
  const [country, setCountry] = useState(props.initialCountry ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const initial = {
    firstName: props.initialFirstName ?? '',
    lastName: props.initialLastName ?? '',
    birthYear: props.initialBirthYear?.toString() ?? '',
    primarySport: props.initialPrimarySport ?? '',
    gender: props.initialGender ?? '',
    country: props.initialCountry ?? '',
  }
  const dirty =
    firstName !== initial.firstName ||
    lastName !== initial.lastName ||
    birthYear !== initial.birthYear ||
    primarySport !== initial.primarySport ||
    gender !== initial.gender ||
    country !== initial.country

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        birth_year: birthYear,
        primary_sport: primarySport,
        gender,
        country,
      })
      if (res.error) { setError(res.error); return }
      setSavedFlash(true)
      router.refresh()
      setTimeout(() => setSavedFlash(false), 1500)
    })
  }

  return (
    <div className="p-6 mt-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Profil
      </p>

      <ProfileImageUploader initialUrl={props.initialProfileImageUrl} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <Field label="Fornavn">
          <Input value={firstName} onChange={setFirstName} />
        </Field>
        <Field label="Etternavn">
          <Input value={lastName} onChange={setLastName} />
        </Field>
        <Field label="Fødselsår">
          <Input value={birthYear} onChange={setBirthYear} type="number" placeholder="ÅÅÅÅ" />
        </Field>
        <Field label="Hovedsport">
          <Select value={primarySport} onChange={setPrimarySport}>
            <option value="">— Velg —</option>
            {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Kjønn">
          <Select value={gender} onChange={setGender}>
            <option value="">— Velg —</option>
            {Object.entries(GENDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Land">
          <Select value={country} onChange={setCountry}>
            <option value="">— Velg —</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button type="button" onClick={save} disabled={!dirty || pending}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: dirty ? '#FF4500' : 'none',
            border: '1px solid ' + (dirty ? '#FF4500' : '#262629'),
            color: dirty ? '#0A0A0B' : '#555560',
            padding: '8px 18px',
            cursor: !dirty || pending ? 'default' : 'pointer',
            minHeight: '40px',
          }}>
          {pending ? 'Lagrer …' : 'Lagre'}
        </button>
        {savedFlash && !error && (
          <span className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
            Lagret
          </span>
        )}
        {error && (
          <span className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: '#0E0E10',
        border: '1px solid #262629',
        color: '#F0F0F2',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '16px',
        padding: '8px 12px',
        minHeight: '40px',
      }} />
  )
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: '#0E0E10',
        border: '1px solid #262629',
        color: '#F0F0F2',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '16px',
        padding: '8px 12px',
        minHeight: '40px',
      }}>
      {children}
    </select>
  )
}
