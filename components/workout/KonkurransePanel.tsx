'use client'

// #50 bolk 1 — KONKURRANSE-/TESTLØP-/TEST-PANELET, redesignet.
// Fasit: design/xpulse-konkurranse-design.html (inkl. «Notat — regler»).
//
// REDESIGN MED FUNKSJONSPARITET: alle felter fra CompetitionModule beholdes
// 1:1 (sport, konkurransetype, format, navn, sted, startnr, mål/før-kommentar
// i plan, plasseringer/deltakere/kommentar i dagbok, regenerer) — kun layout,
// gruppering og plassering er nytt. Panelet ligger ØVERST, over aktivitets-
// og skyteføringen, med auto-stripa synlig FØR man fører.
//
// A/B/C: KUN konkurranse. Prioriteten ER key-datens event_type i årsplanen —
// arves med grønn prikk og skrives TILBAKE dit ved overstyring (samme kilde,
// aldri duplikatfelt).

import { useState } from 'react'
import {
  CompetitionData, COMPETITION_TYPES, DISTANCE_FORMATS, Sport, SPORTS,
  hasAutoGenerateTemplate, type TestData, emptyTestData,
} from '@/lib/types'
import type { WorkoutKeyDateLink } from '@/app/actions/seasons'
import { TestDataModule } from './TestDataModule'

const GULL = '#E8B93C'
const GULL2 = '#D4A017'
const FONT = "'Barlow Condensed', sans-serif"

const FELT: React.CSSProperties = {
  backgroundColor: 'var(--surface, #101014)', border: '1px solid var(--line2)',
  borderRadius: 9, color: '#F0F0F2', fontFamily: FONT, fontSize: 15,
  padding: '10px 12px', outline: 'none', width: '100%', minHeight: 44,
}
const LBL: React.CSSProperties = {
  display: 'block', fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#55555F', marginBottom: 6,
}

export type PanelType = 'competition' | 'testlop' | 'test'

const TYPE_CHIPS: { verdi: PanelType; etikett: string }[] = [
  { verdi: 'competition', etikett: '🏁 Konkurranse' },
  { verdi: 'testlop', etikett: '⏱ Testløp' },
  { verdi: 'test', etikett: '🧪 Test' },
]

