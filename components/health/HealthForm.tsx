'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveDailyHealth } from '@/app/actions/health'
import { saveDailySleep, type DailySleepRecord } from '@/app/actions/sleep'
import { saveDailyHealthMetrics, type DailyHealthMetrics } from '@/app/actions/health-metrics'
import { DailyHealth } from '@/lib/types'

// ── Søvn: tid ↔ tidspunkt ────────────────────────────────────
// sleep_records.date er datoen du VÅKNET. Leggetid klokka 23 hører derfor til
// kvelden før; leggetid klokka 01 hører til samme dato. Grensa settes ved
// klokka 12, som er den eneste tolkningen som ikke gir rare døgn.
// Vi bygger tidspunktet i brukerens egen tidssone og sender ISO — da slipper
// serveren å gjette hvilken sone «23:40» hørte til.
function timeToIso(date: string, time: string, isBedtime: boolean): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const d = new Date(`${date}T00:00:00`)
  if (isBedtime && h >= 12) d.setDate(d.getDate() - 1)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function isoToTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const numOrNull = (s: string): number | null => {
  if (!s.trim()) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n) : null
}

const numFloat = (s: string): number | null => {
  if (!s.trim()) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Kildemerke per verdi: klokke-ikon når verdien kom fra et merke, ingenting
// når den er ført manuelt. Skriver du i feltet, blir verdien din.
function KildeMerke({ source }: { source?: string }) {
  if (!source || source === 'manual') return null
  return (
    <span
      title={`Hentet fra ${source.charAt(0).toUpperCase()}${source.slice(1)}`}
      style={{ marginLeft: 6, fontSize: 11, color: '#8A8A96', whiteSpace: 'nowrap' }}>
      ⌚ {source}
    </span>
  )
}

interface HealthFormProps {
  date: string
  existing: DailyHealth | null
  /**
   * Søvn-raden for datoen (fase 91). Gir de utvidede feltene og kilden per
   * verdi. Er den null, er ingenting ført eller importert for natta.
   */
  sleep?: DailySleepRecord | null
  /**
   * Helse-/aktivitetsraden for datoen (fase 91). Gir kildemerking på vitale
   * verdier og de nye daglig-aktivitet-feltene.
   */
  metrics?: DailyHealthMetrics | null
  /**
   * Settes når skjemaet ligger i en modal: da lukker vi modalen i stedet for
   * å navigere til dagboka. Uten disse oppfører skjemaet seg nøyaktig som før
   * på /app/health/[date] — samme lagring, samme redirect.
   */
  onSaved?: () => void
  onCancel?: () => void
}

export function HealthForm({ date, existing, sleep = null, metrics = null, onSaved, onCancel }: HealthFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const kilde = sleep?.sources ?? {}
  const kildeM = metrics?.sources ?? {}

  // Timer og kvalitet finnes begge steder: daily_health (dagens føring, som
  // analysen leser) og sleep_records (den nye modellen, med kilde per verdi).
  // Er feltet tomt i daily_health, viser vi den importerte verdien fra
  // sleep_records — da ser du klokkas tall og kan overstyre det.
  const importertTimer = sleep?.total_sleep_minutes != null
    ? (sleep.total_sleep_minutes / 60).toFixed(1)
    : ''

  const [form, setForm] = useState({
    resting_hr:     existing?.resting_hr?.toString() ?? metrics?.resting_hr?.toString() ?? '',
    hrv_ms:         existing?.hrv_ms?.toString() ?? metrics?.hrv_ms?.toString() ?? '',
    sleep_hours:    existing?.sleep_hours?.toString() ?? importertTimer,
    sleep_quality:  existing?.sleep_quality ?? sleep?.perceived_quality ?? null as number | null,
    body_weight_kg: existing?.body_weight_kg?.toString() ?? metrics?.body_weight_kg?.toString() ?? '',
    notes:          existing?.notes ?? '',
  })

  const [sovn, setSovn] = useState({
    bedtime:  isoToTime(sleep?.sleep_start ?? null),
    waketime: isoToTime(sleep?.sleep_end ?? null),
    awake:    sleep?.awake_minutes?.toString() ?? '',
    deep:     sleep?.deep_minutes?.toString() ?? '',
    light:    sleep?.light_minutes?.toString() ?? '',
    rem:      sleep?.rem_minutes?.toString() ?? '',
    score:    sleep?.sleep_score?.toString() ?? '',
  })
  const setSovnFelt = (k: keyof typeof sovn, v: string) =>
    setSovn(f => ({ ...f, [k]: v }))

  // Daglig aktivitet — dagliglivet, ikke trening. Trening ligger i økter.
  // Distanse føres i km i UI, lagres i meter. Kalorier finnes ikke her.
  const [aktivitet, setAktivitet] = useState({
    steps:      metrics?.steps?.toString() ?? '',
    active:     metrics?.active_minutes?.toString() ?? '',
    inactive:   metrics?.inactive_minutes?.toString() ?? '',
    distanceKm: metrics?.daily_distance_m != null ? (metrics.daily_distance_m / 1000).toFixed(1) : '',
    stairs:     metrics?.stairs_climbed?.toString() ?? '',
    elevation:  metrics?.daily_elevation_m?.toString() ?? '',
  })
  const setAktivitetFelt = (k: keyof typeof aktivitet, v: string) =>
    setAktivitet(f => ({ ...f, [k]: v }))

  const set = (k: keyof typeof form, v: string | number | null) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    // 1. Dagens føring — uendret vei, uendret tabell. Det er denne dagbok,
    //    oversikt og analysen leser.
    const result = await saveDailyHealth({ date, ...form, sleep_quality: form.sleep_quality })
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    // 2. Søvn-detaljene til den nye modellen, merket som manuelt ført. Feiler
    //    denne, er helsa likevel lagret — vi sier fra i stedet for å rulle
    //    tilbake noe som allerede er riktig lagret. Lagring er idempotent,
    //    så «lagre» på nytt fikser det.
    const timer = form.sleep_hours.trim() ? Number(form.sleep_hours.replace(',', '.')) : null
    const sleepResult = await saveDailySleep(date, {
      sleep_start: timeToIso(date, sovn.bedtime, true),
      sleep_end: timeToIso(date, sovn.waketime, false),
      total_sleep_minutes: timer != null && Number.isFinite(timer) ? Math.round(timer * 60) : null,
      awake_minutes: numOrNull(sovn.awake),
      deep_minutes: numOrNull(sovn.deep),
      light_minutes: numOrNull(sovn.light),
      rem_minutes: numOrNull(sovn.rem),
      perceived_quality: form.sleep_quality,
      sleep_score: numOrNull(sovn.score),
    })
    if (sleepResult.error) {
      setError(`Helse er lagret, men søvndetaljene ble ikke lagret: ${sleepResult.error}`)
      setSaving(false)
      return
    }

    // 3. Vitale verdier speiles til health_metrics som manuelle, og daglig
    //    aktivitet lagres der. Samme grunn som for søvn: importen skal se at
    //    verdien er din og la den stå.
    const km = numFloat(aktivitet.distanceKm)
    const metricsResult = await saveDailyHealthMetrics(date, {
      resting_hr: numOrNull(form.resting_hr),
      hrv_ms: numFloat(form.hrv_ms),
      body_weight_kg: numFloat(form.body_weight_kg),
      steps: numOrNull(aktivitet.steps),
      active_minutes: numOrNull(aktivitet.active),
      inactive_minutes: numOrNull(aktivitet.inactive),
      daily_distance_m: km != null ? Math.round(km * 1000) : null,
      stairs_climbed: numOrNull(aktivitet.stairs),
      daily_elevation_m: numOrNull(aktivitet.elevation),
    })
    if (metricsResult.error) {
      setError(`Helse er lagret, men aktivitetsdataene ble ikke lagret: ${metricsResult.error}`)
      setSaving(false)
      return
    }

    if (onSaved) {
      router.refresh()
      onSaved()
    } else {
      router.push('/app/dagbok')
      router.refresh()
    }
  }

  // Tid i seng vises kun som hint når BEGGE tidspunkt er ført. Vi regner den
  // aldri om til sovetid automatisk — «kun førte»-regelen gjelder: appen skal
  // ikke dikte opp en verdi brukeren ikke har oppgitt.
  const tidISeng = (() => {
    const start = timeToIso(date, sovn.bedtime, true)
    const slutt = timeToIso(date, sovn.waketime, false)
    if (!start || !slutt) return null
    const min = Math.round((new Date(slutt).getTime() - new Date(start).getTime()) / 60000)
    if (min <= 0 || min > 1440) return null
    return `${Math.floor(min / 60)} t ${min % 60} min i seng`
  })()

  const iSt: React.CSSProperties = {
    backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
    borderRadius: 'var(--r-field)',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '16px', padding: '10px 14px', outline: 'none', width: '100%',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Vitals */}
      <div>
        <SectionLabel>Vitale verdier</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label={<>Hvilepuls (bpm)<KildeMerke source={kildeM.resting_hr} /></>}>
            <input type="number" value={form.resting_hr} onChange={e => set('resting_hr', e.target.value)}
              placeholder="42" style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>HRV (ms)<KildeMerke source={kildeM.hrv_ms} /></>}>
            <input type="number" step="0.1" value={form.hrv_ms} onChange={e => set('hrv_ms', e.target.value)}
              placeholder="65" style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Kroppsvekt (kg)<KildeMerke source={kildeM.body_weight_kg} /></>}>
            <input type="number" step="0.1" value={form.body_weight_kg} onChange={e => set('body_weight_kg', e.target.value)}
              placeholder="70.5" style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
        </div>
      </div>

      {/* Søvn — fellesfeltene fra fase 91. Alt er valgfritt: fyll det du vet,
          la resten stå tomt. Tomme felter regnes ikke med noe sted. */}
      <div>
        <SectionLabel>Søvn</SectionLabel>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label={<>Leggetid<KildeMerke source={kilde.sleep_start} /></>}>
            <input type="time" value={sovn.bedtime} onChange={e => setSovnFelt('bedtime', e.target.value)}
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Våknetid<KildeMerke source={kilde.sleep_end} /></>}>
            <input type="time" value={sovn.waketime} onChange={e => setSovnFelt('waketime', e.target.value)}
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
        </div>
        {tidISeng && (
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 12, margin: '6px 0 0' }}>
            {tidISeng} — søvntiden fyller du ut selv, siden den sjelden er hele tiden i senga.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label={<>Sovetid (timer)<KildeMerke source={kilde.total_sleep_minutes} /></>}>
            <input type="number" step="0.5" min="0" max="24" value={form.sleep_hours}
              onChange={e => set('sleep_hours', e.target.value)} placeholder="7.5"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Våken (min)<KildeMerke source={kilde.awake_minutes} /></>}>
            <input type="number" step="1" min="0" max="1440" value={sovn.awake}
              onChange={e => setSovnFelt('awake', e.target.value)} placeholder="20"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
        </div>

        <p className="mt-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '16px 0 0' }}>
          Søvnfaser (minutter)
        </p>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Field label={<>Dyp<KildeMerke source={kilde.deep_minutes} /></>}>
            <input type="number" step="1" min="0" max="1440" value={sovn.deep}
              onChange={e => setSovnFelt('deep', e.target.value)} placeholder="90"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Lett<KildeMerke source={kilde.light_minutes} /></>}>
            <input type="number" step="1" min="0" max="1440" value={sovn.light}
              onChange={e => setSovnFelt('light', e.target.value)} placeholder="240"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>REM<KildeMerke source={kilde.rem_minutes} /></>}>
            <input type="number" step="1" min="0" max="1440" value={sovn.rem}
              onChange={e => setSovnFelt('rem', e.target.value)} placeholder="90"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label={<>Opplevd kvalitet<KildeMerke source={kilde.perceived_quality} /></>}>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" aria-label={`${n} av 5`}
                  onClick={() => set('sleep_quality', form.sleep_quality === n ? null : n)}
                  style={{
                    fontSize: '24px', color: (form.sleep_quality ?? 0) >= n ? '#28A86E' : '#2A2A30',
                    background: 'none', border: 'none', cursor: 'pointer',
                    minWidth: 44, minHeight: 44, lineHeight: 1, padding: 0,
                  }}>★</button>
              ))}
            </div>
          </Field>
          {/* Tallet klokka viser (0–100). Egen skala fra stjernene ved siden
              av, og egen verdi fra merkets importerte score — den vises med
              merkenavn under «Fra klokka». */}
          <Field label={<>Søvnscore (0–100)<KildeMerke source={kilde.sleep_score} /></>}>
            <input type="number" step="1" min="0" max="100" value={sovn.score}
              onChange={e => setSovnFelt('score', e.target.value)} placeholder="82"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
        </div>
      </div>

      {/* Daglig aktivitet — dagliglivet utenom trening. Alt valgfritt.
          Kalorier finnes bevisst ikke her: estimatene spriker for mye mellom
          merker til å være sammenlignbare. */}
      <div>
        <SectionLabel>Daglig aktivitet</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label={<>Skritt<KildeMerke source={kildeM.steps} /></>}>
            <input type="number" step="1" min="0" value={aktivitet.steps}
              onChange={e => setAktivitetFelt('steps', e.target.value)} placeholder="8000"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Distanse (km)<KildeMerke source={kildeM.daily_distance_m} /></>}>
            <input type="number" step="0.1" min="0" value={aktivitet.distanceKm}
              onChange={e => setAktivitetFelt('distanceKm', e.target.value)} placeholder="6.2"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Aktiv tid (min)<KildeMerke source={kildeM.active_minutes} /></>}>
            <input type="number" step="1" min="0" max="1440" value={aktivitet.active}
              onChange={e => setAktivitetFelt('active', e.target.value)} placeholder="240"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Inaktiv tid (min)<KildeMerke source={kildeM.inactive_minutes} /></>}>
            <input type="number" step="1" min="0" max="1440" value={aktivitet.inactive}
              onChange={e => setAktivitetFelt('inactive', e.target.value)} placeholder="480"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Trappetrinn<KildeMerke source={kildeM.stairs_climbed} /></>}>
            <input type="number" step="1" min="0" value={aktivitet.stairs}
              onChange={e => setAktivitetFelt('stairs', e.target.value)} placeholder="12"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
          <Field label={<>Høydemeter<KildeMerke source={kildeM.daily_elevation_m} /></>}>
            <input type="number" step="1" min="0" value={aktivitet.elevation}
              onChange={e => setAktivitetFelt('elevation', e.target.value)} placeholder="40"
              style={{ ...iSt, minHeight: 44 }} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
          </Field>
        </div>
      </div>

      {/* Notes */}
      <div>
        <SectionLabel>Dagskommentar</SectionLabel>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Hvordan kjennes kroppen i dag?"
          rows={3} style={{ ...iSt, resize: 'vertical', marginTop: '12px' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--line)')} />
      </div>

      {error && (
        <p className="px-3 py-2 text-sm"
          style={{ color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)', borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 pb-8">
        <button type="submit" disabled={saving}
          className="flex-1 py-4 text-lg tracking-widest uppercase font-semibold"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: saving ? '#1A5A3A' : '#28A86E', color: '#fff',
            border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? 'Lagrer...' : existing ? 'Oppdater helse' : 'Lagre helse'}
        </button>
        <button type="button" onClick={() => (onCancel ? onCancel() : router.back())}
          className="px-6 py-4 text-lg tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
            backgroundColor: 'transparent', border: '1px solid var(--line2)', borderRadius: 12, cursor: 'pointer',
          }}>
          Avbryt
        </button>
      </div>
    </form>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ width: '16px', height: '2px', backgroundColor: '#28A86E', display: 'inline-block' }} />
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.08em' }}>
        {children}
      </span>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
