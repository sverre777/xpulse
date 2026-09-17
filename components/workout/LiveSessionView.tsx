'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StrengthExerciseRow, StrengthSetRow } from '@/lib/types'
import {
  startLiveSession, finishLiveSession, cancelLiveSession, saveLiveStrength, getLastSessionForExercises, getBesteForExercises,
  type LastSessionForExercise,
} from '@/app/actions/strength-session'
import { searchStandardExercises } from '@/lib/standard-exercises'
import { StandardExerciseBrowser } from '@/components/workout/StandardExerciseBrowser'
import { parseDecimal } from '@/lib/parse-decimal'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'
import { hapticTap, showCompletionCheck } from '@/lib/interactions'
import { Ikon } from '@/components/ui/ikoner'
import { normOvelse } from '@/lib/styrke-pr'
import {
  erPr, fmtBeste, fmtKg, rekorder, spokelse, tonnasje, HVILE_MAAL_SEK, type BesteForOvelse,
} from '@/lib/live-styrke'
import { flyttOvelse, kobleMedNeste, losOppSupersett, leggTilSupersett, startverdiFraForrige, supersettBokstaver } from '@/lib/styrke-ovelser'
import { OvelseListe, SorterbarOvelse, OvelseHandtak } from './SorterbarOvelse'

// LIVE STYRKE v2 (fasit: design/xpulse-styrke-design.html seksjon 2 + notat).
//
// Én hånd, hansker, mellom sett. Ingen systemtastatur: settet du jobber med
// løftes ned i en fast tastaturflate nederst med to store steppere (reps ±1,
// kg ±2,5, treffflate 52 px). Grå forrige-verdier i lista er PLASSHOLDERE og
// lagres aldri; i tastaturet lagres forrige økts tall når du trykker «Logg
// sett» uten å røre det - den asymmetrien er villet (lib/live-styrke).
//
// TRE TIDER: Stopp stanser HELE økta (klokka står, tiden fra da av teller
// ikke), hvile mellom sett stanser ingenting og ER styrketid, total = fra
// live_started_at minus stoppet tid. Stopp er lokalt i økta (ingen SQL):
// lukkes appen mens den er stoppet, teller tiden videre, og varigheten kan
// rettes på ferdig-skjermen. Stopp nullstiller ALDRI live_started_at - da
// forsvinner økta fra gjenoppta-banneret. Avbryt (krysset) er
// cancelLiveSession og noe annet enn Avslutt.
//
// Hvile mellom sett skal ALDRI bli en rad med activity_type 'pause' -
// PASSIV_PAUSE_TYPER ville trukket den ut av treningstida. finishLiveSession
// skriver bare duration_minutes; ingen aktivitetsrader lages her.
//
// Supersett får INGEN egen farge (bolk 2b, Sverre 17. sep): klamme i
// --kant-7 (= designfilas --line3) pluss bokstaven «SS A». Trener-blå lånes
// ikke til noe som ikke er trener. Plan-chipen er blå fordi fasiten
// (.chip.plan) sier det - det er planfargen, ikke supersettfargen.

const ORANGE = '#FF4500'
const GRONN = '#28A86E'
const GULL = '#D4A017'
const PLAN_BLAA = '#1A6FD4'   // .chip.plan i fasiten
const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"

function makeSet(n: number): StrengthSetRow {
  return { id: crypto.randomUUID(), set_number: String(n), reps: '', weight_kg: '', duration: '', rpe: '', notes: '' }
}
function makeExercise(name: string): StrengthExerciseRow {
  return { id: crypto.randomUUID(), exercise_name: name, notes: '', sets: [makeSet(1)] }
}
function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
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
  if (sets.length === 0) return '-'
  const w = sets[0].weight_kg, r = sets[0].reps
  const sameW = sets.every(s => s.weight_kg === w), sameR = sets.every(s => s.reps === r)
  const wPart = w != null ? ` @ ${fmtKg(w)} kg` : ''
  if (sameR && r != null) return `${sets.length}×${r}${sameW ? wPart : ''}`
  return `${sets.length} sett · ${sets.map(s => s.reps ?? '-').join('/')}${sameW ? wPart : ''}`
}
const num = (v: string): number | null => { const n = parseDecimal(v); return isNaN(n) ? null : n }
/** Sett-oppsummeringen i kortets hode: «8 / 8 / -». */
const settRad = (ex: StrengthExerciseRow) => ex.sets.map(s => s.reps.trim() || '-').join(' / ')

