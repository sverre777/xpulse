'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { xpAlert } from '@/components/ui/ConfirmDialog'

// Polar-flatene som hører til bolk 2 (OAuth + registrering):
//  · PolarStatusBanner — leser ?polar=<status> fra callbacken og viser en
//    lesbar melding. Vi tester OAuth-flyten live i prod (én Polar-klient,
//    ingen localhost-runde), så hver feiltilstand har sin egen tekst med
//    konkret neste steg.
//  · PolarConnectionBlock — vises KUN når brukeren faktisk har en Polar-
//    tilkobling. Viser om registreringen hos Polar er fullført, og lar
//    brukeren fullføre den uten ny OAuth-runde.
//
// Det fulle Polar-kortet (koble til, auto-synk-toggle, sist synkronisert,
// frakobling) hører til bolk 5 og bygges etter at frakoblingen (bolk 3) finnes.
// Polar krediteres som «Polar Ecosystem» der Polar-data vises — Polars navn
// brukes kun for å vise interoperabilitet, ikke som markedsføringselement.

export interface PolarConn {
  polar_user_id: number
  auto_sync: boolean
  last_sync_at: string | null
  registered_at: string | null
  connected_at: string
}

const POLAR_STATUS: Record<string, { label: string; hint?: string; tone: 'ok' | 'feil' | 'nøytral' }> = {
  koblet: {
    label: '✓ Polar er koblet til',
    hint: 'Polar gir kun økter fra de siste 30 dagene, og kun økter som lastes opp til Polar Flow etter at du koblet til. Eldre økter må lastes opp som .fit-filer.',
    tone: 'ok',
  },
  avbrutt: {
    label: 'Du avbrøt Polar-tilkoblingen',
    tone: 'nøytral',
  },
  'feil-state': {
    label: 'Sikkerhetsfeil — prøv igjen',
    hint: 'Tilkoblingen ble avbrutt fordi CSRF-kontrollen ikke gikk opp. Start tilkoblingen på nytt fra denne siden.',
    tone: 'feil',
  },
  'ikke-innlogget': {
    label: 'Logg inn først, så prøv igjen',
    tone: 'feil',
  },
  'token-feilet': {
    label: 'Polar ga oss ikke et gyldig token',
    hint: 'Autorisasjonskoden fra Polar varer bare 10 minutter og kan brukes én gang. Prøv tilkoblingen på nytt.',
    tone: 'feil',
  },
  'samtykke-mangler': {
    label: 'Polar-kontoen mangler obligatoriske samtykker',
    hint: 'Polar nekter datatilgang til alle obligatoriske samtykker er godtatt. Logg inn på flow.polar.com, godta samtykkene, og trykk «Fullfør registrering» under.',
    tone: 'feil',
  },
  'allerede-koblet': {
    label: 'Denne Polar-kontoen er allerede koblet til en annen X-PULSE-bruker',
    hint: 'Én Polar-konto kan kun være koblet til én X-PULSE-konto. Koble fra i den andre kontoen først.',
    tone: 'feil',
  },
  'registrering-feilet': {
    label: 'Tilkoblingen ble lagret, men registreringen hos Polar feilet',
    hint: 'Tilkoblingen er beholdt — trykk «Fullfør registrering» under for å prøve igjen.',
    tone: 'feil',
  },
  'registrering-konflikt': {
    label: 'Polar har en eldre registrering som blokkerer denne kontoen',
    hint: 'Polar sier kontoen allerede er registrert, men registreringen gjelder en annen Polar-bruker. Koble fra Polar — det avregistrerer oss hos Polar — og koble til på nytt.',
    tone: 'feil',
  },
  'lagring-feilet': {
    label: 'Kunne ikke lagre Polar-tilkoblingen',
    tone: 'feil',
  },
  'oppsett-mangler': {
    label: 'Polar-tilkobling er ikke ferdig satt opp',
    hint: 'Miljøvariablene for Polar mangler på serveren. Ingenting er lagret.',
    tone: 'feil',
  },
}

const TONE_COLOR: Record<'ok' | 'feil' | 'nøytral', string> = {
  ok: '#28A86E',
  feil: '#E11D48',
  nøytral: '#8A8A96',
}

