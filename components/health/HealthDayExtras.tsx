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
  // Klokkesynk-merkene (garmin/coros) — nøklene settes i lib/stridee-import.ts
  sleep_validation: { label: 'Målestatus', format: v => String(v).endsWith('FINAL') ? 'endelig' : 'foreløpig' },
  nap_minutes: { label: 'Høneblund', format: v => `${v} min` },
  body_battery_charged: { label: 'Body Battery ladet' },
  body_battery_drained: { label: 'Body Battery tappet' },
  avg_stress: { label: 'Stress (snitt)' },
  max_stress: { label: 'Stress (maks)' },
  stress_qualifier: { label: 'Stressprofil', format: v => STRESSPROFIL_NO[String(v)] ?? String(v).replace(/_/g, ' ') },
  hrv_5min_high: { label: 'HRV natt-topp (5 min)', format: v => `${v} ms` },
  vo2max: { label: 'VO₂maks' },
  fitness_age: { label: 'Kondisjonsalder' },
}

const STRESSPROFIL_NO: Record<string, string> = {
  calm: 'rolig', balanced: 'balansert', stressful: 'stresset',
  very_stressful: 'svært stresset', calm_awake: 'rolig våken tid',
  balanced_awake: 'balansert våken tid', stressful_awake: 'stresset våken tid',
}

// Garmins delskårer for søvn (sleep_scores-objektet) — flates ut til egne
// rader. Kvalifikatorene er Garmins egne trinn.
const SOVNSKAR_NO: Record<string, string> = {
  totalDuration: 'Søvn: varighet',
  stress: 'Søvn: stress',
  awakeCount: 'Søvn: oppvåkninger',
  restlessness: 'Søvn: urolighet',
  remPercentage: 'Søvn: REM-andel',
  deepPercentage: 'Søvn: dypsøvn-andel',
  lightPercentage: 'Søvn: lettsøvn-andel',
}
const KVALIFIKATOR_NO: Record<string, string> = {
  EXCELLENT: 'svært god', GOOD: 'god', FAIR: 'middels', POOR: 'svak',
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

// En verdi uten innhold vises ikke i det hele tatt.
function harInnhold(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== '' && v.toLowerCase() !== 'unknown'
  return true
}

function BrandSection({ brand, metrics }: { brand: string; metrics: Record<string, unknown> }) {
  // Kun felter med norsk etikett rendres — et rått API-navn eller et objekt
  // gjennom String() er en bug, ikke en visning. Ukjente/nye felter fra en
  // import ligger trygt i tabellen til de får etikett her.
  const rader: { key: string; label: string; vist: string }[] = []
  for (const [key, value] of Object.entries(metrics)) {
    if (!harInnhold(value)) continue
    if (key === 'sleep_scores' && typeof value === 'object') {
      // Garmins delskårer: én rad per delskår, med norsk etikett og trinn.
      for (const [del, obj] of Object.entries(value as Record<string, unknown>)) {
        const label = SOVNSKAR_NO[del]
        const kval = (obj as { qualifierKey?: unknown } | null)?.qualifierKey
        if (!label || typeof kval !== 'string' || !harInnhold(kval)) continue
        rader.push({ key: `sleep_scores.${del}`, label, vist: KVALIFIKATOR_NO[kval] ?? kval.toLowerCase() })
      }
      continue
    }
    const spec = LABELS[key]
    if (!spec || typeof value === 'object') continue
    const vist = spec.format ? spec.format(value) : String(value)
    if (!harInnhold(vist)) continue
    rader.push({ key, label: spec.label, vist })
  }
  if (rader.length === 0) return null
  const merkenavn = brand.charAt(0).toUpperCase() + brand.slice(1)

  return (
    <div className="p-4" style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <p className="mb-2" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', margin: 0,
      }}>
        ⌚ Fra {merkenavn}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
        {rader.map(rad => (
          <div key={rad.key} className="flex items-baseline justify-between gap-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>
            <span style={{ color: 'var(--tekst-5-app)' }}>{rad.label}</span>
            <span style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{rad.vist}</span>
          </div>
        ))}
      </div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: 'var(--tekst-8-app)', lineHeight: 1.5, margin: '10px 0 0',
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
        letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', margin: 0,
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
        color: 'var(--tekst-8-app)', lineHeight: 1.5, margin: '10px 0 0',
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
        <span style={{ color: 'var(--tekst-5-app)' }}>{label}</span>
        <span style={{ color: 'var(--tekst-1-app)' }}>
          {siste.v}{unit} <span style={{ color: 'var(--tekst-8-app)' }}>· snitt {Math.round(snitt * 10) / 10}{unit} av {førte.length} dager</span>
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
