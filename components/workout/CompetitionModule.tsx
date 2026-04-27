'use client'

import {
  CompetitionData, COMPETITION_TYPES, DISTANCE_FORMATS, Sport,
  hasAutoGenerateTemplate,
} from '@/lib/types'

interface Props {
  data: CompetitionData
  onChange: (data: CompetitionData) => void
  sport: Sport
  mode: 'plan' | 'dagbok'
  // Kalles når brukeren velger et nytt format som har auto-mal, eller trykker "Regenerer".
  // Implementeres av WorkoutForm: vis bekreftelses-dialog, og ved ja kall onChange + sett
  // aktivitetslisten basert på format.
  onRequestGenerate: (format: string, replaceExisting: boolean) => void
  activityCount: number
}

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', outline: 'none',
}

export function CompetitionModule({ data, onChange, sport, mode, onRequestGenerate, activityCount }: Props) {
  const formats = DISTANCE_FORMATS[sport] ?? []
  const canAutoGenerate = hasAutoGenerateTemplate(sport, data.distance_format)
  const isPlan = mode === 'plan'
  const hasPlanBanner = !isPlan && (data.goal.trim() !== '' || data.pre_comment.trim() !== '')

  const set = <K extends keyof CompetitionData>(k: K, v: CompetitionData[K]) =>
    onChange({ ...data, [k]: v })

  const handleFormatChange = (format: string) => {
    const prev = data.distance_format
    onChange({ ...data, distance_format: format })
    if (!format || format === prev) return
    if (hasAutoGenerateTemplate(sport, format)) {
      onRequestGenerate(format, activityCount > 0)
    }
  }

  const handleRegenerate = () => {
    if (!data.distance_format) return
    onRequestGenerate(data.distance_format, activityCount > 0)
  }

  return (
    <div className="p-4 mb-4"
      style={{ backgroundColor: '#13131A', border: '1px solid #D4A01744' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: '#D4A017', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
          Konkurranse {isPlan ? '— Plan' : '— Dagbok'}
        </span>
      </div>

      {hasPlanBanner && (
        <div className="p-3 mb-4"
          style={{ backgroundColor: '#0F0F11', border: '1px solid #1E1E22' }}>
          <div className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Fra planen
          </div>
          {data.goal.trim() !== '' && (
            <div className="mb-2">
              <div className="text-xs tracking-widest uppercase mb-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Mål
              </div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
                fontSize: '15px', whiteSpace: 'pre-wrap',
              }}>{data.goal}</div>
            </div>
          )}
          {data.pre_comment.trim() !== '' && (
            <div>
              <div className="text-xs tracking-widest uppercase mb-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Kommentar før løpet
              </div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
                fontSize: '15px', whiteSpace: 'pre-wrap',
              }}>{data.pre_comment}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Konkurransetype</Label>
          <select value={data.competition_type}
            onChange={e => set('competition_type', (e.target.value || '') as CompetitionData['competition_type'])}
            style={iSt} className="w-full px-3 py-2">
            <option value="">—</option>
            {COMPETITION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Distanse/format</Label>
          <select value={data.distance_format}
            onChange={e => handleFormatChange(e.target.value)}
            style={iSt} className="w-full px-3 py-2"
            disabled={formats.length === 0}>
            <option value="">—</option>
            {formats.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <Label>Konkurransenavn</Label>
          <input value={data.name} onChange={e => set('name', e.target.value)}
            placeholder="F.eks. Birkebeinerrennet"
            style={iSt} className="w-full px-3 py-2" />
        </div>

        <div>
          <Label>Sted</Label>
          <input value={data.location} onChange={e => set('location', e.target.value)}
            placeholder="By/arena"
            style={iSt} className="w-full px-3 py-2" />
        </div>

        <div>
          <Label>Startnummer</Label>
          <input value={data.bib_number} onChange={e => set('bib_number', e.target.value)}
            style={iSt} className="w-full px-3 py-2" />
        </div>

        {isPlan && (
          <>
            <div className="md:col-span-2">
              <Label>Mål</Label>
              <textarea value={data.goal} onChange={e => set('goal', e.target.value)}
                rows={2}
                placeholder="Tidsmål, plasseringsmål, prosessmål..."
                style={{ ...iSt, resize: 'vertical' }} className="w-full px-3 py-2" />
            </div>

            <div className="md:col-span-2">
              <Label>Kommentar / notat før løpet</Label>
              <textarea value={data.pre_comment} onChange={e => set('pre_comment', e.target.value)}
                rows={2}
                placeholder="Taktikk, forhold, fokuspunkter..."
                style={{ ...iSt, resize: 'vertical' }} className="w-full px-3 py-2" />
            </div>
          </>
        )}

        {!isPlan && (
          <>
            <div>
              <Label>Plassering totalt</Label>
              <input type="number" inputMode="numeric" min={1}
                value={data.position_overall} onChange={e => set('position_overall', e.target.value)}
                style={iSt} className="w-full px-3 py-2" />
            </div>

            <div>
              <Label>Plassering klasse</Label>
              <input type="number" inputMode="numeric" min={1}
                value={data.position_class} onChange={e => set('position_class', e.target.value)}
                style={iSt} className="w-full px-3 py-2" />
            </div>

            <div>
              <Label>Plassering kjønn</Label>
              <input type="number" inputMode="numeric" min={1}
                value={data.position_gender} onChange={e => set('position_gender', e.target.value)}
                style={iSt} className="w-full px-3 py-2" />
            </div>

            <div>
              <Label>Antall deltakere</Label>
              <input type="number" inputMode="numeric" min={1}
                value={data.participant_count} onChange={e => set('participant_count', e.target.value)}
                style={iSt} className="w-full px-3 py-2" />
            </div>

            <div className="md:col-span-2">
              <Label>Etterpå-kommentar</Label>
              <textarea value={data.comment} onChange={e => set('comment', e.target.value)}
                rows={2}
                placeholder="Hvordan gikk det? Følelse, taktikk, forhold..."
                style={{ ...iSt, resize: 'vertical' }} className="w-full px-3 py-2" />
            </div>
          </>
        )}
      </div>

      {canAutoGenerate && (
        <div className="flex items-center justify-between mt-4 pt-3"
          style={{ borderTop: '1px solid #1E1E22' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
            Aktivitets-struktur for {data.distance_format} kan auto-genereres.
          </span>
          <button type="button" onClick={handleRegenerate}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#D4A017', background: 'none',
              border: '1px solid #D4A01788', cursor: 'pointer',
            }}>
            Regenerer aktiviteter
          </button>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}
