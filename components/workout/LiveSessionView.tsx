'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StrengthExerciseRow, StrengthSetRow } from '@/lib/types'
import {
  startLiveSession, finishLiveSession, cancelLiveSession, saveLiveStrength,
  type LastSessionForExercise,
} from '@/app/actions/strength-session'
import { searchStandardExercises } from '@/lib/standard-exercises'
import { StandardExerciseBrowser } from '@/components/workout/StandardExerciseBrowser'
import { parseDecimal } from '@/lib/parse-decimal'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'
import { hapticTap, showCompletionCheck } from '@/lib/interactions'

// Live styrkeøkt-modus (Fase 80). Tynt lag oppå WorkoutFormData: redigerer
// styrke-aktivitetens øvelser/sett live, autosaver via saveWorkout, og Fullfør =
// finishLiveSession (markCompleted + total tid). Total tid = wall-clock fra
// live_started_at (pausetid er en del av totalen). Mobil-først.

const ORANGE = '#FF4500'

function makeSet(n: number): StrengthSetRow {
  return { id: crypto.randomUUID(), set_number: String(n), reps: '', weight_kg: '', duration: '', rpe: '', notes: '' }
}
function makeExercise(name: string): StrengthExerciseRow {
  return { id: crypto.randomUUID(), exercise_name: name, notes: '', sets: [makeSet(1)] }
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}
function daysAgoLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return 'i dag'
  if (diff === 1) return 'i går'
  if (diff < 7) return `for ${diff} dager siden`
  if (diff < 14) return 'for 1 uke siden'
  if (diff < 60) return `for ${Math.round(diff / 7)} uker siden`
  return `for ${Math.round(diff / 30)} mnd siden`
}
function summarizeLast(ls: LastSessionForExercise): string {
  const sets = ls.sets
  if (sets.length === 0) return '—'
  const w = sets[0].weight_kg, r = sets[0].reps
  const sameW = sets.every(s => s.weight_kg === w), sameR = sets.every(s => s.reps === r)
  const wPart = w != null ? ` @ ${w} kg` : ''
  if (sameR && r != null) return `${sets.length}×${r}${sameW ? wPart : ''}`
  return `${sets.length} sett · ${sets.map(s => s.reps ?? '–').join('/')}${sameW ? wPart : ''}`
}