export function KonkurransePanel({
  type, onTypeChange, data, onChange, sport, mode, onSportChange,
  onRequestGenerate, activityCount, keyDate, onPrioritetChange,
  testData, onTestDataChange,
}: {
  type: PanelType
  onTypeChange: (t: PanelType) => void
  data: CompetitionData
  onChange: (d: CompetitionData) => void
  sport: Sport
  mode: 'plan' | 'dagbok'
  onSportChange?: (s: Sport) => void
  onRequestGenerate: (format: string, replaceExisting: boolean) => void
  activityCount: number
  // Årsplan-kobling (SF-2 del 1): satt når en key date peker på økta.
  keyDate: WorkoutKeyDateLink | null
  onPrioritetChange: (p: 'a' | 'b' | 'c') => void
  testData: TestData | null
  onTestDataChange: (d: TestData) => void
}) {
  const isPlan = mode === 'plan'
  const erKonk = type === 'competition'
  const erTest = type === 'test'
  // «Etter løpet» kollapset som standard i plan (skjemaet føles kort før
  // start) — åpen i dagbok, eller når noe alt er ført.
  const harResultat = data.position_overall !== '' || data.position_class !== ''
    || data.position_gender !== '' || data.participant_count !== '' || data.comment.trim() !== ''
  const [etterApen, setEtterApen] = useState(!isPlan || harResultat)

  const formats = DISTANCE_FORMATS[sport] ?? []
  const canAutoGenerate = !erTest && hasAutoGenerateTemplate(sport, data.distance_format)
  const set = <K extends keyof CompetitionData>(k: K, v: CompetitionData[K]) =>
    onChange({ ...data, [k]: v })

  const prioritet: 'a' | 'b' | 'c' | null = keyDate?.event_type?.startsWith('competition_')
    ? (keyDate.event_type.slice(-1) as 'a' | 'b' | 'c')
    : null

  const tittel = erKonk ? 'KONKURRANSE' : type === 'testlop' ? 'TESTLØP' : 'TEST'

  return (
    <div className="mb-4" style={{
      border: '1px solid var(--line2)', borderLeft: `4px solid ${GULL2}`,
      background: 'var(--card)', borderRadius: 14, overflow: 'hidden',
    }}>
      {/* ── Header: tittel + type-chips (ikke dropdown) ── */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3.5" style={{ borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontFamily: FONT, fontWeight: 800, letterSpacing: '0.14em', fontSize: 13.5, color: GULL }}>
          — {tittel}{isPlan ? ' · PLAN' : ''}
        </span>
        <span className="flex flex-wrap sm:ml-auto" style={{ border: '1px solid var(--line2)', borderRadius: 10, overflow: 'hidden' }}>
          {TYPE_CHIPS.map(c => (
            <button key={c.verdi} type="button" onClick={() => onTypeChange(c.verdi)}
              style={{
                padding: '8px 14px', fontFamily: FONT, fontSize: 14, cursor: 'pointer', border: 'none',
                color: type === c.verdi ? GULL : '#8B8B95',
                background: type === c.verdi ? 'rgba(232,185,60,.14)' : 'transparent',
                fontWeight: type === c.verdi ? 700 : 400,
              }}>
              {c.etikett}
            </button>
          ))}
        </span>
      </div>

      {/* ── Auto-strip: alltid synlig når formatet kan generere — FØR føring ── */}
      {canAutoGenerate && (
        <div className="flex items-center gap-3 flex-wrap mx-4 mt-4 px-4 py-3"
          style={{ border: '1px solid rgba(232,185,60,.35)', background: 'rgba(232,185,60,.06)', borderRadius: 11 }}>
          <span style={{ fontFamily: FONT, fontSize: 14.5, color: '#F0F0F2', minWidth: 180, flex: 1 }}>
            ⚡ <b style={{ color: GULL }}>{data.distance_format}</b>
            {type === 'testlop' ? ' (testløp)' : ''} genererer aktivitets-strukturen
            {sport === 'biathlon' ? ' — runder og skyteserier klare til føring' : ' — klar til føring'}
          </span>
          <button type="button" onClick={() => onRequestGenerate(data.distance_format, activityCount > 0)}
            style={{
              background: GULL2, color: '#101014', fontFamily: FONT, fontWeight: 800, fontSize: 13.5,
              letterSpacing: '0.06em', border: 'none', borderRadius: 9, padding: '10px 18px',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {activityCount > 0 ? 'Regenerer aktiviteter' : 'Generer aktiviteter'}
          </button>
        </div>
      )}

      {/* ── TEST: protokoll-skjemaet (bolk 2 kobler skytetest-biblioteket) ── */}
      {erTest ? (
        <div className="px-4 pb-4 pt-2">
          <TestDataModule data={testData ?? emptyTestData()} onChange={onTestDataChange} mode={mode} />
        </div>
      ) : (
        <div className="px-4 pb-4 pt-1">
          {/* Rad 1: Sport · Konkurransetype · Format · (Prioritet kun konk).
              Konkurransetype (stafett/tempo) er beholdt for funksjonsparitet. */}
          <div className={`grid grid-cols-2 gap-3 mt-3 ${erKonk ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {onSportChange ? (
              <div>
                <label style={LBL}>Sport</label>
                <select value={sport} onChange={e => onSportChange(e.target.value as Sport)} style={FELT}>
                  {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={LBL}>Sport</label>
                <div style={{ ...FELT, display: 'flex', alignItems: 'center', color: '#8B8B95' }}>
                  {SPORTS.find(s => s.value === sport)?.label ?? sport}
                </div>
              </div>
            )}
            <div>
              <label style={LBL}>Type</label>
              <select value={data.competition_type}
                onChange={e => set('competition_type', (e.target.value || '') as CompetitionData['competition_type'])}
                style={FELT}>
                <option value="">—</option>
                {COMPETITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Format</label>
              <select value={data.distance_format}
                onChange={e => {
                  const format = e.target.value
                  const prev = data.distance_format
                  set('distance_format', format)
                  if (format && format !== prev && hasAutoGenerateTemplate(sport, format)) {
                    onRequestGenerate(format, activityCount > 0)
                  }
                }}
                style={FELT} disabled={formats.length === 0}>
                <option value="">—</option>
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {erKonk && (
              <div>
                <label style={LBL}>Prioritet</label>
                <div className="flex gap-2">
                  {(['a', 'b', 'c'] as const).map(p => (
                    <button key={p} type="button"
                      onClick={() => onPrioritetChange(p)}
                      disabled={!keyDate}
                      title={keyDate ? undefined : 'Prioritet settes på konkurransen i årsplanen — koble økta dit først'}
                      style={{
                        flex: 1, textAlign: 'center', borderRadius: 9, padding: '10px 0',
                        fontFamily: FONT, fontWeight: 800, fontSize: 14.5,
                        cursor: keyDate ? 'pointer' : 'not-allowed',
                        color: prioritet === p ? GULL : '#8B8B95',
                        border: `1px solid ${prioritet === p ? GULL : 'var(--line2)'}`,
                        background: prioritet === p ? 'rgba(232,185,60,.12)' : 'transparent',
                        opacity: keyDate ? 1 : 0.45,
                      }}>
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
                {keyDate && (
                  <div className="flex items-center gap-2 mt-2" style={{ fontFamily: FONT, fontSize: 12.5, color: '#8B8B95' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28A86E', flexShrink: 0 }} />
                    Hentet fra <b style={{ color: '#F0F0F2' }}>årsplanen</b> — kan overstyres
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rad 2: Navn · Sted · Startnr */}
          <div className="grid grid-cols-2 md:grid-cols-[2.2fr_1.2fr_.8fr] gap-3 mt-3">
            <div className="col-span-2 md:col-span-1">
              <label style={LBL}>Navn</label>
              <input value={data.name} onChange={e => set('name', e.target.value)}
                placeholder="F.eks. NC sprint Simostranda" style={FELT} />
            </div>
            <div>
              <label style={LBL}>Sted</label>
              <input value={data.location} onChange={e => set('location', e.target.value)}
                placeholder="By/arena" style={FELT} />
            </div>
            <div>
              <label style={LBL}>Startnr</label>
              <input value={data.bib_number} onChange={e => set('bib_number', e.target.value)} style={FELT} />
            </div>
          </div>

          {/* Plan: mål + før-kommentar (funksjonsparitet). */}
          {isPlan && (
            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <label style={LBL}>Mål</label>
                <textarea value={data.goal} onChange={e => set('goal', e.target.value)} rows={2}
                  placeholder="Tidsmål, plasseringsmål, prosessmål…" style={{ ...FELT, resize: 'vertical' }} />
              </div>
              <div>
                <label style={LBL}>Kommentar før løpet</label>
                <textarea value={data.pre_comment} onChange={e => set('pre_comment', e.target.value)} rows={2}
                  placeholder="Taktikk, forhold, fokuspunkter…" style={{ ...FELT, resize: 'vertical' }} />
              </div>
            </div>
          )}

          {/* Dagbok: «Fra planen»-banner (paritet) + Etter løpet-kollaps. */}
          {!isPlan && (data.goal.trim() !== '' || data.pre_comment.trim() !== '') && (
            <div className="mt-3 p-3" style={{ background: 'var(--surface, #101014)', border: '1px solid var(--line)', borderRadius: 9 }}>
              <div style={{ ...LBL, marginBottom: 4, color: '#8B8B95' }}>Fra planen</div>
              {data.goal.trim() !== '' && (
                <p style={{ fontFamily: FONT, fontSize: 14, color: '#F0F0F2', whiteSpace: 'pre-wrap' }}>🎯 {data.goal}</p>
              )}
              {data.pre_comment.trim() !== '' && (
                <p style={{ fontFamily: FONT, fontSize: 14, color: '#C0C0CC', whiteSpace: 'pre-wrap', marginTop: 4 }}>{data.pre_comment}</p>
              )}
            </div>
          )}

          {!isPlan && (
            <>
              <button type="button" onClick={() => setEtterApen(o => !o)}
                className="flex items-center gap-3 w-full mt-5"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ border: '1px solid var(--line2)', borderRadius: 7, padding: '2px 9px', fontSize: 12, color: '#8B8B95' }}>
                  {etterApen ? '▾' : '▸'}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#55555F' }}>
                  Etter løpet — fyll ut når du er i mål
                </span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </button>
              {etterApen && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <label style={LBL}>Plassering</label>
                      <input type="number" inputMode="numeric" min={1} value={data.position_overall}
                        onChange={e => set('position_overall', e.target.value)} style={FELT} />
                    </div>
                    <div>
                      <label style={LBL}>I klassen</label>
                      <input type="number" inputMode="numeric" min={1} value={data.position_class}
                        onChange={e => set('position_class', e.target.value)} style={FELT} />
                    </div>
                    <div>
                      <label style={LBL}>Kjønn</label>
                      <input type="number" inputMode="numeric" min={1} value={data.position_gender}
                        onChange={e => set('position_gender', e.target.value)} style={FELT} />
                    </div>
                    <div>
                      <label style={LBL}>Deltakere</label>
                      <input type="number" inputMode="numeric" min={1} value={data.participant_count}
                        onChange={e => set('participant_count', e.target.value)} style={FELT} />
                    </div>
                  </div>
                  <textarea value={data.comment} onChange={e => set('comment', e.target.value)} rows={2}
                    placeholder="Hvordan gikk det? Følelse, taktikk, forhold…"
                    className="mt-3" style={{ ...FELT, resize: 'vertical' }} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
