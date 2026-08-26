'use client'

// Kø #48 bolk 3 — STANDARDØKT-BIBLIOTEKET under Analyse: serieliste m/ navn,
// sport, sted, antall gjennomføringer, sist gjennomført og trend-sparkline;
// søk + sport-/bev.form-filter. Klikk → seriedetalj m/ kronologiske
// gjennomføringer + inngang til sammenligningen (bolk 4). Tom-tilstand
// forklarer konseptet. Trener leser via resolveTargetUser (read-only —
// rediger/slett vises kun for egne serier). Dyplenke: ?serie=<id>.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  getSessionSeriesLibrary, updateSessionSeries, deleteSessionSeries,
  type SessionSeriesWithExecutions,
} from '@/app/actions/standard-sessions'
import { SPORTS } from '@/lib/types'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'
import { SerieSammenligning } from './SerieSammenligning'

const ACCENT = '#FF8A5C'

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: '2-digit' })
}

function fmtDur(sec: number | null): string {
  if (sec == null || sec <= 0) return '—'
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}t ${m % 60}m` : `${m}m`
}

// Mini-sparkline: total tid per gjennomføring (hovedmetrikk i listen).
function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.filter((v): v is number => v != null && v > 0)
  if (pts.length < 2) return null
  const min = Math.min(...pts), max = Math.max(...pts)
  const span = max - min || 1
  const W = 96, H = 26
  const step = W / (pts.length - 1)
  const path = pts.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`
  ).join(' ')
  return (
    <svg width={W} height={H} aria-hidden>
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
    </svg>
  )
}

