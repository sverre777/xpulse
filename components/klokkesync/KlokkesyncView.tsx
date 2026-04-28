'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  listSyncableActivities,
  importStravaActivity,
  quickSyncNonConflicting,
  disconnectStrava,
  setStravaAutoSync,
  type SyncableActivity,
  type SyncMode,
  type ConflictResolution,
} from '@/app/actions/strava-sync'
import { uploadFitFile, type FitParsedPreview } from '@/app/actions/fit-upload'
import { ConflictModal } from './ConflictModal'

interface StravaConn {
  athlete_id: number
  auto_sync: boolean
  last_sync_at: string | null
  scope: string | null
  connected_at: string
}

interface Props {
  stravaConnection: StravaConn | null
  status: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  koblet:           { label: '✓ Strava er koblet til',                      color: '#28A86E' },
  avbrutt:          { label: 'Du avbrøt Strava-tilkoblingen',              color: '#8A8A96' },
  'feil-state':     { label: 'Sikkerhetsfeil — prøv igjen',                color: '#E11D48' },
  'ikke-innlogget': { label: 'Logg inn først, så prøv igjen',              color: '#E11D48' },
  'lagring-feilet': { label: 'Kunne ikke lagre tilkoblingen',              color: '#E11D48' },
  'token-feilet':   { label: 'Token-utveksling feilet — prøv igjen',       color: '#E11D48' },
}

export function KlokkesyncView({ stravaConnection, status }: Props) {
  return (
    <div className="space-y-8">
      {status && STATUS_LABEL[status] && (
        <div className="p-4"
          style={{
            background: status === 'koblet' ? 'rgba(40,168,110,0.08)' : 'rgba(225,29,72,0.08)',
            border: `1px solid ${STATUS_LABEL[status].color}`,
            color: STATUS_LABEL[status].color,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
          }}>
          {STATUS_LABEL[status].label}
        </div>
      )}

      <StravaSection conn={stravaConnection} />
      <FitUploadSection />

      <div className="p-4"
        style={{
          background: '#13131A', border: '1px solid #1E1E22',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
          color: '#8A8A96', lineHeight: 1.7,
        }}>
        <strong style={{ color: '#F0F0F2' }}>Direkte-synk for Garmin Connect, Apple Health, Polar og Coros</strong>
        {' '}lanseres Q3 2026. Inntil da: bruk Strava OAuth (auto-synk hvert 5. min) eller last opp .fit-filer manuelt.
      </div>
    </div>
  )
}

// ── Strava-seksjonen ─────────────────────────────────────────

function StravaSection({ conn }: { conn: StravaConn | null }) {
  return (
    <section className="p-5"
      style={{ background: '#13131A', border: '1px solid #1E1E22' }}>
      <h2 className="mb-4 flex items-center gap-3"
        style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: '0.06em', color: '#F0F0F2',
        }}>
        <span style={{ width: 16, height: 2, background: '#FC4C02' }} />
        Strava
      </h2>
      {conn ? <StravaConnected conn={conn} /> : <StravaDisconnected />}
    </section>
  )
}

