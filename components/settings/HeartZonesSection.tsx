'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  HeartZone, ZoneName, ZONE_NAMES,
  computeZonesFromMaxHr, resolveMaxHr,
} from '@/lib/heart-zones'
import {
  saveHeartRateProfile, saveCustomHeartZones, resetHeartZonesToAuto,
} from '@/app/actions/settings'

const ZONE_COLORS: Record<ZoneName, string> = {
  I1: '#28A86E',
  I2: '#1A6FD4',
  I3: '#D4A017',
  I4: '#FF4500',
  I5: '#E11D48',
}

const ZONE_LABELS: Record<ZoneName, string> = {
  I1: 'Rolig langkjøring / Restitusjon',
  I2: 'Moderat langkjøring / Langkjøring 2',
  I3: 'Terskel / Moderat intensiv',
  I4: 'Intensiv terskel / VO2max-forberedelse',
  I5: 'VO2max / Høy intensitet',
}

interface Props {
  birthYear: number | null
  initialMaxHr: number | null
  initialThreshold: number | null
  initialResting: number | null
  initialZones: HeartZone[]        // alltid 5 rader (auto eller custom)
  hasCustomZones: boolean
}

interface ZoneForm {
  zone_name: ZoneName
  min_bpm: string
  max_bpm: string
}

function zonesToForm(z: HeartZone[]): ZoneForm[] {
  return ZONE_NAMES.map(name => {
    const r = z.find(x => x.zone_name === name)
    return {
      zone_name: name,
      min_bpm: r ? String(r.min_bpm) : '',
      max_bpm: r ? String(r.max_bpm) : '',
    }
  })
}

