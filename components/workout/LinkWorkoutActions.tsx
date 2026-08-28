'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSameDateLinkCandidates, markCompleted,
  type LinkCandidate,
} from '@/app/actions/workouts'
import {
  hentFlettGrunnlag, flettOkter,
  type FlettGrunnlag, type FlettModus,
} from '@/app/actions/flett'

// Knappebar høyt oppe i WorkoutForm. Kontekst-avhengige knapper:
//   - «✓ Marker som fullført» — planlagte rader uten flett, dato i dag/
//     passert, kun i Plan-modus (Dagbok har egen CTA lenger ned).
//   - Koble/flett-pillen (fasit: flett-designet seksjon 1) — åpner picker,
//     deretter ÉN flett-dialog med modus A/B (seksjon 2). Kobling ER flett.
//   - Flettet tilstand vises som merke; selve angringen bor i «fra klokka»-
//     blokka i WorkoutOverview (seksjon 3).
//
// Etter flett: naviger til dagbok-redigeringen for MÅLET — mot planlagt økt
// er det nøyaktig samme plan-vs-gjennomført-visning som fullført-markering
// gir (regel 11, gjenbruk).

interface Props {
  workoutId: string
  date: string
  isPlanned: boolean
  isCompleted: boolean
  importedFrom: string | null
  alreadyLinked: boolean
  targetUserId?: string
  formMode?: 'plan' | 'dagbok'
  onMarkCompletedRequested?: () => void
  // Skjul marker-knappen her (WorkoutForm løfter den til topp-CTA-raden i
  // plan-modus). Synlighetslogikken bor fortsatt her — status rapporteres
  // opp via onLinkStateChange.
  hideMarkCompleted?: boolean
  onLinkStateChange?: (effectivelyLinked: boolean) => void
  // Historisk (lesevisningen) — stilen styres nå av konteksten.
  prominent?: boolean
}

