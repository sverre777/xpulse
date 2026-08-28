'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/settings'
import { settVekt } from '@/app/actions/health'
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
  // Bolk 6.
  initialUsername: string | null
  initialBirthDate: string | null
  initialHeightCm: number | null
  initialSecondarySport: Sport | null
  email: string | null
  // Vekt: SAMME kilde som helseflaten (daily_health.body_weight_kg) —
  // siste måling vises, lagring skriver dagens rad (regel 11).
  sisteVektKg: number | null
}

// Kun Mann/Kvinne i VALGET (Sverre 28. aug). Eldre lagrede verdier
// («Annet»/«Vil ikke oppgi») forblir gyldige i basen og vises som
// gjeldende valg til brukeren selv endrer.
const GENDER_LABELS: Record<string, string> = {
  male: 'Mann',
  female: 'Kvinne',
}
const GAMLE_GENDER_LABELS: Record<string, string> = {
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
  // Fødselsår vises ikke lenger som felt — det avledes av fødselsdato
  // server-side; verdien sendes uendret med så den ikke nulles.
  const [birthYear] = useState(props.initialBirthYear?.toString() ?? '')
  const [primarySport, setPrimarySport] = useState<string>(props.initialPrimarySport ?? '')
  const [gender, setGender] = useState<string>(props.initialGender ?? '')
  const [country, setCountry] = useState(props.initialCountry ?? '')
  const [username, setUsername] = useState(props.initialUsername ?? '')
  const [birthDate, setBirthDate] = useState(props.initialBirthDate ?? '')
  const [heightCm, setHeightCm] = useState(props.initialHeightCm?.toString() ?? '')
  const [secondarySport, setSecondarySport] = useState<string>(props.initialSecondarySport ?? '')
  const [vektKg, setVektKg] = useState(props.sisteVektKg?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const initial = {
    firstName: props.initialFirstName ?? '',
    lastName: props.initialLastName ?? '',
    birthYear: props.initialBirthYear?.toString() ?? '',
    primarySport: props.initialPrimarySport ?? '',
    gender: props.initialGender ?? '',
    country: props.initialCountry ?? '',
    username: props.initialUsername ?? '',
    birthDate: props.initialBirthDate ?? '',
    heightCm: props.initialHeightCm?.toString() ?? '',
    secondarySport: props.initialSecondarySport ?? '',
    vektKg: props.sisteVektKg?.toString() ?? '',
  }
  const dirty =
    firstName !== initial.firstName ||
    lastName !== initial.lastName ||
    birthYear !== initial.birthYear ||
    primarySport !== initial.primarySport ||
    gender !== initial.gender ||
    country !== initial.country ||
    username !== initial.username ||
    birthDate !== initial.birthDate ||
    heightCm !== initial.heightCm ||
    secondarySport !== initial.secondarySport ||
    vektKg !== initial.vektKg

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
        username,
        birth_date: birthDate,
        height_cm: heightCm,
        secondary_sport: secondarySport,
      })
      if (res.error) { setError(res.error); return }
      // Vekt lagres i helse-loggen (dagens måling) — kun når endret.
      if (vektKg !== initial.vektKg) {
        const kg = vektKg.trim() ? Number(vektKg.replace(',', '.')) : null
        if (kg != null && !Number.isFinite(kg)) { setError('Ugyldig vekt'); return }
        const vres = await settVekt(kg)
        if (vres.error) { setError(vres.error); return }
      }
      setSavedFlash(true)
      router.refresh()
      setTimeout(() => setSavedFlash(false), 1500)
    })
  }

  return (
    <div className="p-6 mt-6" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <p className="text-xs tracking-widest uppercase mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
        <Field label="Brukernavn">
          <Input value={username} onChange={v => setUsername(v.toLowerCase())}
            placeholder="f.eks. sverre_h" />
          <Hint>3–20 tegn: a–z, tall, punktum, understrek — små bokstaver</Hint>
        </Field>
        <Field label="E-post">
          <Input value={props.email ?? ''} onChange={() => {}} disabled />
          <Hint>Endres under Innstillinger → Sikkerhet (bekreftes på e-post)</Hint>
        </Field>
        <Field label="Fødselsdato">
          <Input value={birthDate} onChange={setBirthDate} type="date" />
          {!birthDate && birthYear && (
            <Hint>Fødselsår {birthYear} er registrert — sett full dato når du vil</Hint>
          )}
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
            {gender && !GENDER_LABELS[gender] && (
              <option value={gender}>{GAMLE_GENDER_LABELS[gender] ?? gender}</option>
            )}
          </Select>
        </Field>
        <Field label="Land">
          <Select value={country} onChange={setCountry}>
            <option value="">— Velg —</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Høyde (cm)">
          <Input value={heightCm} onChange={setHeightCm} type="number" placeholder="f.eks. 182" />
        </Field>
        <Field label="Vekt (kg)">
          <Input value={vektKg} onChange={setVektKg} placeholder="f.eks. 72,4" />
          <Hint>Samme felt som helse-loggen — lagres som dagens måling</Hint>
        </Field>
        <Field label="Sekundærsport (valgfri)">
          <Select value={secondarySport} onChange={setSecondarySport}>
            <option value="">— Ingen —</option>
            {SPORTS.filter(sp => sp.value !== primarySport).map(sp => (
              <option key={sp.value} value={sp.value}>{sp.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button type="button" onClick={save} disabled={!dirty || pending}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: dirty ? '#FF4500' : 'none',
            border: '1px solid ' + (dirty ? '#FF4500' : 'var(--kant-5)'),
            color: dirty ? 'var(--flate-3)' : 'var(--tekst-8-app)',
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs mt-1"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
      {children}
    </p>
  )
}

function Input({ value, onChange, type = 'text', placeholder, disabled = false }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <input type={type} value={value} placeholder={placeholder} disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: 'var(--flate-7)',
        border: '1px solid var(--kant-5)',
        color: 'var(--tekst-1-app)',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '16px',
        padding: '8px 12px',
        minHeight: '40px',
        opacity: disabled ? 0.6 : 1,
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
        background: 'var(--flate-7)',
        border: '1px solid var(--kant-5)',
        color: 'var(--tekst-1-app)',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '16px',
        padding: '8px 12px',
        minHeight: '40px',
      }}>
      {children}
    </select>
  )
}