export function LiveSessionView({
  workoutId, initialExercises, lastByName, plannedByName = {},
}: {
  workoutId: string
  initialExercises: StrengthExerciseRow[]
  lastByName: Record<string, LastSessionForExercise>
  plannedByName?: Record<string, string>
}) {
  const router = useRouter()
  // Sikre stabile klient-id-er på øvelser/sett (for React-keys + redigering).
  // Indeks-basert fallback (ikke crypto) så initialiseringen er trygg under SSR.
  const [exercises, setExercises] = useState<StrengthExerciseRow[]>(() =>
    initialExercises.map((ex, ei) => ({
      ...ex,
      id: ex.id || `ex-${ei}`,
      sets: (ex.sets ?? []).map((s, i) => ({
        ...s,
        id: s.id || `ex-${ei}-set-${i}`,
        set_number: s.set_number || String(i + 1),
      })),
    })),
  )
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const [lastLogMs, setLastLogMs] = useState<number | null>(null)   // hvile-base (etter Logg)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [workStartMs, setWorkStartMs] = useState<number | null>(null) // arbeids-base (etter Start)
  const [doneSets, setDoneSets] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // ── Start/gjenoppta + timer ──────────────────────────────
  useEffect(() => {
    startLiveSession(workoutId).then(res => {
      if (res.live_started_at) setStartedAtMs(new Date(res.live_started_at).getTime())
      else setStartedAtMs(Date.now())
    }).catch(() => setStartedAtMs(Date.now()))
  }, [workoutId])

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedSec = startedAtMs != null ? (nowMs - startedAtMs) / 1000 : 0
  // Arbeidstid vises på det aktive settet; hviletid mellom Logg og neste Start.
  const workSec = activeSetId != null && workStartMs != null ? (nowMs - workStartMs) / 1000 : null
  const restSec = activeSetId == null && lastLogMs != null ? (nowMs - lastLogMs) / 1000 : null

  // ── Wake lock (skjermen sovner ikke under økt) ───────────
  useEffect(() => {
    type WL = { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
    const nav = navigator as Navigator & { wakeLock?: WL }
    if (!nav.wakeLock) return
    let sentinel: { release: () => Promise<void> } | null = null
    let released = false
    const acquire = () => nav.wakeLock!.request('screen').then(s => { if (!released) sentinel = s }).catch(() => {})
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVis)
      sentinel?.release().catch(() => {})
    }
  }, [])

  // ── Autosave (debounced) + ved skjul/lukking ─────────────
  const exRef = useRef(exercises)
  exRef.current = exercises
  const dirtyRef = useRef(false)
  const doSave = useCallback(() => {
    if (!dirtyRef.current) return
    // KLIENT-GUARD: aldri autosave en tom/blank øvelsesliste. Sammen med server-
    // guarden i saveLiveStrength hindrer dette at en treg/avbrutt last (tomt UI)
    // wiper øvelsene i DB. Tom = ikke lastet ennå / ingenting å persistere.
    if (!exRef.current.some(ex => ex.exercise_name.trim())) return
    dirtyRef.current = false
    saveLiveStrength(workoutId, exRef.current).catch(() => {})
  }, [workoutId])
  // Hopp over mount-kjøringen: vi vil bare autosave faktiske BRUKER-endringer,
  // ikke skrive seedede øvelser tilbake umiddelbart (Fullfør/Avbryt persisterer
  // uansett eksplisitt). Hindrer også en race der mount-save fyrer før last er
  // ferdig.
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    dirtyRef.current = true
    const t = setTimeout(doSave, 2500)
    return () => clearTimeout(t)
  }, [exercises, doSave])
  useEffect(() => {
    const onHide = () => doSave()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [doSave])

  // ── Volum (sett × reps × vekt for utfylte sett) ──────────
  const totalVolume = useMemo(() => {
    let v = 0
    for (const ex of exercises) {
      for (const s of ex.sets) {
        const r = parseDecimal(s.reps), w = parseDecimal(s.weight_kg)
        if (!isNaN(r) && !isNaN(w)) v += r * w
      }
    }
    return Math.round(v)
  }, [exercises])

  // ── Mutasjoner ───────────────────────────────────────────
  const updateExercise = (id: string, patch: Partial<StrengthExerciseRow>) =>
    setExercises(exercises.map(e => e.id === id ? { ...e, ...patch } : e))
  const updateSet = (exId: string, setId: string, patch: Partial<StrengthSetRow>) =>
    setExercises(exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...patch } : s) }))
  const addSet = (exId: string) =>
    setExercises(exercises.map(e => e.id !== exId ? e : { ...e, sets: [...e.sets, makeSet(e.sets.length + 1)] }))
  const removeSet = (exId: string, setId: string) =>
    setExercises(exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.filter(s => s.id !== setId).map((s, i) => ({ ...s, set_number: String(i + 1) })) }))
  const removeExercise = (exId: string) => setExercises(exercises.filter(e => e.id !== exId))
  const moveExercise = (exId: string, dir: -1 | 1) => {
    const i = exercises.findIndex(e => e.id === exId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= exercises.length) return
    const next = [...exercises]
    ;[next[i], next[j]] = [next[j], next[i]]
    setExercises(next)
  }
  const addExercise = (name: string) => {
    if (!name.trim()) return
    setExercises([...exercises, makeExercise(name.trim())])
  }

  // ── Supersett: gruppér øvelser (logges sammen). Membership-basert via
  // superset_group; lett å koble med forrige / løse opp. ──
  const groupLetters = useMemo(() => {
    const map = new Map<number, string>()
    let n = 0
    for (const e of exercises) {
      if (e.superset_group != null && !map.has(e.superset_group)) {
        map.set(e.superset_group, String.fromCharCode(65 + n)); n++
      }
    }
    return map
  }, [exercises])
  const linkWithPrevious = (id: string) => {
    const i = exercises.findIndex(e => e.id === id)
    if (i <= 0) return
    const existing = exercises.map(e => e.superset_group).filter((g): g is number => g != null)
    const g = exercises[i - 1].superset_group ?? ((existing.length ? Math.max(...existing) : 0) + 1)
    setExercises(exercises.map((e, idx) => (idx === i || idx === i - 1) ? { ...e, superset_group: g } : e))
  }
  const unlinkExercise = (id: string) =>
    setExercises(exercises.map(e => e.id === id ? { ...e, superset_group: null } : e))
  // Start et sett: timer på selve settet starter, hvile stopper. Ett aktivt om
  // gangen. Tapper du Start på et logget sett, redoes det.
  const startSet = (setId: string) => {
    setDoneSets(prev => { const n = new Set(prev); n.delete(setId); return n })
    setActiveSetId(setId)
    setWorkStartMs(Date.now())
    setLastLogMs(null)
  }
  // Logg et sett: markeres ferdig, hvile-telleren starter mot neste Start.
  const logSet = (setId: string) => {
    hapticTap(15)
    setDoneSets(prev => new Set(prev).add(setId))
    setActiveSetId(null)
    setWorkStartMs(null)
    setLastLogMs(Date.now())
  }
  const repeatLast = (ex: StrengthExerciseRow) => {
    const ls = lastByName[ex.exercise_name.trim().toLowerCase()]
    if (!ls || ls.sets.length === 0) return
    updateExercise(ex.id, {
      sets: ls.sets.map((s, i) => ({
        ...makeSet(i + 1),
        reps: s.reps != null ? String(s.reps) : '',
        weight_kg: s.weight_kg != null ? String(s.weight_kg) : '',
        duration: s.duration_seconds != null ? String(s.duration_seconds) : '',
        rpe: s.rpe != null ? String(s.rpe) : '',
      })),
    })
  }

  // ── Fullfør / avbryt ─────────────────────────────────────
  const finish = async () => {
    if (busy) return
    setBusy(true)
    const saved = await saveLiveStrength(workoutId, exercises)
    if (saved.error) { setBusy(false); void xpAlert(saved.error); return }
    const res = await finishLiveSession(workoutId, Math.round(elapsedSec))
    if (res.error) { setBusy(false); void xpAlert(res.error); return }
    hapticTap([15, 60, 20])
    showCompletionCheck()
    router.push('/app/dagbok')
  }
  const cancel = async () => {
    if (busy) return
    if (!await xpConfirm('Avbryte økt-modus? Loggede sett beholdes, men økten markeres ikke som fullført.')) return
    setBusy(true)
    await saveLiveStrength(workoutId, exercises).catch(() => {})
    await cancelLiveSession(workoutId).catch(() => {})
    router.push('/app/dagbok')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--flate-3)', paddingBottom: 96 }}>
      {/* Topp: avbryt + tittel + total tid */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(14,14,18,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)', padding: '10px 14px' }}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={cancel}
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, cursor: 'pointer' }}>
            ◀ Avbryt
          </button>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Styrke-økt
          </span>
          <span style={{ width: 52 }} />
        </div>
        <div className="flex items-center justify-center gap-4 mt-1">
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 30, letterSpacing: '0.04em' }}>
            ⏱ {fmtClock(elapsedSec)}
          </span>
          {restSec != null && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF', fontSize: 14 }}>
              hvile {fmtClock(restSec)}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0' }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--card)', border: '1px dashed var(--line2)', borderRadius: 14, marginBottom: 16 }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 15, margin: 0 }}>
              Ingen øvelser lagt til — legg til øvelser for å begynne.
            </p>
            <button type="button"
              onClick={() => {
                const el = document.getElementById('xp-live-add-exercise')
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                ;(el as HTMLInputElement | null)?.focus({ preventScroll: true })
              }}
              className="mt-4 transition-opacity hover:opacity-90"
              style={{
                background: ORANGE, color: 'var(--flate-3)', border: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '10px 20px', cursor: 'pointer',
              }}>
              + Legg til øvelse
            </button>
          </div>
        )}

        {exercises.map((ex, idx) => {
          const ls = lastByName[ex.exercise_name.trim().toLowerCase()]
          const plan = plannedByName[ex.exercise_name.trim().toLowerCase()]
          const ssLetter = ex.superset_group != null ? groupLetters.get(ex.superset_group) : undefined
          const accent = ssLetter ? '#5B8DEF' : ORANGE
          return (
            <div key={ex.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: '12px', marginBottom: 12 }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 19, letterSpacing: '0.03em' }}>
                  {ssLetter && (
                    <span style={{ color: '#5B8DEF', fontSize: 14, marginRight: 6 }}>⛓ SS {ssLetter}</span>
                  )}
                  {idx + 1}. {ex.exercise_name || 'Øvelse'}
                </span>
                <div className="flex items-center gap-1">
                  {idx > 0 && ssLetter == null && (
                    <button type="button" onClick={() => linkWithPrevious(ex.id)} title="Supersett med forrige"
                      style={btnIcon}>⛓</button>
                  )}
                  {ssLetter != null && (
                    <button type="button" onClick={() => unlinkExercise(ex.id)} title="Løs opp supersett"
                      style={{ ...btnIcon, color: '#5B8DEF' }}>⛓✕</button>
                  )}
                  <button type="button" onClick={() => moveExercise(ex.id, -1)} title="Flytt opp"
                    style={btnIcon}>▲</button>
                  <button type="button" onClick={() => moveExercise(ex.id, 1)} title="Flytt ned"
                    style={btnIcon}>▼</button>
                  <button type="button" onClick={() => removeExercise(ex.id)} title="Fjern øvelse"
                    style={{ ...btnIcon, color: '#7A3030' }}>✕</button>
                </div>
              </div>

              {(plan || ls) && (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {plan && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF', fontSize: 12, fontStyle: 'italic' }}>
                      Plan: {plan}
                    </span>
                  )}
                  {ls && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-7)', fontSize: 12, fontStyle: 'italic' }}>
                      Sist: {summarizeLast(ls)} ({daysAgoLabel(ls.date)})
                    </span>
                  )}
                  {ls && (
                    <button type="button" onClick={() => repeatLast(ex)}
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ORANGE, background: 'none', border: '1px solid #3A2418', padding: '2px 8px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                      ↺ Gjenta forrige
                    </button>
                  )}
                </div>
              )}

              {ex.sets.map((s, si) => {
                const done = doneSets.has(s.id)
                const active = s.id === activeSetId
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: si === 0 ? 'none' : '1px solid var(--kant-1-app)' }}>
                    <span style={{ width: 22, color: done ? '#28A86E' : active ? ORANGE : 'var(--tekst-8-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>
                      {done ? '✓' : si + 1}
                    </span>
                    <Stepper label="reps" value={s.reps} step={1}
                      onChange={v => updateSet(ex.id, s.id, { reps: v })} />
                    <Stepper label="kg" value={s.weight_kg} step={2.5}
                      onChange={v => updateSet(ex.id, s.id, { weight_kg: v })} />
                    <RpePicker value={s.rpe} onChange={v => updateSet(ex.id, s.id, { rpe: v })} />
                    {active ? (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ORANGE, fontSize: 13 }}>
                          jobber {fmtClock(workSec ?? 0)}
                        </span>
                        <button type="button" onClick={() => logSet(s.id)}
                          style={{ background: '#28A86E', color: 'var(--flate-3)', border: 'none', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                          ✓ logg
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startSet(s.id)}
                        style={{ marginLeft: 'auto', background: done ? '#14241A' : ORANGE, color: done ? '#28A86E' : 'var(--flate-3)', border: done ? '1px solid #1E4A38' : 'none', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                        {done ? '✓ logget' : 'Start'}
                      </button>
                    )}
                    <button type="button" onClick={() => removeSet(ex.id, s.id)} title="Fjern sett" style={btnIcon}>×</button>
                  </div>
                )
              })}

              <button type="button" onClick={() => addSet(ex.id)}
                style={{ marginTop: 8, background: 'none', border: '1px dashed var(--kant-6)', color: 'var(--tekst-5-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, padding: '6px 10px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', width: '100%' }}>
                + Legg til sett
              </button>
            </div>
          )
        })}

        <AddExerciseInline onAdd={addExercise} />
      </div>

      {/* Bunn: volum + Fullfør */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(14,14,18,0.97)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--line)', padding: '10px 14px' }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 13 }}>
            Volum: <b style={{ color: 'var(--tekst-1-app)' }}>{totalVolume.toLocaleString('nb-NO')} kg</b>
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 12 }}>
            {exercises.length} øvelser
          </span>
        </div>
        <button type="button" onClick={finish} disabled={busy}
          style={{ width: '100%', background: '#28A86E', color: 'var(--flate-3)', border: 'none', borderRadius: 12, boxShadow: '0 6px 24px rgba(40,168,110,.3)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.06em', padding: '12px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          Fullfør økt ✓
        </button>
      </div>
    </div>
  )
}