export function LinkWorkoutActions({
  workoutId, date, isPlanned, isCompleted, importedFrom, alreadyLinked, targetUserId, formMode = 'dagbok', onMarkCompletedRequested,
  hideMarkCompleted = false, onLinkStateChange, prominent = false,
}: Props) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [flettMedId, setFlettMedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Lagres med økt-id-en svaret gjaldt — lesing gater på match, så
  // ingen nullstillings-effect (og ingen sync setState) trengs ved
  // bytte av økt i samme montering.
  const [linkedSvar, setLinkedSvar] = useState<{
    id: string; to: string | null; from: string | null
  } | null>(null)
  const linkedToId = linkedSvar?.id === workoutId ? linkedSvar.to : null
  const linkedFromId = linkedSvar?.id === workoutId ? linkedSvar.from : null

  // Kilden i en flett er ALLTID den synkede økta; mål kan være planlagt
  // eller ført. Denne komponenten kan stå i begge.
  const erSynket = importedFrom != null

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const isFutureDate = date > todayStr

  // Kun flett-TILSTANDEN sjekkes ved mount (den bytter pillen mot merket).
  // Kandidatene hentes først når pickeren åpnes — pillen selv står i kortet
  // fra første render (fasit: aldri etterlastet).
  useEffect(() => {
    let cancelled = false
    const id = workoutId
    getSameDateLinkCandidates(id, targetUserId).then(res => {
      if (cancelled || 'error' in res) return
      setLinkedSvar({ id, to: res.sourceLinkedToId, from: res.sourceLinkedFromId })
      onLinkStateChange?.(res.sourceLinkedToId !== null || res.sourceLinkedFromId !== null || alreadyLinked)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, date, targetUserId])

  const apnePicker = () => {
    // Regel 20: dialogen åpner i samme tick; lastingen skjer inni den.
    setShowPicker(true)
    setCandidates(null)
    getSameDateLinkCandidates(workoutId, targetUserId).then(res => {
      if ('error' in res) { setCandidates([]); return }
      setCandidates(res.candidates)
    })
  }

  // Fase 109: mål-økta bærer merged_source; kilden peker med
  // merged_into_workout_id. linkedFromId = kilde finnes (økta er mål),
  // linkedToId = økta er selv konsumert (direkte besøk på skjult rad).
  const effectivelyLinked = linkedToId !== null || linkedFromId !== null || alreadyLinked

  // Picker-valget bekreftet → åpne flett-dialogen i samme tick (regel 20).
  const handleVelg = (otherId: string) => {
    setShowPicker(false)
    setFlettMedId(otherId)
  }

  const handleMarkCompleted = () => {
    if (busy) return
    if (onMarkCompletedRequested) {
      onMarkCompletedRequested()
      return
    }
    setError(null)
    startBusy(async () => {
      const res = await markCompleted(workoutId, targetUserId)
      if (res.error) { setError(res.error); return }
      // Hold økten ÅPEN i redigeringsmodus: naviger til dagbok-redigering
      // for samme økt så bruker kan fylle inn faktiske data med en gang.
      router.push(`/app/dagbok?edit=${workoutId}`)
      router.refresh()
    })
  }

  const showMarkCompleted = isPlanned && !effectivelyLinked && !isCompleted && formMode === 'plan' && !hideMarkCompleted
  const showLinkButton = !effectivelyLinked
  const linkButtonLabel = erSynket ? '🔗 Koble / flett med økt' : '🔗 Koble / flett med synket økt'
  void prominent

  if (isFutureDate) return null
  if (!showMarkCompleted && !showLinkButton && !effectivelyLinked) return null

  const maalId = erSynket ? flettMedId : workoutId
  const kildeId = erSynket ? workoutId : flettMedId

  return (
    <div className="my-3 flex flex-wrap gap-2 items-center">
      {showMarkCompleted && (
        <button type="button"
          onClick={handleMarkCompleted}
          disabled={busy}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#28A86E', color: 'var(--tekst-1-ren)', border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            minHeight: '38px',
          }}>
          ✓ Marker som fullført
        </button>
      )}

      {/* Fasit (flett-designet seksjon 1): fyldig pill, samme tyngde som
          «Marker som gjennomført». Oransje på synket økt, ghost på mål-økta
          (ved siden av den grønne). Rendres MED kortet — kandidat-oppslaget
          skjer først når pickeren åpnes. */}
      {showLinkButton && (
        <button type="button"
          onClick={apnePicker}
          disabled={busy}
          className="text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
          style={erSynket ? {
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500', color: 'var(--tekst-1-ren)',
            border: 'none', borderRadius: 999,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            minHeight: '38px', padding: '0 20px', fontSize: '12px',
          } : {
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent', color: 'var(--tekst-1-app)',
            border: '1.5px solid var(--line2)', borderRadius: 999,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            minHeight: '38px', padding: '0 20px', fontSize: '12px',
          }}>
          {linkButtonLabel}
        </button>
      )}

      {effectivelyLinked && (
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', marginLeft: '4px' }}>
          ⌚ Flettet med synket økt — angre i økt-visningen
        </span>
      )}

      {importedFrom && !effectivelyLinked && (
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', marginLeft: '4px' }}>
          ({importedFrom === 'strava' ? 'Strava-importert' : importedFrom})
        </span>
      )}

      {error && (
        <p className="w-full text-xs mt-2 px-3 py-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
            backgroundColor: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)',
          }}>
          {error}
        </p>
      )}

      {showPicker && (
        <PickerModal
          erSynket={erSynket}
          candidates={candidates}
          onVelg={handleVelg}
          onClose={() => setShowPicker(false)}
        />
      )}

      {flettMedId && maalId && kildeId && (
        <FlettDialog
          maalId={maalId}
          kildeId={kildeId}
          targetUserId={targetUserId}
          onClose={() => setFlettMedId(null)}
        />
      )}
    </div>
  )
}

