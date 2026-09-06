'use client'

// NAVIGASJON v2 bolk 5 — SYNK-ARKET (utøver). Bunn-ark i KortPopup-ramma
// (fullskjerm ≤620): status per kilde (Garmin · Polar · Strava · COROS/Wahoo/
// Zepp via leverandør · .FIT-fil) m/ «Tilkoblet · synk automatisk» / «Koble
// til» / «Last opp», siste synk, «n nye økter hentet i dag → Se innboks»,
// «Synk nå» (grønn, full bredde), nederst «Klokkesynk-innstillinger →».
// Bruker eksisterende status og actions — ingen ny synklogikk. Strava =
// visning + eksisterende tilkoblingsknapp (regel 1).

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KortPopup } from '@/components/oversikt/KortPopup'
import { hentSynkStatus, type SynkStatus } from '@/app/actions/synk-status'
import { syncConnectedWatches } from '@/app/actions/klokkesync-sync'

const FONT = "'Barlow Condensed', sans-serif"
const GRONN = '#28A86E'
const ORANSJE = '#FF4500'

function relativ(iso: string | null): string {
  if (!iso) return 'aldri'
  const d = Date.now() - new Date(iso).getTime(), m = Math.round(d / 60000)
  if (m < 1) return 'nå'; if (m < 60) return `${m} min siden`; const t = Math.round(m / 60); if (t < 24) return `${t} t siden`
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export function SynkArk({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [status, setStatus] = useState<SynkStatus | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [synker, setSynker] = useState(false)
  const [melding, setMelding] = useState<string | null>(null)
  const last = async () => { const r = await hentSynkStatus(); if ('error' in r) setFeil(r.error); else setStatus(r) }
  useEffect(() => { let live = true; hentSynkStatus().then(r => { if (!live) return; if ('error' in r) setFeil(r.error); else setStatus(r) }); return () => { live = false } }, [])
  const synkNaa = async () => {
    setSynker(true); setMelding(null)
    try { const r = await syncConnectedWatches(); setMelding(r.error ? r.error : `${r.imported} ny${r.imported === 1 ? '' : 'e'} økt${r.imported === 1 ? '' : 'er'} hentet`); await last(); router.refresh() }
    catch { setMelding('Synk feilet — prøv igjen') } finally { setSynker(false) }
  }
  const tilkoblede = status?.kilder.filter(k => k.tilkoblet) ?? []
  return (
    <KortPopup kicker="Klokkesynk" tittel="Synk" undertittel={status ? `Sist synket ${relativ(status.lastSyncAt)}` : 'Henter status…'} videreHref="/app/innstillinger/klokkesync" videreTekst="Klokkesynk-innstillinger" onClose={onClose}>
      <div data-synk-ark className="flex flex-col gap-2">
        {feil && <p style={{ fontFamily: FONT, color: '#E23A5A', fontSize: 13 }}>{feil}</p>}
        {(status?.kilder ?? []).map(k => (
          <div key={k.slug} data-synk-kilde={k.slug} data-tilkoblet={k.tilkoblet ? '1' : '0'} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k.name}{k.via ? <span style={{ fontWeight: 400, color: 'var(--tekst-8-app)', textTransform: 'none', letterSpacing: 0 }}> · via klokkesynk-leverandør</span> : null}</p>
              <p style={{ fontFamily: FONT, fontSize: 12.5, color: k.feil ? '#E23A5A' : k.tilkoblet ? GRONN : 'var(--tekst-5-app)', margin: '2px 0 0' }}>
                {k.feil ? 'Synk feilet — re-koble' : k.tilkoblet ? `Tilkoblet${k.autoSynk ? ' · synk automatisk' : ''}${k.lastSyncAt ? ` · ${relativ(k.lastSyncAt)}` : ''}` : 'Ikke tilkoblet'}
              </p>
            </div>
            {k.tilkoblet && !k.feil ? <span aria-hidden style={{ color: GRONN, fontSize: 18 }}>✓</span> : (
              <Link href={k.feil ? `/app/innstillinger/klokkesync/${k.slug}` : (k.connectPath ?? '/app/innstillinger/klokkesync')} data-synk-koble={k.slug} onClick={onClose}
                style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: k.feil ? '#E23A5A' : ORANSJE, textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>{k.feil ? 'Re-koble' : 'Koble til'}</Link>
            )}
          </div>
        ))}
        <div data-synk-kilde="fit" className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0, letterSpacing: '0.06em' }}>.FIT-FIL</p>
            <p style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', margin: '2px 0 0' }}>Garmin · COROS · Suunto · Wahoo</p>
          </div>
          <Link href="/app/innstillinger/klokkesync#fit" data-synk-lastopp onClick={onClose} style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANSJE, textDecoration: 'none', fontWeight: 700 }}>Last opp</Link>
        </div>
        {status && (
          <p data-synk-nye style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', margin: '8px 0 0' }}>
            {status.nyeIDag} ny{status.nyeIDag === 1 ? '' : 'e'} økt{status.nyeIDag === 1 ? '' : 'er'} hentet i dag{status.nyeIDag > 0 ? <> → <Link href="/app/innboks" onClick={onClose} style={{ color: ORANSJE }}>Se innboks</Link></> : null}
          </p>
        )}
        <button type="button" data-synk-naa onClick={synkNaa} disabled={synker || tilkoblede.length === 0} className="xp-btn"
          style={{ width: '100%', marginTop: 10, minHeight: 48, background: GRONN, borderColor: GRONN, color: 'var(--tekst-1-ren)', opacity: synker || tilkoblede.length === 0 ? 0.6 : 1, fontFamily: FONT, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', borderRadius: 12 }}>
          {synker ? 'Synker…' : 'Synk nå'}
        </button>
        {melding && <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', margin: '6px 0 0' }}>{melding}</p>}
      </div>
    </KortPopup>
  )
}
