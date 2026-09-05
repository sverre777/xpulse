'use client'

// HJEM v2 bolk 4 — «VIS MER»-POPUPEN for Siste hardøkt (lesing, ingen
// redigering). Fasit design/xpulse-hjem-kort-v2-design.html: tittel +
// datolinje, ØktGraf stor (~280 px) m/ GRAF·KURVER·BEGGE og PÅ GRAFEN-chips
// (samme komponent og husket valg som øktsiden), 6 nøkkeltall, to kolonner
// (Soner i økta + Runder = klokkas ORIGINALE runder · Skyting x/20, Laktat &
// ernæring m/ tidspunkt, Opplevd, Aktiviteter), full bredde SKYTING PER SERIE
// (én rad per ShootingSeriesRow m/ fem blinker), «Åpne i dagbok →».
// Skyting (kort + serier) kun når brukeren har skiskyting OG økta har skyting.

import { useMemo } from 'react'
import type { OversiktWorkoutCard, OversiktSkyteserie } from '@/app/actions/oversikt'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { WorkoutDetailChart, Nokkeltall, type NokkeltallCelle } from '@/components/workout/WorkoutDetailChart'
import { PlanGraf } from '@/components/workout/PlanGraf'
import { fraRaaRader } from '@/lib/plan-graf'
import { beregnSoneTss } from '@/lib/belastning'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { SEGMENT_FARGER } from '@/lib/segmenter'
import { formatMinPerKm } from '@/lib/pace-utils'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { KortPopup, PopupSeksjon } from './KortPopup'
import { ZoneBar, fmtHM, COLOR_PRONE, COLOR_STANDING } from './kort-deler'

const FONT = "'Barlow Condensed', sans-serif"
const LAKTAT = '#E8B93C'
const ERNAERING = '#28A86E'
const UKEDAG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MND = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']