// Picker med klikkbare rader, highlight på valgt rad, og separat "Velg"-knapp.
// Valget åpner flett-dialogen — ingenting lagres her.
function PickerModal({
  erSynket, candidates, onVelg, onClose,
}: {
  erSynket: boolean
  /** null = kandidatene laster fortsatt (spinner-tilstand i pickeren). */
  candidates: LinkCandidate[] | null
  onVelg: (id: string) => void
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const title = erSynket ? 'Velg økt å koble til' : 'Velg synket økt å koble til'

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--scrim-75)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--kant-3)',
          maxWidth: '480px', width: '100%', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '20px', letterSpacing: '0.04em' }}>
            {title}
          </h2>
          <p className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Klikk en rad for å markere, deretter «Velg». Du bestemmer hva
            fletten skal gjøre i neste steg.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {candidates === null && (
            <p className="py-6 text-center text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Henter økter …
            </p>
          )}
          {candidates !== null && candidates.length === 0 && (
            <p className="py-6 text-center text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              {erSynket
                ? 'Ingen økter å koble til innen ±3 dager.'
                : 'Ingen synkede økter å koble til innen ±3 dager.'}
            </p>
          )}
          {(candidates ?? []).map(c => {
            const isSelected = c.id === selectedId
            return (
              <button key={c.id} type="button"
                onClick={() => setSelectedId(c.id)}
                className="w-full p-3 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? 'rgba(40,168,110,0.12)' : 'var(--flate-12-alt)',
                  border: `2px solid ${isSelected ? '#28A86E' : 'var(--kant-3)'}`,
                  cursor: 'pointer',
                }}>
                <div className="flex items-start gap-2">
                  <span style={{
                    color: isSelected ? '#28A86E' : 'var(--tekst-8-app)',
                    fontSize: '16px', lineHeight: 1, marginTop: '1px',
                  }}>
                    {isSelected ? '●' : '○'}
                  </span>
                  <div className="flex-1">
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px', fontWeight: 600 }}>
                      {c.title}
                      {c.imported_from === 'strava' && (
                        <span style={{ color: '#FC4C02', marginLeft: '6px', fontSize: '11px' }}>↻ Strava</span>
                      )}
                      {c.is_planned && (
                        <span style={{ color: 'var(--tekst-5-app)', marginLeft: '6px', fontSize: '11px' }}>planlagt</span>
                      )}
                    </div>
                    <div className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                      {new Date(`${c.date}T00:00:00`).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {c.duration_minutes != null ? ` · ${c.duration_minutes} min` : ' · —'}
                      {c.distance_km != null ? ` · ${c.distance_km.toFixed(1)} km` : ''}
                      {c.sport ? ` · ${c.sport}` : ''}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
              background: 'none', border: '1px solid var(--kant-3)', cursor: 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={() => selectedId && onVelg(selectedId)}
            disabled={!selectedId}
            className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: !selectedId ? 'var(--kant-3)' : '#28A86E',
              color: 'var(--tekst-1-ren)', border: 'none',
              cursor: !selectedId ? 'not-allowed' : 'pointer',
              opacity: !selectedId ? 0.5 : 1,
            }}>
            Velg
          </button>
        </div>
      </div>
    </div>
  )
}

