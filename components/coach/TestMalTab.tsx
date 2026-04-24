'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveTestTemplate, deleteTestTemplate,
  type TestTemplate, type TestTemplateInput,
} from '@/app/actions/tests'
import { SPORTS, TEST_TYPES_BY_SPORT, type Sport } from '@/lib/types'

const COACH_BLUE = '#1A6FD4'
const iSt: React.CSSProperties = {
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', outline: 'none', padding: '8px 10px', width: '100%',
}

interface Props {
  initialTemplates: TestTemplate[]
  primarySport: Sport
}

export function TestMalTab({ initialTemplates, primarySport }: Props) {
  const [editing, setEditing] = useState<TestTemplate | 'new' | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {initialTemplates.length} test-mal{initialTemplates.length === 1 ? '' : 'er'}
        </p>
        <button type="button" onClick={() => setEditing('new')}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE, color: '#F0F0F2',
            border: 'none', cursor: 'pointer',
          }}>
          + Ny test-mal
        </button>
      </div>

      {initialTemplates.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen test-maler ennå. Trykk «+ Ny test-mal» for å bygge din første.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          {initialTemplates.map(t => (
            <button key={t.id} type="button"
              onClick={() => setEditing(t)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-white/5 transition-colors"
              style={{ borderBottom: '1px solid #1E1E22' }}>
              <div>
                <p className="text-sm"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}>
                  {t.name}
                </p>
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                  {t.test_type} · {SPORTS.find(s => s.value === t.sport)?.label ?? t.sport}
                  {t.is_shared_with_athletes && <span className="ml-2" style={{ color: '#8A8A96' }}>· delt</span>}
                </p>
              </div>
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {t.default_duration_minutes ? `${t.default_duration_minutes} min` : ''}
                {t.default_distance_km ? ` · ${t.default_distance_km} km` : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <TestMalEditModal
          template={editing === 'new' ? null : editing}
          defaultSport={primarySport}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TestMalEditModal({
  template, defaultSport, onClose,
}: {
  template: TestTemplate | null
  defaultSport: Sport
  onClose: () => void
}) {
  const router = useRouter()
  const [sport, setSport] = useState<Sport>(template?.sport ?? defaultSport)
  const [testType, setTestType] = useState(template?.test_type ?? '')
  const [name, setName] = useState(template?.name ?? '')
  const [protocol, setProtocol] = useState(template?.protocol ?? '')
  const [defaultKm, setDefaultKm] = useState(template?.default_distance_km?.toString() ?? '')
  const [defaultMin, setDefaultMin] = useState(template?.default_duration_minutes?.toString() ?? '')
  const [shared, setShared] = useState(template?.is_shared_with_athletes ?? false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const suggestions = TEST_TYPES_BY_SPORT[sport] ?? []

  const save = () => {
    const km = defaultKm.trim() ? parseFloat(defaultKm.replace(',', '.')) : null
    const min = defaultMin.trim() ? parseInt(defaultMin, 10) : null
    if (km != null && !Number.isFinite(km)) { setError('Distanse må være et tall'); return }
    if (min != null && !Number.isFinite(min)) { setError('Varighet må være et tall'); return }
    const input: TestTemplateInput = {
      id: template?.id,
      sport,
      test_type: testType,
      name,
      protocol,
      default_distance_km: km,
      default_duration_minutes: min,
      is_shared_with_athletes: shared,
    }
    setError(null)
    startTransition(async () => {
      const res = await saveTestTemplate(input)
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const remove = () => {
    if (!template) return
    if (!confirm('Slette denne test-malen?')) return
    startTransition(async () => {
      const res = await deleteTestTemplate(template.id)
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-xl p-5"
        style={{ backgroundColor: '#111113', border: `1px solid ${COACH_BLUE}55` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
            <h3 className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
              {template ? 'Rediger test-mal' : 'Ny test-mal'}
            </h3>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', minHeight: '36px' }}>
            Lukk
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Navn">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="f.eks. 5km tidsløp på bane"
              style={iSt} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sport">
              <select value={sport} onChange={e => setSport(e.target.value as Sport)} style={iSt}>
                {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Test-type">
              <input list="test-mal-suggestions" value={testType}
                onChange={e => setTestType(e.target.value)}
                placeholder="f.eks. 5km_tt, FTP_20…"
                style={iSt} />
              <datalist id="test-mal-suggestions">
                {suggestions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Default distanse (km)">
              <input value={defaultKm} onChange={e => setDefaultKm(e.target.value)}
                placeholder="5" style={iSt} />
            </Field>
            <Field label="Default varighet (min)">
              <input value={defaultMin} onChange={e => setDefaultMin(e.target.value)}
                placeholder="20" style={iSt} />
            </Field>
          </div>

          <Field label="Protokoll">
            <textarea value={protocol} onChange={e => setProtocol(e.target.value)}
              rows={4}
              placeholder="Beskriv oppvarming, pacing, hvile…"
              style={{ ...iSt, resize: 'vertical' }} />
          </Field>

          <label className="flex items-center gap-2 text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
            Del med utøvere (de kan lese malen)
          </label>

          {error && (
            <p className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          {template ? (
            <button type="button" onClick={remove} disabled={isPending}
              className="px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent', border: '1px solid #E11D48',
                color: '#E11D48', minHeight: '40px',
              }}>
              Slett
            </button>
          ) : <span />}
          <button type="button" onClick={save} disabled={isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
              color: '#F0F0F2', minHeight: '40px',
            }}>
            {isPending ? 'Lagrer…' : template ? 'Oppdater' : 'Lagre mal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
