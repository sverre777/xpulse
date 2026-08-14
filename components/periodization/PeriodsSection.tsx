'use client'

import { useState } from 'react'
import type { Season, SeasonPeriod, SeasonMarking, SeasonKeyDate, KeyEventType, Intensity } from '@/app/actions/seasons'
import { PeriodModal } from './PeriodModal'
import { MarkingModal } from './MarkingModal'
import { KeyDateModal } from './KeyDateModal'
import { SeasonCanvas } from './SeasonCanvas'

const INTENSITY_COLOR: Record<Intensity, string> = {
  rolig: '#28A86E',
  medium: '#D4A017',
  hard: '#E11D48',
}

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig',
  medium: 'Medium',
  hard: 'Hard',
}

export function PeriodsSection({
  season, periods, markings, keyDates = [], targetUserId, canEdit = true,
}: {
  season: Season
  periods: SeasonPeriod[]
  markings: SeasonMarking[]
  keyDates?: SeasonKeyDate[]
  targetUserId?: string
  canEdit?: boolean
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonPeriod | null>(null)
  // Del B: markeringslag — nytt spenn tegnet i lerretet / rediger via ✋.
  const [newMarkingRange, setNewMarkingRange] = useState<{ start: string; end: string } | null>(null)
  const [editingMarking, setEditingMarking] = useState<SeasonMarking | null>(null)
  // G2: stemple-verktøyet → KeyDateModal forhåndsutfylt / ✋ på stempel.
  const [stampInit, setStampInit] = useState<{ date: string; type: KeyEventType; peak: boolean } | null>(null)
  const [editingKeyDate, setEditingKeyDate] = useState<SeasonKeyDate | null>(null)

  return (
    <section className="mb-8">
      {/* «Mal sesongen»-lerretet (kø #39 fase 1). ✋ Velg åpner samme
          PeriodModal som liste-radene — full feltparitet. */}
      <SeasonCanvas
        season={season}
        periods={periods}
        markings={markings}
        keyDates={keyDates}
        targetUserId={targetUserId}
        canEdit={canEdit}
        onPickPeriod={p => setEditing(p)}
        onPickMarking={m => setEditingMarking(m)}
        onDrawMarking={(start, end) => setNewMarkingRange({ start, end })}
        onStampDay={(date, type, peak) => setStampInit({ date, type, peak })}
        onPickKeyDate={k => setEditingKeyDate(k)}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Perioder
          </h2>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewMarkingRange({ start: season.start_date, end: season.start_date })}
              className="px-3 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent',
                border: '1px solid #D4A017',
                color: '#D4A017',
                cursor: 'pointer',
              }}
            >
              + Samling/høyde
            </button>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="px-3 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500',
                border: '1px solid #FF4500',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              + Legg til periode
            </button>
          </div>
        )}
      </div>

      {periods.length === 0 ? (
        <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen perioder definert ennå
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {periods.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => canEdit && setEditing(p)}
              disabled={!canEdit}
              className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[#1A1A22]"
              style={{
                backgroundColor: 'var(--card)',
                borderLeft: `3px solid ${INTENSITY_COLOR[p.intensity]}`,
                border: '1px solid #1E1E22',
                cursor: canEdit ? 'pointer' : 'default',
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                    {p.name}
                  </span>
                  <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: INTENSITY_COLOR[p.intensity], border: `1px solid ${INTENSITY_COLOR[p.intensity]}` }}>
                    {INTENSITY_LABEL[p.intensity]}
                  </span>
                  {/* B2: samling/høyde vises i markeringslaget («Samlinger &
                      høyde» under) — ikke lenger som periode-flagg her. */}
                </div>
                {p.focus && (
                  <p className="text-sm mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    {p.focus}
                  </p>
                )}
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {p.start_date} → {p.end_date}
                </p>
                {p.notes && (
                  <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {p.notes}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Del B: markeringslaget som liste — samme info som båndene i
          lerretet (lesbar også uten redigeringstilgang). */}
      {markings.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ width: '14px', height: '2px', backgroundColor: '#D4A017', display: 'inline-block' }} />
            <h3 className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Samlinger & høyde
            </h3>
          </div>
          <div className="space-y-2">
            {markings.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => canEdit && setEditingMarking(m)}
                disabled={!canEdit}
                className="w-full p-3 flex items-start gap-3 text-left transition-colors hover:bg-[#1A1A22]"
                style={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid #1E1E22',
                  borderLeft: '3px solid #D4A017',
                  cursor: canEdit ? 'pointer' : 'default',
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em' }}>
                      {m.is_training_camp ? '📍 ' : ''}{m.is_altitude ? '🏔️ ' : ''}{m.name}
                    </span>
                    {m.is_training_camp && m.location && (
                      <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
                        {m.location}
                      </span>
                    )}
                    {m.is_altitude && m.altitude_meters != null && (
                      <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF' }}>
                        {m.altitude_meters} moh
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {m.start_date} → {m.end_date}
                  </p>
                  {m.notes && (
                    <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {m.notes}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <>
          {newOpen && (
            <PeriodModal
              open
              onClose={() => setNewOpen(false)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              targetUserId={targetUserId}
            />
          )}
          {/* Mount modalen friskt per redigering. Tidligere lå modalen alltid
              mountet og useState(editing?.x ?? '') ble satt ved første mount
              (editing=null), så felter forble tomme når brukeren klikket en
              eksisterende rad. key={editing.id} sikrer re-mount per rad. */}
          {editing && (
            <PeriodModal
              key={editing.id}
              open
              onClose={() => setEditing(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              editing={editing}
              targetUserId={targetUserId}
            />
          )}
          {newMarkingRange && (
            <MarkingModal
              open
              onClose={() => setNewMarkingRange(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              initialStart={newMarkingRange.start}
              initialEnd={newMarkingRange.end}
              targetUserId={targetUserId}
            />
          )}
          {/* Samme re-mount-mønster som PeriodModal: key per markering. */}
          {editingMarking && (
            <MarkingModal
              key={editingMarking.id}
              open
              onClose={() => setEditingMarking(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              editing={editingMarking}
              targetUserId={targetUserId}
            />
          )}
          {/* G2: stempel → ny nøkkeldato forhåndsutfylt (dato/type/peak);
              ✋ på stempel → rediger. Samme flyt/kilde som KeyDatesSection —
              kalendere og nedtelling plukker den opp automatisk. */}
          {stampInit && (
            <KeyDateModal
              open
              onClose={() => setStampInit(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              initialDate={stampInit.date}
              initialType={stampInit.type}
              initialPeak={stampInit.peak}
              targetUserId={targetUserId}
            />
          )}
          {editingKeyDate && (
            <KeyDateModal
              key={editingKeyDate.id}
              open
              onClose={() => setEditingKeyDate(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              editing={editingKeyDate}
              targetUserId={targetUserId}
            />
          )}
        </>
      )}
    </section>
  )
}