export function PolarStatusBanner({ status, detail }: { status: string | null; detail?: string | null }) {
  if (!status) return null
  const s = POLAR_STATUS[status]
  if (!s) return null
  const color = TONE_COLOR[s.tone]
  return (
    <div className="p-4"
      style={{
        background: s.tone === 'ok' ? 'rgba(40,168,110,0.08)'
          : s.tone === 'feil' ? 'rgba(225,29,72,0.08)'
          : 'rgba(138,138,150,0.08)',
        border: `1px solid ${color}`,
        color,
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
      }}>
      <div style={{ fontWeight: 600 }}>Polar: {s.label}</div>
      {s.hint && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(242,240,236,0.72)', lineHeight: 1.6 }}>
          {s.hint}
        </div>
      )}
      {detail && (
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
          Detaljer: <code>{detail}</code>
        </div>
      )}
    </div>
  )
}

export function PolarConnectionBlock({ conn }: { conn: PolarConn }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleRegister = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/polar/register', { method: 'POST' })
        const data = await res.json() as { ok?: boolean; note?: string; error?: string }
        const message = data.note ?? data.error ?? 'Ukjent svar fra registreringen.'
        setLastResult(message)
        if (!data.ok) void xpAlert(message)
        router.refresh()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Uventet feil'
        setLastResult(message)
        void xpAlert(message)
      }
    })
  }

  return (
    <section className="p-5"
      style={{
        background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 14, borderTop: '3px solid #FF4500',
      }}>
      <h2 className="mb-3 flex items-center gap-3"
        style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: '0.06em', color: '#F0F0F2', margin: 0,
        }}>
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        Polar
      </h2>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: '#F0F0F2' }}>
        Koblet · polar-bruker <code style={{ color: '#8A8A96', fontSize: 13 }}>{conn.polar_user_id}</code>
      </div>

      {conn.registered_at ? (
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555560', marginTop: 2 }}>
          Registrert hos Polar {new Date(conn.registered_at).toLocaleString('nb-NO')}
          {conn.last_sync_at && <> · sist synket {new Date(conn.last_sync_at).toLocaleString('nb-NO')}</>}
        </div>
      ) : (
        <div className="p-3 mt-3"
          style={{
            background: 'rgba(245,197,66,0.08)',
            border: '1px solid rgba(245,197,66,0.4)', borderRadius: 10,
            borderLeft: '3px solid #F5C542',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: '#F0F0F2', lineHeight: 1.6,
          }}>
          <div style={{ color: '#F5C542', fontWeight: 600, marginBottom: 4 }}>
            Registreringen hos Polar er ikke fullført
          </div>
          Polar krever at kontoen din registreres hos oss før data kan hentes, og at
          alle obligatoriske samtykker er godtatt i Polar Flow. Godta samtykkene på{' '}
          <span style={{ color: '#FF4500' }}>flow.polar.com</span> og fullfør her.
          <div className="mt-3">
            <button type="button" onClick={handleRegister} disabled={pending}
              style={{
                background: '#FF4500', color: '#F0F0F2', border: 'none', borderRadius: 10,
                padding: '9px 18px', cursor: pending ? 'default' : 'pointer',
                opacity: pending ? 0.7 : 1,
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
              }}>
              {pending ? 'Registrerer …' : 'Fullfør registrering'}
            </button>
          </div>
          {lastResult && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(242,240,236,0.72)' }}>
              {lastResult}
            </div>
          )}
        </div>
      )}

      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
        color: '#8A8A96', lineHeight: 1.7, marginTop: 14, marginBottom: 0,
      }}>
        Polar gir kun økter fra de <strong style={{ color: '#F0F0F2' }}>siste 30 dagene</strong>, og kun
        økter som lastes opp til Polar Flow <strong style={{ color: '#F0F0F2' }}>etter</strong> at du
        koblet til. Eldre økter henter du inn med <strong style={{ color: '#FF4500' }}>.fit-opplasting</strong> under.
      </p>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: '#555560', letterSpacing: '0.06em', marginTop: 8, marginBottom: 0,
      }}>
        Datakilde: Polar Ecosystem
      </p>
    </section>
  )
}
