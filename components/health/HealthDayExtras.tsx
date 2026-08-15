'use client'

import { useEffect, useState } from 'react'
import { getHealthDayExtras, type HealthDayExtras as Extras } from '@/app/actions/health-metrics'

// To ting under helse-skjemaet, brukt både i modalen og på helse-siden:
//
//  1. MERKESPESIFIKKE SKÅRER for dagen, vist med merkenavn og holdt UTENFOR
//     fellesfeltene. Polars Nightly Recharge, søvnskår og ANS-lading har egne
//     algoritmer og egne skalaer — de skal aldri blandes inn i en felles
//     trendlinje sammen med tall fra andre merker eller manuell føring.
//
//  2. ENKEL TREND for de siste 14 dagene. Slår sammen manuell føring og
//     importerte verdier med manuell-vinner-regelen, og tar KUN med dager som
//     faktisk har en verdi — ingen nuller for dager uten data.
//
// Dagens analyse-flater er ikke rørt: dette er en ny visning ved siden av.

const LABELS: Record<string, { label: string; format?: (v: unknown) => string }> = {
  nightly_recharge_status: {
    label: 'Nightly Recharge',
    format: v => ['', 'svært dårlig', 'dårlig', 'svekket', 'OK', 'god', 'svært god'][Number(v)] ?? String(v),
  },
  ans_charge: { label: 'ANS-lading' },
  ans_charge_status: { label: 'ANS mot vanlig', format: v => ['', 'langt under', 'under', 'vanlig', 'over', 'langt over'][Number(v)] ?? String(v) },
  sleep_score: { label: 'Søvnskår' },
  sleep_charge: { label: 'Søvn mot vanlig', format: v => ['', 'langt under', 'under', 'vanlig', 'over', 'langt over'][Number(v)] ?? String(v) },
  continuity: { label: 'Søvnkontinuitet' },
  sleep_cycles: { label: 'Søvnsykluser' },
  breathing_rate_avg: { label: 'Pustefrekvens' },
  group_duration_score: { label: 'Varighet-skår' },
  group_solidity_score: { label: 'Soliditet-skår' },
  group_regeneration_score: { label: 'Regenerering-skår' },
}

export function HealthDayExtras({ date }: { date: string }) {
  const [data, setData] = useState<Extras | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getHealthDayExtras(date)
      .then(res => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [date])

  if (loading) return null
  if (!data || (data.brand.length === 0 && data.trend.length === 0)) return null

  return (
    <div className="space-y-5 mt-6">
      {data.brand.map(rad => (
        <BrandSection key={rad.brand} brand={rad.brand} metrics={rad.metrics} />
      ))}
      {data.trend.length > 0 && <TrendSection points={data.trend} />}
    </div>
  )
}

function BrandSection({ brand, metrics }: { brand: string; metrics: Record<string, unknown> }) {
  const rader = Object.entries(metrics).filter(([, v]) => v != null)
  if (rader.length === 0) return null
  const merkenavn = brand.charAt(0).toUpperCase() + brand.slice(1)

  return (
    <div className="p-4" style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <p className="mb-2" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8A96', margin: 0,
      }}>
        ⌚ Fra {merkenavn}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
        {rader.map(([key, value]) => {
          const spec = LABELS[key]
          const vist = spec?.format ? spec.format(value) : String(value)
          return (
            <div key={key} className="flex items-baseline justify-between gap-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>
              <span style={{ color: '#8A8A96' }}>{spec?.label ?? key}</span>
              <span style={{ color: '#F0F0F2', fontWeight: 600 }}>{vist}</span>
            </div>
          )
        })}
      </div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: '#555560', lineHeight: 1.5, margin: '10px 0 0',
      }}>
        {merkenavn} sine egne skårer, på {merkenavn} sin skala. De regnes ikke inn i
        trenden under, som bruker verdier som er sammenlignbare på tvers av kilder.
        {brand === 'polar' && ' Datakilde: Polar Ecosystem.'}
      </p>
    </div>
  )
}

function TrendSection({ points }: { points: { date: string; resting_hr: number | null; hrv_ms: number | null; sleep_hours: number | null }[] }) {
  return (
    <div className="p-4" style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <p className="mb-3" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8A96', margin: 0,
      }}>
        Siste 14 dager
      </p>
      <div className="space-y-3">
        <TrendRow label="Hvilepuls" unit="bpm" color="#28A86E"
          values={points.map(p => ({ date: p.date, v: p.resting_hr }))} />
        <TrendRow label="HRV" unit="ms" color="#8B5CF6"
          values={points.map(p => ({ date: p.date, v: p.hrv_ms }))} />
        <TrendRow label="Sovetid" unit="t" color="#1A6FD4"
          values={points.map(p => ({ date: p.date, v: p.sleep_hours }))} />
      </div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: '#555560', lineHeight: 1.5, margin: '10px 0 0',
      }}>
        Snitt regnes kun av dager som faktisk har en verdi — dager uten føring teller ikke som null.
      </p>
    </div>
  )
}

// Enkel søylerad. Ingen akser, ingen biblioteker: dette er et raskt blikk på
// retningen, ikke en analyse. Den dype analysen ligger i analyse-delen.
function TrendRow({ label, unit, color, values }: {
  label: string
  unit: string
  color: string
  values: { date: string; v: number | null }[]
}) {
  const førte = values.filter(x => x.v != null) as { date: string; v: number }[]
  if (førte.length === 0) return null

  const tall = førte.map(x => x.v)
  const min = Math.min(...tall)
  const max = Math.max(...tall)
  const snitt = tall.reduce((a, b) => a + b, 0) / tall.length
  const spenn = max - min || 1
  const siste = førte[førte.length - 1]

  return (
    <div>
      <div className="flex items-baseline justify-between"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12 }}>
        <span style={{ color: '#8A8A96' }}>{label}</span>
        <span style={{ color: '#F0F0F2' }}>
          {siste.v}{unit} <span style={{ color: '#555560' }}>· snitt {Math.round(snitt * 10) / 10}{unit} av {førte.length} dager</span>
        </span>
      </div>
      <div className="flex items-end gap-0.5 mt-1" style={{ height: 28 }}>
        {førte.map(p => {
          const høyde = 6 + ((p.v - min) / spenn) * 22
          return (
            <span key={p.date} title={`${p.date}: ${p.v}${unit}`}
              style={{ flex: 1, height: høyde, background: color, opacity: 0.75, borderRadius: 2 }} />
          )
        })}
      </div>
    </div>
  )
}
