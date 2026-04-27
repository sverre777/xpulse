'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlanTemplate } from '@/app/actions/plan-templates'
import { PERIOD_SPORT_CATEGORIES } from '@/lib/types'
import type { PlanTemplate } from '@/lib/template-types'

const COACH_BLUE = '#1A6FD4'

interface Props {
  template: PlanTemplate
  onClose: () => void
}

export function PlanMalEditModal({ template, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [category, setCategory] = useState(template.category ?? 'Annet')
  const [durationDays, setDurationDays] = useState<number>(template.duration_days)
  const [err, setErr] = useState<string | null>(null)
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

  const submit = () => {
    if (!name.trim()) { setErr('Navn er påkrevd'); return }
    if (durationDays < 1) { setErr('Varighet må være minst én dag'); return }
    setErr(null)
    startTransition(async () => {
      const res = await updatePlanTemplate(template.id, {
        name: name.trim(),
        description: description.trim() || null,
        category,
        duration_days: durationDays,
      })
      if (res.error) { setErr(res.error); return }
      onClose()
      router.refresh()
    })
  }

  const changedDuration = durationDays !== template.duration_days

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px',
          backgroundColor: '#111113', border: '1px solid #1E1E22',
        }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1E1E22' }}>
          <div className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
            Rediger plan-mal
          </div>
          <button type="button" onClick={onClose}
            className="text-xs tracking-widest uppercase px-2 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96', background: 'transparent', border: '1px solid #1E1E22',
              cursor: 'pointer',
            }}>
            Lukk
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {err && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                border: '1px solid #E11D48',
              }}>
              {err}
            </p>
          )}
          <Field label="Navn">
            <input value={name} onChange={e => setName(e.target.value)} style={iSt} />
          </Field>
          <Field label="Beskrivelse">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} style={iSt} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sport">
              <select value={category} onChange={e => setCategory(e.target.value)} style={iSt}>
                {PERIOD_SPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Varighet (dager)">
              <input type="number" min={1} max={365}
                value={durationDays}
                onChange={e => setDurationDays(parseInt(e.target.value) || 1)}
                style={iSt} />
            </Field>
          </div>
          {changedDuration && durationDays < template.duration_days && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017',
                border: '1px solid #D4A01766',
              }}>
              Advarsel: økter eller hviledager etter dag {durationDays} blir ikke automatisk fjernet. Åpne «Bygg»-modus for å rydde.
            </p>
          )}
          <p className="text-xs mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Innholdet i kalenderen redigeres via «Bygg»-knappen på plan-malen.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #222228', cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="button" onClick={submit} disabled={isPending}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: COACH_BLUE, color: '#F0F0F2',
                border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}>
              {isPending ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
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
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}