// ÉN flett-dialog, to moduser (fasit seksjon 2). Åpner i samme tick;
// konsekvens-tallene (FAKTISKE rader ut/inn) laster inni dialogen.
function FlettDialog({
  maalId, kildeId, targetUserId, onClose,
}: {
  maalId: string
  kildeId: string
  targetUserId?: string
  onClose: () => void
}) {
  // «Bytt ut» øverst og forvalgt (Sverre 28. aug) — det er modusen som
  // kommer til å bli brukt mest.
  const [modus, setModus] = useState<FlettModus>('bytt_ut')
  const [grunnlag, setGrunnlag] = useState<FlettGrunnlag | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    hentFlettGrunnlag(maalId, kildeId, targetUserId).then(res => {
      if (cancelled) return
      if ('error' in res) { setError(res.error); return }
      setGrunnlag(res)
    })
    return () => { cancelled = true }
  }, [maalId, kildeId, targetUserId])

  const handleFlett = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    const res = await flettOkter(maalId, kildeId, modus, targetUserId)
    if (res.error) { setError(res.error); setSaving(false); return }
    // Mot planlagt mål: nøyaktig samme plan-vs-gjennomført-visning som
    // fullført-markering gir. Mot ført mål: samme redigering, friske data.
    window.location.assign(`/app/dagbok?edit=${maalId}`)
  }

  const radioStyle = (on: boolean): React.CSSProperties => ({
    border: `2px solid ${on ? '#FF4500' : 'var(--kant-3)'}`,
    backgroundColor: on ? 'rgba(255,69,0,0.06)' : 'var(--flate-12-alt)',
    padding: '12px 14px', cursor: 'pointer', textAlign: 'left', width: '100%',
  })

  return (
    <div onClick={saving ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--scrim-75)',
        zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--kant-3)',
          maxWidth: '520px', width: '100%', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '20px', letterSpacing: '0.04em' }}>
            {grunnlag
              ? `Koble «${grunnlag.kildeTittel}» til «${grunnlag.maalTittel}»`
              : 'Koble øktene'}
          </h2>
          <p className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Velg hva klokkedataen skal gjøre med økta di. Kan angres.
          </p>
        </div>

        <div className="p-4 space-y-3">
          <button type="button" onClick={() => setModus('bytt_ut')} style={radioStyle(modus === 'bytt_ut')}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em' }}>
              {modus === 'bytt_ut' ? '●' : '○'} BYTT UT AKTIVITETENE — klokkas runder inn
            </div>
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Klokkas runder, rundetider, distanse og soner erstatter
              aktivitetene i økta. Notater, følelse, skyting og tags står.
            </p>
            <p className="text-xs mt-2 px-2 py-1" style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)',
              border: '1px dashed var(--kant-3)',
            }}>
              {grunnlag
                ? <>Aktivitetene dine: <b>{grunnlag.maalRader} {grunnlag.maalRader === 1 ? 'rad' : 'rader'} erstattes</b> · Inn: <b>{grunnlag.kildeRader} {grunnlag.kildeRader === 1 ? 'runde' : 'runder'} fra klokka</b></>
                : 'Henter tall …'}
            </p>
          </button>

          <button type="button" onClick={() => setModus('legg_bak')} style={radioStyle(modus === 'legg_bak')}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em' }}>
              {modus === 'legg_bak' ? '●' : '○'} LEGG BAK — økta di er sjefen
            </div>
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Alt du har ført (aktiviteter, sett/reps, notater) står urørt. Fra
              klokka hentes puls og pulskurve, totaltiden (klokkas vinner) og
              sonefordelingen (regnes fra pulskurven).
            </p>
            <p className="text-xs mt-2 px-2 py-1" style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)',
              border: '1px dashed var(--kant-3)',
            }}>
              {grunnlag
                ? <>Aktivitetene dine: <b>0 endres</b> · Inn: puls, kurve, totaltid{grunnlag.kildeVarighetMin != null ? ` (${grunnlag.kildeVarighetMin} min)` : ''}, soner</>
                : 'Henter tall …'}
            </p>
          </button>

          {grunnlag?.maalErPlanlagt && (
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Fletten markerer samtidig den planlagte økta som gjennomført, og
              plan-vs-gjennomført kommer opp etterpå.
            </p>
          )}

          {error && (
            <p className="text-xs px-3 py-2" style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
              backgroundColor: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)',
            }}>
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)',
              background: 'none', border: '1.5px solid var(--line2)', borderRadius: 999,
              minHeight: '38px', padding: '0 20px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleFlett} disabled={saving}
            className="text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500', color: 'var(--tekst-1-ren)',
              border: 'none', borderRadius: 999,
              minHeight: '38px', padding: '0 20px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>
            {saving ? 'Fletter…' : 'Flett ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
