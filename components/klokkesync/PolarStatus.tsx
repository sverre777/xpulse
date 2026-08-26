'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { xpAlert } from '@/components/ui/ConfirmDialog'
import { setPolarAutoSync } from '@/app/actions/polar-sync'
import { getKlokkesyncBrand } from '@/lib/klokkesync-brands'
import { BrandMark } from './KlokkesyncBrandPicker'
import { PolarDisconnectModal } from './PolarDisconnectModal'

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
  last_webhook_at: string | null
  registered_at: string | null
  connected_at: string
}

// Polar deaktiverer webhooken automatisk etter 7 døgn med feilende
// leveranser. Vi advarer fra dag 5 — da er det fortsatt tid til å fikse.
const WEBHOOK_WARN_DAYS = 5

// Merke-flisen hentes fra samme liste som merkevelgeren, så kortet og
// velgeren aldri kan komme i utakt.
const polarBrand = getKlokkesyncBrand('polar')

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
  frakoblet: {
    label: '✓ Polar er frakoblet',
    hint: 'Alle Polar-importerte økter, aktiviteter og rå-data er slettet, og X-PULSE er avregistrert hos Polar. Økter du har lastet opp som .fit-filer eller ført manuelt er ikke rørt.',
    tone: 'ok',
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
  nøytral: 'var(--tekst-5-app)',
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
        <div style={{ marginTop: 6, fontSize: 12, color: 'rgb(var(--tekst-land-rgb) / 0.72)', lineHeight: 1.6 }}>
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
  const [showDisconnect, setShowDisconnect] = useState(false)

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
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-3"
          style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
            letterSpacing: '0.06em', color: 'var(--tekst-1-app)', margin: 0,
          }}>
          {polarBrand && <BrandMark brand={polarBrand} size={32} />}
          Polar
        </h2>
        <button type="button" onClick={() => setShowDisconnect(true)} disabled={pending}
          style={{
            background: 'none', border: '1px solid var(--kant-6)', borderRadius: 10,
            padding: '8px 14px', cursor: pending ? 'default' : 'pointer', color: 'var(--tekst-5-app)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
          Frakoble
        </button>
      </div>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'var(--tekst-1-app)' }}>
        Koblet · polar-bruker <code style={{ color: 'var(--tekst-5-app)', fontSize: 13 }}>{conn.polar_user_id}</code>
      </div>

      {conn.registered_at ? (
        <>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-app)', marginTop: 2 }}>
            Registrert hos Polar {new Date(conn.registered_at).toLocaleString('nb-NO')}
            {conn.last_sync_at
              ? <> · sist synket {new Date(conn.last_sync_at).toLocaleString('nb-NO')}</>
              : <> · ingen økter synket ennå</>}
          </div>
          <WebhookStatus lastWebhookAt={conn.last_webhook_at} />
        </>
      ) : (
        <div className="p-3 mt-3"
          style={{
            background: 'rgba(245,197,66,0.08)',
            border: '1px solid rgba(245,197,66,0.4)', borderRadius: 10,
            borderLeft: '3px solid #F5C542',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'var(--tekst-1-app)', lineHeight: 1.6,
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
                background: '#FF4500', color: 'var(--tekst-1-app)', border: 'none', borderRadius: 10,
                padding: '9px 18px', cursor: pending ? 'default' : 'pointer',
                opacity: pending ? 0.7 : 1,
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
              }}>
              {pending ? 'Registrerer …' : 'Fullfør registrering'}
            </button>
          </div>
          {lastResult && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(var(--tekst-land-rgb) / 0.72)' }}>
              {lastResult}
            </div>
          )}
        </div>
      )}

      {conn.registered_at && (
        <label className="flex items-center gap-2 mt-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)', minHeight: 44 }}>
          <input type="checkbox" checked={conn.auto_sync} disabled={pending}
            onChange={() => {
              startTransition(async () => {
                const res = await setPolarAutoSync(!conn.auto_sync)
                if ('error' in res) void xpAlert(res.error)
                router.refresh()
              })
            }} />
          Auto-synk nye Polar-økter (varsles direkte, sikkerhetsnett hver 6. time)
        </label>
      )}

      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
        color: 'var(--tekst-5-app)', lineHeight: 1.7, marginTop: 14, marginBottom: 0,
      }}>
        Polar gir kun økter fra de <strong style={{ color: 'var(--tekst-1-app)' }}>siste 30 dagene</strong>, og kun
        økter som lastes opp til Polar Flow <strong style={{ color: 'var(--tekst-1-app)' }}>etter</strong> at du
        koblet til. Eldre økter henter du inn med <strong style={{ color: '#FF4500' }}>.fit-opplasting</strong> under.
      </p>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: 'var(--tekst-8-app)', letterSpacing: '0.06em', marginTop: 8, marginBottom: 0,
      }}>
        Datakilde: Polar Ecosystem
      </p>

      <PolarDisconnectModal
        open={showDisconnect}
        onClose={() => setShowDisconnect(false)}
      />
    </section>
  )
}

// Overvåkning av webhooken. Polar sender nye økter til oss automatisk
// (primærkanalen); cron-fallbacken går hver 6. time uansett, så brukeren
// mister ikke data selv om webhooken er stille — men de skal kunne se det.
function WebhookStatus({ lastWebhookAt }: { lastWebhookAt: string | null }) {
  const days = lastWebhookAt
    ? Math.floor((Date.now() - new Date(lastWebhookAt).getTime()) / 86400_000)
    : null
  const stale = days == null || days >= WEBHOOK_WARN_DAYS

  if (!stale) {
    return (
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#28A86E', marginTop: 4 }}>
        ✓ Direkte-varsling fra Polar er aktiv
        {lastWebhookAt && <span style={{ color: 'var(--tekst-8-app)' }}> · sist {new Date(lastWebhookAt).toLocaleString('nb-NO')}</span>}
      </div>
    )
  }

  return (
    <div className="p-3 mt-3"
      style={{
        background: 'rgba(245,197,66,0.08)',
        border: '1px solid rgba(245,197,66,0.4)', borderRadius: 10,
        borderLeft: '3px solid #F5C542',
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
        color: 'rgb(var(--tekst-land-rgb) / 0.8)', lineHeight: 1.6,
      }}>
      <span style={{ color: '#F5C542', fontWeight: 600 }}>
        {days == null
          ? 'Venter på første direkte-varsling fra Polar'
          : `Ingen direkte-varsling fra Polar på ${days} dager`}
      </span>
      <br />
      Nye økter hentes fortsatt inn automatisk hver 6. time, så du mister ingenting.
      {days != null && ' Vedvarer det, kan Polar ha slått av varslingen — si fra, så kobler vi den opp igjen.'}
    </div>
  )
}
