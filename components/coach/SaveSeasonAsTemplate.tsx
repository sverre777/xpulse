'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildPeriodizationTemplateFromSeason,
  savePeriodizationTemplate,
} from '@/app/actions/periodization-templates'
import { PERIOD_SPORT_CATEGORIES, sportToCategory, type Sport } from '@/lib/types'

const COACH_BLUE = '#1A6FD4'

// Lagrer en eksisterende sesong som periodiseringsmal i TRENERS eget mal-bibliotek.
// Snapshot via buildPeriodizationTemplateFromSeason → relative day_offset.
export function SaveSeasonAsTemplate({
  seasonId,
  defaultName,
  defaultSport,
}: {
  seasonId: string
  defaultName: string
  defaultSport?: Sport
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(
    defaultSport ? sportToCategory(defaultSport) : 'Løping',
  )
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (!name.trim()) { setErr('Navn er påkrevd'); return }
    setErr(null)
    startTransition(async () => {
      const snap = await buildPeriodizationTemplateFromSeason(seasonId)
      if (snap.error || !snap.data || !snap.duration_days) {
        setErr(snap.error ?? 'Kunne ikke bygge mal fra sesong'); return
      }
      const res = await savePeriodizationTemplate({
        name: name.trim(),
        description: description.trim() || null,
        category,
        duration_days: snap.duration_days,
        periodization_data: snap.data,
      })
      if (res.error) { setErr(res.error); return }
      setDone(true)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setDone(false); setErr(null); setName(defaultName) }}
        className="px-3 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: COACH_BLUE, color: '#F0F0F2',
          border: 'none', cursor: 'pointer',
        }}
      >
        Lagre som mal
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
            zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '12vh',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
              maxWidth: '520px', width: '100%', margin: '0 16px',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid #1E1E22' }}>
              <span className="text-sm tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                Lagre sesong som mal
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Lukk"
                style={{
                  color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 24, lineHeight: 1, padding: 0,
                }}>
                ×
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {done ? (
                <>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    ✓ Mal lagret i ditt mal-bibliotek.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setOpen(false)}
                      className="px-4 py-2 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                        background: 'none', border: '1px solid #222228', cursor: 'pointer',
                      }}>
                      Lukk
                    </button>
                    <a href="/app/trener/planlegg?tab=periodisering"
                      className="px-4 py-2 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        backgroundColor: COACH_BLUE, color: '#F0F0F2',
                        border: 'none', cursor: 'pointer',
                        textDecoration: 'none',
                      }}>
                      Gå til maler
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    Snapshotter sesongens perioder og nøkkeldatoer som relativ mal
                    (dag-offset). Malen havner i ditt eget bibliotek — ikke utøverens.
                  </p>

                  <div>
                    <label className="block mb-1 text-[10px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      Mal-navn
                    </label>
                    <input value={name} onChange={e => setName(e.target.value)} style={iSt} />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      Sport-kategori
                    </label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={iSt}>
                      {PERIOD_SPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      Beskrivelse (valgfri)
                    </label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                      rows={2} style={{ ...iSt, resize: 'vertical' }} />
                  </div>

                  {err && (
                    <p className="text-xs px-3 py-2"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                        border: '1px solid #E11D48',
                      }}>
                      {err}
                    </p>
                  )}

                  <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
                    <button type="button" onClick={() => setOpen(false)}
                      className="px-4 py-2 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                        background: 'none', border: '1px solid #222228', cursor: 'pointer',
                      }}>
                      Avbryt
                    </button>
                    <button type="button" onClick={handleSave} disabled={pending}
                      className="px-4 py-2 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        backgroundColor: COACH_BLUE, color: '#F0F0F2',
                        border: 'none',
                        cursor: pending ? 'not-allowed' : 'pointer',
                        opacity: pending ? 0.5 : 1,
                      }}>
                      {pending ? 'Lagrer…' : 'Lagre mal'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
