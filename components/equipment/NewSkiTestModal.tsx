'use client'

// Ny skitest (fasit: design/xpulse-utstyr-design.html seksjon 3 + 4).
// Testmaler: ⏱ tidtaker-glid · 📏 lengde-glid · ⚔ parallelltest · ✎ egen test
// (+ egne lagrede test-maler). Forhold registreres på alle tester. «Under
// skiene» er per ski — samme ski kan stille flere ganger m/ ulik smøring.
// Alt lagres gjennom eksisterende saveSkiTest/rank_in_test — utvidet, ikke erstattet.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSkiTest, saveConditionsTemplate, saveSkiTestTemplate } from '@/app/actions/ski-tests'
import {
  STANDARD_SNOW_TYPES,
  STANDARD_CONDITIONS,
  STANDARD_WEATHER,
  SKI_TEST_TYPES,
  SKI_TEST_TYPE_LABELS,
  SKI_TEST_TYPE_DESCRIPTIONS,
  type SkiTestType,
  type SkiTestTemplate,
  type UserConditionsTemplate,
} from '@/lib/ski-test-types'
import Link from 'next/link'
import { visSlipDato, type SkiEquipment } from '@/lib/equipment-types'
import { parseDecimal } from '@/lib/parse-decimal'
import {
  lagRunde,
  rundeAvgjort,
  nesteRunde,
  erFerdig,
  beregnRangering,
  type PtRunde,
} from '@/lib/parallelltest'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  ski: SkiEquipment[]
  templates: UserConditionsTemplate[]
  defaultSkiId?: string
  onClose: () => void
  // Når satt: trener legger til test for utøver. saveSkiTest sjekker
  // can_edit_plan-permission via resolveTargetUser.
  targetUserId?: string
  // Egne lagrede test-maler (fase 100) — kun i utøverens egen flyt.
  testTemplates?: SkiTestTemplate[]
}

