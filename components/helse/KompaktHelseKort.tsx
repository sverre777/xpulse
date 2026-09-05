'use client'

import { useEffect, useState } from 'react'
import { getHelseOversikt, type HelseOversiktData } from '@/app/actions/helse-oversikt'
import { HelseOversikt } from './HelseOversikt'
import { FallbackStripe, formatTimer } from './SovnGrafikk'

// KOMPAKT HELSEKORT (visning C fra design/xpulse-helse-oversikt-design.html):
// fire minifliser + natta i miniatyr. Hele kortet er klikkbart — klikk åpner
// hele oversikten (visning A, med VIS MER inni) som pop-up. SAMME kort og
// samme data-action som resten av helseflaten (regel 11, aldri kopier).
// Brukes på hjem-skjermen og ved dag-klikk i kalenderen.

export function KompaktHelseKort({ targetUserId, sluttDato, tomTekst, forhandsdata, tillegg, fot }: {
  targetUserId?: string
  /** Dag-klikk: fliser og popup ankres til denne dagen. Uten = i dag. */
  sluttDato?: string
  /** Hjem-konteksten viser en «kom i gang»-tekst uten data; dag-klikk
   * skjuler kortet helt (dagen HAR ikke helsedata da). */
  tomTekst?: string
  /** Ferdig hentet 30-dagers data (server-prefetch) — hopper over egen henting. */
  forhandsdata?: HelseOversiktData
  /** HJEM v2 bolk 8: innhold under flisene (HRV/hvilepuls-grafen) og en fot
      (Logg helse · Vis mer) — begge får dataene. Utenfor kort-knappen, så
      klikk i dem ikke åpner helseoversikten. */
  tillegg?: (data: HelseOversiktData) => React.ReactNode
  fot?: (data: HelseOversiktData) => React.ReactNode
}) {
  const [data, setData] = useState<HelseOversiktData | null>(forhandsdata ?? null)
  const [lastet, setLastet] = useState(!!forhandsdata)
  const [apen, setApen] = useState(false)

  const anker = sluttDato ?? isoDato(new Date())

  useEffect(() => {
    if (forhandsdata) return
    let avbrutt = false
    const fra = new Date(`${anker}T12:00:00`); fra.setDate(fra.getDate() - 30)
    getHelseOversikt(isoDato(fra), anker, targetUserId).then(res => {
      if (avbrutt) return
      if (!('error' in res)) setData(res)
      setLastet(true)
    })
    return () => { avbrutt = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anker, targetUserId])

  if (!lastet) return null
  if (!data || !data.harData || data.dager.length === 0) {
    if (!tomTekst) return null
    return (
      <div className="p-4" style={ramme}>
        <Tittel kilde={null} />
        <p style={{ fontSize: 13, color: 'var(--tekst-8-app)', fontFamily: "'Barlow Condensed', sans-serif", margin: '8px 0 0' }}>
          {tomTekst}
        </p>
      </div>
    )
  }

  // Flisene viser ankerdagens verdier — eller siste dag med verdi i spennet.
  const siste = (felt: 'resting_hr' | 'hrv_ms' | 'total_sleep_minutes' | 'sleep_score' | 'day_form') =>
    [...data.dager].reverse().find(d => d[felt] != null)?.[felt] ?? null
  const snitt = (felt: 'resting_hr' | 'hrv_ms' | 'sleep_score') => {
    const v = data.dager.map(d => d[felt]).filter((x): x is number => typeof x === 'number')
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  const natt = data.sisteNatt ? data.dager.find(d => d.date === data.sisteNatt!.date) ?? null : null
  const folelse = data.dager.find(d => d.date === anker)?.day_form ?? null

  return (
    <div data-helse-kort style={tillegg || fot ? { ...ramme, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } : undefined}>
      <button type="button" onClick={() => setApen(true)}
        className="block w-full text-left transition-opacity hover:opacity-95"
        style={tillegg || fot ? { cursor: 'pointer', padding: 0, background: 'none', border: 'none' } : { ...ramme, cursor: 'pointer', padding: 0, overflow: 'hidden' }}
        title="Åpne hele helseoversikten">
        <div className="flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <Tittel kilde={data.kilde.navn} />
          <span style={{ color: 'var(--tekst-8-app)', fontSize: 12 }}>åpne →</span>
        </div>
        <div className="grid grid-cols-2" style={{ gap: 1, background: 'var(--line)' }}>
          <MiniFlis navn="HVILEPULS" verdi={siste('resting_hr') != null ? String(siste('resting_hr')) : '–'}
            under={snitt('resting_hr') != null ? `snitt ${snitt('resting_hr')}` : 'for lite data'} />
          <MiniFlis navn="HRV" verdi={siste('hrv_ms') != null ? String(Math.round(siste('hrv_ms') as number)) : '–'}
            under={snitt('hrv_ms') != null ? `snitt ${snitt('hrv_ms')}` : 'for lite data'} />
          <MiniFlis navn="SØVN" verdi={siste('total_sleep_minutes') != null ? formatTimer(siste('total_sleep_minutes') as number) : '–'}
            under={siste('sleep_score') != null ? `score ${siste('sleep_score')}` : 'for lite data'} />
          <MiniFlis navn="FØLELSE" verdi={folelse != null ? `${folelse}` : '–'} liten={folelse != null ? '/5' : undefined}
            under={folelse != null ? 'ført' : '+ før i dag'} />
        </div>
        {natt && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            <FallbackStripe natt={natt} hoyde={16} />
          </div>
        )}
      </button>
      {tillegg && <div style={{ padding: '0 18px' }}>{tillegg(data)}</div>}
      {fot && <div style={{ padding: '10px 18px 14px', marginTop: 'auto' }}>{fot(data)}</div>}

      {apen && (
        <div onClick={() => setApen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 130, backgroundColor: 'var(--scrim-75)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: 16, overflowY: 'auto',
          }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 860, margin: '24px 0' }}>
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setApen(false)} aria-label="Lukk"
                style={{
                  background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 999,
                  color: 'var(--tekst-1-app)', width: 34, height: 34, cursor: 'pointer', fontSize: 18,
                }}>
                ×
              </button>
            </div>
            {/* forhandsdata = flisenes 30-dagers henting — ingen dobbelthenting */}
            <HelseOversikt targetUserId={targetUserId} kompaktHeader
              forhandsdata={data} sluttDato={sluttDato} foringsDato={sluttDato} />
          </div>
        </div>
      )}
    </div>
  )
}