export function StandardSessionsTab({ targetUserId }: { targetUserId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [series, setSeries] = useState<SessionSeriesWithExecutions[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams?.get('serie') ?? null)
  const [q, setQ] = useState('')
  const [sportFilter, setSportFilter] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSted, setEditSted] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const readOnly = !!targetUserId

  const load = () => {
    getSessionSeriesLibrary(targetUserId)
      .then(res => setSeries(Array.isArray(res) ? res : []))
      .catch(() => setSeries([]))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  const sportsPresent = useMemo(() => {
    const s = new Set<string>()
    for (const r of series ?? []) if (r.sport) s.add(r.sport)
    return Array.from(s)
  }, [series])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return (series ?? []).filter(r => {
      if (sportFilter && r.sport !== sportFilter) return false
      if (query && !r.name.toLowerCase().includes(query)
        && !(r.location ?? '').toLowerCase().includes(query)
        && !(r.movement_name ?? '').toLowerCase().includes(query)) return false
      return true
    })
  }, [series, q, sportFilter])

  const selected = (series ?? []).find(r => r.id === selectedId) ?? null

  if (series === null) {
    return <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>Laster standardøkter…</p>
  }

  // ── Tom-tilstand: forklarer konseptet ──
  if (series.length === 0) {
    return (
      <div className="p-8 text-center" style={{ border: '1px dashed var(--line2)', borderRadius: 14 }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.05em', color: 'var(--tekst-1-app)', marginBottom: 8 }}>
          ⟳ Standardøkter
        </p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, color: 'var(--tekst-5-app)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
          En standardøkt-serie er samme økt gjennomført mange ganger — en fast terskeltest,
          en standard intervalløkt, en fast rute. Koble økter til en serie fra økt-skjemaet
          («⟳ Standardøkt»), så samles alle gjennomføringene her og kan sammenlignes over tid.
          Maler er planlegging — standardøkter er analyse.
        </p>
      </div>
    )
  }

  // ── Seriedetalj ──
  if (selected) {
    const startEdit = () => {
      setEditName(selected.name)
      setEditSted(selected.location ?? '')
      setEditDesc(selected.description ?? '')
      setEditing(true)
    }
    const saveEdit = async () => {
      const res = await updateSessionSeries(selected.id, {
        name: editName, location: editSted, description: editDesc,
      })
      if (res.error) { void xpAlert(res.error); return }
      setEditing(false)
      load()
    }
    const doDelete = async () => {
      const ok = await xpConfirm(
        `Slette serien «${selected.name}»? Øktene beholdes — kun koblingen til serien fjernes.`)
      if (!ok) return
      const res = await deleteSessionSeries(selected.id)
      if (res.error) { void xpAlert(res.error); return }
      setSelectedId(null)
      load()
      router.refresh()
    }
    const sportLabel = SPORTS.find(s => s.value === selected.sport)?.label ?? selected.sport

    return (
      <div className="space-y-4">
        <button type="button" onClick={() => { setSelectedId(null); setEditing(false) }}
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}>
          ← Alle serier
        </button>

        <div className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
          {editing ? (
            <div className="flex flex-col gap-2" style={{ maxWidth: 420 }}>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Navn"
                style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, padding: '9px 11px', outline: 'none' }} />
              <input value={editSted} onChange={e => setEditSted(e.target.value)} placeholder="Sted (valgfritt)"
                style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, padding: '9px 11px', outline: 'none' }} />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Beskrivelse (valgfritt)" rows={2}
                style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, padding: '9px 11px', outline: 'none' }} />
              <div className="flex gap-2">
                <button type="button" onClick={() => { void saveEdit() }}
                  className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--flate-3)', background: ACCENT, border: 'none', borderRadius: 999, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>
                  Lagre
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}>
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: '0.04em', color: 'var(--tekst-1-app)' }}>
                  ⟳ {selected.name}
                </h3>
                {!readOnly && (
                  <span className="ml-auto flex gap-2">
                    <button type="button" onClick={startEdit}
                      className="text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>
                      Rediger
                    </button>
                    <button type="button" onClick={() => { void doDelete() }}
                      className="text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', background: 'none', border: '1px solid #FF450066', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>
                      Slett serie
                    </button>
                  </span>
                )}
              </div>
              <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
                {[sportLabel, selected.movement_name, selected.location,
                  `${selected.workout_count} gjennomføring${selected.workout_count !== 1 ? 'er' : ''}`]
                  .filter(Boolean).join(' · ')}
              </p>
              {selected.description && (
                <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-3-app)' }}>
                  {selected.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Gjennomføringer kronologisk (nyeste øverst i listen). */}
        <div className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
          <p className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Gjennomføringer
          </p>
          {selected.executions.length === 0 ? (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-8-app)' }}>
              Ingen gjennomførte økter i serien ennå.
            </p>
          ) : (
            <div className="flex flex-col">
              {[...selected.executions].reverse().map(e => (
                <div key={e.workout_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
                  style={{ borderTop: '1px solid var(--line)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>
                  <span style={{ color: 'var(--tekst-1-app)', minWidth: 90 }}>{fmtDate(e.date)}</span>
                  <span style={{ color: 'var(--tekst-3-app)', flex: 1, minWidth: 120 }}>{e.title || '—'}</span>
                  <span style={{ color: 'var(--tekst-5-app)' }}>{fmtDur(e.total_seconds)}</span>
                  {e.distance_meters != null && e.distance_meters > 0 && (
                    <span style={{ color: 'var(--tekst-5-app)' }}>{(e.distance_meters / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km</span>
                  )}
                  {e.avg_heart_rate != null && <span style={{ color: 'var(--tekst-5-app)' }}>ø{e.avg_heart_rate}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kø #48 bolk 4–6: sammenligningen — innholdsavhengig fra start. */}
        <SerieSammenligning serie={selected} />
      </div>
    )
  }

  // ── Serielisten ──
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk navn, sted eller bev.form…"
          style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '9px 12px', outline: 'none', minWidth: 220 }} />
        {sportsPresent.length > 1 && (
          <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
            style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '9px 10px', outline: 'none' }}>
            <option value="">Alle sporter</option>
            {sportsPresent.map(s => (
              <option key={s} value={s}>{SPORTS.find(x => x.value === s)?.label ?? s}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-8-app)' }}>
          Ingen serier matcher filtrene.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(r => {
            const sportLabel = SPORTS.find(s => s.value === r.sport)?.label ?? r.sport
            return (
              <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                className="p-4 text-left transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, cursor: 'pointer' }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: '0.04em', color: 'var(--tekst-1-app)' }}>
                    <span style={{ color: ACCENT }}>⟳</span> {r.name}
                  </span>
                  <span className="ml-auto">
                    <Sparkline values={r.executions.map(e => e.total_seconds)} />
                  </span>
                </div>
                <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-5-app)' }}>
                  {[sportLabel, r.movement_name, r.location].filter(Boolean).join(' · ') || '—'}
                </p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-app)' }}>
                  {r.workout_count} gjennomføring{r.workout_count !== 1 ? 'er' : ''}
                  {r.last_date ? ` · sist ${fmtDate(r.last_date)}` : ''}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
