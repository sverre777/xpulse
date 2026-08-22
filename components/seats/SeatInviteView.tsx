'use client'

// Invitasjonssiden for utøverplass (setemodellen bolk 3).
// «Enkelt må det være»: ny bruker fyller navn + e-post + passord og er inne,
// koblet og lisensiert på under et minutt. Innlogget bruker ser NØYAKTIG hva
// som skjer (kobling + plass, ev. at eget abonnement settes til å løpe ut)
// FØR bekreftelse. Full lenke = ærlig melding.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  claimSeatAsExistingUser,
  claimSeatAsNewUser,
  type SeatInvitePageInfo,
} from '@/app/actions/seat-invite'

const ORANGE = '#FF4500'

interface Props {
  token: string
  info: SeatInvitePageInfo
}

export function SeatInviteView({ token, info }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const handleNyBruker = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await claimSeatAsNewUser({ token, ...form })
      if (res.error) { setError(res.error); return }
      router.push('/app')
      router.refresh()
    })
  }

  const handleInnlogget = () => {
    setError(null)
    startTransition(async () => {
      const res = await claimSeatAsExistingUser(token)
      if (res.error) { setError(res.error); return }
      router.push('/app')
      router.refresh()
    })
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}
      className="flex items-start justify-center px-4 py-16">
      <div className="w-full" style={{ maxWidth: 460 }}>
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: 32, height: 3, backgroundColor: ORANGE, display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 32, letterSpacing: '0.08em' }}>
            Utøverplass
          </h1>
        </div>

        <div className="p-6" style={{ backgroundColor: '#101014', border: '1px solid #2A2A33', borderRadius: 14 }}>
          {!info.gyldig ? (
            <p style={tekst}>{info.feilmelding ?? 'Lenka er ikke gyldig.'}</p>
          ) : info.full && !(info.preview?.alleredePaaPlass) ? (
            <>
              <p style={tittel}>Alle plassene er i bruk</p>
              <p style={tekst}>
                {info.coachName} har ingen ledige utøverplasser akkurat nå — si fra til treneren din,
                så kan flere plasser åpnes.
              </p>
            </>
          ) : !info.innlogget ? (
            <>
              <p style={tittel}>{info.coachName} gir deg en utøverplass</p>
              <p style={tekst}>
                Full X-PULSE (Athlete Pro) betalt av treneren din — du trenger aldri legge inn kort,
                og ingenting trekkes deg. Du kobles til {info.coachName} samtidig.
              </p>
              <form onSubmit={handleNyBruker} className="space-y-3 mt-4">
                <Field label="Navn">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required autoComplete="name" className="w-full px-4 py-3" style={inputStyle} />
                </Field>
                <Field label="E-post">
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required autoComplete="email" className="w-full px-4 py-3" style={inputStyle} />
                </Field>
                <Field label="Passord (minst 8 tegn)">
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required minLength={8} autoComplete="new-password" className="w-full px-4 py-3" style={inputStyle} />
                </Field>
                {error && <p className="text-sm" style={{ color: ORANGE }}>{error}</p>}
                <button type="submit" disabled={pending}
                  className="w-full px-4 py-3 text-sm font-semibold tracking-widest uppercase"
                  style={{ ...knapp, opacity: pending ? 0.6 : 1 }}>
                  {pending ? 'Oppretter…' : 'Opprett bruker og ta plassen'}
                </button>
              </form>
              <p className="text-xs mt-4" style={{ color: '#8A8A96' }}>
                Har du allerede en bruker?{' '}
                <Link href={`/app?return_to=/plass/${token}`}
                  style={{ color: ORANGE, textDecoration: 'underline' }}>
                  Logg inn
                </Link>{' '}
                — du kommer rett tilbake hit.
              </p>
            </>
          ) : info.preview?.alleredePaaPlass ? (
            <>
              <p style={tittel}>Du er allerede på plass</p>
              <p style={tekst}>Plassen hos {info.coachName} er aktiv — alt er i orden.</p>
              <Link href="/app" className="inline-block mt-4 px-4 py-3 text-sm font-semibold tracking-widest uppercase"
                style={{ ...knapp, textDecoration: 'none' }}>
                Til appen
              </Link>
            </>
          ) : info.preview?.harTrenerAbo ? (
            <>
              <p style={tittel}>Du har et trener-abonnement</p>
              <p style={tekst}>
                Utøverplassen kan ikke erstatte et trener-abonnement. Ta kontakt med
                {' '}{info.coachName} hvis dette ser feil ut.
              </p>
            </>
          ) : (
            <>
              <p style={tittel}>{info.coachName} gir deg en utøverplass</p>
              <p style={tekst}>Når du bekrefter skjer dette:</p>
              <ul className="mt-2 space-y-2" style={{ listStyle: 'none', padding: 0 }}>
                <Punkt>Du får full X-PULSE (Athlete Pro), betalt av treneren — ingenting trekkes deg.</Punkt>
                {!info.preview?.alleredeKoblet && (
                  <Punkt>Du kobles til {info.coachName} som utøver.</Punkt>
                )}
                {info.preview?.selvbetalende && (
                  <Punkt varsel>
                    Ditt eget abonnement (59 kr/mnd) settes til å løpe ut ved periodeslutt —
                    du betaler ikke mer, og plassen tar over. Ingen dobbelttrekk.
                  </Punkt>
                )}
              </ul>
              {error && <p className="text-sm mt-3" style={{ color: ORANGE }}>{error}</p>}
              <button type="button" onClick={handleInnlogget} disabled={pending}
                className="w-full mt-4 px-4 py-3 text-sm font-semibold tracking-widest uppercase"
                style={{ ...knapp, opacity: pending ? 0.6 : 1 }}>
                {pending ? 'Aktiverer…' : 'Bekreft og ta plassen'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Punkt({ children, varsel = false }: { children: React.ReactNode; varsel?: boolean }) {
  return (
    <li className="flex gap-2 text-sm" style={{
      fontFamily: "'Barlow Condensed', sans-serif",
      color: varsel ? '#E8B93C' : '#C0C0CC',
    }}>
      <span aria-hidden style={{ color: varsel ? '#E8B93C' : ORANGE }}>{varsel ? '⚠' : '✓'}</span>
      <span>{children}</span>
    </li>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const tittel: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#F0F0F2', fontSize: 18, fontWeight: 600, marginBottom: 6,
}
const tekst: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#8A8A96', fontSize: 15,
}
const inputStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#F0F0F2', backgroundColor: '#0F0F12',
  border: '1px solid #2A2A33', borderRadius: 9, fontSize: 15,
}
const knapp: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  backgroundColor: ORANGE, color: '#F0F0F2',
  border: 'none', borderRadius: 9, cursor: 'pointer',
}
