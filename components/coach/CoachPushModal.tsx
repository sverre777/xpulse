'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  listCoachTargets,
  pushWorkoutTemplateToAthlete,
  pushPlanTemplateToAthlete,
  pushPeriodizationTemplateToAthlete,
  type CoachTargetAthlete, type CoachTargetGroup,
} from '@/app/actions/coach-push'

const COACH_BLUE = '#1A6FD4'

export type PushKind = 'workout' | 'plan' | 'periodization'

interface Props {
  kind: PushKind
  templateId: string
  templateName: string
  onClose: () => void
}

interface PushOutcome {
  athleteId: string
  athleteName: string
  ok: boolean
  message: string
}

export function CoachPushModal({ kind, templateId, templateName, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [athletes, setAthletes] = useState<CoachTargetAthlete[]>([])
  const [groups, setGroups] = useState<CoachTargetGroup[]>([])
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [date, setDate] = useState<string>(todayIso())
  const [err, setErr] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<PushOutcome[] | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await listCoachTargets()
      if (cancelled) return
      if ('error' in res) {
        setErr(res.error)
      } else {
        setAthletes(res.athletes)
        setGroups(res.groups)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const toggleAthlete = (id: string) => {
    setSelectedAthleteIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleGroup = (g: CoachTargetGroup) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(g.id)) {
        next.delete(g.id)
        setSelectedAthleteIds(prevAth => {
          const stillSelected = [...groups].filter(x => x.id !== g.id && next.has(x.id))
            .flatMap(x => x.athleteIds)
          const union = new Set(stillSelected)
          const out = new Set(prevAth)
          for (const aid of g.athleteIds) {
            if (!union.has(aid)) out.delete(aid)
          }
          return out
        })
      } else {
        next.add(g.id)
        setSelectedAthleteIds(prevAth => {
          const out = new Set(prevAth)
          for (const aid of g.athleteIds) out.add(aid)
          return out
        })
      }
      return next
    })
  }

  const totalTargets = selectedAthleteIds.size
  const hasTargets = totalTargets > 0
  const submitLabel = labelForKind(kind, hasTargets, totalTargets)

  const handlePush = () => {
    if (!hasTargets) { setErr('Velg minst én utøver eller gruppe'); return }
    if (!date) { setErr('Dato er påkrevd'); return }
    setErr(null)
    setOutcomes([])

    startTransition(async () => {
      const results: PushOutcome[] = []
      for (const aid of selectedAthleteIds) {
        const athlete = athletes.find(a => a.id === aid)
        const name = athlete?.name ?? 'Utøver'
        try {
          if (kind === 'workout') {
            const r = await pushWorkoutTemplateToAthlete({
              athleteId: aid, templateId, date,
            })
            if (r.error) results.push({ athleteId: aid, athleteName: name, ok: false, message: r.error })
            else results.push({ athleteId: aid, athleteName: name, ok: true, message: 'Økt sendt' })
          } else if (kind === 'plan') {
            const r = await pushPlanTemplateToAthlete({
              athleteId: aid, templateId, startDate: date,
            })
            if (r.error) results.push({ athleteId: aid, athleteName: name, ok: false, message: r.error })
            else results.push({
              athleteId: aid, athleteName: name, ok: true,
              message: `${r.createdCount ?? 0} økter materialisert`,
            })
          } else {
            const r = await pushPeriodizationTemplateToAthlete({
              athleteId: aid, templateId, startDate: date,
            })
            if (r.error) results.push({ athleteId: aid, athleteName: name, ok: false, message: r.error })
            else results.push({ athleteId: aid, athleteName: name, ok: true, message: 'Sesong opprettet' })
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Ukjent feil'
          results.push({ athleteId: aid, athleteName: name, ok: false, message: msg })
        }
        setOutcomes([...results])
      }
      router.refresh()
    })
  }

  const allDone = outcomes != null && outcomes.length === selectedAthleteIds.size && !isPending

  return (
    <div
      onClick={onClose}
      className="px-2 md:px-3"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '24px', paddingBottom: '24px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '640px', width: '100%',
          margin: '0 auto',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <div>
            <div className="text-[10px] tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
              Send {kindLabel(kind)}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.05em' }}>
              {templateName}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{
              color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 28, lineHeight: 1, padding: 0,
              minHeight: '44px', minWidth: '44px',
            }}>
            ×
          </button>
        </div>

        <div className="p-4 md:p-5 flex flex-col gap-4">
          {err && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                border: '1px solid #E11D48',
              }}>
              {err}
            </p>
          )}

          {loading ? (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Laster utøvere…
            </p>
          ) : athletes.length === 0 ? (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Du har ingen aktive utøvere koblet til konto.
            </p>
          ) : (
            <>
              <div>
                <Label>{dateLabelForKind(kind)}</Label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={iSt} />
              </div>

              {groups.length > 0 && (
                <div>
                  <Label>Grupper</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map(g => {
                      const active = selectedGroupIds.has(g.id)
                      return (
                        <button key={g.id} type="button" onClick={() => toggleGroup(g)}
                          className="px-3 py-1.5 text-[11px] tracking-widest uppercase"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            color: active ? '#F0F0F2' : '#8A8A96',
                            backgroundColor: active ? COACH_BLUE : 'transparent',
                            border: `1px solid ${active ? COACH_BLUE : '#222228'}`,
                            cursor: 'pointer',
                          }}>
                          {g.name} ({g.athleteIds.length})
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <Label>Utøvere ({selectedAthleteIds.size}/{athletes.length} valgt)</Label>
                <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto"
                  style={{ border: '1px solid #1E1E22' }}>
                  {athletes.map(a => {
                    const checked = selectedAthleteIds.has(a.id)
                    return (
                      <label key={a.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                        style={{
                          backgroundColor: checked ? '#16161A' : '#0D0D11',
                          borderBottom: '1px solid #111113',
                        }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => toggleAthlete(a.id)}
                          style={{ accentColor: COACH_BLUE }} />
                        <span className="flex-1"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                          {a.name}
                        </span>
                        {a.primarySport && (
                          <span className="text-[10px] tracking-widest uppercase"
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                            {a.primarySport}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {outcomes != null && outcomes.length > 0 && (
            <div>
              <Label>Resultat ({outcomes.filter(o => o.ok).length}/{selectedAthleteIds.size})</Label>
              <div className="flex flex-col gap-1 max-h-[30vh] overflow-y-auto">
                {outcomes.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-3 py-1.5"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: o.ok ? '#7DD87D' : '#E11D48',
                      backgroundColor: '#111113', border: '1px solid #1E1E22',
                    }}>
                    <span>{o.ok ? '✓' : '✕'}</span>
                    <span className="flex-1" style={{ color: '#F0F0F2' }}>{o.athleteName}</span>
                    <span>{o.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #222228', cursor: 'pointer',
              }}>
              {allDone ? 'Lukk' : 'Avbryt'}
            </button>
            {!allDone && (
              <button type="button" onClick={handlePush}
                disabled={isPending || !hasTargets || loading}
                className="px-4 py-2 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: COACH_BLUE, color: '#F0F0F2',
                  border: 'none',
                  cursor: (isPending || !hasTargets) ? 'not-allowed' : 'pointer',
                  opacity: (isPending || !hasTargets) ? 0.5 : 1,
                }}>
                {isPending ? 'Sender…' : submitLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-[10px] tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {children}
    </label>
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function kindLabel(kind: PushKind): string {
  switch (kind) {
    case 'workout': return 'øktmal'
    case 'plan': return 'plan-mal'
    case 'periodization': return 'periodiseringsmal'
  }
}

function dateLabelForKind(kind: PushKind): string {
  switch (kind) {
    case 'workout': return 'Dato (én planlagt økt per utøver)'
    case 'plan': return 'Startdato for plan-mal'
    case 'periodization': return 'Startdato for sesong'
  }
}

function labelForKind(kind: PushKind, hasTargets: boolean, n: number): string {
  if (!hasTargets) return 'Send'
  const suffix = n === 1 ? '1 utøver' : `${n} utøvere`
  switch (kind) {
    case 'workout': return `Send økt til ${suffix}`
    case 'plan': return `Send plan til ${suffix}`
    case 'periodization': return `Send periodisering til ${suffix}`
  }
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}