export function LiveSessionView({
  workoutId, initialExercises, lastByName: lastInn, plannedByName = {}, besteByName: besteInn = {},
}: {
  workoutId: string
  initialExercises: StrengthExerciseRow[]
  lastByName: Record<string, LastSessionForExercise>
  plannedByName?: Record<string, string>
  besteByName?: Record<string, BesteForOvelse>
}) {
  const router = useRouter()
  const [exercises, setExercises] = useState<StrengthExerciseRow[]>(() =>
    initialExercises.map((ex, ei) => ({
      ...ex,
      id: ex.id || `ex-${ei}`,
      sets: (ex.sets ?? []).map((s, i) => ({ ...s, id: s.id || `ex-${ei}-set-${i}`, set_number: s.set_number || String(i + 1) })),
    })),
  )
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const [lastLogMs, setLastLogMs] = useState<number | null>(null)   // hvile-base (etter Logg)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [doneSets, setDoneSets] = useState<Set<string>>(new Set())
  const [prSets, setPrSets] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  // Stopp: akkumulert stoppet tid + «stoppet siden» - lokalt, ingen SQL.
  const [stoppetSidenMs, setStoppetSidenMs] = useState<number | null>(null)
  const [stoppetSumMs, setStoppetSumMs] = useState(0)
  // Bolk 8h: pausen mellom sett teller OPP fra «Logg sett» til «Start sett» på neste.
  // Summen holdes her (ingen SQL, aldri en pause-rad) og vises på ferdig-skjermen.
  const [pauseSumMs, setPauseSumMs] = useState(0)
  // Bolk 8e: klokka fryses når økta avsluttes (ferdig-skjermen); «tilbake» regner tida der som stoppet.
  const [avsluttetMs, setAvsluttetMs] = useState<number | null>(null)
  const [skjerm, setSkjerm] = useState<'live' | 'ferdig'>('live')
  const [varighetMin, setVarighetMin] = useState<string>('')
  const [meny, setMeny] = useState<string | null>(null)
  // Tastaturets verdier for det aktive settet. rort = brukeren har trykket.
  const [tast, setTast] = useState<{ reps: string; kg: string; rort: boolean }>({ reps: '', kg: '', rort: false })
  // Bolk 8f: trykk på tallet i stepperen åpner et numerisk felt - skriver til SAMME tast-tilstand.
  const [redigerer, setRedigerer] = useState<'reps' | 'kg' | null>(null)
  // Bolk 8c: «Bytt øvelse» - forrige/beste for navn som ikke var med ved lasting hentes her
  // og legges oppå propsene. PR-merker og «Beste» regnes mot det NYE navnet.
  const [ekstraLast, setEkstraLast] = useState<Record<string, LastSessionForExercise>>({})
  const [ekstraBeste, setEkstraBeste] = useState<Record<string, BesteForOvelse>>({})
  const lastByName = useMemo(() => ({ ...lastInn, ...ekstraLast }), [lastInn, ekstraLast])
  const besteByName = useMemo(() => ({ ...besteInn, ...ekstraBeste }), [besteInn, ekstraBeste])
  const [bytter, setBytter] = useState<string | null>(null)

  // ── Start/gjenoppta + timer ──────────────────────────────
  useEffect(() => {
    startLiveSession(workoutId).then(res => {
      if (res.live_started_at) setStartedAtMs(new Date(res.live_started_at).getTime())
      else setStartedAtMs(Date.now())
    }).catch(() => setStartedAtMs(Date.now()))
  }, [workoutId])
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t) }, [])

  const stoppet = stoppetSidenMs != null
  const stoppetNaa = stoppet ? nowMs - stoppetSidenMs! : 0
  const klokkeMs = avsluttetMs ?? nowMs
  const elapsedSec = startedAtMs != null ? Math.max(0, (klokkeMs - startedAtMs - stoppetSumMs - stoppetNaa) / 1000) : 0
  // Pausen som går nå: fra siste «Logg sett», frosset mens økta står stoppet (lastLogMs
  // skyves fram ved Fortsett). Å rette et ført sett avslutter den IKKE - bare «Start sett».
  const pauseSek = lastLogMs != null ? Math.max(0, ((stoppet ? stoppetSidenMs! : klokkeMs) - lastLogMs) / 1000) : null
  const pauseIAltSek = (pauseSumMs + (lastLogMs != null && avsluttetMs == null ? Math.max(0, (stoppet ? stoppetSidenMs! : nowMs) - lastLogMs) : 0)) / 1000
  const stoppetSumSek = (stoppetSumMs + stoppetNaa) / 1000
  const tilstand: 'gaar' | 'stoppet' | 'avsluttet' = avsluttetMs != null ? 'avsluttet' : stoppet ? 'stoppet' : 'gaar'

  // ── Wake lock (best effort - ingen lovnad om at skjermen står på) ──
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
    return () => { released = true; document.removeEventListener('visibilitychange', onVis); sentinel?.release().catch(() => {}) }
  }, [])

  // ── Autosave (debounced) + ved skjul/lukking ─────────────
  const exRef = useRef(exercises)
  useEffect(() => { exRef.current = exercises }, [exercises])
  const dirtyRef = useRef(false)
  const doSave = useCallback(() => {
    if (!dirtyRef.current) return
    // KLIENT-GUARD: aldri autosave en tom øvelsesliste (sammen med server-guarden).
    if (!exRef.current.some(ex => ex.exercise_name.trim())) return
    dirtyRef.current = false
    saveLiveStrength(workoutId, exRef.current).catch(() => {})
  }, [workoutId])
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
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', onHide) }
  }, [doSave])

  // ── Tall ─────────────────────────────────────────────────
  const somOvelser = useMemo(() => exercises.map(ex => ({ navn: ex.exercise_name, sett: ex.sets.map(s => ({ reps: num(s.reps), vekt: num(s.weight_kg) })) })), [exercises])
  const totalVolume = useMemo(() => tonnasje(somOvelser), [somOvelser])
  const antallSett = exercises.reduce((n, e) => n + e.sets.length, 0)
  const forte = exercises.reduce((n, e) => n + e.sets.filter(s => s.reps.trim() || s.weight_kg.trim()).length, 0)

  // ── Mutasjoner ───────────────────────────────────────────
  const updateExercise = (id: string, patch: Partial<StrengthExerciseRow>) => setExercises(exercises.map(e => e.id === id ? { ...e, ...patch } : e))
  const updateSet = (exId: string, setId: string, patch: Partial<StrengthSetRow>) =>
    setExercises(prev => prev.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...patch } : s) }))
  const addSet = (exId: string) => setExercises(exercises.map(e => e.id !== exId ? e : { ...e, sets: [...e.sets, makeSet(e.sets.length + 1)] }))
  const removeSet = (exId: string, setId: string) =>
    setExercises(exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.filter(s => s.id !== setId).map((s, i) => ({ ...s, set_number: String(i + 1) })) }))
  const removeExercise = (exId: string) => setExercises(exercises.filter(e => e.id !== exId))
  const moveExercise = (exId: string, dir: -1 | 1) => {
    const i = exercises.findIndex(e => e.id === exId), j = i + dir
    if (i < 0 || j < 0 || j >= exercises.length) return
    const next = [...exercises]; [next[i], next[j]] = [next[j], next[i]]; setExercises(next)
  }
  const addExercise = (name: string) => { if (name.trim()) setExercises([...exercises, makeExercise(name.trim())]) }
  /** PR-merkene på FØRTE sett i én øvelse, regnet mot beste for navnet (bolk 8c: etter bytte er et stående merke en oppdiktet rekord). */
  const regnPrPaaNytt = (ex: StrengthExerciseRow, beste: BesteForOvelse | undefined) => {
    setPrSets(prev => {
      const n = new Set(prev)
      for (const s of ex.sets) { if (!doneSets.has(s.id)) continue; if (erPr(beste, num(s.reps), num(s.weight_kg))) n.add(s.id); else n.delete(s.id) }
      return n
    })
  }
  /** Bolk 8c: bytt øvelse på kortet - settene (reps, kg, tid, RPE) står, bare navnet byttes. */
  const byttOvelse = (exId: string, navn: string) => {
    const ex = exercises.find(e => e.id === exId); const n = navn.trim()
    setBytter(null)
    if (!ex || !n || n === ex.exercise_name) return
    const nyEx = { ...ex, exercise_name: n }
    setExercises(exercises.map(e => e.id === exId ? nyEx : e))
    const key = normOvelse(n)
    if (key in besteByName || key in lastByName) { regnPrPaaNytt(nyEx, besteByName[key]); return }
    regnPrPaaNytt(nyEx, undefined)
    Promise.all([getLastSessionForExercises([n]), getBesteForExercises([n], undefined, workoutId)]).then(([l, b]) => {
      setEkstraLast(prev => ({ ...prev, ...l })); setEkstraBeste(prev => ({ ...prev, ...b }))
      regnPrPaaNytt(nyEx, b[key])
    }).catch(() => {})
  }
  // Bolk 8a/8b: dra-og-slipp + supersett - samme hjelper som plan/dagbok (lib/styrke-ovelser).
  const flytt = (aktivId: string, overId: string | null) => { const next = flyttOvelse(exercises, aktivId, overId); if (next !== exercises) setExercises(next) }
  const groupLetters = useMemo(() => supersettBokstaver(exercises), [exercises])
  const supersett = (id: string) => setExercises(kobleMedNeste(exercises, id))
  const losOpp = (id: string) => setExercises(losOppSupersett(exercises, id))
  const nyttSupersett = () => setExercises(leggTilSupersett(exercises, () => makeExercise('')))

  // «Gjenta forrige»: hele øvelsen fra forrige økt, som FØRT (aktivt valg).
  const repeatLast = (ex: StrengthExerciseRow) => {
    const ls = lastByName[normOvelse(ex.exercise_name)]
    if (!ls || ls.sets.length === 0) return
    updateExercise(ex.id, {
      sets: ls.sets.map((s, i) => ({
        ...makeSet(i + 1),
        reps: s.reps != null ? String(s.reps) : '', weight_kg: s.weight_kg != null ? fmtKg(s.weight_kg) : '',
        duration: s.duration_seconds != null ? String(s.duration_seconds) : '', rpe: s.rpe != null ? String(s.rpe) : '',
      })),
    })
  }

  // ── Aktivt sett + tastaturet ─────────────────────────────
  const aktiv = finnAktiv(exercises, activeSetId)

  /** Velg et sett: tastaturet starter på FØRT verdi hvis den finnes, ellers forrige økts tall (grått). */
  const velgSett = (ex: StrengthExerciseRow, s: StrengthSetRow, i: number) => {
    if (stoppet) return
    setDoneSets(prev => { const n = new Set(prev); n.delete(s.id); return n })
    setActiveSetId(s.id)
    setRedigerer(null)
    const sp = spokelse(lastByName[normOvelse(ex.exercise_name)], i)
    const harFort = !!(s.reps.trim() || s.weight_kg.trim())
    // Bolk 8g: et uført sett arver settet OVER som startverdi (rort: true - lagres
    // først ved «Logg sett»). Ellers forrige økts tall grått.
    const arv = harFort ? null : startverdiFraForrige(ex, i)
    setTast(harFort ? { reps: s.reps, kg: s.weight_kg, rort: true } : arv ? { reps: arv.reps, kg: arv.kg, rort: true } : { reps: sp.reps, kg: sp.kg, rort: false })
  }
  /** «Start sett»: DEN knappen avslutter pausen (bolk 8h) - summen tar med pausen som gikk. */
  const startSett = (ex: StrengthExerciseRow, s: StrengthSetRow, i: number) => {
    if (stoppet) return
    if (lastLogMs != null) { setPauseSumMs(p => p + Math.max(0, Date.now() - lastLogMs)); setLastLogMs(null) }
    velgSett(ex, s, i)
  }
  const bump = (felt: 'reps' | 'kg', d: number) => {
    hapticTap(8)
    setTast(t => {
      const cur = num(t[felt]) ?? 0
      const step = felt === 'reps' ? 1 : 2.5
      const next = Math.max(0, Math.round((cur + d * step) * 100) / 100)
      return { ...t, [felt]: next === 0 ? '' : fmtKg(next), rort: true }
    })
  }
  /** Logg sett: verdien i tastaturet lagres som ført - også når den er forrige økts (aktivt valg). */
  const loggSett = () => {
    if (!aktiv) return
    const reps = tast.reps.trim(), kg = tast.kg.trim()
    updateSet(aktiv.ex.id, aktiv.sett.id, { reps, weight_kg: kg })
    const pr = erPr(besteByName[normOvelse(aktiv.ex.exercise_name)], num(reps), num(kg))
    setPrSets(prev => { const n = new Set(prev); if (pr) n.add(aktiv.sett.id); else n.delete(aktiv.sett.id); return n })
    hapticTap(pr ? [15, 40, 15] : 15)
    setDoneSets(prev => new Set(prev).add(aktiv.sett.id))
    setActiveSetId(null); setRedigerer(null)
    setLastLogMs(Date.now())   // hvile teller mot neste sett
  }
  /** Trykk på et grått felt i lista fyller verdien inn som ført. */
  const fyllSpokelse = (ex: StrengthExerciseRow, s: StrengthSetRow, i: number, felt: 'reps' | 'kg') => {
    const sp = spokelse(lastByName[normOvelse(ex.exercise_name)], i)
    const v = felt === 'reps' ? sp.reps : sp.kg
    if (!v) return
    updateSet(ex.id, s.id, felt === 'reps' ? { reps: v } : { weight_kg: v })
  }

  // ── Stopp / fortsett / avslutt / avbryt ──────────────────
  const stopp = () => { if (stoppet) return; setActiveSetId(null); setStoppetSidenMs(Date.now()) }
  const fortsett = () => {
    if (!stoppet) return
    const sto = Date.now() - stoppetSidenMs!
    setStoppetSumMs(s => s + sto); setStoppetSidenMs(null)
    // Pausen sto også stille: skyv startpunktet fram så den fortsetter der den var.
    setLastLogMs(l => l != null ? l + sto : l)
  }
  const tilFerdig = () => {
    if (stoppet) fortsett()
    const naa = Date.now()
    // Bolk 8h: en åpen pause legges i summen; 8e: klokka fryses.
    if (lastLogMs != null) { setPauseSumMs(p => p + Math.max(0, naa - lastLogMs)); setLastLogMs(null) }
    setAvsluttetMs(naa); setActiveSetId(null)
    setVarighetMin(String(Math.max(1, Math.round(elapsedSec / 60))))
    setSkjerm('ferdig')
  }
  /** Tilbake fra ferdig-skjermen: tida der teller som stoppet, klokka går igjen. */
  const tilbakeTilOkta = () => {
    if (avsluttetMs != null) setStoppetSumMs(s => s + (Date.now() - avsluttetMs))
    setAvsluttetMs(null); setSkjerm('live')
  }
  const lagreIDagboka = async () => {
    if (busy) return
    setBusy(true)
    const saved = await saveLiveStrength(workoutId, exercises)
    if (saved.error) { setBusy(false); void xpAlert(saved.error); return }
    const min = Math.max(1, Math.round(num(varighetMin) ?? elapsedSec / 60))
    const res = await finishLiveSession(workoutId, min * 60)
    if (res.error) { setBusy(false); void xpAlert(res.error); return }
    hapticTap([15, 60, 20]); showCompletionCheck()
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

  const nyeRekorder = useMemo(() => rekorder(somOvelser, besteByName), [somOvelser, besteByName])
  // Neste sett (til hvile-ringen): første uferdige sett etter det sist loggede.
  const neste = finnNeste(exercises, doneSets)

  // ═══ FERDIG-SKJERMEN ═══
  if (skjerm === 'ferdig') {
    const ovelserMedSett = exercises.filter(e => e.exercise_name.trim()).length
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--flate-3)', paddingBottom: 40 }} data-live-ferdig>
        <div style={topp}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={tilbakeTilOkta} style={ikonKnapp} aria-label="Tilbake til økta"><Ikon navn="forrige" variant="strek" storrelse={18} /></button>
            <span style={{ flex: 1, fontFamily: BEBAS, color: 'var(--tekst-1-app)', fontSize: 19, letterSpacing: '0.03em' }}>Økta er ferdig</span>
          </div>
          <Teller sek={elapsedSec} tilstand="avsluttet" forte={forte} antall={antallSett} stoppetSek={stoppetSumSek} pauseSek={null} pauseIAltSek={pauseIAltSek} neste={null} />
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={kort}>
            <h3 style={kortH3}>Nøkkeltall</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
              <div><div style={disp}>{totalVolume.toLocaleString('nb-NO')}</div><div style={meta}>kg tonnasje</div></div>
              <div><div style={disp}>{forte}</div><div style={meta}>sett · {ovelserMedSett} øvelser</div></div>
              <div><div style={{ ...disp, color: GULL }}>{nyeRekorder.length}</div><div style={meta}>nye PR-er</div></div>
            </div>
          </div>
          {nyeRekorder.length > 0 && (
            <div style={kort} data-live-rekorder>
              <h3 style={kortH3}>Nye rekorder</h3>
              <div style={{ marginTop: 8 }}>
                {nyeRekorder.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '7px 0', borderBottom: i < nyeRekorder.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ ...chip, ...chipBeste, height: 22, padding: '0 7px' }}>★</span>
                    <div style={{ flex: 1 }}><b style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)' }}>{r.ovelse}</b><div style={meta}>{r.tekst}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={kort}>
            <h3 style={kortH3}>Varighet</h3>
            <p style={{ ...meta, margin: '6px 0 8px' }}>Fra start til nå, uten tida økta sto stoppet. Rett den om klokka gikk mens du var borte.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setVarighetMin(v => String(Math.max(1, (num(v) ?? 0) - 5)))} style={stepKnapp} aria-label="5 minutter mindre">−5</button>
              <div style={{ ...verdiBoks, flex: 1 }}><em style={verdiEm}>{varighetMin || '-'}</em><i style={verdiI}>min</i></div>
              <button type="button" onClick={() => setVarighetMin(v => String((num(v) ?? 0) + 5))} style={stepKnapp} aria-label="5 minutter mer">+5</button>
            </div>
          </div>
          <button type="button" onClick={lagreIDagboka} disabled={busy} data-live-lagre
            className="xp-pill" style={{ ...pillStor, width: '100%', background: GRONN, borderColor: GRONN, color: '#fff', opacity: busy ? .6 : 1 }}>
            Lagre i dagboka
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <a href={`/app/dagbok?edit=${workoutId}`} className="xp-pill xp-pill-ghost" style={{ flex: 1 }}>Se plan mot faktisk</a>
            <a href="/app/analyse?tab=styrke" data-live-styrke-analyse className="xp-pill xp-pill-ghost" style={{ flex: 1 }}>Utvikling</a>
          </div>
        </div>
      </div>
    )
  }

  // ═══ LIVE ═══
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--flate-3)', paddingBottom: aktiv ? 300 : 96 }} data-live-styrke>
      {/* Topp (klebrig): avbryt (×) · tittel · Stopp, og TELLEREN (bolk 8e/8h) - totaltid stort,
          tilstand går/STOPPET/avsluttet, «Stoppet: 4:12 (ikke med)», og pausen som teller opp. */}
      <div style={topp}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={cancel} style={ikonKnapp} aria-label="Avbryt økt-modus" data-live-avbryt><Ikon navn="lukk" variant="strek" storrelse={18} /></button>
          <span style={{ flex: 1, fontFamily: BEBAS, color: 'var(--tekst-1-app)', fontSize: 19, letterSpacing: '0.03em' }}>Live styrke</span>
          {!stoppet && (
            <button type="button" onClick={stopp} className="xp-pill xp-pill-ghost" style={{ minHeight: 30, padding: '0 11px', fontSize: 11.5 }} data-live-stopp>Stopp</button>
          )}
        </div>
        <Teller sek={elapsedSec} tilstand={tilstand} forte={forte} antall={antallSett} stoppetSek={stoppetSumSek} pauseSek={pauseSek} pauseIAltSek={null} neste={neste} />
      </div>

      <div style={{ padding: '14px 16px 0', opacity: stoppet ? .34 : 1, pointerEvents: stoppet ? 'none' : 'auto', filter: stoppet ? 'blur(1px)' : 'none', transition: 'opacity .2s' }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--card)', border: '1px dashed var(--line2)', borderRadius: 16, marginBottom: 16 }}>
            <p style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', fontSize: 15, margin: 0 }}>Ingen øvelser lagt til - legg til øvelser for å begynne.</p>
          </div>
        )}

        <OvelseListe ids={exercises.map(e => e.id)} onFlytt={flytt}>
        {exercises.map((ex, idx) => {
          const key = normOvelse(ex.exercise_name)
          const ls = lastByName[key], plan = plannedByName[key], beste = fmtBeste(besteByName[key])
          const ssLetter = ex.superset_group != null ? groupLetters.get(ex.superset_group) : undefined
          const erAktivOvelse = aktiv?.ex.id === ex.id
          return (
            <SorterbarOvelse key={ex.id} id={ex.id}>
            {grip => (
            <div data-styrke-ss={ssLetter} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderLeft: `3px solid ${ssLetter ? 'var(--kant-7)' : erAktivOvelse ? ORANGE : 'var(--line)'}`, borderRadius: 16, marginBottom: 12, overflow: 'hidden' }} data-live-ovelse>
              <header style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 10px 9px 8px' }}>
                <OvelseHandtak dragRef={grip.dragRef} dragListeners={grip.dragListeners} dragAttributes={grip.dragAttributes} dragging={grip.dragging} onMove={dir => moveExercise(ex.id, dir)} />
                <span style={{ width: ssLetter ? 'auto' : 24, padding: ssLetter ? '0 7px' : 0, height: 24, borderRadius: 999, background: 'var(--card2)', color: 'var(--tekst-8-app)', display: 'grid', placeItems: 'center', fontFamily: FONT, fontSize: 12, fontWeight: 700, flex: 'none' }}>
                  {ssLetter ? `SS ${ssLetter}` : idx + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {ex.exercise_name.trim() && bytter !== ex.id ? (
                    <b style={{ display: 'block', fontFamily: BEBAS, fontSize: 19, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.exercise_name || 'Øvelse'}</b>
                  ) : (
                    <NavnVelger start={bytter === ex.id ? ex.exercise_name : ''} onVelg={navn => bytter === ex.id ? byttOvelse(ex.id, navn) : updateExercise(ex.id, { exercise_name: navn })} onAvbryt={() => setBytter(null)} />
                  )}
                  <span style={{ fontFamily: FONT, color: 'var(--tekst-8-app)', fontSize: 11.5 }}>{ex.sets.length} sett · {settRad(ex)}</span>
                </span>
                <button type="button" onClick={() => setMeny(m => m === ex.id ? null : ex.id)} style={ikonKnapp} aria-label="Handlinger for øvelsen" aria-expanded={meny === ex.id}>⋯</button>
              </header>
              {meny === ex.id && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 14px 10px' }} data-live-meny>
                  <button type="button" className="xp-pill xp-pill-ghost" style={pillLiten} onClick={() => { setBytter(ex.id); setMeny(null) }} data-live-bytt-ovelse>Bytt øvelse</button>
                  <button type="button" className="xp-pill xp-pill-ghost" style={pillLiten} onClick={() => moveExercise(ex.id, -1)}>▲ Opp</button>
                  <button type="button" className="xp-pill xp-pill-ghost" style={pillLiten} onClick={() => moveExercise(ex.id, 1)}>▼ Ned</button>
                  <button type="button" className="xp-pill xp-pill-ghost" style={{ ...pillLiten, color: '#E23A5A' }} onClick={() => { removeExercise(ex.id); setMeny(null) }}>Fjern øvelse</button>
                </div>
              )}
              {(beste || plan || ls) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 14px 11px', alignItems: 'center' }}>
                  {beste && <span style={{ ...chip, ...chipBeste }} data-live-beste>★ Beste <b style={{ color: GULL, fontWeight: 700 }}>{beste}</b></span>}
                  {!beste && !ls && <span style={{ ...chip, color: 'var(--tekst-8-app)' }}>Ingen historikk ennå</span>}
                  {plan && <span style={{ ...chip, borderColor: 'rgba(26,111,212,.45)', color: PLAN_BLAA, background: 'rgba(26,111,212,.10)' }}>Plan <b style={{ color: 'var(--tekst-1-app)', fontWeight: 700 }}>{plan}</b></span>}
                  {ls && <span style={{ fontFamily: FONT, color: 'var(--tekst-8-app)', fontSize: 11.5 }}>Sist: {summarizeLast(ls)} ({daysAgoLabel(ls.date)})</span>}
                  {ls && <button type="button" onClick={() => repeatLast(ex)} className="xp-pill xp-pill-ghost" style={pillLiten}><Ikon navn="gjenta-forrige" variant="strek" storrelse={14} /> Gjenta forrige</button>}
                </div>
              )}

              {/* Settradene: nr · reps · kg · rpe · knapp. Grått = forrige økt, plassholder - lagres aldri. */}
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {ex.sets.map((s, si) => {
                  const done = doneSets.has(s.id), active = s.id === activeSetId, pr = prSets.has(s.id)
                  const sp = spokelse(ls, si)
                  const repsFort = s.reps.trim() !== '', kgFort = s.weight_kg.trim() !== ''
                  return (
                    <div key={s.id} className="xp-live-settrad" data-sett={si + 1} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 1fr 44px 62px', gap: 7, alignItems: 'center', padding: '7px 14px', borderTop: si === 0 ? 'none' : '1px solid var(--line)', background: active ? 'rgba(255,69,0,.06)' : 'none' }}>
                      <span style={{ fontFamily: FONT, fontSize: 13, color: done ? GRONN : active ? ORANGE : 'var(--tekst-8-app)', textAlign: 'center' }}>
                        {done ? <Ikon navn="fullfort" variant="strek" storrelse={14} /> : si + 1}
                      </span>
                      <Felt fort={repsFort} verdi={repsFort ? s.reps : sp.reps} pr={false} onClick={() => repsFort || active ? velgSett(ex, s, si) : fyllSpokelse(ex, s, si, 'reps')} aria={`Sett ${si + 1} reps`} />
                      <Felt fort={kgFort} verdi={kgFort ? s.weight_kg : sp.kg} pr={pr} onClick={() => kgFort || active ? velgSett(ex, s, si) : fyllSpokelse(ex, s, si, 'kg')} aria={`Sett ${si + 1} kg`} />
                      <RpePicker value={s.rpe} onChange={v => updateSet(ex.id, s.id, { rpe: v })} />
                      {done ? (
                        <button type="button" onClick={() => velgSett(ex, s, si)} style={{ ...settKnapp, background: 'rgba(40,168,110,.14)', color: GRONN, border: '1px solid rgba(40,168,110,.35)' }} aria-label={`Sett ${si + 1} logget - trykk for å rette`}>✓</button>
                      ) : active ? (
                        <button type="button" onClick={loggSett} style={settKnapp} data-live-logg-rad>Logg</button>
                      ) : (
                        <button type="button" onClick={() => startSett(ex, s, si)} style={settKnapp} data-live-start>Start</button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '8px 14px 12px' }}>
                <button type="button" onClick={() => addSet(ex.id)} className="xp-pill xp-pill-ghost" style={{ flex: 1, borderStyle: 'dashed', minHeight: 40 }} data-live-legg-til-sett>+ Legg til sett</button>
                {ssLetter ? (
                  <button type="button" onClick={() => losOpp(ex.id)} className="xp-pill xp-pill-ghost" style={{ minHeight: 40 }} data-live-los-opp>Løs opp</button>
                ) : idx < exercises.length - 1 ? (
                  <button type="button" onClick={() => supersett(ex.id)} className="xp-pill xp-pill-ghost" style={{ minHeight: 40 }} data-live-supersett>Supersett</button>
                ) : null}
                {ex.sets.length > 1 && <button type="button" onClick={() => removeSet(ex.id, ex.sets[ex.sets.length - 1].id)} className="xp-pill xp-pill-ghost" style={{ minHeight: 40 }} aria-label="Fjern siste sett">− Sett</button>}
              </div>
            </div>
            )}
            </SorterbarOvelse>
          )
        })}
        </OvelseListe>

        <AddExerciseInline onAdd={addExercise} onSupersett={nyttSupersett} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px' }}>
          <span style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', fontSize: 13 }}>Tonnasje: <b style={{ color: 'var(--tekst-1-app)' }}>{totalVolume.toLocaleString('nb-NO')} kg</b></span>
          <a href="/app/analyse?tab=styrke" data-live-styrke-analyse style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', fontSize: 12, textDecoration: 'underline' }}>utvikling og PR-er</a>
        </div>
      </div>

      {/* TASTATURET - fast nederst når et sett er aktivt. Ellers: Fullfør-linja. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: 'var(--live-topp)', backdropFilter: 'blur(14px)', borderTop: '1px solid var(--line2)', borderRadius: '20px 20px 0 0', padding: '12px 14px 14px' }} data-live-bunn>
        {stoppet ? (
          <div data-live-stoppet>
            <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
              <div style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: '0.03em', color: 'var(--tekst-1-app)' }}>Klokka står</div>
              <div style={{ ...meta, fontSize: 12 }}>Tiden fra nå teller ikke med - totaltida står i toppen.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
              <button type="button" onClick={tilFerdig} className="xp-pill" style={{ ...pillStor, background: 'var(--card2)', color: 'var(--tekst-1-app)', borderColor: 'var(--line2)' }} data-live-avslutt>Avslutt</button>
              <button type="button" onClick={fortsett} className="xp-pill xp-pill-primary" style={pillStor} data-live-fortsett>▶ Fortsett</button>
            </div>
            <div style={{ ...meta, textAlign: 'center', fontSize: 11 }}>{forte} sett ført · {totalVolume.toLocaleString('nb-NO')} kg · hvile mellom sett teller som styrketid</div>
          </div>
        ) : aktiv ? (
          <div data-live-tastatur>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <b style={{ fontFamily: BEBAS, fontSize: 17, letterSpacing: '0.03em', fontWeight: 400, color: 'var(--tekst-1-app)' }}>{aktiv.ex.exercise_name} · sett {aktiv.i + 1}</b>
              <span style={{ fontFamily: FONT, color: 'var(--tekst-8-app)', fontSize: 11.5 }}>{tast.rort ? 'Ditt tall' : 'Grått = forrige økt'}</span>
            </div>
            <div style={stepperRad}>
              <button type="button" onClick={() => bump('reps', -1)} style={stepKnapp} aria-label="En rep mindre">−</button>
              <TallBoks felt="reps" enhet="reps" verdi={tast.reps} rort={tast.rort} redigerer={redigerer === 'reps'} onApne={() => setRedigerer('reps')} onLukk={() => setRedigerer(null)} onSkriv={v => setTast(t => ({ ...t, reps: v, rort: true }))} />
              <button type="button" onClick={() => bump('reps', 1)} style={stepKnapp} aria-label="En rep mer">+</button>
            </div>
            <div style={stepperRad}>
              <button type="button" onClick={() => bump('kg', -1)} style={stepKnapp} aria-label="2,5 kg mindre">−2,5</button>
              <TallBoks felt="kg" enhet="kg" verdi={tast.kg} rort={tast.rort} redigerer={redigerer === 'kg'} onApne={() => setRedigerer('kg')} onLukk={() => setRedigerer(null)} onSkriv={v => setTast(t => ({ ...t, kg: v, rort: true }))} />
              <button type="button" onClick={() => bump('kg', 1)} style={stepKnapp} aria-label="2,5 kg mer">+2,5</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <RpePicker value={aktiv.sett.rpe} onChange={v => updateSet(aktiv.ex.id, aktiv.sett.id, { rpe: v })} somPille />
              <button type="button" onClick={() => setActiveSetId(null)} className="xp-pill xp-pill-ghost" style={pillLiten}>Lukk</button>
            </div>
            <button type="button" onClick={loggSett} className="xp-pill" style={{ ...pillStor, width: '100%', background: GRONN, borderColor: GRONN, color: '#fff' }} data-live-logg>✓ Logg sett</button>
          </div>
        ) : (
          <button type="button" onClick={tilFerdig} disabled={busy} className="xp-pill" style={{ ...pillStor, width: '100%', background: GRONN, borderColor: GRONN, color: '#fff' }} data-live-fullfor>
            Fullfør økt
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Bolk 8f: tallet i stepperen. Trykk åpner et numerisk felt (inputmode decimal for kg,
 * numeric for reps), forhåndsfylt og markert; Enter eller trykk utenfor lukker. Komma og
 * punktum godtas (num() leser begge). Skriver til samme tast-tilstand som stepperen -
 * ingen ny kilde. Boksen er fortsatt 52 px.
 */
function TallBoks({ felt, enhet, verdi, rort, redigerer, onApne, onLukk, onSkriv }: {
  felt: 'reps' | 'kg'; enhet: string; verdi: string; rort: boolean; redigerer: boolean
  onApne: () => void; onLukk: () => void; onSkriv: (v: string) => void
}) {
  if (redigerer) {
    return (
      <div style={verdiBoks}>
        <input autoFocus value={verdi} inputMode={felt === 'kg' ? 'decimal' : 'numeric'} aria-label={`Skriv ${enhet}`} data-live-tast-felt={felt}
          onFocus={e => e.currentTarget.select()}
          onChange={e => onSkriv(e.target.value.replace(/[^0-9.,]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onLukk() } }}
          onBlur={onLukk}
          style={{ ...verdiEm, width: '100%', minWidth: 0, background: 'none', border: 'none', outline: 'none', textAlign: 'right', padding: 0 }} />
        <i style={verdiI}>{enhet}</i>
      </div>
    )
  }
  return (
    <button type="button" onClick={onApne} aria-label={`Skriv ${enhet} direkte`} style={{ ...verdiBoks, cursor: 'text', width: '100%' }} data-live-tast-apne={felt}>
      <em style={{ ...verdiEm, color: rort ? 'var(--tekst-1-app)' : 'var(--tekst-10)' }} data-live-tast-reps={felt === 'reps' ? '' : undefined} data-live-tast-kg={felt === 'kg' ? '' : undefined}>{verdi || '-'}</em><i style={verdiI}>{enhet}</i>
    </button>
  )
}

function finnAktiv(exercises: StrengthExerciseRow[], activeSetId: string | null) {
  if (activeSetId == null) return null
  for (const ex of exercises) { const i = ex.sets.findIndex(s => s.id === activeSetId); if (i >= 0) return { ex, sett: ex.sets[i], i } }
  return null
}
/** Første uferdige sett - det hvile-ringen teller ned mot. */
function finnNeste(exercises: StrengthExerciseRow[], doneSets: Set<string>) {
  for (const ex of exercises) for (let i = 0; i < ex.sets.length; i++) if (!doneSets.has(ex.sets[i].id)) return { ex, i }
  return null
}

// ── Småkomponenter ───────────────────────────────────────

/** Felt i settrada: ført (hvit) eller forrige økts tall (grått, plassholder). */
function Felt({ fort, verdi, pr, onClick, aria }: { fort: boolean; verdi: string; pr: boolean; onClick: () => void; aria: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={aria} data-fort={fort ? '1' : '0'}
      style={{
        position: 'relative', height: 44, borderRadius: 10, border: `1px solid ${pr ? 'rgba(212,160,23,.55)' : fort ? 'var(--kant-3)' : 'var(--line2)'}`,
        background: fort ? 'var(--card2)' : 'var(--card)', color: fort ? 'var(--tekst-1-app)' : 'var(--tekst-10)',
        fontFamily: BEBAS, fontSize: 20, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
        boxShadow: pr ? 'inset 0 0 0 1px rgba(212,160,23,.18)' : 'none',
      }}>
      {verdi || '-'}
      {pr && <small style={{ position: 'absolute', right: 7, bottom: 3, fontFamily: FONT, fontSize: 9, letterSpacing: '0.04em', color: GULL, fontWeight: 700 }}>PR</small>}
    </button>
  )
}

/**
 * Bolk 8e + 8h: telleren i den klebrige toppen. Totaltid stort (Bebas, som appens andre
 * store tall), tilstand går / STOPPET (dempet + merke) / avsluttet, «Totaltid» som etikett,
 * «Stoppet: 4:12 (ikke med)» når det finnes stoppet tid, og pausen som teller OPP fra
 * «Logg sett» - ringen fylles til HVILE_MAAL_SEK som et mykt mål, tallet er tida som har
 * gått. Bare visning: verdien er den samme som lagres (bolk 3).
 */
function Teller({ sek, tilstand, forte, antall, stoppetSek, pauseSek, pauseIAltSek, neste }: {
  sek: number; tilstand: 'gaar' | 'stoppet' | 'avsluttet'; forte: number; antall: number
  stoppetSek: number; pauseSek: number | null; pauseIAltSek: number | null
  neste: { ex: StrengthExerciseRow; i: number } | null
}) {
  const dempet = tilstand !== 'gaar'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '4px 0 2px' }} data-live-teller>
      <div style={{ minWidth: 0 }}>
        <div data-live-tid data-live-tilstand={tilstand}
          style={{ fontFamily: BEBAS, fontSize: 44, lineHeight: 1, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', color: dempet ? 'var(--tekst-8-app)' : 'var(--tekst-1-app)' }}>
          {fmtClock(sek)}
        </div>
        <div style={{ ...meta, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>Totaltid</span>
          {tilstand === 'stoppet' && <span data-live-merke="stoppet" style={{ padding: '1px 7px', borderRadius: 999, border: '1px solid var(--line2)', color: 'var(--tekst-3-app)', fontWeight: 700 }}>Stoppet</span>}
          {tilstand === 'avsluttet' && <span data-live-merke="avsluttet" style={{ padding: '1px 7px', borderRadius: 999, border: '1px solid rgba(40,168,110,.45)', color: GRONN, fontWeight: 700 }}>Avsluttet</span>}
          <span>· {forte} av {antall} sett</span>
        </div>
        {stoppetSek >= 1 && <div data-live-stoppet-tid style={{ ...meta, fontSize: 11.5, marginTop: 2 }}>Stoppet: {fmtClock(stoppetSek)} (ikke med)</div>}
        {pauseIAltSek != null && pauseIAltSek >= 1 && <div data-live-pause-sum={Math.round(pauseIAltSek)} style={{ ...meta, fontSize: 11.5, marginTop: 2 }}>Pause i alt: {fmtClock(pauseIAltSek)} (med i totaltida)</div>}
      </div>
      {pauseSek != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }} data-live-pause={Math.floor(pauseSek)}>
          <HvileRing sek={pauseSek} liten />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: BEBAS, fontSize: 24, lineHeight: 1, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', color: dempet ? 'var(--tekst-8-app)' : 'var(--tekst-1-app)' }}>{fmtClock(pauseSek)}</div>
            <div style={{ ...meta, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap' }}>Pause{neste ? ` · ${neste.ex.exercise_name} sett ${neste.i + 1}` : ''}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function HvileRing({ sek, liten = false }: { sek: number; liten?: boolean }) {
  const r = 18, omkrets = 2 * Math.PI * r
  const andel = Math.min(1, sek / HVILE_MAAL_SEK)
  return (
    <svg width={liten ? 30 : 42} height={liten ? 30 : 42} viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line2)" strokeWidth="4" />
      <circle cx="21" cy="21" r={r} fill="none" stroke={ORANGE} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={omkrets} strokeDashoffset={omkrets * (1 - andel)} transform="rotate(-90 21 21)" style={{ transition: 'stroke-dashoffset .9s linear' }} />
    </svg>
  )
}

function RpePicker({ value, onChange, somPille = false }: { value: string; onChange: (v: string) => void; somPille?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="RPE"
        className={somPille ? 'xp-pill xp-pill-ghost' : undefined}
        style={somPille ? pillLiten : { height: 36, width: '100%', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--card2)', color: value ? 'var(--tekst-1-app)' : 'var(--tekst-8-app)', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
        {somPille ? `RPE ${value || '-'}` : (value || '-')}
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: somPille ? '100%' : 'auto', top: somPille ? 'auto' : '100%', left: 0, zIndex: 60, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', margin: '2px 0' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} type="button" onClick={() => { onChange(String(n)); setOpen(false) }}
              style={{ width: 36, height: 36, background: String(n) === value ? ORANGE : 'none', color: String(n) === value ? '#fff' : 'var(--tekst-3-app)', border: '1px solid var(--kant-1-app)', cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tom øvelse (fra «Legg til supersett»): navnet velges på kortet - søk i standardbiblioteket eller skriv eget. Bolk 8c gjenbruker den for «Bytt øvelse». */
function NavnVelger({ onVelg, onAvbryt, start = '' }: { onVelg: (navn: string) => void; onAvbryt?: () => void; start?: string }) {
  const [q, setQ] = useState(start)
  const matches = useMemo(() => q.trim() && q.trim() !== start ? searchStandardExercises(q, new Set(), 5) : [], [q, start])
  const commit = (navn: string) => { if (navn.trim()) onVelg(navn.trim()); else onAvbryt?.() }
  return (
    <span style={{ display: 'block', position: 'relative' }} data-live-navnvelger>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Skriv øvelsen (søk eller eget navn)" autoFocus aria-label="Øvelsesnavn"
        onFocus={e => { if (start) e.currentTarget.select() }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(q) } if (e.key === 'Escape') { e.preventDefault(); onAvbryt?.() } }} onBlur={() => { if (matches.length === 0) commit(q) }}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 999, color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 15, padding: '7px 12px', minHeight: 36 }} />
      {matches.length > 0 && (
        <span style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14, marginTop: 4, overflow: 'hidden' }}>
          {matches.map(m => (
            <button key={m.name} type="button" onMouseDown={e => e.preventDefault()} onClick={() => commit(m.name)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--kant-1-app)', color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 14, padding: '9px 12px', minHeight: 36 }}>
              {m.name}
            </button>
          ))}
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => commit(q)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontFamily: FONT, fontSize: 13, padding: '9px 12px', minHeight: 36 }}>Bruk «{q.trim()}»</button>
        </span>
      )}
    </span>
  )
}

function AddExerciseInline({ onAdd, onSupersett }: { onAdd: (name: string) => void; onSupersett: () => void }) {
  const [q, setQ] = useState('')
  const [browse, setBrowse] = useState(false)
  const matches = useMemo(() => q.trim() ? searchStandardExercises(q, new Set(), 6) : [], [q])
  const commit = (name: string) => { onAdd(name); setQ(''); setBrowse(false) }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="xp-live-add-exercise" value={q} onChange={e => setQ(e.target.value)} placeholder="Legg til øvelse (søk eller skriv eget)"
          style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 999, color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 15, padding: '10px 16px', outline: 'none', minHeight: 44 }} />
        <button type="button" onClick={() => setBrowse(b => !b)} aria-label="Bla i biblioteket" className={`xp-pill ${browse ? 'xp-pill-primary' : 'xp-pill-ghost'}`} style={{ minHeight: 44 }}>Bla</button>
        <button type="button" onClick={() => commit(q)} disabled={!q.trim()} className="xp-pill xp-pill-primary" style={{ minHeight: 44 }}>Legg til</button>
      </div>
      {/* Bolk 8b: to tomme, koblede øvelser i ett trykk - samme knapp som plan/dagbok. */}
      <button type="button" onClick={onSupersett} data-live-legg-til-supersett className="xp-pill xp-pill-ghost" style={{ width: '100%', minHeight: 40, marginTop: 8, borderStyle: 'dashed', borderColor: 'var(--kant-7)' }}>+ Legg til supersett</button>
      {browse && <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14, marginTop: 6, overflow: 'hidden' }}><StandardExerciseBrowser onPick={commit} /></div>}
      {matches.length > 0 && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14, marginTop: 6, overflow: 'hidden' }}>
          {matches.map(m => (
            <button key={m.name} type="button" onClick={() => commit(m.name)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--kant-1-app)', color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 14, padding: '10px 14px', cursor: 'pointer', minHeight: 40 }}>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stiler ───────────────────────────────────────────────
const topp: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 10, background: 'var(--live-topp)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)', padding: '8px 16px 12px' }
const ikonKnapp: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--tekst-5-app)', minWidth: 36, minHeight: 36, fontSize: 17, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const kort: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 14, marginBottom: 12 }
const kortH3: React.CSSProperties = { margin: 0, fontFamily: BEBAS, fontSize: 18, letterSpacing: '0.03em', fontWeight: 400, color: 'var(--tekst-1-app)' }
const meta: React.CSSProperties = { fontFamily: FONT, color: 'var(--tekst-8-app)', fontSize: 11.5 }
const disp: React.CSSProperties = { fontFamily: BEBAS, fontSize: 26, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 999, border: '1px solid var(--line2)', fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-5-app)', background: 'var(--card2)' }
const chipBeste: React.CSSProperties = { borderColor: 'rgba(212,160,23,.5)', color: GULL, background: 'rgba(212,160,23,.10)' }
const settKnapp: React.CSSProperties = { height: 36, borderRadius: 999, border: 0, background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px', whiteSpace: 'nowrap', cursor: 'pointer' }
const pillLiten: React.CSSProperties = { minHeight: 30, padding: '0 11px', fontSize: 11.5, letterSpacing: '0.06em' }
const pillStor: React.CSSProperties = { minHeight: 52, fontSize: 16, letterSpacing: '0.06em' }
const stepperRad: React.CSSProperties = { display: 'grid', gridTemplateColumns: '52px 1fr 52px', gap: 8, alignItems: 'center', marginBottom: 9 }
const stepKnapp: React.CSSProperties = { height: 52, minWidth: 52, borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--card2)', color: 'var(--tekst-3-app)', fontSize: 22, fontFamily: "'Barlow', sans-serif", lineHeight: 1, cursor: 'pointer' }
const verdiBoks: React.CSSProperties = { height: 52, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line2)', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }
const verdiEm: React.CSSProperties = { fontStyle: 'normal', fontFamily: BEBAS, fontSize: 30, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', color: 'var(--tekst-1-app)' }
const verdiI: React.CSSProperties = { fontStyle: 'normal', color: 'var(--tekst-8-app)', fontSize: 12, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.07em' }
