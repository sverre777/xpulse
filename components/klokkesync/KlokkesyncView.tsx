'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConnectWithStravaButton, StravaLogo, PoweredByStravaBadge } from '@/components/strava/StravaBrand'
import { StravaInfoBox } from '@/components/strava/StravaInfoBox'
import { StravaDisconnectModal } from '@/components/strava/StravaDisconnectModal'
import { StravaCompactInfo } from '@/components/strava/StravaCompactInfo'
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
import { uploadFitFile } from '@/app/actions/fit-upload'
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
  detail?: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  koblet:           { label: '✓ Strava er koblet til',                      color: '#28A86E' },
  avbrutt:          { label: 'Du avbrøt Strava-tilkoblingen',              color: '#8A8A96' },
  'feil-state':     { label: 'Sikkerhetsfeil — prøv igjen',                color: '#E11D48' },
  'ikke-innlogget': { label: 'Logg inn først, så prøv igjen',              color: '#E11D48' },
  'lagring-feilet': { label: 'Kunne ikke lagre tilkoblingen',              color: '#E11D48' },
  'token-feilet':   { label: 'Token-utveksling feilet — prøv igjen',       color: '#E11D48' },
}

export function KlokkesyncView({ stravaConnection, status, detail }: Props) {
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
          <div>{STATUS_LABEL[status].label}</div>
          {detail && (
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
              Detaljer: <code>{detail}</code>
            </div>
          )}
        </div>
      )}

      <StravaRolloutNote />{/* alltid synlig — info om gradvis utrulling + at .fit alltid fungerer */}

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

