'use client'

// HJEM v2 bolk 2 — I DAG (m/ Neste økt). Fasit design/xpulse-hjem-kort-v2-design.html
// (kort 1 og 8): status-chip, tittel, metalinje, ØktGraf i kompakt modus
// (~110 px: kurve + blokker bak m/ klokkesynk, blokkgraf fra radene uten —
// aldri tom flate), 4 nøkkeltall, knapp. NESTE ØKT nederst m/ stiplet skille.
// Hviledag eller dagens del uten graf → de 2–3 neste planlagte i smått i
// stedet for én — kortet fyller høyden sin, aldri halvtomt.
//
// Samme komponenter som ellers (regel i notatet): WorkoutDetailChart /
// PlanGraf / Nokkeltall — ingen ny graf på Hjem. Skyting kun for skiskyttere.

import Link from 'next/link'
import { useMemo, useSyncExternalStore } from 'react'
import type { OversiktWorkoutCard, OversiktFeedEntry } from '@/app/actions/oversikt'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { WorkoutDetailChart, Nokkeltall, type NokkeltallCelle } from '@/components/workout/WorkoutDetailChart'
import { PlanGraf } from '@/components/workout/PlanGraf'
import { fraRaaRader } from '@/lib/plan-graf'
import { beregnSoneTss } from '@/lib/belastning'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'
import type { ExtendedZoneName } from '@/lib/heart-zones'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { fmtHM } from './kort-deler'

const FONT = "'Barlow Condensed', sans-serif"
const GRONN = '#28A86E'
const BLAA = '#1A6FD4'

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
function dagerTil(iso: string, todayISO: string): number {
  return Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayISO + 'T00:00:00').getTime()) / 86400000)
}
function naar(iso: string, todayISO: string): string {
  const n = dagerTil(iso, todayISO)
  return n <= 0 ? 'i dag' : n === 1 ? 'i morgen' : `om ${n} dager`
}
function bevForm(w: OversiktWorkoutCard): string | null {
  const first = w.activities.find(a => a.movement_name)
  return first?.movement_name ?? null
}
function hovedsone(w: OversiktWorkoutCard): ExtendedZoneName | null {
  return (w.primary_intensity_zone as ExtendedZoneName | null) ?? null
}

function SoneChip({ sone }: { sone: string | null }) {
  if (!sone) return null
  const farge = ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] ?? 'var(--mut)'
  return (
    <span data-sone-chip style={{
      fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
      color: farge, border: `1px solid ${farge}`, borderRadius: 999, padding: '1px 7px',
    }}>{sone}</span>
  )
}

function Chip({ farge, children, data }: { farge: string; children: React.ReactNode; data?: string }) {
  return (
    <span data-status-chip={data} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONT, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase', color: farge,
      background: `${farge}1f`, border: `1px solid ${farge}59`, borderRadius: 999, padding: '3px 9px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: farge }} />
      {children}
    </span>
  )
}

function Meta({ deler }: { deler: Array<React.ReactNode | null | false | ''> }) {
  const d = deler.filter(Boolean)
  return (
    <p className="flex items-center gap-x-2 gap-y-1 flex-wrap" style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', margin: '4px 0 0' }}>
      {d.map((x, i) => <span key={i} className="inline-flex items-center gap-2">{i > 0 && <span style={{ color: 'var(--tekst-8-alt)' }}>·</span>}{x}</span>)}
    </p>
  )
}

/** Blokkgraf fra radene (uten klokke) — aldri tom flate. */
function Blokkgraf({ w, hoyde, harSki = true }: { w: OversiktWorkoutCard; hoyde: number; harSki?: boolean }) {
  // Skyting kun for skiskyttere: skyterader ut av blokkgrafen uten skiskyting.
  const blokker = useMemo(() => fraRaaRader(w.activities.filter(a => harSki || !a.activity_type.startsWith('skyting')).map((a, i) => ({
    id: `${w.id}-${i}`, activity_type: a.activity_type, movement_name: a.movement_name, movement_subcategory: a.movement_subcategory ?? null,
    lap_notes: a.lap_notes ?? null, duration_seconds: a.duration_seconds, zones: a.zones ?? null, avg_heart_rate: a.avg_heart_rate ?? null,
    gruppe_id: a.gruppe_id ?? null, prone_shots: a.prone_shots ?? null, standing_shots: a.standing_shots ?? null, distance_meters: a.distance_meters,
  }))), [w, harSki])
  if (blokker.every(b => b.sek <= 0)) return null
  return <div data-idag-blokkgraf><PlanGraf blokker={blokker} tetthet="kompakt" hoyde={hoyde} /></div>
}

