'use client'

// HJEM v2 bolk 3 — SISTE HARDØKT. Fasit design/xpulse-hjem-kort-v2-design.html
// (kort 5): tittel + klokkemerke-chip, metalinje, hele ØktGraf ~190 px
// (kurve + blokker + 🩸🍌🎯-piller m/ pekelinje + segmentbånd + klammer),
// 6 nøkkeltall (varighet · snittpuls · makspuls · hovedsone-tid · belastning ·
// laktat maks — byttes med opplevd når laktat ikke er ført), piller, fot
// «Se detaljer» · «Vis mer ↗» (popup, bolk 4). Uten klokke: blokkgraf
// ~110 px + 4 nøkkeltall + «— puls ikke ført» dempet.
// Samme regel for «hardøkt» som før (server: HARD_WORKOUT_TYPES / ≥ 15 min I3+).

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import type { OversiktWorkoutCard } from '@/app/actions/oversikt'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { WorkoutDetailChart, Nokkeltall, type NokkeltallCelle } from '@/components/workout/WorkoutDetailChart'
import { PlanGraf } from '@/components/workout/PlanGraf'
import { fraRaaRader } from '@/lib/plan-graf'
import { beregnSoneTss } from '@/lib/belastning'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { fmtHM, KortFot, VisMer, COLOR_PRONE, COLOR_STANDING } from './kort-deler'
import { HardoktPopupV2 } from './HardoktPopupV2'

const FONT = "'Barlow Condensed', sans-serif"
const ROED = '#E11D48'
const LAKTAT = '#E8B93C'
const ERNAERING = '#28A86E'