function Tittel({ kilde }: { kilde: string | null }) {
  return (
    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.16em', fontSize: 14, color: 'var(--tekst-1-app)' }}>
      <span style={{ display: 'inline-block', width: 22, height: 4, borderRadius: 2, background: '#FF4500', marginRight: 9, verticalAlign: 'middle' }} />
      HELSE
      {kilde && kilde !== 'manual' && (
        <span style={{ color: 'var(--tekst-8-app)', fontWeight: 500, letterSpacing: '0.06em', marginLeft: 8, fontSize: 12, textTransform: 'none' }}>
          ⌚ i natt
        </span>
      )}
    </div>
  )
}

function MiniFlis({ navn, verdi, liten, under }: { navn: string; verdi: string; liten?: string; under: string }) {
  return (
    <div style={{ background: 'var(--card2)', padding: '12px 18px' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.16em', fontSize: 11, color: 'var(--tekst-5-app)' }}>
        {navn}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1.05, marginTop: 2, color: 'var(--tekst-1-app)' }}>
        {verdi}{liten && <small style={{ fontSize: 15, color: 'var(--tekst-5-app)' }}>{liten}</small>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--tekst-8-app)', marginTop: 1 }}>
        <b style={{ color: 'var(--tekst-5-app)', fontWeight: 600 }}>{under}</b>
      </div>
    </div>
  )
}

const ramme: React.CSSProperties = {
  background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14,
}

function isoDato(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