function NesteOektLinje({ w, todayISO, liten = false, harSki = true }: { w: OversiktWorkoutCard; todayISO: string; liten?: boolean; harSki?: boolean }) {
  const bev = bevForm(w)
  return (
    <Link href={`/app/plan?edit=${w.id}`} data-neste-okt={w.id} className="flex items-center gap-3 no-underline"
      style={{ textDecoration: 'none', color: 'inherit', padding: liten ? '5px 0' : '6px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: BLAA, margin: 0 }}>
          {naar(w.date, todayISO)} · {fmtDato(w.date)}{w.time_of_day ? ` · ${w.time_of_day.slice(0, 5)}` : ''}
        </p>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: liten ? 17 : 20, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', margin: '1px 0 0', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {w.title}
        </p>
        <Meta deler={[bev, w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : null, <SoneChip key="s" sone={w.primary_intensity_zone} />]} />
      </div>
      {!liten && w.activities.length > 0 && (
        <div style={{ width: 120, flexShrink: 0 }}><Blokkgraf w={w} hoyde={34} harSki={harSki} /></div>
      )}
    </Link>
  )
}

export function IDagKort({ today, nextPlanned, klokke, siste, todayISO }: {
  today: OversiktWorkoutCard[]
  nextPlanned: OversiktWorkoutCard[]
  klokke: WorkoutKlokkesyncData | null
  /** Forrige gjennomførte økt — hviledagens ene linje. */
  siste: OversiktFeedEntry | null
  todayISO: string
}) {
  const harSki = useHarSkiskyting()
  // Hydrering: ØktGraf leser husket visning (localStorage) — tegnes først på klienten,
  // server-HTML-en får en flate med samme høyde. Ingen setState i effekt.
  const montert = useSyncExternalStore(() => () => {}, () => true, () => false)
  const gjennomfort = today.find(w => w.is_completed || !w.is_planned) ?? null
  const planlagt = today.find(w => w.is_planned && !w.is_completed) ?? null
  const hoved = gjennomfort ?? planlagt
  const flere = Math.max(0, today.length - 1)
  const erGjennomfort = !!hoved && (hoved.is_completed || !hoved.is_planned)
  const harKurve = !!(hoved && klokke?.samples && klokke.sport && (klokke.samples.hr_samples?.length ?? 0) > 1)
  const sone = hoved ? hovedsone(hoved) : null
  const soneSek = hoved && sone ? hoved.zones[sone as keyof typeof hoved.zones] ?? 0 : 0
  const harGraf = !!hoved && (harKurve || hoved.activities.some(a => (a.duration_seconds ?? 0) > 0))
  // Neste økt = første planlagte etter dagens (eller neste i dag når dagens er ført).
  const neste = nextPlanned[0] ?? null
  const lite = !hoved || !harGraf   // hviledag / økt uten graf → flere neste i smått

  const celler: NokkeltallCelle[] = hoved ? (erGjennomfort ? [
    { id: 'puls', etikett: 'Snittpuls', verdi: hoved.avg_heart_rate != null ? String(hoved.avg_heart_rate) : '—', hale: hoved.avg_heart_rate != null ? 'slag' : undefined },
    { id: 'sone', etikett: sone ? `${sone}-tid` : 'Hovedsone', verdi: soneSek > 0 ? String(Math.round(soneSek / 60)) : '—', hale: soneSek > 0 ? 'min' : undefined, farge: sone ? ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] : undefined },
    { id: 'tss', etikett: 'Belastning', verdi: (() => { const t = Math.round(beregnSoneTss(hoved.zones)); return t > 0 ? String(t) : '—' })(), hale: 'TSS' },
    { id: 'rpe', etikett: 'Opplevd', verdi: hoved.rpe != null ? String(hoved.rpe) : '—', hale: '/10' },
  ] : [
    { id: 'forventet', etikett: 'Forventet', verdi: hoved.forventet_belastning != null ? String(hoved.forventet_belastning) : '—', hale: hoved.forventet_belastning != null ? '/10' : undefined },
    { id: 'sone', etikett: sone ? `${sone}-tid` : 'Hovedsone', verdi: soneSek > 0 ? String(Math.round(soneSek / 60)) : '—', hale: soneSek > 0 ? 'min' : undefined, farge: sone ? ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] : undefined },
    ...(harSki ? [{ id: 'skyting', etikett: 'Skyting', verdi: hoved.shots && hoved.shots.shots > 0 ? String(hoved.shots.shots) : '—', hale: hoved.shots && hoved.shots.shots > 0 ? 'skudd' : undefined }] : []),
    { id: 'varighet', etikett: 'Varighet', verdi: hoved.effective_duration_minutes != null ? fmtHM(hoved.effective_duration_minutes * 60) : '—' },
  ]) : []

  return (
    <section className="p-5 h-full flex flex-col" data-idag-kort data-tilstand={!hoved ? 'hviledag' : erGjennomfort ? 'gjennomfort' : 'planlagt'}
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, minWidth: 0 }}>
      <div className="xp-kh green" style={{ marginBottom: 8 }}>
        <span className="xp-beam" />
        <h2 className="xp-kh-t">I dag</h2>
        <span className="xp-kh-tag">{fmtDato(todayISO)}</span>
      </div>

      {hoved ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {erGjennomfort
              ? <Chip farge={GRONN} data="gjennomfort">Gjennomført</Chip>
              : <Chip farge={BLAA} data="planlagt">Planlagt{hoved.time_of_day ? ` · ${hoved.time_of_day.slice(0, 5)}` : ''}</Chip>}
            {flere > 0 && (
              <Link href="/app/dagbok" data-flere-okter style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)', textDecoration: 'underline' }}>
                +{flere} økt{flere > 1 ? 'er' : ''} til
              </Link>
            )}
          </div>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: '0.03em', lineHeight: 1.05, color: 'var(--tekst-1-app)', margin: '8px 0 0' }}>
            {hoved.title}
          </h3>
          <Meta deler={[
            sportLabel(hoved.sport), typeLabel(hoved.workout_type),
            hoved.effective_duration_minutes != null ? fmtHM(hoved.effective_duration_minutes * 60) : null,
            <SoneChip key="s" sone={hoved.primary_intensity_zone} />,
            hoved.distance_km != null && hoved.distance_km > 0 ? `${hoved.distance_km.toFixed(1).replace('.', ',')} km` : null,
            harKurve ? <span key="k" data-klokke-chip style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', border: '1px solid var(--line2)', borderRadius: 999, padding: '1px 7px' }}>⌚ klokkesynk</span> : null,
          ]} />

          <div className="mt-3" data-idag-graf={harKurve ? 'kurve' : harGraf ? 'blokker' : 'ingen'}>
            {harKurve && klokke && klokke.samples && klokke.sport ? (montert ? (
              <WorkoutDetailChart
                workoutId={hoved.id}
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
                height={110}
                tetthet="skjema"
                flate="oversikt"
                kontroller="visning"
                punktStil="ikon"
              />
            ) : <div style={{ height: 150 }} aria-hidden />) : harGraf ? (
              <Blokkgraf w={hoved} hoyde={100} harSki={harSki} />
            ) : null}
          </div>

          {celler.length > 0 && <div className="mt-3"><Nokkeltall celler={celler} /></div>}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {erGjennomfort ? (
              <Link href={`/app/dagbok?edit=${hoved.id}`} className="xp-hbtn xp-hbtn-outline" data-idag-knapp="dagbok" style={{ color: GRONN }}>Åpne i dagbok</Link>
            ) : (
              <>
                <Link href={`/app/dagbok?edit=${hoved.id}`} className="xp-hbtn" data-idag-knapp="logg" style={{ backgroundColor: BLAA, color: 'var(--tekst-1-ren)' }}>Logg økta</Link>
                <Link href={`/app/plan?edit=${hoved.id}`} className="xp-hbtn xp-hbtn-outline" data-idag-knapp="plan" style={{ color: BLAA }}>Åpne i plan</Link>
              </>
            )}
          </div>
        </>
      ) : (
        <div data-hviledag>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', margin: '4px 0 0' }}>
            Ingen økt i dag — hviledag.
          </p>
          {siste && (
            <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', margin: '6px 0 0' }}>
              Forrige økt: <Link href={`/app/dagbok?edit=${siste.id}`} style={{ color: 'var(--tekst-1-app)' }}>{siste.title}</Link>
              {' · '}{fmtDato(siste.date)}{siste.duration_minutes != null ? ` · ${fmtHM(siste.duration_minutes * 60)}` : ''}
            </p>
          )}
        </div>
      )}

      {/* NESTE ØKT — alltid nederst, stiplet skille. Lite innhold over →
          de 2–3 neste i smått, så kortet fyller høyden. */}
      <div className="mt-auto" style={{ paddingTop: 12 }}>
        <div style={{ borderTop: '1px dashed var(--line2)', paddingTop: 10 }} data-neste-okter={lite ? 'flere' : 'en'}>
          <p style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', margin: 0 }}>
            {lite && nextPlanned.length > 1 ? 'Neste økter' : 'Neste økt'}
          </p>
          {nextPlanned.length === 0 ? (
            <p style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-5-app)', margin: '4px 0 0' }}>
              Ingen planlagt økt framover. <Link href={`/app/plan?new=${todayISO}`} style={{ color: BLAA }}>+ Planlegg økt</Link>
            </p>
          ) : lite ? (
            nextPlanned.slice(0, 3).map(w => <NesteOektLinje key={w.id} w={w} todayISO={todayISO} liten harSki={harSki} />)
          ) : neste ? (
            <NesteOektLinje w={neste} todayISO={todayISO} harSki={harSki} />
          ) : null}
        </div>
      </div>
    </section>
  )
}