const btnIcon: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--tekst-8-app)', cursor: 'pointer',
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '2px 6px',
}

function Stepper({ label, value, step, onChange }: {
  label: string; value: string; step: number; onChange: (v: string) => void
}) {
  const bump = (d: number) => {
    const cur = parseDecimal(value)
    const base = isNaN(cur) ? 0 : cur
    const next = Math.max(0, Math.round((base + d * step) * 100) / 100)
    onChange(next === 0 && d < 0 ? '' : String(next))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button type="button" onClick={() => bump(-1)} style={stepBtn}>−</button>
        <input value={value} onChange={e => onChange(e.target.value)} inputMode="decimal"
          style={{ width: 46, textAlign: 'center', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, padding: '6px 0', outline: 'none' }} />
        <button type="button" onClick={() => bump(1)} style={stepBtn}>+</button>
      </div>
    </div>
  )
}
const stepBtn: React.CSSProperties = {
  background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)',
  width: 30, height: 34, fontSize: 18, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
}

function RpePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>RPE</span>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: 38, height: 34, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: value ? 'var(--tekst-1-app)' : 'var(--tekst-8-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, cursor: 'pointer' }}>
        {value || '–'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', zIndex: 20, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 2 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} type="button"
              onClick={() => { onChange(String(n)); setOpen(false) }}
              style={{ width: 30, height: 30, background: String(n) === value ? ORANGE : 'none', color: String(n) === value ? 'var(--flate-3)' : 'var(--tekst-3-app)', border: '1px solid var(--kant-1-app)', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddExerciseInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [q, setQ] = useState('')
  // Bla-modus: kategorichips fra standardbiblioteket (kø #46-oppfølger).
  const [browse, setBrowse] = useState(false)
  const matches = useMemo(() => q.trim() ? searchStandardExercises(q, new Set(), 6) : [], [q])
  const commit = (name: string) => { onAdd(name); setQ(''); setBrowse(false) }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="xp-live-add-exercise" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Legg til øvelse (søk eller skriv eget)"
          style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, padding: '10px 12px', outline: 'none' }} />
        <button type="button" onClick={() => setBrowse(b => !b)} aria-label="Bla i biblioteket"
          style={{ background: browse ? ORANGE : 'var(--card2)', color: browse ? 'var(--flate-3)' : 'var(--tekst-3-app)', border: '1px solid var(--line)', borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, padding: '0 12px', cursor: 'pointer', minHeight: 40 }}>
          ▦ Bla
        </button>
        <button type="button" onClick={() => commit(q)} disabled={!q.trim()}
          style={{ background: ORANGE, color: 'var(--flate-3)', border: 'none', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, padding: '0 16px', textTransform: 'uppercase', cursor: q.trim() ? 'pointer' : 'default', opacity: q.trim() ? 1 : 0.5 }}>
          Legg til
        </button>
      </div>
      {browse && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
          <StandardExerciseBrowser onPick={commit} />
        </div>
      )}
      {matches.length > 0 && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
          {matches.map(m => (
            <button key={m.name} type="button" onClick={() => commit(m.name)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--kant-1-app)', color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '8px 12px', cursor: 'pointer' }}>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
