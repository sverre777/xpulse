'use client'

import { useRef, useState, useTransition } from 'react'
import { upsertMonthlyVolumePlan } from '@/app/actions/volume-plans'

const MONTHS_NO = [
  'Januar','Februar','Mars','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Desember',
] as const

// Del E (kø #39): valgfri sone-nedbryting — gruppert eller detaljert.
// Hellige sonefarger (delt palett).
const ZONE_GROUPED: { key: string; color: string }[] = [
  { key: 'I1-2', color: '#28A86E' },
  { key: 'I3',   color: '#E8B93C' },
  { key: 'I4-5', color: '#E23A5A' },
]
const ZONE_DETAILED: { key: string; color: string }[] = [
  { key: 'I1', color: '#28A86E' },
  { key: 'I2', color: '#1A6FD4' },
  { key: 'I3', color: '#E8B93C' },
  { key: 'I4', color: '#FF8C00' },
  { key: 'I5', color: '#E23A5A' },
]

export interface MonthlyVolumeInputProps {
  userId: string
  seasonId: string | null
  year: number
  month: number // 1-12
  initialHours: number | null
  initialKm: number | null
  initialNotes: string | null
  initialZoneHours?: Record<string, number> | null
  initialMovementHours?: Record<string, number> | null
}

export function MonthlyVolumeInput({
  userId, seasonId, year, month,
  initialHours, initialKm, initialNotes,
  initialZoneHours, initialMovementHours,
}: MonthlyVolumeInputProps) {
  const [hours, setHours] = useState(initialHours != null ? String(initialHours) : '')
  const [km, setKm] = useState(initialKm != null ? String(initialKm) : '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const saveTimer = useRef<number | null>(null)

  // ── Del E: valgfri fordeling (default kun totaltimer — ingen mas). ──
  const hadInitialBreakdown =
    (initialZoneHours && Object.keys(initialZoneHours).length > 0) ||
    (initialMovementHours && Object.keys(initialMovementHours).length > 0)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [zoneMode, setZoneMode] = useState<'gruppert' | 'detaljert'>(
    initialZoneHours && ZONE_DETAILED.some(z => z.key !== 'I3' && initialZoneHours[z.key] != null)
      ? 'detaljert' : 'gruppert')
  const [zoneVals, setZoneVals] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(initialZoneHours ?? {})) out[k] = String(v)
    return out
  })
  const [movRows, setMovRows] = useState<{ name: string; hours: string }[]>(() =>
    Object.entries(initialMovementHours ?? {}).map(([name, v]) => ({ name, hours: String(v) })))
  // Fordelingen sendes KUN når editoren faktisk er brukt (eller det fantes
  // data fra før) — totaltimer-lagring er dermed trygg før fase 83 er kjørt.
  const breakdownTouched = useRef(false)

  const zoneKeys = zoneMode === 'gruppert' ? ZONE_GROUPED : ZONE_DETAILED

  const doSave = () => {
    const sendBreakdown = breakdownTouched.current || hadInitialBreakdown
    const zonePayload: Record<string, string> = {}
    for (const z of zoneKeys) {
      if ((zoneVals[z.key] ?? '') !== '') zonePayload[z.key] = zoneVals[z.key]
    }
    const movPayload: Record<string, string> = {}
    for (const r of movRows) {
      if (r.name.trim() && r.hours !== '') movPayload[r.name.trim()] = r.hours
    }
    startTransition(async () => {
      const res = await upsertMonthlyVolumePlan(userId, year, month, {
        season_id: seasonId,
        planned_hours: hours,
        planned_km: km,
        notes,
        ...(sendBreakdown ? { zone_hours: zonePayload, movement_hours: movPayload } : {}),
      })
      if (res.error) {
        setErr(res.error)
        setSaved(false)
      } else {
        setErr(null)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1200)
      }
    })
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(doSave, 600)
  }

  const iSt: React.CSSProperties = {
    backgroundColor: '#1A1A22',
    border: '1px solid #1E1E22',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '13px',
    padding: '4px 8px',
    width: '100%',
  }

  const labelSt: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    color: '#8A8A96',
    fontSize: '13px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '2px',
    display: 'block',
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2"
      style={{ borderTop: '1px solid #1A1A1E' }}>
      <div className="col-span-12 md:col-span-2 flex items-center">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '15px',
          letterSpacing: '0.04em',
        }}>
          {MONTHS_NO[month - 1]} {year}
        </span>
      </div>
      <div className="col-span-4 md:col-span-2">
        <label style={labelSt}>Timer</label>
        <input
          value={hours}
          onChange={e => { setHours(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="—"
          inputMode="decimal"
          style={iSt} />
      </div>
      <div className="col-span-4 md:col-span-2">
        <label style={labelSt}>Km</label>
        <input
          value={km}
          onChange={e => { setKm(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="—"
          inputMode="decimal"
          style={iSt} />
      </div>
      <div className="col-span-12 md:col-span-5">
        <label style={labelSt}>Notat</label>
        <input
          value={notes}
          onChange={e => { setNotes(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="Valgfritt"
          style={iSt} />
      </div>
      <div className="col-span-4 md:col-span-1 flex items-end h-full">
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '13px',
          color: err ? '#E11D48' : saved ? '#28A86E' : '#555560',
        }}>
          {err ? 'Feil' : saved ? 'Lagret' : isPending ? '…' : ''}
        </span>
      </div>
      {err && (
        <div className="col-span-12 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {err}
        </div>
      )}

      {/* ── Del E: VALGFRI fordeling (soner og/eller bevegelsesform).
          Default skjult — kun totaltimer, ingen mas. Myk validering
          («fordelt X av Y t» diskret, aldri blokkerende). ── */}
      <div className="col-span-12">
        {(() => {
          const num = (s: string) => parseFloat((s || '').replace(',', '.')) || 0
          const fmtN = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 })
          const hoursNum = num(hours)
          const zoneSum = zoneKeys.reduce((s, z) => s + num(zoneVals[z.key] ?? ''), 0)
          const movSum = movRows.reduce((s, r) => s + num(r.hours), 0)
          const touch = () => { breakdownTouched.current = true; scheduleSave() }
          const softColor = (sum: number) =>
            hoursNum > 0 && sum > hoursNum ? '#FF8C00' : '#555560'
          return (
            <>
              <button type="button" onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-xs"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '9px 0',
                  letterSpacing: '0.06em', minHeight: 36,
                }}>
                {showBreakdown ? '▾' : '▸'} Fordeling
                {!showBreakdown && (zoneSum > 0 || movSum > 0) && (
                  <span style={{ color: '#555560' }}>
                    {zoneSum > 0 ? ` · soner ${fmtN(zoneSum)} t` : ''}
                    {movSum > 0 ? ` · bev.form ${fmtN(movSum)} t` : ''}
                  </span>
                )}
              </button>
              {showBreakdown && (
                <div className="mt-1 space-y-2 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={{ ...labelSt, marginBottom: 0 }}>Soner</span>
                    {(['gruppert', 'detaljert'] as const).map(m => (
                      <button key={m} type="button"
                        onClick={() => {
                          if (zoneMode === m) return
                          setZoneMode(m); setZoneVals({}); touch()
                        }}
                        className="text-xs px-2 py-0.5"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          color: zoneMode === m ? '#F0F0F2' : '#555560',
                          background: zoneMode === m ? '#1A1A22' : 'none',
                          border: `1px solid ${zoneMode === m ? '#2A2A32' : '#1E1E22'}`,
                          cursor: 'pointer',
                        }}>
                        {m === 'gruppert' ? 'I1–2 / I3 / I4–5' : 'I1…I5'}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {zoneKeys.map(z => (
                      <div key={z.key} style={{ width: 74 }}>
                        <label style={{ ...labelSt, color: z.color, textTransform: 'none' }}>{z.key}</label>
                        <input value={zoneVals[z.key] ?? ''}
                          onChange={e => { setZoneVals(v => ({ ...v, [z.key]: e.target.value })); touch() }}
                          onBlur={doSave}
                          placeholder="t" inputMode="decimal" style={iSt} />
                      </div>
                    ))}
                  </div>
                  {zoneSum > 0 && hoursNum > 0 && (
                    <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: softColor(zoneSum) }}>
                      Soner: fordelt {fmtN(zoneSum)} av {fmtN(hoursNum)} t
                    </p>
                  )}
                  <div className="space-y-1">
                    {movRows.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={r.name}
                          onChange={e => { setMovRows(rows => rows.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x)); touch() }}
                          onBlur={doSave}
                          placeholder="Bevegelsesform (f.eks. Løping)" style={{ ...iSt, maxWidth: 220 }} />
                        <input value={r.hours}
                          onChange={e => { setMovRows(rows => rows.map((x, xi) => xi === i ? { ...x, hours: e.target.value } : x)); touch() }}
                          onBlur={doSave}
                          placeholder="t" inputMode="decimal" style={{ ...iSt, width: 64 }} />
                        <button type="button" aria-label="Fjern"
                          onClick={() => { setMovRows(rows => rows.filter((_, xi) => xi !== i)); touch(); doSave() }}
                          style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '8px 10px', minHeight: 36 }}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setMovRows(rows => [...rows, { name: '', hours: '' }])}
                      className="text-xs"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: '1px dashed #1E1E22', padding: '3px 8px', cursor: 'pointer' }}>
                      + Bevegelsesform
                    </button>
                    {movSum > 0 && hoursNum > 0 && (
                      <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: softColor(movSum) }}>
                        Bev.form: fordelt {fmtN(movSum)} av {fmtN(hoursNum)} t
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