function StravaDisconnected() {
  return (
    <>
      <p style={{ fontSize: 14, color: 'rgba(242,240,236,0.7)', lineHeight: 1.7, marginBottom: 16 }}>
        Koble til Strava én gang — alle nye økter synkes automatisk innen 5 minutter.
        Vi henter aktiviteten, splittene/lapsene og puls/watt/pace-streamene.
      </p>
      <a href="/auth/strava/connect"
        style={{
          display: 'inline-block', padding: '12px 22px',
          background: '#FC4C02', color: '#FFFFFF', textDecoration: 'none',
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
        Koble til Strava
      </a>
    </>
  )
}

function StravaConnected({ conn }: { conn: StravaConn }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [syncMode, setSyncMode] = useState<SyncMode>('last_30d')
  const [previewList, setPreviewList] = useState<SyncableActivity[] | null>(null)
  const [conflict, setConflict] = useState<{ activity: SyncableActivity } | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const handleSync = () => {
    startTransition(async () => {
      const res = await listSyncableActivities(syncMode)
      if ('error' in res) { alert(res.error); return }
      setPreviewList(res.activities)
    })
  }

  const handleQuickSyncAll = () => {
    if (!previewList) return
    const todo = previewList.filter(a => !a.already_imported && !a.conflict_workout_id)
    if (todo.length === 0) {
      alert('Ingen aktiviteter å importere automatisk (alle har konflikt eller er importert tidligere).')
      return
    }
    setProgress({ done: 0, total: todo.length })
    startTransition(async () => {
      let done = 0
      for (const a of todo) {
        await importStravaActivity(a.strava_id)
        done++
        setProgress({ done, total: todo.length })
      }
      setProgress(null)
      setPreviewList(null)
      router.refresh()
    })
  }

  const handleResolveConflict = (resolution: ConflictResolution) => {
    if (!conflict) return
    const a = conflict.activity
    setConflict(null)
    startTransition(async () => {
      await importStravaActivity(a.strava_id, {
        conflictResolution: resolution,
        conflictWorkoutId: a.conflict_workout_id ?? undefined,
      })
      // Fjern fra preview-listen
      setPreviewList(prev => prev?.filter(x => x.strava_id !== a.strava_id) ?? null)
      router.refresh()
    })
  }

  const handleDisconnect = () => {
    if (!confirm('Er du sikker på at du vil frakoble Strava? Importerte økter beholdes.')) return
    startTransition(async () => {
      await disconnectStrava()
      router.refresh()
    })
  }

  const handleAutoSyncToggle = () => {
    startTransition(async () => {
      await setStravaAutoSync(!conn.auto_sync)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: 15,
          }}>
            Koblet · athlete-id <code style={{ color: '#8A8A96', fontSize: 13 }}>{conn.athlete_id}</code>
          </div>
          {conn.last_sync_at && (
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 12,
            }}>
              Sist synket: {new Date(conn.last_sync_at).toLocaleString('nb-NO')}
            </div>
          )}
        </div>
        <button type="button" onClick={handleDisconnect} disabled={pending}
          style={{
            background: 'none', border: '1px solid #2A2A30',
            padding: '8px 14px', cursor: 'pointer', color: '#8A8A96',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
          Frakoble
        </button>
      </div>

      <label className="flex items-center gap-2 mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#F0F0F2' }}>
        <input type="checkbox" checked={conn.auto_sync} onChange={handleAutoSyncToggle} disabled={pending} />
        Auto-synk nye aktiviteter (sjekkes hver 5. min)
      </label>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select value={syncMode} onChange={e => setSyncMode(e.target.value as SyncMode)}
          style={{
            background: '#0F0F14', border: '1px solid #1E1E22',
            color: '#F0F0F2', padding: '8px 10px', fontSize: 13,
            fontFamily: "'Barlow', sans-serif",
          }}>
          <option value="last_30d">Siste 30 dager</option>
          <option value="last_90d">Siste 90 dager</option>
          <option value="last_year">Siste år</option>
          <option value="all">Alt (siste 5 år)</option>
        </select>
        <button type="button" onClick={handleSync} disabled={pending}
          style={{
            background: '#FC4C02', color: '#FFFFFF', border: 'none',
            padding: '9px 18px', cursor: pending ? 'default' : 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
          {pending ? 'Henter …' : 'Hent fra Strava'}
        </button>
      </div>

      {progress && (
        <div className="p-3 mb-3"
          style={{ background: '#0F0F14', border: '1px solid #1E1E22', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#F0F0F2' }}>
          Importerer … {progress.done}/{progress.total}
        </div>
      )}

      {previewList && previewList.length > 0 && (
        <div className="space-y-2 mt-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#8A8A96' }}>
              Fant {previewList.length} aktiviteter
            </span>
            <button type="button" onClick={handleQuickSyncAll} disabled={pending}
              style={{
                background: '#FF4500', color: '#F0F0F2', border: 'none',
                padding: '8px 16px', cursor: pending ? 'default' : 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              }}>
              Importer alle uten konflikt
            </button>
          </div>
          {previewList.map(a => (
            <ActivityRow key={a.strava_id} activity={a}
              onResolveConflict={() => setConflict({ activity: a })}
              onImport={() => {
                startTransition(async () => {
                  await importStravaActivity(a.strava_id)
                  setPreviewList(prev => prev?.filter(x => x.strava_id !== a.strava_id) ?? null)
                  router.refresh()
                })
              }}
            />
          ))}
        </div>
      )}

      {previewList && previewList.length === 0 && (
        <div className="p-3 mt-3"
          style={{ background: '#0F0F14', border: '1px solid #1E1E22', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555560' }}>
          Ingen nye aktiviteter funnet i valgt periode.
        </div>
      )}

      {conflict && (
        <ConflictModal
          title={conflict.activity.name}
          existingWorkoutId={conflict.activity.conflict_workout_id ?? ''}
          newSourceLabel={`Strava-aktivitet (${conflict.activity.duration_minutes} min)`}
          onResolve={handleResolveConflict}
          onCancel={() => setConflict(null)}
        />
      )}
    </>
  )
}

function ActivityRow({
  activity, onImport, onResolveConflict,
}: {
  activity: SyncableActivity
  onImport: () => void
  onResolveConflict: () => void
}) {
  const date = new Date(activity.start_date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const conflict = activity.conflict_workout_id != null
  const imported = activity.already_imported
  return (
    <div className="flex items-center justify-between gap-3 p-3"
      style={{
        background: '#0F0F14', border: '1px solid #1E1E22',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, color: '#F0F0F2', fontWeight: 600 }}>{activity.name}</div>
        <div style={{ fontSize: 12, color: '#8A8A96' }}>
          {date} · {activity.duration_minutes} min · {activity.distance_km} km · {activity.sport_type}
        </div>
      </div>
      {imported ? (
        <span style={{ fontSize: 11, color: '#28A86E', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          ✓ Importert
        </span>
      ) : conflict ? (
        <button type="button" onClick={onResolveConflict}
          style={{
            background: 'rgba(245,197,66,0.15)', border: '1px solid rgba(245,197,66,0.5)',
            color: '#F5C542', padding: '6px 12px', cursor: 'pointer',
            fontWeight: 700, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
          Konflikt — løs
        </button>
      ) : (
        <button type="button" onClick={onImport}
          style={{
            background: 'transparent', border: '1px solid #FF4500',
            color: '#FF4500', padding: '6px 12px', cursor: 'pointer',
            fontWeight: 700, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
          Importer
        </button>
      )}
    </div>
  )
}

// ── .fit-fil-opplasting ──────────────────────────────────────

function FitUploadSection() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [results, setResults] = useState<{ file: string; status: string; ok: boolean }[]>([])
  const [conflictFile, setConflictFile] = useState<{ file: File; preview: FitParsedPreview } | null>(null)

  const handleFiles = async (files: FileList) => {
    setResults([])
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadFitFile(fd)
        if (res.preview) {
          setConflictFile({ file, preview: res.preview })
          setResults(prev => [...prev, { file: file.name, status: 'Konflikt — venter på avgjørelse', ok: false }])
          break  // Stopper køen når konflikt — bruker må løse den først.
        } else if (res.ok && res.workout_id) {
          setResults(prev => [...prev, { file: file.name, status: '✓ Importert', ok: true }])
        } else if (res.ok) {
          setResults(prev => [...prev, { file: file.name, status: 'Allerede importert', ok: true }])
        } else {
          setResults(prev => [...prev, { file: file.name, status: res.error ?? 'Feilet', ok: false }])
        }
      }
      router.refresh()
    })
  }

  const handleResolveFitConflict = async (resolution: ConflictResolution) => {
    if (!conflictFile) return
    const { file, preview } = conflictFile
    setConflictFile(null)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await uploadFitFile(fd, {
        conflictResolution: resolution,
        conflictWorkoutId: preview.conflict_workout_id ?? undefined,
      })
      setResults(prev => [
        ...prev.filter(r => r.file !== file.name),
        { file: file.name, status: res.ok ? '✓ Importert' : (res.error ?? 'Feilet'), ok: res.ok },
      ])
      router.refresh()
    })
  }

  return (
    <section className="p-5"
      style={{ background: '#13131A', border: '1px solid #1E1E22' }}>
      <h2 className="mb-2 flex items-center gap-3"
        style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: '0.06em', color: '#F0F0F2',
        }}>
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        .fit-fil-opplasting
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(242,240,236,0.6)', lineHeight: 1.7, marginBottom: 16 }}>
        Last opp .fit-filer fra Garmin, Coros, Polar, Wahoo, Suunto eller andre.
        Flere filer kan dras inn samtidig.
      </p>

      <FitDropZone onFiles={handleFiles} pending={pending} />

      {results.length > 0 && (
        <ul className="mt-4 space-y-2 list-none p-0">
          {results.map((r, i) => (
            <li key={i} className="p-3 flex items-center justify-between gap-3"
              style={{
                background: '#0F0F14', border: '1px solid #1E1E22',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
              }}>
              <span style={{ color: '#F0F0F2' }}>{r.file}</span>
              <span style={{ color: r.ok ? '#28A86E' : '#F5C542' }}>{r.status}</span>
            </li>
          ))}
        </ul>
      )}

      {conflictFile && (
        <ConflictModal
          title={conflictFile.preview.title}
          existingWorkoutId={conflictFile.preview.conflict_workout_id ?? ''}
          newSourceLabel={`Fra ${conflictFile.file.name}`}
          onResolve={handleResolveFitConflict}
          onCancel={() => setConflictFile(null)}
        />
      )}
    </section>
  )
}

function FitDropZone({ onFiles, pending }: {
  onFiles: (files: FileList) => void
  pending: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files)
      }}
      style={{
        display: 'block', padding: '32px 24px', textAlign: 'center',
        background: dragOver ? 'rgba(255,69,0,0.1)' : '#0F0F14',
        border: `2px dashed ${dragOver ? '#FF4500' : '#262629'}`,
        cursor: pending ? 'default' : 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}>
      <input type="file" accept=".fit" multiple
        onChange={e => { if (e.target.files) onFiles(e.target.files) }}
        disabled={pending}
        style={{ display: 'none' }} />
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
        color: pending ? '#555560' : '#F0F0F2', marginBottom: 6,
      }}>
        {pending ? 'Behandler …' : 'Dra .fit-filer inn her, eller klikk for å velge'}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: '#555560', letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        Maks 20 MB per fil
      </div>
    </label>
  )
}