function sportLabel(v: string): string { return SPORTS.find(s => s.value === v)?.label ?? v }
function typeLabel(v: string): string { return WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v }
// Deterministisk (ingen Intl): kortet er klient-rendret, og server/nettleser
// formaterer «nb-NO» ulikt → hydreringsfeil. Egne tabeller i stedet.
const UKEDAG = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
function fmtDato(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${UKEDAG[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]}`
}
function fmtMmol(v: number): string { return v.toFixed(1).replace('.', ',') }

function Pille({ farge, children, data }: { farge: string; children: React.ReactNode; data: string }) {
  return (
    <span data-hardokt-pille={data} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT, fontSize: 12, fontWeight: 700,
      color: farge, border: `1px solid ${farge}66`, background: `${farge}14`, borderRadius: 999, padding: '2px 9px',
    }}>{children}</span>
  )
}

function SoneChip({ sone }: { sone: string | null }) {
  if (!sone) return null
  const farge = ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] ?? 'var(--mut)'
  return (
    <span style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: farge, border: `1px solid ${farge}`, borderRadius: 999, padding: '1px 7px' }}>{sone}</span>
  )
}

function Blokkgraf({ w, hoyde, harSki = true }: { w: OversiktWorkoutCard; hoyde: number; harSki?: boolean }) {
  // Skyting kun for skiskyttere: skyterader ut av blokkgrafen uten skiskyting.
  const blokker = useMemo(() => fraRaaRader(w.activities.filter(a => harSki || !a.activity_type.startsWith('skyting')).map((a, i) => ({
    id: `${w.id}-${i}`, activity_type: a.activity_type, movement_name: a.movement_name, movement_subcategory: a.movement_subcategory ?? null,
    lap_notes: a.lap_notes ?? null, duration_seconds: a.duration_seconds, zones: a.zones ?? null, avg_heart_rate: a.avg_heart_rate ?? null,
    gruppe_id: a.gruppe_id ?? null, prone_shots: a.prone_shots ?? null, standing_shots: a.standing_shots ?? null, distance_meters: a.distance_meters,
  }))), [w, harSki])
  if (blokker.every(b => b.sek <= 0)) return null
  return <div data-hardokt-blokkgraf><PlanGraf blokker={blokker} tetthet="full" hoyde={hoyde} /></div>
}

export function SisteHardoktKort({ w, klokke }: { w: OversiktWorkoutCard | null; klokke: WorkoutKlokkesyncData | null }) {
  const harSki = useHarSkiskyting()
  const [apen, setApen] = useState(false)
  // Hydrering: ØktGraf leser husket visning (localStorage) — tegnes først på klienten.
  const montert = useSyncExternalStore(() => () => {}, () => true, () => false)
  if (!w) {
    return (
      <section className="p-5 h-full flex flex-col" data-hardokt-kort data-tilstand="ingen"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, minWidth: 0 }}>
        <div className="xp-kh red"><span className="xp-beam" /><h2 className="xp-kh-t">Siste hardøkt</h2></div>
        <p className="xp-key-h3">Ingen registrert</p>
        <p className="xp-key-p">Ingen økt i I3 eller høyere er ført ennå.</p>
      </section>
    )
  }
  const harKurve = !!(klokke?.samples && klokke.sport && (klokke.samples.hr_samples?.length ?? 0) > 1)
  const sone = w.primary_intensity_zone
  const soneSek = sone ? (w.zones[sone as keyof typeof w.zones] ?? 0) : 0
  const tss = Math.round(beregnSoneTss(w.zones))
  const laktatVerdier = (klokke?.lactate ?? []).map(l => l.mmol).filter(v => Number.isFinite(v))
  const laktatMaks = w.lactate_mmol ?? (laktatVerdier.length > 0 ? Math.max(...laktatVerdier) : null)
  const karbo = (klokke?.nutrition ?? []).reduce((s, n) => s + (n.carbs_g ?? 0), 0)
  const soneCelle: NokkeltallCelle = { id: 'sone', etikett: sone ? `${sone}-tid` : 'Hovedsone', verdi: soneSek > 0 ? String(Math.round(soneSek / 60)) : '—', hale: soneSek > 0 ? 'min' : undefined, farge: sone ? ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] : undefined }
  const celler: NokkeltallCelle[] = harKurve ? [
    { id: 'varighet', etikett: 'Varighet', verdi: w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : '—' },
    { id: 'puls', etikett: 'Snittpuls', verdi: w.avg_heart_rate != null ? String(w.avg_heart_rate) : '—' },
    { id: 'maks', etikett: 'Makspuls', verdi: w.max_heart_rate != null ? String(w.max_heart_rate) : '—' },
    soneCelle,
    { id: 'tss', etikett: 'Belastning', verdi: tss > 0 ? String(tss) : '—', hale: 'TSS' },
    laktatMaks != null
      ? { id: 'laktat', etikett: 'Laktat', verdi: fmtMmol(laktatMaks), hale: 'maks', farge: LAKTAT }
      : { id: 'rpe', etikett: 'Opplevd', verdi: w.rpe != null ? String(w.rpe) : '—', hale: '/10' },
  ] : [
    { id: 'varighet', etikett: 'Varighet', verdi: w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : '—' },
    soneCelle,
    { id: 'tss', etikett: 'Belastning', verdi: tss > 0 ? String(tss) : '—', hale: 'TSS' },
    { id: 'rpe', etikett: 'Opplevd', verdi: w.rpe != null ? String(w.rpe) : '—', hale: '/10' },
  ]
  const ligg = w.shots?.prone ?? null, staa = w.shots?.standing ?? null

  return (
    <section className="p-5 h-full flex flex-col" data-hardokt-kort data-tilstand={harKurve ? 'kurve' : 'blokker'}
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, minWidth: 0 }}>
      <div className="xp-kh red" style={{ marginBottom: 8 }}>
        <span className="xp-beam" />
        <h2 className="xp-kh-t">Siste hardøkt</h2>
        <span className="xp-kh-tag">{fmtDato(w.date)}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: '0.03em', lineHeight: 1.05, color: 'var(--tekst-1-app)', margin: 0 }}>{w.title}</h3>
        {harKurve && <span data-klokke-chip style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', border: '1px solid var(--line2)', borderRadius: 999, padding: '1px 7px' }}>⌚ klokkesynk</span>}
      </div>
      <p className="flex items-center gap-x-2 gap-y-1 flex-wrap" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', margin: '4px 0 0' }}>
        <span>{sportLabel(w.sport)}</span><span style={{ color: 'var(--tekst-8-alt)' }}>·</span>
        <span>{typeLabel(w.workout_type)}</span>
        {w.activities.find(a => a.movement_name)?.movement_name && <><span style={{ color: 'var(--tekst-8-alt)' }}>·</span><span>{w.activities.find(a => a.movement_name)?.movement_name}</span></>}
        {sone && <><span style={{ color: 'var(--tekst-8-alt)' }}>·</span><SoneChip sone={sone} /></>}
        {!harKurve && <><span style={{ color: 'var(--tekst-8-alt)' }}>·</span><span data-puls-ikke-fort style={{ color: 'var(--tekst-8-alt)' }}>— puls ikke ført</span></>}
      </p>

      <div className="mt-3" data-hardokt-graf={harKurve ? 'kurve' : 'blokker'}>
        {harKurve && klokke && klokke.samples && klokke.sport ? (montert ? (
          <WorkoutDetailChart
            workoutId={w.id}
            sport={klokke.sport}
            samples={klokke.samples}
            laps={klokke.lapMarkers}
            lactate={klokke.lactate}
            nutrition={klokke.nutrition}
            shooting={harSki ? klokke.shooting : []}
            segmenter={harSki ? klokke.segmenter : klokke.segmenter.filter(sg => !sg.type.startsWith('skyting'))}
            heartZones={klokke.heartZones}
            np={klokke.wattMetrikker?.np ?? null}
            ftp={klokke.ftp}
            sonerRader={klokke.sonerRader}
            rader={klokke.rader}
            tidspunktNotater={klokke.tidspunktNotater}
            height={190}
            tetthet="skjema"
            flate="oversikt"
            kontroller="visning"
          />
        ) : <div style={{ height: 230 }} aria-hidden />) : (
          <Blokkgraf w={w} hoyde={110} harSki={harSki} />
        )}
      </div>

      <div className="mt-3"><Nokkeltall celler={celler} /></div>

      <div className="mt-3 flex items-center gap-2 flex-wrap" data-hardokt-piller>
        {laktatVerdier.length > 0 && <Pille farge={LAKTAT} data="laktat">🩸 {laktatVerdier.map(fmtMmol).join(' · ')}</Pille>}
        {laktatVerdier.length === 0 && w.lactate_mmol != null && <Pille farge={LAKTAT} data="laktat">🩸 {fmtMmol(w.lactate_mmol)}</Pille>}
        {karbo > 0 && <Pille farge={ERNAERING} data="ernaering">🍌 {Math.round(karbo)} g karbo</Pille>}
        {harSki && ligg && ligg.shots > 0 && <Pille farge={COLOR_PRONE} data="ligg">🎯 L {ligg.hits}/{ligg.shots}</Pille>}
        {harSki && staa && staa.shots > 0 && <Pille farge={COLOR_STANDING} data="staa">🎯 S {staa.hits}/{staa.shots}</Pille>}
        {w.rpe != null && <Pille farge="var(--tekst-5-app)" data="opplevd">Opplevd {w.rpe}/10</Pille>}
      </div>

      <div className="mt-auto">
        <KortFot>
          <Link href={`/app/dagbok?edit=${w.id}`} data-hardokt-detaljer
            style={{ fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ROED, textDecoration: 'none' }}>
            Se detaljer
          </Link>
          <VisMer onClick={() => setApen(true)} />
        </KortFot>
      </div>
      {apen && <HardoktPopupV2 w={w} klokke={klokke} onClose={() => setApen(false)} />}
    </section>
  )
}