// Vises over Strava-tilkoblingen når brukeren ikke er koblet til ennå. Strava-
// direktesync rulles ut gradvis (Strava API Standard Tier = 10 athletes inntil
// Extended Access er godkjent), så ikke alle får koblet til med en gang. .fit-
// opplasting er den fulle løsningen tilgjengelig for alle, derfor fremhevet.
function StravaRolloutNote() {
  return (
    <div className="p-4"
      style={{
        background: 'rgba(245,197,66,0.06)',
        border: '1px solid rgba(245,197,66,0.35)',
        borderLeft: '3px solid #F5C542',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>
      <div style={{ color: '#F0F0F2', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
        📡 Strava-sync er i gradvis utrulling
      </div>
      <p style={{ color: 'rgba(242,240,236,0.62)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        Direkte Strava-tilkobling er for øyeblikket tilgjengelig for et begrenset
        antall brukere mens vi utvider kapasiteten. Får du ikke koblet til ennå?
        Det kommer snart.
      </p>
      <p style={{ color: 'rgba(242,240,236,0.82)', fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>
        <span style={{ color: '#28A86E' }}>✓</span>{' '}
        Du kan alltid laste opp <strong style={{ color: '#FF4500' }}>.fit-filer</strong> manuelt
        — fungerer for alle, fra alle klokkemerker, med full data.
      </p>
    </div>
  )
}

// ── Strava-seksjonen ─────────────────────────────────────────

function StravaSection({ conn }: { conn: StravaConn | null }) {
  return (
    <section className="p-5"
      style={{ background: '#13131A', border: '1px solid #1E1E22', borderTop: '3px solid #FC5200' }}>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2.5"
          style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
            letterSpacing: '0.06em', color: '#F0F0F2', margin: 0,
          }}>
          <StravaLogo size={26} color="#FC5200" />
          Strava
        </h2>
        {conn && <PoweredByStravaBadge />}
      </div>
      {conn ? <StravaConnected conn={conn} /> : <StravaDisconnected />}
    </section>
  )
}

function StravaDisconnected() {
  return (
    <>
      <StravaInfoBox />
      <p style={{ fontSize: 14, color: 'rgba(242,240,236,0.7)', lineHeight: 1.7, marginBottom: 16 }}>
        Koble til Strava én gang — alle nye økter synkes automatisk innen 5 minutter.
        Vi henter aktiviteten, splittene/lapsene og puls/watt/pace-streamene.
      </p>
      <ConnectWithStravaButton />
      <p style={{ marginTop: '10px', fontSize: 12, color: 'rgba(242,240,236,0.5)', fontFamily: "'Barlow Condensed', sans-serif" }}>
        Ved tilkobling samtykker du til Stravas API Agreement og X-PULSE sine vilkår.
      </p>
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
  // Aksepter både activity:read (offentlige) og activity:read_all (alle).
  // Banner vises kun hvis brukeren ikke har gitt noen aktivitets-tilgang
  // — typisk fra gamle koblinger med utilstrekkelig scope.
  const missingScope = !conn.scope ||
    (!conn.scope.includes('activity:read') && !conn.scope.includes('activity:read_all'))
  // Vis informasjons-banner hvis brukeren bare har offentlige aktiviteter
  // (ingen activity:read_all) — funker fortsatt, men private kommer ikke.
  const onlyPublic = !!conn.scope &&
    conn.scope.includes('activity:read') &&
    !conn.scope.includes('activity:read_all')

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

  // Strava API Agreement § 5.4 krever at frakobling sletter ALL importert
  // Strava-data innen 48t. Vi viser dedikert modal med slettings-advarsel
  // og kaller /api/strava/disconnect som gjør cascade-sletting + token-revoke.
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const handleDisconnect = () => setShowDisconnectModal(true)
  // disconnectStrava (eksisterende server-action) er nå legacy — beholdt for
  // bakoverkomp med andre kallere, men UI bruker modalen + API-rute.
  void disconnectStrava

  const handleAutoSyncToggle = () => {
    startTransition(async () => {
      await setStravaAutoSync(!conn.auto_sync)
      router.refresh()
    })
  }

  return (
    <>
      {missingScope && (
        <div className="p-3 mb-3"
          style={{
            background: 'rgba(225,29,72,0.1)',
            border: '1px solid rgba(225,29,72,0.5)',
            color: '#E11D48',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
          }}>
          ⚠️ Eksisterende kobling mangler aktivitets-tilgang
          (scope: <code>{conn.scope ?? '—'}</code>). Frakoble og koble til på nytt
          for å gi tilgang til økter.
        </div>
      )}
      {!missingScope && onlyPublic && (
        <div className="p-3 mb-3"
          style={{
            background: 'rgba(245,197,66,0.08)',
            border: '1px solid rgba(245,197,66,0.4)',
            color: '#F5C542',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
          }}>
            Bare offentlige Strava-aktiviteter er gitt tilgang. Private aktiviteter
            importeres ikke. Koble til på nytt og kryss av for «alle» (inkl. private)
            i Strava-dialogen om du vil ha alt.
        </div>
      )}
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

      {/* Kompakt regel-påminnelse — vises etter tilkobling som lite-dominant
          motvekt til StravaInfoBox-en (som vises før tilkobling). */}
      <StravaCompactInfo />

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

      <StravaDisconnectModal
        open={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
      />
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

// ── .fit-fil-opplasting (bulk) ───────────────────────────────

type FileStatus = 'pending' | 'importing' | 'imported' | 'duplicate' | 'skipped' | 'failed'

interface FileEntry {
  file: File
  name: string
  status: FileStatus
  detail?: string
}

// Hvor mange filer som lastes opp parallelt. Hver .fit-opplasting parser +
// skriver til DB server-side; 3 om gangen gir god gjennomstrømning uten å
// overbelaste (et helt år = 200-400 filer prosesseres i bolker på 3).
const UPLOAD_BATCH = 3

const STATUS_VISUAL: Record<FileStatus, { label: string; color: string }> = {
  pending:   { label: 'Klar',                color: '#8A8A96' },
  importing: { label: 'Importerer …',        color: '#F5C542' },
  imported:  { label: '✓ Importert',         color: '#28A86E' },
  duplicate: { label: '⊘ Allerede importert', color: '#8A8A96' },
  skipped:   { label: '⊘ Duplikat — hoppet over', color: '#8A8A96' },
  failed:    { label: '✗ Feilet',            color: '#E11D48' },
}

function FitUploadSection() {
  const router = useRouter()
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [summary, setSummary] = useState<{ imported: number; duplicate: number; skipped: number; failed: number } | null>(null)

  // Legg til filer i kø (dedup på navn+størrelse så samme fil ikke står to
  // ganger om brukeren slipper inn / velger overlappende sett). Nullstiller
  // forrige oppsummering når nye filer legges til.
  const addFiles = (files: FileList) => {
    const fitFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.fit'))
    if (fitFiles.length === 0) return
    setSummary(null)
    setEntries(prev => {
      const seen = new Set(prev.map(e => `${e.name}:${e.file.size}`))
      const additions = fitFiles
        .filter(f => !seen.has(`${f.name}:${f.size}`))
        .map<FileEntry>(f => ({ file: f, name: f.name, status: 'pending' }))
      return [...prev, ...additions]
    })
  }

  const removeEntry = (idx: number) => {
    if (importing) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const clearAll = () => {
    if (importing) return
    setEntries([])
    setSummary(null)
  }

  const updateEntry = (idx: number, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))

  // Prosesser én fil. Returnerer endelig status så oppsummeringen kan telles
  // uten å lese (potensielt stale) entries-state etter løkka.
  const processOne = async (entry: FileEntry, idx: number, bump: () => void): Promise<FileStatus> => {
    updateEntry(idx, { status: 'importing', detail: undefined })
    let final: FileStatus = 'failed'
    let detail: string | undefined
    try {
      const fd = new FormData()
      fd.append('file', entry.file)
      const res = await uploadFitFile(fd)
      if (res.preview) {
        // Konflikt (økt finnes på ~samme tid). I bulk spør vi ikke per fil —
        // vi hopper over og markerer den som importert (skip) så den ikke
        // dukker opp på nytt ved neste opplasting. Rapporteres i oppsummeringen.
        await uploadFitFile(fd, {
          conflictResolution: 'skip',
          conflictWorkoutId: res.preview.conflict_workout_id ?? undefined,
        })
        final = 'skipped'
        detail = 'Økt finnes allerede på samme tidspunkt'
      } else if (res.ok && res.workout_id) {
        final = 'imported'
      } else if (res.ok) {
        final = 'duplicate'
      } else {
        final = 'failed'
        detail = res.error ?? 'Ukjent feil'
      }
    } catch {
      final = 'failed'
      detail = 'Uventet feil under opplasting'
    } finally {
      bump()
    }
    updateEntry(idx, { status: final, detail })
    return final
  }

  const startImport = async () => {
    if (importing || entries.length === 0) return
    setImporting(true)
    setSummary(null)
    const total = entries.length
    let done = 0
    setProgress({ done, total })
    const bump = () => { done += 1; setProgress({ done, total }) }

    const tally = { imported: 0, duplicate: 0, skipped: 0, failed: 0 }
    const indices = entries.map((_, i) => i)
    for (let i = 0; i < indices.length; i += UPLOAD_BATCH) {
      const chunk = indices.slice(i, i + UPLOAD_BATCH)
      const statuses = await Promise.all(chunk.map(idx => processOne(entries[idx], idx, bump)))
      for (const s of statuses) {
        if (s === 'imported') tally.imported++
        else if (s === 'duplicate') tally.duplicate++
        else if (s === 'skipped') tally.skipped++
        else if (s === 'failed') tally.failed++
      }
    }

    setProgress(null)
    setSummary(tally)
    setImporting(false)
    router.refresh()
  }

  const pendingCount = entries.filter(e => e.status === 'pending').length

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
        Velg eller dra inn flere filer samtidig — et helt år går fint på én gang.
      </p>

      <FitHelpAccordion />

      <FitDropZone onFiles={addFiles} disabled={importing} />

      {entries.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#8A8A96' }}>
              {entries.length} {entries.length === 1 ? 'fil' : 'filer'} valgt
              {progress && ` · importerer ${progress.done} av ${progress.total} …`}
            </span>
            <div className="flex items-center gap-2">
              {!importing && (
                <button type="button" onClick={clearAll}
                  style={{
                    background: 'none', border: '1px solid #2A2A30', color: '#8A8A96',
                    padding: '8px 14px', cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                  }}>
                  Tøm liste
                </button>
              )}
              <button type="button" onClick={startImport} disabled={importing || pendingCount === 0}
                style={{
                  background: importing || pendingCount === 0 ? '#7A2200' : '#FF4500',
                  color: '#F0F0F2', border: 'none',
                  padding: '9px 18px', cursor: importing || pendingCount === 0 ? 'default' : 'pointer',
                  opacity: importing || pendingCount === 0 ? 0.7 : 1,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
                }}>
                {importing
                  ? `Importerer ${progress?.done ?? 0}/${progress?.total ?? entries.length} …`
                  : `Importer ${pendingCount > 0 ? pendingCount : entries.length} ${pendingCount === 1 ? 'fil' : 'filer'}`}
              </button>
            </div>
          </div>

          <ul className="space-y-2 list-none p-0" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {entries.map((e, i) => {
              const v = STATUS_VISUAL[e.status]
              return (
                <li key={`${e.name}:${e.file.size}:${i}`} className="p-3 flex items-center justify-between gap-3"
                  style={{
                    background: '#0F0F14', border: '1px solid #1E1E22',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                  }}>
                  <span className="min-w-0 flex-1" style={{ color: '#F0F0F2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.name}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span style={{ color: v.color }} title={e.detail}>{v.label}</span>
                    {!importing && e.status === 'pending' && (
                      <button type="button" onClick={() => removeEntry(i)}
                        aria-label={`Fjern ${e.name}`}
                        style={{ background: 'none', border: 'none', color: '#555560', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>
                        ×
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {summary && (
        <div className="mt-4 p-3"
          style={{
            background: summary.failed > 0 ? 'rgba(245,197,66,0.08)' : 'rgba(40,168,110,0.08)',
            border: `1px solid ${summary.failed > 0 ? 'rgba(245,197,66,0.4)' : 'rgba(40,168,110,0.4)'}`,
            borderLeft: `3px solid ${summary.failed > 0 ? '#F5C542' : '#28A86E'}`,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: '#F0F0F2', lineHeight: 1.6,
          }}>
          Ferdig: <strong>{summary.imported}</strong> importert
          {summary.skipped > 0 && <> · <strong>{summary.skipped}</strong> duplikat hoppet over</>}
          {summary.duplicate > 0 && <> · <strong>{summary.duplicate}</strong> allerede importert</>}
          {summary.failed > 0 && <> · <strong>{summary.failed}</strong> feilet</>}.
        </div>
      )}
    </section>
  )
}

// Steg-for-steg per merke for å finne/eksportere .fit-fila. Native
// <details>/<summary> — ingen JS-state, fungerer også uten hydrering.
const BRAND_GUIDES: { brand: string; steps: string[] }[] = [
  { brand: 'Strava', steps: [
    'Åpne aktiviteten på strava.com (web, ikke app-en)',
    'Klikk de tre prikkene (…) → «Export Original»',
    'Last opp .fit-filen her',
  ]},
  { brand: 'Garmin', steps: [
    'Logg inn på connect.garmin.com',
    'Åpne aktiviteten → tannhjul-ikonet → «Export to FIT»',
    'Last opp filen her',
  ]},
  { brand: 'Polar', steps: [
    'Logg inn på flow.polar.com',
    'Åpne treningsøkten → … → «Export session» → .fit/.tcx',
    'Last opp her',
  ]},
  { brand: 'Coros', steps: [
    'Åpne Coros-appen → aktiviteten → del/eksporter → .fit',
    'Eller bruk traininghub.coros.com → eksporter',
    'Last opp her',
  ]},
  { brand: 'Suunto', steps: [
    'Logg inn på app.suunto.com',
    'Åpne aktiviteten → … → eksporter .fit',
    'Last opp her',
  ]},
  { brand: 'Wahoo', steps: [
    'Åpne Wahoo-appen eller wahoofitness.com',
    'Eksporter aktiviteten som .fit',
    'Last opp her',
  ]},
]

function FitHelpAccordion() {
  return (
    <details className="mb-4"
      style={{ background: '#0F0F14', border: '1px solid #1E1E22' }}>
      <summary
        style={{
          cursor: 'pointer', padding: '12px 14px', listStyle: 'none',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
          color: '#F0F0F2', letterSpacing: '0.04em',
        }}>
        ▸ Hvordan finne .fit-fil fra klokken din
      </summary>
      <div style={{ padding: '0 14px 12px', borderTop: '1px solid #1E1E22' }}>
        {BRAND_GUIDES.map(g => (
          <details key={g.brand} style={{ marginTop: 10 }}>
            <summary
              style={{
                cursor: 'pointer', listStyle: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                color: '#FF4500', letterSpacing: '0.08em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
              {g.brand}
            </summary>
            <ol style={{
              margin: '8px 0 4px', paddingLeft: 20,
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
              color: 'rgba(242,240,236,0.75)', lineHeight: 1.7,
            }}>
              {g.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </details>
        ))}
      </div>
    </details>
  )
}

function FitDropZone({ onFiles, disabled }: {
  onFiles: (files: FileList) => void
  disabled: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <label
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        if (disabled) return
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files)
      }}
      style={{
        display: 'block', padding: '32px 24px', textAlign: 'center',
        background: dragOver ? 'rgba(255,69,0,0.1)' : '#0F0F14',
        border: `2px dashed ${dragOver ? '#FF4500' : '#262629'}`,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}>
      <input type="file" accept=".fit" multiple
        onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = '' }}
        disabled={disabled}
        style={{ display: 'none' }} />
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
        color: disabled ? '#555560' : '#F0F0F2', marginBottom: 6,
      }}>
        {disabled ? 'Behandler …' : 'Dra .fit-filer inn her, eller klikk for å velge (flere støttes)'}
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