export function HeartZonesSection({
  birthYear, initialMaxHr, initialThreshold, initialResting,
  initialZones, hasCustomZones,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [maxHr, setMaxHr] = useState(initialMaxHr != null ? String(initialMaxHr) : '')
  const [threshold, setThreshold] = useState(initialThreshold != null ? String(initialThreshold) : '')
  const [resting, setResting] = useState(initialResting != null ? String(initialResting) : '')
  const [zones, setZones] = useState<ZoneForm[]>(zonesToForm(initialZones))
  const [customMode, setCustomMode] = useState(hasCustomZones)

  const resolvedMaxHr = useMemo(() => {
    const n = parseInt(maxHr)
    return resolveMaxHr(Number.isFinite(n) ? n : null, birthYear)
  }, [maxHr, birthYear])

  // Live-preview: når brukeren ikke har custom zones, reflekterer zones alltid
  // de auto-beregnede OLT-verdiene fra resolvedMaxHr.
  const previewZones = useMemo(() => computeZonesFromMaxHr(resolvedMaxHr), [resolvedMaxHr])
  const displayedZones = customMode ? zones : zonesToForm(previewZones)

  const thresholdNote = useMemo(() => {
    const t = parseInt(threshold)
    if (!Number.isFinite(t) || t <= 0) return null
    // Finn sonen terskelen ligger i for en hint-tekst.
    for (const z of previewZones) {
      if (t >= z.min_bpm && t <= z.max_bpm) {
        return `Terskel ${t} bpm — innenfor ${z.zone_name} (${z.min_bpm}–${z.max_bpm})`
      }
    }
    if (t < previewZones[0].min_bpm) return `Terskel ${t} bpm — under I1`
    if (t > previewZones[4].max_bpm) return `Terskel ${t} bpm — over I5`
    // Ved nærhet til grensen mellom to soner.
    for (let i = 0; i < previewZones.length - 1; i++) {
      const hi = previewZones[i].max_bpm
      if (Math.abs(t - hi) <= 2) return `Terskel ${t} bpm — nær ${previewZones[i].zone_name}/${previewZones[i + 1].zone_name}-grensen`
    }
    return null
  }, [threshold, previewZones])

  const setZone = (name: ZoneName, patch: Partial<ZoneForm>) => {
    setZones(prev => prev.map(z => z.zone_name === name ? { ...z, ...patch } : z))
  }

  const applyOltToCustom = () => {
    // Ta de auto-beregnede ranges inn i custom-feltene og marker som custom.
    setZones(zonesToForm(previewZones))
    setCustomMode(true)
    setMsg(null)
  }

  const onSaveProfile = () => {
    startTransition(async () => {
      const res = await saveHeartRateProfile({
        max_heart_rate: maxHr,
        lactate_threshold_hr: threshold,
        resting_heart_rate: resting,
      })
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Pulsprofil lagret' })
        router.refresh()
      }
    })
  }

  const onSaveZones = () => {
    startTransition(async () => {
      const res = await saveCustomHeartZones(zones)
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setMsg({ kind: 'ok', text: 'Egne soner lagret' })
        router.refresh()
      }
    })
  }

  const onReset = () => {
    startTransition(async () => {
      const res = await resetHeartZonesToAuto()
      if (res.error) setMsg({ kind: 'err', text: res.error })
      else {
        setCustomMode(false)
        setZones(zonesToForm(previewZones))
        setMsg({ kind: 'ok', text: 'Tilbakestilt til auto' })
        router.refresh()
      }
    })
  }

  return (
    <section className="p-6 mt-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h2 className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          Pulssoner
        </h2>
      </div>

      <p className="mb-5 text-sm"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        OLT I-skala — basert på % av maksimal puls. HFmax måles best ved testløp;
        manuell verdi overstyrer auto-beregning fra fødselsår.
      </p>

      {/* Pulsprofil */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Field label="Maksimal puls (HFmax)">
          <input value={maxHr} onChange={e => setMaxHr(e.target.value)}
            inputMode="numeric" placeholder={`Auto: ${resolveMaxHr(null, birthYear)}`}
            style={iSt} />
        </Field>
        <Field label="Terskelpuls (LT)">
          <input value={threshold} onChange={e => setThreshold(e.target.value)}
            inputMode="numeric" placeholder="—"
            style={iSt} />
        </Field>
        <Field label="Hvilepuls">
          <input value={resting} onChange={e => setResting(e.target.value)}
            inputMode="numeric" placeholder="—"
            style={iSt} />
        </Field>
      </div>

      {thresholdNote && (
        <p className="mb-3 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {thresholdNote}
        </p>
      )}

      <div className="flex items-center gap-3 mb-5">
        <button type="button" onClick={onSaveProfile} disabled={pending}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500', color: '#F0F0F2',
            border: 'none', cursor: pending ? 'default' : 'pointer',
            padding: '8px 18px', fontSize: '13px', letterSpacing: '0.1em',
            opacity: pending ? 0.6 : 1,
          }}>
          Lagre pulsprofil
        </button>
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Brukt HFmax: <span style={{ color: '#C0C0CC' }}>{resolvedMaxHr}</span>
          {!maxHr && birthYear && <span> (fra fødselsår {birthYear})</span>}
          {!maxHr && !birthYear && <span> (fallback 30 år)</span>}
        </span>
      </div>

      {/* Soner */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Soner {customMode ? '(egne verdier)' : '(auto)'}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={applyOltToCustom} disabled={pending}
            style={miniBtn}>
            Bruk OLT-standard
          </button>
          {customMode && (
            <button type="button" onClick={onReset} disabled={pending}
              style={miniBtn}>
              Tilbakestill til auto
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {ZONE_NAMES.map((name, i) => {
          const zf = displayedZones[i]
          return (
            <ZoneCard
              key={name}
              name={name}
              color={ZONE_COLORS[name]}
              label={ZONE_LABELS[name]}
              min={zf.min_bpm}
              max={zf.max_bpm}
              editable={customMode}
              onMin={v => setZone(name, { min_bpm: v })}
              onMax={v => setZone(name, { max_bpm: v })}
            />
          )
        })}
      </div>

      {customMode && (
        <button type="button" onClick={onSaveZones} disabled={pending}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500', color: '#F0F0F2',
            border: 'none', cursor: pending ? 'default' : 'pointer',
            padding: '8px 18px', fontSize: '13px', letterSpacing: '0.1em',
            opacity: pending ? 0.6 : 1,
          }}>
          Lagre egne soner
        </button>
      )}

      {msg && (
        <p className="mt-3 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: msg.kind === 'ok' ? '#28A86E' : '#FF4500',
          }}>
          {msg.text}
        </p>
      )}
    </section>
  )
}

function ZoneCard({
  name, color, label, min, max, editable, onMin, onMax,
}: {
  name: ZoneName; color: string; label: string
  min: string; max: string; editable: boolean
  onMin: (v: string) => void; onMax: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 p-3"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22', borderLeft: `3px solid ${color}` }}>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif", color, fontSize: '22px',
        letterSpacing: '0.06em', minWidth: '28px',
      }}>
        {name}
      </span>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px' }}>
          {label}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input value={min} onChange={e => onMin(e.target.value)}
          disabled={!editable} inputMode="numeric"
          style={{ ...iSt, width: '72px', textAlign: 'center',
            opacity: editable ? 1 : 0.7 }} />
        <span style={{ color: '#555560' }}>–</span>
        <input value={max} onChange={e => onMax(e.target.value)}
          disabled={!editable} inputMode="numeric"
          style={{ ...iSt, width: '72px', textAlign: 'center',
            opacity: editable ? 1 : 0.7 }} />
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
          bpm
        </span>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
}

const miniBtn: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#F0F0F2',
  background: 'none',
  border: '1px solid #2A2A30',
  cursor: 'pointer',
  padding: '6px 12px',
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

