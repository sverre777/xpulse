'use client'

import { useState } from 'react'
import { PILLE_BASIS } from '@/components/ui/Pilleknapp'

// Kontaktskjemaet. Går til Netlify Forms (definisjonen ligger i
// public/kontakt-skjema.html), som varsler support@x-pulse.no. Feiler
// innsendingen, står e-postadressen der uansett - brukeren skal aldri
// stå uten en vei videre.
const FONT = "'Barlow Condensed', sans-serif"
const SUPPORT = 'support@x-pulse.no'

type Tilstand = 'klar' | 'sender' | 'sendt' | 'feil'

export function KontaktSkjema() {
  const [tilstand, setTilstand] = useState<Tilstand>('klar')
  const [epost, setEpost] = useState('')
  const [emne, setEmne] = useState('')
  const [melding, setMelding] = useState('')

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (tilstand === 'sender') return
    setTilstand('sender')
    const felt = new URLSearchParams({ 'form-name': 'kontakt', epost, emne, melding })
    try {
      const svar = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: felt.toString(),
      })
      setTilstand(svar.ok ? 'sendt' : 'feil')
    } catch {
      setTilstand('feil')
    }
  }

  const felt: React.CSSProperties = {
    width: '100%', padding: '12px 14px', fontFamily: FONT, fontSize: 16,
    backgroundColor: 'var(--flate-15)', border: '1px solid var(--kant-4)', borderRadius: 12,
    color: 'var(--tekst-1-app)', outline: 'none',
  }
  const etikett: React.CSSProperties = {
    display: 'block', marginBottom: 6, fontFamily: FONT, fontSize: 12, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: 'var(--tekst-5-app)',
  }
  // mailto med emne og melding ferdig utfylt - samme innhold, annen vei.
  const mailto = `mailto:${SUPPORT}?subject=${encodeURIComponent(emne || 'Henvendelse')}&body=${encodeURIComponent(melding)}`

  if (tilstand === 'sendt') {
    return (
      <div data-kontakt-sendt className="px-4 py-5" style={{ border: '1px solid rgba(40,168,110,0.35)', backgroundColor: 'rgba(40,168,110,0.10)', borderRadius: 14, fontFamily: FONT }}>
        <p className="text-lg mb-1" style={{ color: '#28A86E', fontWeight: 700 }}>Meldingen er sendt.</p>
        <p style={{ color: 'var(--tekst-3-app)' }}>
          Vi svarer til {epost} så snart vi kan, som regel innen et par dager.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={send} data-kontakt-skjema className="flex flex-col gap-5" noValidate={false}>
      {/* Honeypot: mennesker ser ikke feltet, roboter fyller det ut. */}
      <p hidden><label>Ikke fyll ut dette feltet: <input name="bot-field" tabIndex={-1} autoComplete="off" /></label></p>

      <div>
        <label htmlFor="kontakt-epost" style={etikett}>Din e-post</label>
        <input id="kontakt-epost" name="epost" type="email" required autoComplete="email"
          placeholder="navn@eksempel.no" value={epost} onChange={e => setEpost(e.target.value)} style={felt}
          onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--kant-4)')} />
      </div>
      <div>
        <label htmlFor="kontakt-emne" style={etikett}>Emne</label>
        <input id="kontakt-emne" name="emne" type="text" required maxLength={120}
          placeholder="Hva gjelder det?" value={emne} onChange={e => setEmne(e.target.value)} style={felt}
          onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--kant-4)')} />
      </div>
      <div>
        <label htmlFor="kontakt-melding" style={etikett}>Melding</label>
        <textarea id="kontakt-melding" name="melding" required rows={7} maxLength={4000}
          placeholder="Skriv så mye du vil. Gjelder det en økt eller en synk, ta gjerne med dato."
          value={melding} onChange={e => setMelding(e.target.value)} style={{ ...felt, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--kant-4)')} />
      </div>

      {tilstand === 'feil' && (
        <p data-kontakt-feil className="text-sm px-3 py-2" style={{ fontFamily: FONT, color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.10)', border: '1px solid rgba(255,69,0,0.30)', borderRadius: 10 }}>
          Vi fikk ikke sendt meldingen akkurat nå. Send den som e-post i stedet:{' '}
          <a href={mailto} style={{ color: '#FF4500', textDecoration: 'underline' }}>{SUPPORT}</a>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-1">
        <button type="submit" disabled={tilstand === 'sender'}
          style={{ ...PILLE_BASIS, minHeight: 48, padding: '0 28px', fontSize: 15, backgroundColor: tilstand === 'sender' ? '#7A2200' : '#FF4500', color: '#FFFFFF', border: 'none', opacity: tilstand === 'sender' ? 0.7 : 1, cursor: tilstand === 'sender' ? 'not-allowed' : 'pointer' }}>
          {tilstand === 'sender' ? 'Sender...' : 'Send melding'}
        </button>
        <span style={{ fontFamily: FONT, fontSize: 14, color: 'var(--tekst-5-app)' }}>
          eller skriv rett til{' '}
          <a href={`mailto:${SUPPORT}`} style={{ color: '#FF4500', textDecoration: 'none', fontWeight: 700 }}>{SUPPORT}</a>
        </span>
      </div>
    </form>
  )
}