function sportLabel(v: string): string { return SPORTS.find(s => s.value === v)?.label ?? v }
function typeLabel(v: string): string { return WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v }
function fmtLangDato(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${UKEDAG[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]} ${d.getFullYear()}`
}
function fmtKlokke(sek: number): string {
  const s = Math.max(0, Math.round(sek)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}
function fmtMmol(v: number): string { return v.toFixed(1).replace('.', ',') }
const SIKT: Record<string, string> = { god: 'god sikt', lett_taake: 'lett tåke', taake: 'tåke', tett_taake: 'tett tåke' }

const cap: React.CSSProperties = { fontFamily: FONT, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }
const tekst: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-3-app)' }
const tall: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums' }

/** Fem blinker m/ ett skudd hver: hvit = treff, mørk = bom, prikk = plottet posisjon. */
function Blinker({ s }: { s: OversiktSkyteserie }) {
  const antall = Math.max(1, Math.min(10, s.shots ?? 5))
  const treff = s.hits ?? null
  return (
    <span className="inline-flex items-center gap-1" data-blinker aria-label={treff != null ? `${treff} av ${antall} treff` : 'treff ikke ført'}>
      {Array.from({ length: antall }, (_, i) => {
        const p = s.shot_plot?.[i] ?? null
        // Uten plott: de første `treff` skuddene vises som treff (bare antallet er kjent).
        const erTreff = p ? Math.hypot(p.x - 0.5, p.y - 0.5) <= 0.5 : treff != null ? i < treff : null
        return (
          <span key={i} style={{
            position: 'relative', width: 16, height: 16, borderRadius: 999,
            background: erTreff === null ? 'transparent' : erTreff ? 'var(--tekst-1-app)' : 'var(--flate-12-alt)',
            border: `1.5px solid ${erTreff === null ? 'var(--line2)' : erTreff ? 'var(--tekst-1-app)' : 'var(--kant-6)'}`,
          }}>
            {p && <span style={{ position: 'absolute', width: 4, height: 4, borderRadius: 999, background: erTreff ? 'var(--card)' : '#E23A5A', left: `calc(${Math.round(p.x * 100)}% - 2px)`, top: `calc(${Math.round(p.y * 100)}% - 2px)` }} />}
          </span>
        )
      })}
    </span>
  )
}

function Vind({ s }: { s: OversiktSkyteserie }) {
  if (s.vind_styrke == null && !s.vind_retning) return <span style={{ color: 'var(--tekst-8-alt)' }}>—</span>
  const styrke = s.vind_styrke ?? 0
  if (styrke === 0) return <span style={tekst}>stille</span>
  return (
    <span className="inline-flex items-center gap-1" title={`Vind ${s.vind_retning === 'V' ? 'fra venstre' : 'fra høyre'} · styrke ${styrke}`}>
      <span style={{ ...tall, fontWeight: 700 }}>{s.vind_retning === 'V' ? '←' : '→'}</span>
      <span className="inline-flex items-end gap-[2px]">
        {[1, 2, 3, 4].map(n => <span key={n} style={{ width: 3, height: 5 + n * 2, borderRadius: 1, background: n <= styrke ? 'var(--tekst-1-app)' : 'var(--line2)' }} />)}
      </span>
    </span>
  )
}

export function HardoktPopupV2({ w, klokke, onClose }: { w: OversiktWorkoutCard; klokke: WorkoutKlokkesyncData | null; onClose: () => void }) {
  const harSki = useHarSkiskyting()
  const harKurve = !!(klokke?.samples && klokke.sport && (klokke.samples.hr_samples?.length ?? 0) > 1)
  const sone = w.primary_intensity_zone
  const soneSek = sone ? (w.zones[sone as keyof typeof w.zones] ?? 0) : 0
  const tss = Math.round(beregnSoneTss(w.zones))
  const celler: NokkeltallCelle[] = [
    { id: 'varighet', etikett: 'Varighet', verdi: w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : '—' },
    { id: 'km', etikett: 'Distanse', verdi: w.distance_km != null && w.distance_km > 0 ? w.distance_km.toFixed(1).replace('.', ',') : '—', hale: w.distance_km ? 'km' : undefined },
    { id: 'puls', etikett: 'Snittpuls', verdi: w.avg_heart_rate != null ? String(w.avg_heart_rate) : '—' },
    { id: 'maks', etikett: 'Makspuls', verdi: w.max_heart_rate != null ? String(w.max_heart_rate) : '—' },
    { id: 'sone', etikett: sone ? `${sone}-tid` : 'Hovedsone', verdi: soneSek > 0 ? String(Math.round(soneSek / 60)) : '—', hale: soneSek > 0 ? 'min' : undefined, farge: sone ? ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] : undefined },
    { id: 'tss', etikett: 'Belastning', verdi: tss > 0 ? String(tss) : '—', hale: 'TSS' },
  ]
  const blokker = useMemo(() => fraRaaRader(w.activities.map((a, i) => ({
    id: a.id ?? `${w.id}-${i}`, activity_type: a.activity_type, movement_name: a.movement_name, movement_subcategory: a.movement_subcategory ?? null,
    lap_notes: a.lap_notes ?? null, duration_seconds: a.duration_seconds, zones: a.zones ?? null, avg_heart_rate: a.avg_heart_rate ?? null,
    gruppe_id: a.gruppe_id ?? null, prone_shots: a.prone_shots ?? null, standing_shots: a.standing_shots ?? null, distance_meters: a.distance_meters,
  }))), [w])

  // Skyteseriene i rekkefølge: aktivitetens plassering i økta, så serienummer.
  const serier = useMemo(() => {
    const ut: Array<OversiktSkyteserie & { startSek: number | null; aktivitet: string }> = []
    for (const a of w.activities) {
      for (const s of a.serier ?? []) ut.push({ ...s, startSek: a.window_start_seconds ?? null, aktivitet: a.activity_type })
    }
    return ut.sort((x, y) => (x.startSek ?? 1e9) - (y.startSek ?? 1e9) || x.series_no - y.series_no)
  }, [w])
  const visSkyting = harSki && (serier.length > 0 || (w.shots != null && w.shots.shots > 0))
  const skytetider = serier.map(s => s.time_seconds).filter((t): t is number => t != null && t > 0)
  const snittSkytetid = skytetider.length > 0 ? Math.round(skytetider.reduce((a, b) => a + b, 0) / skytetider.length) : null
  const laps = klokke?.laps ?? []
  const lapFarge = (t: string | null | undefined) =>
    t === 'warmup' ? SEGMENT_FARGER.oppvarming : t === 'cooldown' ? SEGMENT_FARGER.nedjogg : t === 'rest' ? SEGMENT_FARGER.pause : t === 'skyting' ? SEGMENT_FARGER.pause : SEGMENT_FARGER.drag

  return (
    <KortPopup
      kicker="Siste hardøkt"
      tittel={w.title}
      undertittel={[fmtLangDato(w.date), sportLabel(w.sport), typeLabel(w.workout_type), sone ? `hovedsone ${sone}` : null].filter(Boolean).join(' · ')}
      videreHref={`/app/dagbok?edit=${w.id}`}
      videreTekst="Åpne i dagbok"
      onClose={onClose}
      bred
    >
      <div data-hardokt-popup>
        <div data-popup-graf={harKurve ? 'kurve' : 'blokker'}>
          {harKurve && klokke && klokke.samples && klokke.sport ? (
            <WorkoutDetailChart
              workoutId={w.id}
              sport={klokke.sport}
              samples={klokke.samples}
              laps={klokke.lapMarkers}
              lactate={klokke.lactate}
              nutrition={klokke.nutrition}
              shooting={harSki ? klokke.shooting : []}
              segmenter={klokke.segmenter}
              heartZones={klokke.heartZones}
              np={klokke.wattMetrikker?.np ?? null}
              ftp={klokke.ftp}
              sonerRader={klokke.sonerRader}
              rader={klokke.rader}
              tidspunktNotater={klokke.tidspunktNotater}
              height={280}
              tetthet="skjema"
              flate="oversikt"
            />
          ) : (
            <PlanGraf blokker={blokker} tetthet="full" hoyde={160} />
          )}
        </div>

        <div className="mt-3"><Nokkeltall celler={celler} /></div>

        <div className="xp-popup-to mt-4">
          <div>
            <PopupSeksjon tittel="Soner i økta">
              <ZoneBar zones={w.zones} />
            </PopupSeksjon>
            {laps.length > 0 && (
              <PopupSeksjon tittel="Runder">
                <div data-popup-runder style={{ display: 'grid', gridTemplateColumns: '14px 44px 1fr 56px 64px 44px 44px', gap: '4px 8px', alignItems: 'center' }}>
                  {['', '#', 'Tid', 'Km', 'Tempo', 'Snitt', 'Maks'].map((h, i) => <span key={i} style={cap}>{h}</span>)}
                  {laps.map((l, i) => {
                    const skyting = l.lap_type === 'skyting' || (l.prone_shots ?? 0) + (l.standing_shots ?? 0) > 0
                    const treff = (l.prone_hits ?? 0) + (l.standing_hits ?? 0), skudd = (l.prone_shots ?? 0) + (l.standing_shots ?? 0)
                    return (
                      <div key={l.id ?? i} style={{ display: 'contents' }} data-runde={l.index}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: lapFarge(l.lap_type), display: 'inline-block' }} />
                        <span style={tall}>{skyting && harSki ? '🎯' : ''} {l.index}</span>
                        <span style={tall}>{fmtKlokke(l.duration_seconds)}{skyting && harSki && skudd > 0 ? <span style={{ ...tekst, marginLeft: 6 }}>{treff}/{skudd}</span> : null}</span>
                        <span style={tall}>{l.distance_meters ? (l.distance_meters / 1000).toFixed(2).replace('.', ',') : '—'}</span>
                        <span style={tall}>{l.avg_speed_ms && l.avg_speed_ms > 0 ? formatMinPerKm(1000 / l.avg_speed_ms) : '—'}</span>
                        <span style={tall}>{l.avg_heart_rate ?? '—'}</span>
                        <span style={tall}>{l.max_hr ?? '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </PopupSeksjon>
            )}
          </div>
          <div>
            {visSkyting && (
              <PopupSeksjon tittel={`Skyting · ${w.shots?.hits ?? 0}/${w.shots?.recorded_shots ?? w.shots?.shots ?? 0}`}>
                <div className="flex gap-4 flex-wrap" data-popup-skyting>
                  <span style={tekst}><b style={{ color: COLOR_PRONE }}>Ligg</b> {w.shots?.prone.hits ?? 0}/{w.shots?.prone.recorded_shots ?? w.shots?.prone.shots ?? 0}</span>
                  <span style={tekst}><b style={{ color: COLOR_STANDING }}>Stå</b> {w.shots?.standing.hits ?? 0}/{w.shots?.standing.recorded_shots ?? w.shots?.standing.shots ?? 0}</span>
                  <span style={tekst}>Skytetid snitt <b style={{ color: 'var(--tekst-1-app)' }}>{snittSkytetid != null ? `${snittSkytetid} s` : '—'}</b></span>
                </div>
              </PopupSeksjon>
            )}
            {((klokke?.lactate.length ?? 0) > 0 || (klokke?.nutrition.length ?? 0) > 0 || w.lactate_mmol != null) && (
              <PopupSeksjon tittel="Laktat & ernæring">
                <div className="flex flex-col gap-1" data-popup-laktat-ernaering>
                  {(klokke?.lactate ?? []).map((l, i) => (
                    <span key={`l${i}`} style={tekst}><b style={{ color: LAKTAT }}>🩸 {fmtMmol(l.mmol)} mmol</b> ved {fmtKlokke(l.t)}</span>
                  ))}
                  {(klokke?.lactate.length ?? 0) === 0 && w.lactate_mmol != null && <span style={tekst}><b style={{ color: LAKTAT }}>🩸 {fmtMmol(w.lactate_mmol)} mmol</b> (høyeste)</span>}
                  {(klokke?.nutrition ?? []).map((n, i) => (
                    <span key={`n${i}`} style={tekst}><b style={{ color: ERNAERING }}>🍌 {n.carbs_g != null ? `${Math.round(n.carbs_g)} g karbo` : n.type}</b> ved {fmtKlokke(n.t)}{n.carbs_g != null && n.type ? ` · ${n.type}` : ''}</span>
                  ))}
                </div>
              </PopupSeksjon>
            )}
            <PopupSeksjon tittel="Opplevd">
              <div className="flex items-center gap-1" data-popup-opplevd={w.rpe ?? 'ikke-fort'}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <span key={n} style={{
                    width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: FONT, fontSize: 11, fontWeight: 700,
                    background: w.rpe === n ? 'var(--accent)' : 'var(--flate-12-alt)', color: w.rpe === n ? 'var(--tekst-1-ren)' : 'var(--tekst-8-alt)',
                  }}>{n}</span>
                ))}
                <span style={{ ...tekst, marginLeft: 6 }}>{w.rpe != null ? `${w.rpe}/10` : '— ikke ført'}</span>
              </div>
              {w.notes && <p style={{ ...tekst, whiteSpace: 'pre-wrap', marginTop: 8 }}>{w.notes}</p>}
            </PopupSeksjon>
            {w.activities.length > 0 && (
              <PopupSeksjon tittel="Aktiviteter">
                <div className="flex flex-col gap-1">
                  {w.activities.map((a, i) => (
                    <div key={a.id ?? i} className="flex items-center justify-between gap-3" style={{ ...tekst, padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                      <span style={{ color: 'var(--tekst-1-app)' }}>{a.movement_name || a.lap_notes || a.activity_type || 'Aktivitet'}</span>
                      <span>{a.duration_seconds ? fmtHM(a.duration_seconds) : '—'}{a.distance_meters ? ` · ${(a.distance_meters / 1000).toFixed(1).replace('.', ',')} km` : ''}</span>
                    </div>
                  ))}
                </div>
              </PopupSeksjon>
            )}
          </div>
        </div>

        {visSkyting && serier.length > 0 && (
          <PopupSeksjon tittel="Skyting per serie">
            <div className="xp-serier" data-popup-serier>
              {['#', 'Stilling', 'Skudd', 'Treff', 'Tid', 'Puls', 'Vind', 'Sikt · notat'].map((h, i) => (
                <span key={i} style={cap} className={i === 5 || i === 7 ? 'xp-serie-skjul' : undefined}>{h}</span>
              ))}
              {serier.map((s, i) => (
                <div key={s.id} style={{ display: 'contents' }} data-serie={s.series_no}>
                  <span style={tall}>{i + 1}</span>
                  <span className="inline-flex items-center gap-2">
                    <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 800, color: 'var(--tekst-1-ren)', background: s.position === 'S' ? COLOR_STANDING : COLOR_PRONE, borderRadius: 5, padding: '1px 7px' }}>{s.position}</span>
                    {s.startSek != null && <span style={tekst}>{fmtKlokke(s.startSek)}</span>}
                  </span>
                  <Blinker s={s} />
                  <span style={tall}>{s.hits != null ? `${s.hits}/${s.shots ?? 5}` : '—'}</span>
                  <span style={tall}>{s.time_seconds != null ? `${s.time_seconds} s` : '—'}</span>
                  <span style={tall} className="xp-serie-skjul">{s.avg_heart_rate ?? '—'}{s.max_heart_rate != null ? ` / ${s.max_heart_rate}` : ''}</span>
                  <Vind s={s} />
                  <span style={tekst} className="xp-serie-skjul">{[s.sikt ? SIKT[s.sikt] ?? s.sikt : null, s.note].filter(Boolean).join(' · ') || '—'}</span>
                </div>
              ))}
            </div>
            <p style={{ ...cap, marginTop: 8, textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>
              Hvit blink = treff · mørk = bom · prikk = plottet posisjon · pil = vind fra venstre/høyre, strekene er styrken · puls = inn / maks
            </p>
          </PopupSeksjon>
        )}
      </div>
    </KortPopup>
  )
}