// Slip og lengde spoerres IKKE om her — de ligger paa ski-raden i utstyr og
// leses derfra. Testen har derfor ingen slip-felt i skjema-tilstanden; verdien
// snapshottes fra utstyret ved lagring (test-historikken skal vise hvilken
// slip skia faktisk hadde da testen ble kjoert).
interface EntryRow {
  ski_id: string
  rank_in_test: string
  rating: string
  time_seconds: string
  distance_m: string
  wax_used: string
  notes: string
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NewSkiTestModal({ ski, templates, defaultSkiId, onClose, targetUserId, testTemplates = [] }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [testType, setTestType] = useState<SkiTestType>('egen')
  // Valgt egen mal (styrer målemåten når testType='egen').
  const [egenMal, setEgenMal] = useState<SkiTestTemplate | null>(null)
  const [lagreSomMal, setLagreSomMal] = useState(false)
  const [malNavn, setMalNavn] = useState('')
  const [test, setTest] = useState({
    test_date: todayISO(),
    location: '',
    weather: '',
    air_temp: '',
    snow_temp: '',
    humidity_pct: '',
    snow_type: '',
    conditions: '',
    notes: '',
  })
  const [entries, setEntries] = useState<EntryRow[]>(() => {
    const initial: EntryRow[] = []
    if (defaultSkiId) initial.push(makeEntry(defaultSkiId))
    return initial
  })
  // Parallelltest: runder bygges når brukeren starter braketten.
  const [runder, setRunder] = useState<PtRunde[] | null>(null)

  const snowOptions = useMemo(() => buildOptions(STANDARD_SNOW_TYPES, templates, 'snow'), [templates])
  const condOptions = useMemo(() => buildOptions(STANDARD_CONDITIONS, templates, 'conditions'), [templates])

  const skiById = useMemo(() => new Map(ski.map(s => [s.id, s])), [ski])

  // «Under skiene per ski»: samme ski kan stille flere ganger m/ ulik smøring
  // — derfor filtreres ikke valgte ski bort fra velgeren.
  const oppsettNr = (idx: number) => {
    const id = entries[idx].ski_id
    let n = 0
    for (let i = 0; i <= idx; i++) if (entries[i].ski_id === id) n++
    return n
  }
  const entryNavn = (idx: number) => {
    const base = skiById.get(entries[idx].ski_id)?.name ?? '—'
    const n = oppsettNr(idx)
    const flere = entries.filter(e => e.ski_id === entries[idx].ski_id).length > 1
    return flere ? `${base} (oppsett ${n})` : base
  }

  const addEntry = (ski_id: string) => {
    setEntries(es => [...es, makeEntry(ski_id)])
    setRunder(null) // braketten bygges på nytt hvis deltakerne endres
  }
  const removeEntry = (idx: number) => {
    setEntries(es => es.filter((_, i) => i !== idx))
    setRunder(null)
  }
  const updateEntry = (idx: number, patch: Partial<EntryRow>) => {
    setEntries(es => es.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  const handleSaveSnowAsTemplate = async () => {
    const label = test.snow_type.trim()
    if (!label) return
    if (snowOptions.includes(label)) return
    await saveConditionsTemplate({ type: 'snow', label })
    router.refresh()
  }
  const handleSaveCondAsTemplate = async () => {
    const label = test.conditions.trim()
    if (!label) return
    if (condOptions.includes(label)) return
    await saveConditionsTemplate({ type: 'conditions', label })
    router.refresh()
  }

  // Målemåten for egen test: fra valgt egen mal, ellers alt (som før).
  const egenMeasure = egenMal?.measure ?? null

  const visTid = testType === 'tidtaker' || (testType === 'egen' && (egenMeasure === null || egenMeasure === 'tid'))
  const visLengde = testType === 'lengde' || (testType === 'egen' && egenMeasure === 'lengde')
  const visScore = testType === 'egen' && (egenMeasure === null || egenMeasure === 'score')
  const visRank = testType !== 'parallell'
  const erParallell = testType === 'parallell'

  // Parallell: klikk = vinner; neste runde bygges når runden er avgjort.
  const velgVinner = (rundeIdx: number, parIdx: number, vinner: string) => {
    setRunder(r => {
      if (!r) return r
      // Valg i en tidligere runde nullstiller alt etterpå.
      const beholdt = r.slice(0, rundeIdx + 1).map((runde, ri) =>
        ri === rundeIdx
          ? { par: runde.par.map((p, pi) => pi === parIdx && p.b !== null ? { ...p, vinner } : p) }
          : runde
      )
      const neste = nesteRunde(beholdt)
      return neste ? [...beholdt, neste] : beholdt
    })
  }

  const startBracket = () => {
    setError(null)
    if (entries.length < 2) { setError('Parallelltest trenger minst 2 ski'); return }
    setRunder([lagRunde(entries.map((_, i) => String(i)))])
  }

  const parallellRangering = useMemo(() => {
    if (!runder || !erFerdig(runder)) return null
    return beregnRangering(runder)
  }, [runder])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (entries.length < 1) { setError('Minst 1 ski må registreres'); return }
    if (erParallell && !parallellRangering) { setError('Fullfør parallelltesten — alle duellene må avgjøres'); return }
    setError(null)
    startTransition(async () => {
      // Egen test kan lagres som gjenbrukbar mal (fase 100).
      if (testType === 'egen' && lagreSomMal && malNavn.trim()) {
        await saveSkiTestTemplate({
          name: malNavn,
          measure: egenMeasure ?? 'score',
        })
      }

      // Rangering: parallell fra braketten; tidtaker/lengde autorangeres fra
      // målingene hvis ingen manuell rangering er satt.
      const manuelleRanks = entries.some(en => en.rank_in_test.trim() !== '')
      const autoRank = new Map<number, number>()
      if (!erParallell && !manuelleRanks) {
        const målt = entries
          .map((en, i) => ({
            i,
            verdi: testType === 'tidtaker'
              ? (en.time_seconds ? parseDecimal(en.time_seconds) : null)
              : testType === 'lengde'
                ? (en.distance_m ? parseDecimal(en.distance_m) : null)
                : null,
          }))
          .filter((x): x is { i: number; verdi: number } => typeof x.verdi === 'number')
        if (målt.length === entries.length && målt.length > 0) {
          // Tidtaker: lavest tid vinner. Lengde: lengst glid vinner.
          målt.sort((a, b) => testType === 'tidtaker' ? a.verdi - b.verdi : b.verdi - a.verdi)
          målt.forEach((x, plass) => autoRank.set(x.i, plass + 1))
        }
      }

      const result = await saveSkiTest({
        test_date: test.test_date,
        location: test.location || null,
        weather: test.weather || null,
        air_temp: test.air_temp ? parseDecimal(test.air_temp) : null,
        snow_temp: test.snow_temp ? parseDecimal(test.snow_temp) : null,
        humidity_pct: test.humidity_pct ? parseDecimal(test.humidity_pct) : null,
        snow_type: test.snow_type || null,
        conditions: test.conditions || null,
        notes: egenMal ? [`Mal: ${egenMal.name}`, test.notes].filter(Boolean).join(' — ') : (test.notes || null),
        test_type: testType,
        entries: entries.map((en, idx) => ({
          ski_id: en.ski_id,
          rank_in_test: erParallell
            ? (parallellRangering?.get(String(idx)) ?? null)
            : en.rank_in_test
              ? parseInt(en.rank_in_test)
              : (autoRank.get(idx) ?? null),
          rating: en.rating ? parseInt(en.rating) : null,
          time_seconds: en.time_seconds ? parseInt(en.time_seconds) : null,
          distance_m: en.distance_m ? parseDecimal(en.distance_m) : null,
          wax_used: en.wax_used || null,
          // Fra utstyret — aldri fra et felt i testen.
          slip_used: skiById.get(en.ski_id)?.ski_data?.current_slip ?? null,
          notes: en.notes || null,
        })),
      }, targetUserId)
      if (result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid var(--line)',
          borderRadius: 14,
          width: '94%', maxWidth: '760px',
        }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.08em' }}>
            Ny skitest
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', fontSize: '22px' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Testtype (fasit seksjon 3) */}
          <div>
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Testtype
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SKI_TEST_TYPES.map(t => (
                <button key={t} type="button"
                  onClick={() => { setTestType(t); setEgenMal(null); setRunder(null) }}
                  className="p-3 text-left"
                  style={{
                    background: testType === t && !egenMal ? 'rgba(255,69,0,0.07)' : '#0B0B0F',
                    border: `1px solid ${testType === t && !egenMal ? ATHLETE_ORANGE : 'var(--line2, #2A2A33)'}`,
                    borderRadius: 12, cursor: 'pointer',
                  }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', fontWeight: 600 }}>
                    {SKI_TEST_TYPE_LABELS[t]}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#555560' }}>
                    {SKI_TEST_TYPE_DESCRIPTIONS[t]}
                  </p>
                </button>
              ))}
            </div>
            {testTemplates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {testTemplates.map(m => (
                  <button key={m.id} type="button"
                    onClick={() => { setTestType('egen'); setEgenMal(m); setRunder(null) }}
                    className="px-3 py-2 text-xs"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: egenMal?.id === m.id ? '#F0F0F2' : '#8A8A96',
                      background: egenMal?.id === m.id ? 'rgba(255,69,0,0.07)' : 'none',
                      border: `1px solid ${egenMal?.id === m.id ? ATHLETE_ORANGE : 'var(--line)'}`,
                      borderRadius: 999, cursor: 'pointer',
                    }}>
                    ✎ {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Forhold — registreres på alle tester (fasit) */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--line)' }}>
            <p className="text-xs tracking-widest uppercase mt-3 mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Forhold — registreres på alle tester
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dato">
                <input type="date" required value={test.test_date}
                  onChange={e => setTest(t => ({ ...t, test_date: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
              <Field label="Sted">
                <input value={test.location} onChange={e => setTest(t => ({ ...t, location: e.target.value }))}
                  placeholder="F.eks. Sjusjøen"
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Vær">
                <VaerVelger value={test.weather} onChange={v => setTest(t => ({ ...t, weather: v }))} />
              </Field>
              <Field label="Føre">
                <ComboInput options={condOptions} value={test.conditions}
                  onChange={v => setTest(t => ({ ...t, conditions: v }))}
                  onSaveTemplate={handleSaveCondAsTemplate} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Temp luft (°C)">
                <input type="number" step="0.1" value={test.air_temp}
                  onChange={e => setTest(t => ({ ...t, air_temp: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
              <Field label="Temp snø (°C)">
                <input type="number" step="0.1" value={test.snow_temp}
                  onChange={e => setTest(t => ({ ...t, snow_temp: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
              <Field label="Luftfuktighet %">
                <input type="number" min="0" max="100" value={test.humidity_pct}
                  onChange={e => setTest(t => ({ ...t, humidity_pct: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Snøtype">
                <ComboInput options={snowOptions} value={test.snow_type}
                  onChange={v => setTest(t => ({ ...t, snow_type: v }))}
                  onSaveTemplate={handleSaveSnowAsTemplate} />
              </Field>
              <Field label="Notat">
                <input value={test.notes}
                  onChange={e => setTest(t => ({ ...t, notes: e.target.value }))}
                  placeholder="F.eks. vind fra nord, sporet glaserte…"
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
            </div>
          </div>

          {/* Ski i testen — under skiene per ski */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--line)' }}>
            <p className="text-xs tracking-widest uppercase mt-4 mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Ski i testen — under skiene per ski ({entries.length}/10)
            </p>

            {entries.map((en, idx) => (
              <div key={idx} className="p-3 mb-2"
                style={{ backgroundColor: '#0F0F12', border: '1px solid var(--line)', borderRadius: 9 }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                    {entryNavn(idx)}
                  </span>
                  <button type="button" onClick={() => removeEntry(idx)}
                    className="text-xs tracking-widest uppercase"
                    style={{ background: 'none', border: 'none', color: '#FF4500', cursor: 'pointer' }}>
                    ✕ Fjern
                  </button>
                </div>
                {/* Slip og lengde LESES fra utstyret — ingen input her, og
                    ingen andre sannhet lagret på testen. */}
                <SkiFraUtstyret ski={skiById.get(en.ski_id) ?? null}
                  href={targetUserId
                    ? `/app/trener/${targetUserId}/utstyr`
                    : `/app/utstyr/${en.ski_id}`} />
                <Field label="Under skiene (smøring)">
                  <input value={en.wax_used}
                    onChange={e => updateEntry(idx, { wax_used: e.target.value })}
                    placeholder="F.eks. HF7 + topping C6"
                    className="w-full px-3 py-2" style={inputStyle} />
                </Field>
                {!erParallell && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {visTid && (
                      <Field label="Tid (sek)">
                        <input type="number" min="0" step="0.1" value={en.time_seconds}
                          onChange={e => updateEntry(idx, { time_seconds: e.target.value })}
                          className="w-full px-3 py-2" style={inputStyle} />
                      </Field>
                    )}
                    {visLengde && (
                      <Field label="Glidlengde (m)">
                        <input type="number" min="0" step="0.1" value={en.distance_m}
                          onChange={e => updateEntry(idx, { distance_m: e.target.value })}
                          className="w-full px-3 py-2" style={inputStyle} />
                      </Field>
                    )}
                    {visScore && (
                      <Field label="Score (1-10)">
                        <input type="number" min="1" max="10" value={en.rating}
                          onChange={e => updateEntry(idx, { rating: e.target.value })}
                          className="w-full px-3 py-2" style={inputStyle} />
                      </Field>
                    )}
                    {visRank && (
                      <Field label="Rangering">
                        <input type="number" min="1" value={en.rank_in_test}
                          onChange={e => updateEntry(idx, { rank_in_test: e.target.value })}
                          className="w-full px-3 py-2" style={inputStyle} />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            ))}

            {ski.length > 0 && entries.length < 10 && (
              <select value="" onChange={e => { if (e.target.value) addEntry(e.target.value) }}
                className="w-full px-4 py-3 mt-2" style={inputStyle}>
                <option value="">+ Legg til ski fra skiparken…</option>
                {ski.map(s => {
                  const alleredeMed = entries.filter(e2 => e2.ski_id === s.id).length
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.brand || s.model ? ` — ${[s.brand, s.model].filter(Boolean).join(' ')}` : ''}
                      {alleredeMed > 0 ? ` (oppsett ${alleredeMed + 1})` : ''}
                    </option>
                  )
                })}
              </select>
            )}
            {(testType === 'tidtaker' || testType === 'lengde') && (
              <p className="text-xs mt-2" style={{ color: '#555560' }}>
                {testType === 'tidtaker'
                  ? 'Rangeringen fylles automatisk fra tidene (lavest vinner) hvis du ikke setter den selv.'
                  : 'Rangeringen fylles automatisk fra lengdene (lengst glid vinner) hvis du ikke setter den selv.'}
                {' '}Ved smøretest kan samme ski legges til flere ganger med ulik smøring.
              </p>
            )}
          </div>

          {/* Parallelltest — utslagsformat (fasit seksjon 4) */}
          {erParallell && (
            <div className="pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="flex items-center justify-between mt-4 mb-2 gap-2 flex-wrap">
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Parallelltesten — to og to · vinneren videre
                </p>
                <button type="button" onClick={startBracket}
                  className="px-3 py-1 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: '#F0F0F2', backgroundColor: runder ? 'transparent' : ATHLETE_ORANGE,
                    border: runder ? '1px solid var(--line)' : 'none',
                    cursor: 'pointer',
                  }}>
                  {runder ? '⟳ Start på nytt' : 'Sett opp paringene'}
                </button>
              </div>
              {!runder && (
                <p className="text-xs" style={{ color: '#555560' }}>
                  Paringene settes opp automatisk fra skia over (oddetall → frirunde).
                  Ett trykk per par markerer vinneren — runde for runde til finalen.
                </p>
              )}
              {runder && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {runder.map((runde, ri) => {
                    const erSisteRunde = erFerdig(runder) && ri === runder.length - 1
                    return (
                      <div key={ri}>
                        <p className="text-xs tracking-widest uppercase mb-2 text-center"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                          {erSisteRunde && runde.par.length === 1 ? 'Finale' : `Runde ${ri + 1}`}
                        </p>
                        {runde.par.map((p, pi) => (
                          <div key={pi} className="mb-3"
                            style={{ border: '1px solid var(--line2, #2A2A33)', borderRadius: 10, overflow: 'hidden', backgroundColor: '#0B0B0F' }}>
                            {[p.a, p.b].map(deltaker => {
                              if (deltaker === null) {
                                return (
                                  <div key="fri" className="px-3 py-2 text-xs tracking-widest uppercase"
                                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                                    Frirunde
                                  </div>
                                )
                              }
                              const vant = p.vinner === deltaker
                              return (
                                <button key={deltaker} type="button"
                                  onClick={() => p.b !== null && velgVinner(ri, pi, deltaker)}
                                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                                  style={{
                                    fontFamily: "'Barlow Condensed', sans-serif",
                                    fontSize: '13px',
                                    color: '#F0F0F2',
                                    background: vant ? 'rgba(40,168,110,0.10)' : 'none',
                                    border: 'none',
                                    borderBottom: deltaker === p.a && p.b !== null ? '1px solid var(--line)' : 'none',
                                    cursor: p.b === null ? 'default' : 'pointer',
                                  }}>
                                  <span>{entryNavn(parseInt(deltaker))}{vant ? ' ✓' : ''}</span>
                                  {entries[parseInt(deltaker)]?.wax_used && (
                                    <span className="text-xs" style={{ color: '#555560' }}>
                                      {entries[parseInt(deltaker)].wax_used}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {parallellRangering && (
                    <div>
                      <p className="text-xs tracking-widest uppercase mb-2 text-center"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
                        Rangering
                      </p>
                      <div className="p-3"
                        style={{ border: '1px solid rgba(212,160,23,0.45)', borderRadius: 10, backgroundColor: 'rgba(212,160,23,0.06)' }}>
                        {[...parallellRangering.entries()]
                          .sort((a, b) => a[1] - b[1])
                          .map(([key, plass]) => (
                            <div key={key} className="flex items-center justify-between py-1"
                              style={{ borderBottom: '1px solid var(--line)', fontSize: '13px' }}>
                              <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#D4A017', width: 26 }}>{plass}</span>
                              <span className="flex-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                                {entryNavn(parseInt(key))}{plass === 1 ? ' 🏆' : ''}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Egen test kan lagres som mal (fase 100) */}
          {testType === 'egen' && !egenMal && !targetUserId && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#8A8A96' }}>
                <input type="checkbox" checked={lagreSomMal} onChange={e => setLagreSomMal(e.target.checked)} />
                Lagre oppsettet som egen test-mal
              </label>
              {lagreSomMal && (
                <input value={malNavn} onChange={e => setMalNavn(e.target.value)}
                  placeholder="Navn på malen, f.eks. «Glid nedover Kollen»"
                  className="flex-1 px-3 py-2" style={{ ...inputStyle, fontSize: '13px', minWidth: 200 }} />
              )}
            </div>
          )}

          {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', background: 'none', border: '1px solid var(--line)', cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="submit" disabled={pending || (erParallell && !parallellRangering)}
              className="px-4 py-2 text-sm font-semibold tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: ATHLETE_ORANGE, color: '#F0F0F2',
                border: 'none', cursor: pending ? 'wait' : 'pointer',
                opacity: pending || (erParallell && !parallellRangering) ? 0.6 : 1,
              }}>
              {pending ? 'Lagrer…' : 'Lagre test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function buildOptions(standard: readonly string[], templates: UserConditionsTemplate[], type: 'snow' | 'conditions'): string[] {
  const userLabels = templates.filter(t => t.type === type).map(t => t.label)
  const set = new Set<string>(standard)
  for (const u of userLabels) set.add(u)
  return Array.from(set)
}

// Vær-velger: standardvalg + fritekst (ingen mal-lagring — værtypene er faste).
function VaerVelger({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = value !== '' && !(STANDARD_WEATHER as readonly string[]).includes(value)
  return (
    <div className="space-y-1">
      <select value={isCustom ? '__custom' : value}
        onChange={e => { if (e.target.value !== '__custom') onChange(e.target.value) }}
        className="w-full px-4 py-3" style={inputStyle}>
        <option value="">— velg —</option>
        {STANDARD_WEATHER.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Egen…</option>
      </select>
      {isCustom && (
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder="Skriv egen verdi"
          className="w-full px-3 py-2" style={{ ...inputStyle, fontSize: '13px' }} />
      )}
    </div>
  )
}

function ComboInput({
  options, value, onChange, onSaveTemplate,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  onSaveTemplate: () => void
}) {
  const isCustom = value && !options.includes(value)
  return (
    <div className="space-y-1">
      <select value={options.includes(value) ? value : (isCustom ? '__custom' : '')}
        onChange={e => {
          if (e.target.value === '__custom') return
          onChange(e.target.value)
        }}
        className="w-full px-4 py-3" style={inputStyle}>
        <option value="">— velg —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Egen…</option>
      </select>
      {(isCustom || value === '') && (
        <div className="flex gap-1">
          <input value={isCustom ? value : ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Skriv egen verdi"
            className="flex-1 px-3 py-2" style={{ ...inputStyle, fontSize: '13px' }} />
          {isCustom && (
            <button type="button" onClick={onSaveTemplate}
              className="px-3 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', background: 'none', border: '1px solid var(--line)', cursor: 'pointer',
              }}>
              Lagre som mal
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function makeEntry(ski_id: string): EntryRow {
  return { ski_id, rank_in_test: '', rating: '', time_seconds: '', distance_m: '', wax_used: '', notes: '' }
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#F0F0F2',
  backgroundColor: '#0F0F12',
  border: '1px solid var(--line)',
  fontSize: '15px',
}

// Slip og lengde hentes fra ski-raden i utstyr og vises som lest info.
// Mangler verdien: «— (legg inn på utstyret)» med lenke dit — aldri et felt
// her som ville lagret en andre sannhet.
function SkiFraUtstyret({ ski, href }: { ski: SkiEquipment | null; href: string }) {
  const d = ski?.ski_data ?? null
  const slipDato = visSlipDato(d?.slip_date ?? null)
  const slip = d?.current_slip ? `${d.current_slip}${slipDato ? ` (${slipDato})` : ''}` : null
  const lengde = d?.length_cm != null ? `${d.length_cm} cm` : null

  const mangler = (
    <Link href={href}
      style={{ color: '#8A8A96', textDecoration: 'underline' }}>
      — (legg inn på utstyret)
    </Link>
  )

  return (
    <p className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
      <span className="text-xs tracking-widest uppercase" style={{ color: '#555560' }}>
        Fra utstyret
      </span>
      <span>Slip: {slip ? <b style={{ color: '#F0F0F2' }}>{slip}</b> : mangler}</span>
      <span>Lengde: {lengde ? <b style={{ color: '#F0F0F2' }}>{lengde}</b> : mangler}</span>
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
