'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SerieListe } from './SerieListe'
import { PunktEtiketter } from './WorkoutDetailChart'
import type { Segment } from '@/lib/segmenter'
import { shootingSummary } from '@/lib/shooting'
import { createPortal } from 'react-dom'
import {
  SEGMENT_FARGER, PUNKT_FARGER, segmentBakgrunn, segmentTypeFor, fmtKlokkeSek, pulsIVindu, fmtVarighetKort,
} from '@/lib/segmenter'
import {
  plasserRader, kuttRad, radVed, naboEtter, slaaSammenMedNeste, settRadStart, settRadVarighet,
  slettRad, typerForRad, etikettFor, klokkeslettTilSek, sekTilKlokkeslett,
  leggInnBygg, flyttKjedeTil, snappTilKlokkerunder, overKurven, type Utkast, KURVE_TOLERANSE_SEK, MIN_RAD_SEK, radVarighetSek } from '@/lib/oktbygger-rader'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import { parseActivityDuration } from '@/lib/activity-duration'
import { OktKurve, type KurveSerie, type KurveHjelpere } from './OktKurve'
import { BlokkLerret } from './BlokkLerret'
import { RundeValg } from './RundeValg'
import { PlanSpokelse, VisPlanBryter } from './PlanSpokelse'
import { hentPlanensRunder, hentPlanensPunkter, sikreKlokkerundeBackup, hentKlokkerunder, type PlanBlokk, type Klokkerunde } from '@/app/actions/runder'
import { nyttTidspunktNotat, type TidspunktNotat, type PunktType } from '@/lib/tidspunkt-notater'
import { nyAktivitetsrad } from '@/lib/aktivitetsrad'
import { emptyNutritionEntryRow } from '@/lib/types'
import { verdiVed } from './OktKurve'
import { PUNKT_SLAG, PunktMerke, PunktKnapp, type PunktSlag } from './Punkt'
import { visPlanBak, settVisPlanBak, abonnerVisPlan } from '@/lib/vis-plan'
import { lesVisning, settVisning, abonnerVisning, VISNING_ETIKETT, type GrafVisning } from '@/lib/kurve-valg'
import { byggPlanBlokker, fraActivityRows, type PlanBlokkInn } from '@/lib/plan-graf'
import { tilSpokelser, snittVindu, soneSekFraPuls } from '@/lib/gjennomfort-kart'
import { resolveSoner, type SoneDbRad } from '@/lib/terskel-oppslag'
import { PlanGraf } from './PlanGraf'
import { fraTidspunktNotater } from './Punkt'
import { ByggSum } from './ByggSum'
import { lagreVindu, hentVindu } from '@/lib/kurve-zoom'
import { PAUSE_TYPER, type ActivityRow, type ActivityType, type LactateRow, type NutritionEntryRow, type ShootingSeriesRow, type Sport } from '@/lib/types'
import type { HeartZone } from '@/lib/heart-zones'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { IntervallBygger } from './IntervallBygger'
import { PlottTreffPopup } from './PlottTreff'

// ØKTBYGGEREN — omlegging v6. RADENE ER EDITOREN.
//
// Byggeren arbeider på SKJEMAETS egne aktivitetsrader (bolk 3): alt den
// gjør — kutt, grenser som tall, del/slå sammen, type, navn — skriver
// radene i skjemaet, og grafen i oppsummeringskortet tegner de samme
// radene i samme øyeblikk. Ingen egen lagring: økta lagres som vanlig.
//   · HURTIGOPPSETTET (antall × dragtid × sone / pause) — uendret,
//     lib/intervall-generator som før.
//   · KUTT: klikk på kurven i kutt-modus = kuttpunkt; raden som dekker
//     tidspunktet deles i to, begge får start/varighet, samme type og
//     bevegelsesform. Klokkerunder er ferdige kutt.
//   · TALL I RADEN: start/varighet skrivbare — flytter grensen mot naboen,
//     aldri hull, aldri overlapp. Samme grense som skjemaets varighetsfelt.
//   · «Del her» / «Slå sammen med neste» / Slett / type / navn i raden.
//   · ANGRE steg for steg. Ulagrede endringer: skjemaets eget vern.
//
// Pulsen LESES fra vinduet, arves aldri: kutt og grenseflytting tømmer
// ført snitt/maks på de berørte radene, visningen leser det målte, og
// lagringen skriver det på nytt fra samples i full oppløsning.

export function OktbyggerInngang({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        color: 'var(--accent)', background: 'rgba(255,69,0,.08)',
        border: '1px solid var(--accent)', borderRadius: 999,
        padding: '6px 14px', cursor: 'pointer', minHeight: 32,
      }}>
      ⚡ Øktbygger
    </button>
  )
}

export function OktbyggerPopup({
  workoutId, sport, rader, onRader, klokke, erPlanlagt, heartZones, rpe, timeOfDay,
  laktat, onLaktat, ernaering, onErnaering, punkter, onPunkter, onRaderFraBasen,
  onClose, onSerierLagret, onOpprett, onByggTittel, onBolkTittel,
}: {
  /** null = økta er ikke lagret ennå: klokkeverktøyene finnes ikke, bare hurtigoppsettet. */
  workoutId: string | null
  sport?: Sport
  /** Skjemaets rader — byggerens eneste sannhet. */
  rader: ActivityRow[]
  onRader: (rader: ActivityRow[]) => void
  /** Klokkedataene skjemaet alt har hentet (samples, totalSek, radinfo). */
  klokke: WorkoutKlokkesyncData | null
  erPlanlagt: boolean
  heartZones: HeartZone[]
  rpe: number | null
  timeOfDay: string
  laktat: LactateRow[]
  onLaktat: (l: LactateRow[]) => void
  ernaering: NutritionEntryRow[]
  onErnaering: (n: NutritionEntryRow[]) => void
  /** Punktene (bolk 8): planlagte laktat/ernæring/notat og dagbokas notater
      — workouts.tidspunkt_notater, eid av skjemaet. */
  punkter: TidspunktNotat[]
  onPunkter: (p: TidspunktNotat[]) => void
  /** Rundebyttet skriver til basen — skjemaet henter radene inn på nytt. */
  onRaderFraBasen: () => Promise<void>
  onClose: () => void
  /** Videresendes fra «Plott treff» når serier lagres derfra. */
  onSerierLagret?: (lagret: Array<{ activityId: string; serier: ShootingSeriesRow[] }>) => void
  /** Hurtigoppsettet leverer genererte rader + forslags-tittel. */
  onOpprett?: (rader: ActivityRow[], tittel: string) => void | Promise<void>
  /** Bygg PÅ kurven (3b): tittelen foreslås, radene legges inn her. */
  onByggTittel?: (tittel: string) => void
  /** «+ Legg til bolk» (Sverre 5. sep): ny bolk lagt UNDER radene — tittelen
      blir «intervall 1 + intervall 2». */
  onBolkTittel?: (tittel: string) => void
}) {
  const harKurve = !!klokke?.samples && Object.values(klokke.samples).some(v => v && (v as unknown[]).length > 0)
  const grunnlag = useMemo(() => ({
    totalSek: klokke?.totalSek ?? 0, harKurve, radInfo: klokke?.radInfo ?? {},
  }), [klokke, harKurve])
  const plassering = useMemo(() => plasserRader(rader, grunnlag), [rader, grunnlag])
  const totalSek = harKurve
    ? grunnlag.totalSek
    : plassering.reduce((m, u) => Math.max(m, u.startSek + u.varighetSek), 0)

  const [planBlokker, setPlanBlokker] = useState<PlanBlokk[]>([])
  const visPlan = useSyncExternalStore(abonnerVisPlan, () => visPlanBak(workoutId), () => true)
  // Samme visning som øktsiden (GRAF · KURVER · BEGGE), husket per bruker.
  const visningHusket = useSyncExternalStore(abonnerVisning, () => lesVisning('bygger'), () => 'begge' as GrafVisning)
  const visning: GrafVisning = harKurve ? visningHusket : 'graf'
  const [valgtRad, setValgtRad] = useState<string | null>(null)
  const [kuttModus, setKuttModus] = useState(false)
  // PUNKT-MODUS (bolk 8): klikk på kurven setter et punkt. I plan velges
  // typen (laktat/ernæring/notat) — alle planlagte. I dagboka er det notat
  // (ført laktat og ernæring har egne rader og får bare et tidspunkt).
  const [punktModus, setPunktModus] = useState(false)
  // Punkt-typene (Sverre 4. sep): laktat, ernæring, skyting og notat kan
  // settes på grafen i BEGGE moduser. I dagboka lager laktat/ernæring/
  // skyting ekte rader (måling, inntak, skyterad) — samme rader som
  // skjemaet fører — så det går begge veier. I plan blir laktat/ernæring/
  // notat planlagte punkter og skyting en planlagt skyterad.
  const [punktType, setPunktType] = useState<PunktType | 'skyting_ligg' | 'skyting_staa'>(erPlanlagt ? 'laktat' : 'notat')
  // BOLK 23 (Sverre 5. sep): det VALGTE punktet får utfyllingsfeltene rett
  // under grafen/verktøylinja — ikke nederst under alle radene.
  const [valgtPunkt, setValgtPunkt] = useState<{ slag: 'notat' | 'laktat' | 'ernaering' | 'skyting'; id: string } | null>(null)
  const [planPunkter, setPlanPunkter] = useState<TidspunktNotat[]>([])
  // MATCH (3b): «start her» venter på et klikk på kurven for valgt rad.
  const [startHerModus, setStartHerModus] = useState(false)
  const [klokkerunder, setKlokkerunder] = useState<Klokkerunde[] | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  const [visPlottTreff, setVisPlottTreff] = useState(false)
  // Rettelse 3 (3. sep): hurtigoppsettet er FØRSTE seksjon og står ÅPENT —
  // i plan og dagbok, med og uten kurve. Det lå her før også, men
  // sammenslått bak en pil så snart økta hadde rader, og ble ikke funnet.
  // Sverre 5. sep: hurtigoppsettet står SKJULT (pila ▾ henter det ned igjen)
  // når man åpner en dagbok-økt som alt er ført eller kommer fra klokkesynk.
  // På en tom økt og alltid i plan står det åpent som første seksjon.
  // Avgjøres ved åpning — etter «Opprett» skal ferdig-linja bli stående.
  const [hurtigAapent, setHurtigAapent] = useState(() => erPlanlagt || rader.length === 0)
  const [kurve, setKurve] = useState<'puls' | 'fart' | 'watt'>(() =>
    klokke?.samples?.hr_samples?.length ? 'puls' : (klokke?.samples?.pace_samples ?? klokke?.samples?.speed_samples)?.length ? 'fart' : 'watt')
  // ANGRE: forrige radsett, steg for steg. Lever i byggeren til den lukkes.
  const [angreStabel, setAngreStabel] = useState<ActivityRow[][]>([])
  // Rettelse 6: før FØRSTE endring av radene på en klokkeøkt tas klokkas
  // runder vare på (runde_backup) — rundetabellen leser derfra og viser
  // alltid originalen, uansett kutt, slå sammen eller flytting. Idempotent.
  // Ikke betinget av at kurven er lastet: byggeren kan åpne før klokkedataene
  // kommer, og serveren tar uansett bare kopi når økta HAR klokkerunder.
  const kopiSikret = useRef(false)
  const sikreKopi = () => {
    if (!workoutId || kopiSikret.current) return
    kopiSikret.current = true
    void sikreKlokkerundeBackup(workoutId)
  }
  const endre = (neste: ActivityRow[]) => {
    sikreKopi()
    setAngreStabel(st => [...st.slice(-49), rader])
    onRader(neste)
  }
  const angre = () => {
    const forrige = angreStabel[angreStabel.length - 1]
    if (!forrige) return
    setAngreStabel(st => st.slice(0, -1))
    onRader(forrige)
  }

  useEffect(() => {
    if (!workoutId) return
    let avbrutt = false
    hentPlanensRunder(workoutId).then(b => { if (!avbrutt) setPlanBlokker(b) }).catch(() => {})
    hentPlanensPunkter(workoutId).then(p => { if (!avbrutt) setPlanPunkter(p) }).catch(() => {})
    hentKlokkerunder(workoutId).then(r => { if (!avbrutt) setKlokkerunder(r) }).catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId])

  const userHasBiathlon = sport === 'biathlon' || rader.some(r => r.activity_type.startsWith('skyting'))
  const skytingRader = rader.filter(r => r.activity_type.startsWith('skyting'))
  const hr = useMemo(() => (klokke?.samples?.hr_samples ?? []).map(p => ({ t: p.t, hr: p.hr })), [klokke])
  // Bolk 22 (Sverre 5. sep): «Legg skyting på puls» — en bestemt UPLASSERT
  // skyterad velges fra lista og plasseres med klikk på kurven eller tid
  // (mm:ss). Bare synlig når økta har skytinger som ikke ligger på kurven.
  const [leggSkyting, setLeggSkyting] = useState<{ aapen: boolean; radId: string | null; tid: string }>({ aapen: false, radId: null, tid: '' })
  // Sverre 5. sep («finner ikke knapp for å legge eksisterende skyting inn i
  // pulskurven»): kjeden gir ALLE rader vindu etter første endring, så
  // «uplassert» fantes nesten aldri. Lista viser nå alle skyterader — med
  // tida de står på — og plassering flytter raden dit man klikker/skriver.
  const uplasserteSkytinger = skytingRader
    .map((rad, i) => ({ rad, navn: `Skyting ${i + 1} ${skytePosisjonKort(rad)}${rad.window_start_seconds != null ? ` · ${fmtKlokkeSek(rad.window_start_seconds)}` : ''}` }))
  const settPulsIVindu = (r: ActivityRow, start: number, sek: number) => {
    // Sverre 4. sep: snitt- og makspuls for vinduet legges inn på skytingen
    // automatisk (pulsen i vinduet — samme tall som båndet viser).
    const puls = pulsIVindu(hr, start, start + sek)
    if (puls.snitt != null) r.avg_heart_rate = String(puls.snitt)
    if (puls.maks != null) r.max_heart_rate = String(puls.maks)
  }
  /** Plasserer en eksisterende skyterad på tidslinja: starten settes, pulsen
      fylles, og utkastet regner kjeden på nytt rundt den. */
  const plasserSkyterad = (rad: ActivityRow, s: number) => {
    // Skyting regnes i sekunder (aldri «45» = 45 min) og begrenses til 10 min.
    const sek = Math.max(MIN_RAD_SEK, radVarighetSek(rad) || 60)
    const ny = medSerie({ ...rad, window_start_seconds: s, window_duration_seconds: sek })
    settPulsIVindu(ny, s, sek)
    endre(rader.map(r => (r.id === rad.id ? ny : r)))
    setValgtRad(rad.id)
    setValgtPunkt({ slag: 'skyting', id: rad.id })
    setLeggSkyting({ aapen: false, radId: null, tid: '' })
  }
  const velgSkytingForPlassering = (rad: ActivityRow) => {
    setLeggSkyting({ aapen: false, radId: rad.id, tid: '' })
    setPunktType(rad.activity_type === 'skyting_staaende' ? 'skyting_staa' : 'skyting_ligg')
    setPunktModus(true); setKuttModus(false); setStartHerModus(false)
  }
  const plasserFraTid = () => {
    const rad = leggSkyting.radId ? rader.find(r => r.id === leggSkyting.radId) : undefined
    const sek = parseActivityDuration(leggSkyting.tid)
    if (!rad || sek == null || sek < 0) return
    plasserSkyterad(rad, Math.round(sek))
    setPunktModus(false)
  }
  // Fokus-serien avledes hver gang: byggeren kan åpne før klokkedataene
  // kommer, og da må valget falle tilbake på den første serien som finnes.
  const tilgjengeligeKurver = useMemo(() => {
    const s = klokke?.samples
    const ut: Array<'puls' | 'fart' | 'watt'> = []
    if (s?.hr_samples?.length) ut.push('puls')
    if ((s?.pace_samples ?? s?.speed_samples)?.length) ut.push('fart')
    if (s?.watt_samples?.length) ut.push('watt')
    return ut
  }, [klokke])
  const kurveAktiv = tilgjengeligeKurver.includes(kurve) ? kurve : (tilgjengeligeKurver[0] ?? 'puls')

  /** Klikk på kurven i kutt-modus: raden som dekker tidspunktet deles der. */
  const kuttVed = (sek: number) => {
    const u = radVed(plassering, sek)
    if (!u) return
    endre(kuttRad(rader, plassering, u.id, sek, { pulsHint: !harKurve }))
    setValgtRad(u.id)
  }
  /** Klikk på kurven i start-her-modus: valgt rad (og kjeden etter) flyttes dit. */
  const startHerVed = (sek: number) => {
    if (!valgtRad) return
    const rad = rader.find(r => r.id === valgtRad)
    if (rad && rad.activity_type.startsWith('skyting')) {
      // Skyting er et vindu på pulsen, ikke et ledd i kjeden: bare vinduet
      // flyttes, og pulsen i vinduet følger med (Sverre 4. sep).
      const s = Math.max(0, Math.round(sek))
      const sek2 = Math.max(MIN_RAD_SEK, rad.window_duration_seconds ?? (parseActivityDuration(rad.duration) || 60))
      const ny = { ...rad, window_start_seconds: s, window_duration_seconds: sek2 }
      const puls = pulsIVindu(hr, s, s + sek2)
      if (puls.snitt != null) ny.avg_heart_rate = String(puls.snitt)
      if (puls.maks != null) ny.max_heart_rate = String(puls.maks)
      endre(rader.map(r => (r.id === rad.id ? ny : r)))
    } else {
      endre(flyttKjedeTil(rader, plassering, valgtRad, sek))
    }
    setStartHerModus(false)
    setMelding(null)
  }
  /** Klikk i båndet i punkt-modus: nytt punkt der, av valgt type. */
  const punktVed = (sek: number) => {
    const s = Math.max(0, Math.round(sek))
    if (punktType === 'skyting_ligg' || punktType === 'skyting_staa') {
      // Skyterad på tidslinja (ligg eller stå) — samme rad som «+ Legg til
      // skyting» lager. Finnes det alt en UPLASSERT skyterad av samme
      // stilling i lista (lagt til i aktivitetsradene), er det den som
      // plasseres her (Sverre 4. sep) — ellers lages en ny.
      const type = punktType === 'skyting_ligg' ? 'skyting_liggende' : 'skyting_staaende'
      // Bolk 22: er en bestemt uplassert skyting valgt («Legg skyting på
      // puls»), er det den som plasseres — ellers første uplasserte av stillingen.
      const valgtForPlassering = leggSkyting.radId ? rader.find(r => r.id === leggSkyting.radId) : undefined
      const eksisterende = valgtForPlassering ?? rader.find(r => r.activity_type === type && r.window_start_seconds == null)
      if (eksisterende) {
        plasserSkyterad(eksisterende, s)
      } else {
        const rad = medSerie(nyAktivitetsrad(type, ''))
        rad.duration = '1:00'
        rad.window_start_seconds = s
        rad.window_duration_seconds = 60
        settPulsIVindu(rad, s, 60)
        endre([...rader, rad])
        setValgtPunkt({ slag: 'skyting', id: rad.id })
      }
    } else if (!erPlanlagt && punktType === 'laktat') {
      const id = crypto.randomUUID()
      onLaktat([...laktat, { id, measured_at_time: sekTilKlokkeslett(startSek + s), mmol: '', heart_rate: '', feeling: null }])
      setValgtPunkt({ slag: 'laktat', id })
    } else if (!erPlanlagt && punktType === 'ernaering') {
      const ny = { ...emptyNutritionEntryRow(), time_offset_minutes: String(Math.round(s / 60)) }
      onErnaering([...ernaering, ny])
      setValgtPunkt({ slag: 'ernaering', id: ny.id })
    } else {
      const ny = nyttTidspunktNotat(punktType, s, erPlanlagt)
      onPunkter([...punkter, ny])
      setValgtPunkt({ slag: 'notat', id: ny.id })
    }
    setPunktModus(false)
  }
  const endrePunkt = (id: string, patch: Partial<TidspunktNotat>) => onPunkter(punkter.map(p => (p.id === id ? { ...p, ...patch } : p)))
  const fjernPunkt = (id: string) => onPunkter(punkter.filter(p => p.id !== id))
  const klikkPaaKurven = punktModus ? punktVed : kuttModus ? kuttVed : startHerModus && valgtRad ? startHerVed : undefined
  const modus: BaandModus = punktModus ? 'punkt' : kuttModus ? 'kutt' : startHerModus && valgtRad ? 'startHer' : null

  /** BYGG PÅ KURVEN (3b): strukturen legges under grafen med fortløpende
      start/varighet. Finnes klokkerunder, erstatter bygget dem etter
      spørsmål — klokkas runder tas vare på i runde_backup først, så
      «tilbakestill til klokka» kan hente dem hjem. Uten runder: legg til. */
  const byggPaaKurven = async (nye: ActivityRow[], tittel: string) => {
    if (!workoutId) return
    const harProv = rader.some(a => a.db_id && grunnlag.radInfo[a.db_id]?.harKlokkeProveniens && !a.activity_type.startsWith('skyting'))
    let erstatt = false
    if (harProv) {
      const n = rader.filter(a => a.db_id && grunnlag.radInfo[a.db_id]?.harKlokkeProveniens && !a.activity_type.startsWith('skyting')).length
      erstatt = await xpConfirm(`Erstatte klokkas ${n} runder med den bygde strukturen? Rundene tas vare på, og «tilbakestill til klokka» henter dem hjem.`)
      if (!erstatt) return
      const b = await sikreKlokkerundeBackup(workoutId)
      if (!b.ok) { setMelding(b.error); return }
    }
    endre(leggInnBygg(rader, plassering, nye, { erstattKlokkerunder: erstatt, radInfo: grunnlag.radInfo }))
    onByggTittel?.(tittel)
    setHurtigAapent(false)
    setMelding(erstatt
      ? 'Strukturen ligger under kurven. Match den: velg en rad og «Start her», skriv tall, eller «Snapp til klokkerunder».'
      : 'Strukturen er lagt til etter radene som sto. Match den mot kurven med «Start her», tall eller «Snapp».')
  }

  const snapp = () => {
    if (!klokkerunder || klokkerunder.length === 0) return
    const r = snappTilKlokkerunder(rader, plassering, klokkerunder, harKurve ? totalSek : 0)
    if (!r.ok) { setMelding(r.melding); return }
    endre(r.rader)
    setMelding(`${r.antall} drag snappet til klokkas runder — pausene fyller mellom.`)
  }
  const utenfor = overKurven(plassering, harKurve ? totalSek : 0)

  const endreRad = (id: string, patch: Partial<ActivityRow>) =>
    endre(rader.map(r => (r.id === id ? { ...r, ...patch } : r)))

  // Laktat- og ernæringspunkter bor i skjemaet (samme rader som «Laktat»
  // og «Ernæring» lenger nede) — her får de bare et tidspunkt.
  const startSek = klokkeslettTilSek(timeOfDay)
  const laktatSek = (l: LactateRow) => (l.measured_at_time ? Math.max(0, klokkeslettTilSek(l.measured_at_time) - startSek) : null)
  const settLaktatSek = (id: string, sek: number | null) =>
    onLaktat(laktat.map(l => (l.id === id ? { ...l, measured_at_time: sek == null ? '' : sekTilKlokkeslett(startSek + sek) } : l)))
  const settErnaeringMin = (id: string, min: number | null) =>
    onErnaering(ernaering.map(n => (n.id === id ? { ...n, time_offset_minutes: min == null ? '' : String(min) } : n)))

  const body = (
    <div onClick={onClose}
      style={{
        // z 200: økt-modalen ligger på 100 (samme stige som utstyrsvelgeren).
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--line2)',
          borderRadius: 14, width: '94%', maxWidth: 640,
        }}>
        <div className="flex items-center justify-between px-5 py-4 gap-2 flex-wrap"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.08em' }}>
            Øktbygger
          </h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {angreStabel.length > 0 && (
              <button type="button" onClick={angre} style={pille()}>↶ Angre</button>
            )}
            {workoutId && skytingRader.length > 0 && (
              <button type="button" onClick={() => setVisPlottTreff(true)}
                style={pille('#FF4500')}>
                🎯 Plott treff
              </button>
            )}
            {/* Sverre 5. sep: «Ferdig» høyt oppe — også når hurtigoppsettet er skjult. */}
            <button type="button" onClick={onClose} data-ferdig-topp className="xp-pill xp-pill-primary" style={{ minHeight: 34, padding: '4px 14px' }}>Ferdig</button>
            <button type="button" onClick={onClose} aria-label="Lukk"
              style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontSize: 20, cursor: 'pointer', minWidth: 36, minHeight: 36 }}>
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ── HURTIGOPPSETTET ── første seksjon, åpent. Radene går rett i
              skjemaet; på en kurve legges de under grafen (byggPaaKurven). */}
          {onOpprett && sport && (
            <div data-hurtigoppsett data-aapent={hurtigAapent}>
              <button type="button" onClick={() => setHurtigAapent(v => !v)}
                aria-expanded={hurtigAapent}
                className="w-full flex items-center gap-2 text-left"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  letterSpacing: '0.12em', fontSize: 11.5, textTransform: 'uppercase',
                  color: 'var(--tekst-5-app)', background: 'none', border: 'none',
                  padding: '4px 0', cursor: 'pointer', minHeight: 36,
                }}>
                <span style={{ color: 'var(--accent)' }}>⚡</span> Hurtigoppsett — antall × dragtid × sone / pause
                <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>{hurtigAapent ? '▴' : '▾'}</span>
              </button>
              {hurtigAapent && (
                <IntervallBygger
                  sport={sport}
                  onAvbryt={workoutId ? () => setHurtigAapent(false) : undefined}
                  onFerdig={onClose}
                  lagerNokkel={workoutId ?? 'ny'}
                  onLeggTil={async (nye, tittel) => {
                    // Sverre 5. sep: bolken legges UNDER radene som finnes (én
                    // økt i oversikten); tittelen får « + <bolk>».
                    endre([...rader, ...nye])
                    onBolkTittel?.(tittel)
                  }}
                  onOpprett={async (nye, tittel) => {
                    if (workoutId && harKurve) { await byggPaaKurven(nye, tittel); return }
                    // Sverre 5. sep: Opprett holder deg i byggeren med økta
                    // opprettet — laktat/punkter kan legges inn, og «Ferdig» lukker.
                    await onOpprett(nye, tittel)
                  }}
                />
              )}
            </div>
          )}

          {/* BOLK 20 (Sverre 5. sep): byggeren fra start — også på en NY økt
              uten id jobber byggeren på skjemaets utkast-rader i minnet, og
              alt lagres i ÉN lagring sammen med økta. Ingen «lagre først». */}
          {rader.length === 0 && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Økta har ingen aktiviteter ennå — bruk hurtigoppsettet over eller legg til en rad, så bygges den i tid her.
            </p>
          )}

          {rader.length > 0 && (
            <>
              {/* Rundene: fra klokka, planens runder, eller tilbake (bolk 6).
                  Skriver til basen — bare på en lagret økt. */}
              {workoutId && <RundeValg workoutId={workoutId} onEndret={() => {
                setValgtRad(null)
                setAngreStabel([])
                void onRaderFraBasen()
              }} />}

              {/* ── VERKTØYENE PÅ KURVEN ── */}
              <div className="flex items-center gap-2 flex-wrap">
                {harKurve && (
                  <span data-graf-visning={visning} role="group" style={{ display: 'inline-flex', border: '1px solid var(--kant-3)', borderRadius: 999, overflow: 'hidden' }}>
                    {(['graf', 'kurver', 'begge'] as const).map(v => (
                      <button key={v} type="button" data-visning-valg={v} aria-pressed={visning === v}
                        onClick={() => settVisning(v)}
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.1em',
                          textTransform: 'uppercase', padding: '6px 12px', minHeight: 32, cursor: 'pointer', border: 'none',
                          background: visning === v ? 'var(--accent)' : 'transparent',
                          color: visning === v ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)',
                        }}>
                        {VISNING_ETIKETT[v]}
                      </button>
                    ))}
                  </span>
                )}
                {uplasserteSkytinger.length > 0 && (
                  <span data-legg-skyting={leggSkyting.radId ? 'valgt' : 'liste'} className="flex items-center gap-1 flex-wrap" style={{ position: 'relative' }}>
                    <button type="button" data-legg-skyting-knapp aria-expanded={leggSkyting.aapen}
                      onClick={() => setLeggSkyting(v => ({ ...v, aapen: !v.aapen }))}
                      style={pille(leggSkyting.radId ? PUNKT_SLAG.skyting.farge : undefined, !!leggSkyting.radId)}>
                      🎯 Legg skyting på puls{leggSkyting.radId ? ` · ${uplasserteSkytinger.find(x => x.rad.id === leggSkyting.radId)?.navn ?? ''}` : ` (${uplasserteSkytinger.length})`}
                    </button>
                    {leggSkyting.aapen && (
                      <span data-legg-skyting-liste role="listbox" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 30, marginTop: 4, background: 'var(--flate-3)', border: '1px solid var(--kant-3)', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
                        {uplasserteSkytinger.map(({ rad, navn }) => (
                          <button key={rad.id} type="button" data-legg-skyting-valg={rad.id} role="option" aria-selected={leggSkyting.radId === rad.id}
                            onClick={() => velgSkytingForPlassering(rad)}
                            style={{ ...pille(), justifyContent: 'flex-start', textTransform: 'none', letterSpacing: 0 }}>
                            🎯 {navn}
                          </button>
                        ))}
                      </span>
                    )}
                    {leggSkyting.radId && (
                      <>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-5-app)' }}>klikk på kurven, eller tid</span>
                        <input type="text" inputMode="numeric" placeholder="mm:ss" value={leggSkyting.tid} data-legg-skyting-tid aria-label="Tid fra start (mm:ss)"
                          onChange={e => setLeggSkyting(v => ({ ...v, tid: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); plasserFraTid() } }}
                          style={{ width: 64, minHeight: 32, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--kant-3)', background: 'var(--flate-3)', color: 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums' }} />
                        <button type="button" data-legg-skyting-plasser onClick={plasserFraTid} disabled={parseActivityDuration(leggSkyting.tid) == null} style={pille()}>Plasser</button>
                        <button type="button" aria-label="Avbryt plassering" onClick={() => { setLeggSkyting({ aapen: false, radId: null, tid: '' }); setPunktModus(false) }} style={{ ...pille(), padding: '4px 8px' }}>×</button>
                      </>
                    )}
                  </span>
                )}
                <button type="button" onClick={() => { setKuttModus(v => !v); setStartHerModus(false) }}
                  aria-pressed={kuttModus} data-kutt-modus
                  style={pille(kuttModus ? 'var(--accent)' : undefined, kuttModus)}>
                  ✂ Kutt {kuttModus ? '· klikk på kurven' : ''}
                </button>
                {harKurve && (
                  <button type="button" disabled={!valgtRad}
                    onClick={() => { setStartHerModus(v => !v); setKuttModus(false) }}
                    aria-pressed={startHerModus} data-start-her
                    title={valgtRad ? 'Klikk på kurven der raden skal starte — kjeden følger' : 'Velg en rad først'}
                    style={{ ...pille(startHerModus ? 'var(--accent)' : undefined, startHerModus), opacity: valgtRad ? 1 : 0.5 }}>
                    ⇥ Start her {startHerModus ? '· klikk på kurven' : ''}
                  </button>
                )}
                <PunktKnapp aktiv={punktModus} onClick={() => { setPunktModus(v => !v); setKuttModus(false); setStartHerModus(false) }}
                  tekst="Punkt" />
                {/* Typeraden står åpen hele tiden (Sverre 4. sep) — å velge en
                    type slår punkt-modus på, så man slipper å trykke «Punkt». */}
                <span className="flex items-center gap-1 flex-wrap" data-punkt-type>
                  {([
                    { t: 'laktat', ikon: PUNKT_SLAG.laktat.ikon, navn: PUNKT_SLAG.laktat.navn, farge: PUNKT_SLAG.laktat.farge },
                    { t: 'ernaering', ikon: PUNKT_SLAG.ernaering.ikon, navn: PUNKT_SLAG.ernaering.navn, farge: PUNKT_SLAG.ernaering.farge },
                    // Skyting velges som ligg eller stå (Sverre 4. sep).
                    { t: 'skyting_ligg', ikon: '🎯', navn: 'Ligg', farge: PUNKT_SLAG.skyting.farge },
                    { t: 'skyting_staa', ikon: '🎯', navn: 'Stå', farge: PUNKT_SLAG.skyting.farge },
                    { t: 'notat', ikon: PUNKT_SLAG.notat.ikon, navn: PUNKT_SLAG.notat.navn, farge: PUNKT_SLAG.notat.farge },
                  ] as const).map(({ t, ikon, navn, farge }) => (
                    <button key={t} type="button" data-punkt-valg={t}
                      onClick={() => { setPunktType(t); setPunktModus(true); setKuttModus(false); setStartHerModus(false) }}
                      aria-pressed={punktModus && punktType === t}
                      style={{ ...pille(punktModus && punktType === t ? farge : undefined, punktModus && punktType === t), padding: '5px 10px', minHeight: 32, opacity: punktModus || punktType !== t ? 1 : 0.85 }}>
                      {ikon} {navn}
                    </button>
                  ))}
                </span>
                {planBlokker.length > 0 && (
                  <VisPlanBryter paa={visPlan} antall={planBlokker.length} onEndre={p2 => settVisPlanBak(workoutId, p2)} />
                )}
                {harKurve && klokkerunder && klokkerunder.length > 0 && (
                  <button type="button" onClick={snapp} data-snapp
                    style={pille()}>
                    ⌚ Snapp til klokkerunder ({klokkerunder.length})
                  </button>
                )}
                {(() => {
                  const s = klokke?.samples
                  const valg = ([
                    ['puls', 'Puls', s?.hr_samples?.length ?? 0] as const,
                    ['fart', 'Fart', (s?.pace_samples ?? s?.speed_samples)?.length ?? 0] as const,
                    ['watt', 'Watt', s?.watt_samples?.length ?? 0] as const,
                  ]).filter(([, , n]) => n > 0)
                  if (valg.length < 2) return null
                  return valg.map(([id, navn]) => (
                    <button key={id} type="button" onClick={() => setKurve(id)}
                      className="text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                        color: kurveAktiv === id ? KURVE_FARGER[id] : 'var(--tekst-8-alt)',
                        background: 'none',
                        border: `1px solid ${kurveAktiv === id ? KURVE_FARGER[id] : 'var(--kant-3)'}`,
                        borderRadius: 999, padding: '4px 12px', cursor: 'pointer', minHeight: 30,
                      }}>
                      {navn}
                    </button>
                  ))
                })()}
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>
                  {punktModus
                    ? (erPlanlagt
                      ? 'Klikk i båndet under kurven der punktet skal ligge — planlagt laktat har ingen verdi, det er ingen måling. Skyting blir en planlagt skyterad.'
                      : 'Klikk i båndet under kurven der punktet skal ligge. Laktat og ernæring blir rader du fyller ut; skyting blir en skyterad.')
                    : kuttModus
                    ? 'Klikk i båndet under kurven der økta skal deles — linja viser hvor kuttet treffer.'
                    : startHerModus
                      ? 'Klikk i båndet der raden skal starte — radene etter følger med, raden foran strekkes eller kortes.'
                      : 'Velg en rad i båndet eller i lista for tall og knapper. Kurven er bare lesing og zoom.'}
                </span>
              </div>
              {melding && (
                <p data-bygger-melding style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)', margin: 0 }}>
                  {melding}
                </p>
              )}
              {utenfor.length > 0 && (
                <p data-over-kurven style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#E23A5A', margin: 0 }}>
                  ⚠ Bygget er lengre enn kurven: {utenfor.length} {utenfor.length === 1 ? 'rad stikker' : 'rader stikker'} ut forbi {fmtKlokkeSek(totalSek)}.
                  Ingenting klippes — kort inn, eller snapp til klokkerundene.
                </p>
              )}

              <KurveMedRader
                workoutId={workoutId ?? 'ny'}
                utkast={plassering}
                valgtRad={valgtRad}
                onVelgRad={setValgtRad}
                onKlikkSek={klikkPaaKurven}
                modus={modus}
                onDelHer={id => endre(kuttRad(rader, plassering, id, undefined, { pulsHint: !harKurve }))}
                onSlaaSammen={id => endre(slaaSammenMedNeste(rader, plassering, id))}
                erPlanlagt={erPlanlagt}
                samples={klokke?.samples ?? null}
                hr={hr}
                kurve={kurveAktiv}
                sport={sport ?? null}
                totalSek={totalSek}
                punkter={[
                  ...laktat.map(l => ({ id: l.id, slag: 'laktat' as const, sek: laktatSek(l), planlagt: false, tittel: String(l.mmol ?? '').trim() ? `${String(l.mmol).replace('.', ',')} mmol` : 'fyll inn' })),
                  ...ernaering.map(n => ({ id: n.id, slag: 'ernaering' as const, sek: n.time_offset_minutes.trim() ? (parseInt(n.time_offset_minutes) || 0) * 60 : null, planlagt: false, tittel: String(n.carbs_g ?? '').trim() ? `${n.carbs_g} g` : (n.nutrition_type || 'fyll inn') })),
                  ...punkter.map(p => ({ id: p.id, slag: p.type, sek: p.sek, planlagt: p.planlagt, tittel: p.tekst.trim() || (p.type === 'ernaering' && p.ernaering?.karbo_g ? `${p.ernaering.karbo_g} g` : PUNKT_SLAG[p.type].navn) })),
                  ...(visPlan ? planPunkter.map(p => ({ id: `pl-${p.id}`, slag: p.type, sek: p.sek, planlagt: true, tittel: `${p.tekst?.trim() || PUNKT_SLAG[p.type].navn} · plan` })) : []),
                ]}
                planBlokker={visPlan ? planBlokker : []}
                visning={visning}
                heartZones={heartZones}
                runder={(klokke?.lapMarkers ?? []).slice(1).map(l => l.t_start)}
                rader={rader}
                sonerRader={klokke?.sonerRader ?? []}
              />

              {/* BOLK 23: utfyllingsfeltene for det valgte punktet — rett under grafen. */}
              {valgtPunkt && (
                <PunktPanel valgt={valgtPunkt} punkter={punkter} laktat={laktat} ernaering={ernaering} rader={rader} totalSek={totalSek} erPlanlagt={erPlanlagt}
                  onLukk={() => setValgtPunkt(null)}
                  onEndrePunkt={endrePunkt} onFjernPunkt={fjernPunkt}
                  onLaktat={onLaktat} settLaktatSek={settLaktatSek} laktatSek={laktatSek}
                  onErnaering={onErnaering} settErnaeringMin={settErnaeringMin}
                  onEndreRad={(id, patch) => endre(rader.map(x => (x.id === id ? { ...x, ...patch } : x)))} />
              )}
              <ByggSum utkast={plassering} heartZones={heartZones} rpe={rpe} erPlanlagt={erPlanlagt} />

              {/* ── RADENE ── tid som tall, del/slå sammen/slett/type/navn. */}
              <div className="space-y-1">
                <Overskrift>Radene — tid, type og navn</Overskrift>
                {plassering.map(u => {
                  const rad = rader.find(r => r.id === u.id)
                  if (!rad) return null
                  return (
                    <Rad key={u.id}
                      onPaaPuls={u.type.startsWith('skyting') ? () => { const r = rader.find(x => x.id === u.id); if (r) velgSkytingForPlassering(r) } : undefined}
                      u={u}
                      alle={plassering}
                      valgt={valgtRad === u.id}
                      hr={hr}
                      userHasBiathlon={userHasBiathlon}
                      harNabo={!!naboEtter(plassering, u.id)}
                      onVelg={() => setValgtRad(valgtRad === u.id ? null : u.id)}
                      onStart={sek => endre(settRadStart(rader, plassering, u.id, sek))}
                      onVarighet={sek => endre(settRadVarighet(rader, plassering, u.id, sek, totalSek))}
                      onType={t => endreRad(u.id, { activity_type: t })}
                      onNavn={navn => endreRad(u.id, { lap_notes: navn })}
                      onDel={() => endre(kuttRad(rader, plassering, u.id, undefined, { pulsHint: !harKurve }))}
                      onSlaaSammen={() => endre(slaaSammenMedNeste(rader, plassering, u.id))}
                      onSlett={() => { setValgtRad(null); endre(slettRad(rader, plassering, u.id)) }}
                    />
                  )
                })}
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                  Km, puls, bevegelsesform og resten redigeres i aktivitetsradene i skjemaet — det er samme rader.
                </p>
              </div>

              {/* ── Punkter — målingene som er ført, får et tidspunkt ── */}
              {(laktat.length > 0 || ernaering.length > 0 || punkter.length > 0) && (
                <div className="space-y-2">
                  <Overskrift>Punkter på kurven</Overskrift>
                  {punkter.map(p => (
                    <div key={p.id} className="flex items-center gap-2 flex-wrap" data-punkt-rad={p.type}>
                      <button type="button" onClick={() => setValgtPunkt({ slag: 'notat', id: p.id })} title="Fyll inn under grafen"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>↑ velg</button>
                      {!p.tekst.trim() && p.type !== 'laktat' && !(p.type === 'ernaering' && p.ernaering?.karbo_g) && <span data-fyll-inn style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>fyll inn</span>}
                      <NotatPunktRad p={p} totalSek={totalSek}
                        onEndre={patch => endrePunkt(p.id, patch)} onFjern={() => fjernPunkt(p.id)} />
                    </div>
                  ))}
                  {laktat.map(l => (
                    <div key={l.id} className="flex items-center gap-2 flex-wrap" data-punkt-rad="laktat">
                      <button type="button" onClick={() => setValgtPunkt({ slag: 'laktat', id: l.id })} title="Fyll inn under grafen"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>↑ velg</button>
                      {!String(l.mmol ?? '').trim() && <span data-fyll-inn style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>fyll inn</span>}
                    <PunktRad
                      farge={PUNKT_FARGER.laktat}
                      navn={`Laktat ${l.mmol ? String(l.mmol).replace('.', ',') + ' mmol' : '(uten verdi)'}`}
                      sek={laktatSek(l)}
                      onSek={s => settLaktatSek(l.id, Math.max(0, Math.round(s)))}
                      onPlasser={() => settLaktatSek(l.id, Math.round(totalSek / 2))}
                      onFjern={() => settLaktatSek(l.id, null)}
                      verdi={l.mmol} verdiNavn="mmol"
                      onVerdi={v => onLaktat(laktat.map(x => (x.id === l.id ? { ...x, mmol: v } : x)))}
                    />
                    </div>
                  ))}
                  {ernaering.map(n => (
                    <div key={n.id} className="flex items-center gap-2 flex-wrap" data-punkt-rad="ernaering">
                      <button type="button" onClick={() => setValgtPunkt({ slag: 'ernaering', id: n.id })} title="Fyll inn under grafen"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>↑ velg</button>
                      {!String(n.carbs_g ?? '').trim() && <span data-fyll-inn style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>fyll inn</span>}
                    <PunktRad
                      farge={PUNKT_FARGER.ernaering}
                      navn={`Ernæring — ${n.nutrition_type || n.custom_label || 'inntak'}${n.carbs_g ? ` (${n.carbs_g} g)` : ''}`}
                      sek={n.time_offset_minutes.trim() ? (parseInt(n.time_offset_minutes) || 0) * 60 : null}
                      onSek={s => settErnaeringMin(n.id, Math.max(0, Math.round(s / 60)))}
                      onPlasser={() => settErnaeringMin(n.id, Math.round(totalSek / 120))}
                      onFjern={() => settErnaeringMin(n.id, null)}
                      verdi={n.carbs_g} verdiNavn="g karbo"
                      onVerdi={v => onErnaering(ernaering.map(x => (x.id === n.id ? { ...x, carbs_g: v } : x)))}
                    />
                    </div>
                  ))}
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                    {erPlanlagt
                      ? 'Planlagte punkter er hule på grafen. En planlagt laktat er ingen måling — verdien føres i dagboka.'
                      : 'Ført laktat og ernæring er radene du alt har ført — her får de bare et tidspunkt. Notater er egne punkter.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
            Endringene ligger i skjemaet — lagre økta som vanlig.
          </span>
          <button type="button" onClick={onClose} className="xp-pill xp-pill-primary" data-ferdig-bunn>Ferdig</button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(body, document.body)}
      {visPlottTreff && workoutId && (
        <PlottTreffPopup
          workoutId={workoutId}
          onClose={() => setVisPlottTreff(false)}
          onLagret={lagret => onSerierLagret?.(lagret)}
        />
      )}
    </>
  )
}

function pille(farge?: string, fylt = false): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    letterSpacing: '0.1em', fontSize: 12, textTransform: 'uppercase',
    color: fylt ? 'var(--tekst-1-ren)' : (farge ?? 'var(--tekst-1-app)'),
    background: fylt ? (farge ?? 'var(--accent)') : 'none',
    border: `1.5px solid ${farge ?? 'var(--line2)'}`, borderRadius: 999,
    padding: '6px 14px', cursor: 'pointer', minHeight: 36, whiteSpace: 'nowrap',
  }
}

// ── Kurven med radene som bånd ───────────────────────────────

const KURVE_HOYDE = 190

// Samme fargefasit som økt-grafen (design/xpulse-oktgraf-design.html).
export const KURVE_FARGER = {
  puls: '#E23A5A',
  fart: '#28A86E',
  watt: '#E8B93C',
} as const

type KurveValg = keyof typeof KURVE_FARGER

interface Punkt { id: string; slag: PunktSlag; sek: number | null; planlagt: boolean; /** pilla over kurven: verdi eller «fyll inn» */ tittel?: string }

export type BaandModus = 'kutt' | 'startHer' | 'punkt' | null

function KurveMedRader({
  workoutId, utkast, valgtRad, onVelgRad, onKlikkSek, modus, onDelHer, onSlaaSammen, erPlanlagt,
  samples, hr, kurve, sport, totalSek, punkter, planBlokker, visning, heartZones, runder, rader, sonerRader,
}: {
  workoutId: string
  utkast: Utkast[]
  valgtRad: string | null
  onVelgRad: (id: string | null) => void
  /** Kutt/start her/punkt: klikk i BÅNDET → tidspunkt (rettelse 11 — kurven
      selv er bare lesing og zoom). */
  onKlikkSek?: (sek: number) => void
  modus: BaandModus
  onDelHer: (id: string) => void
  onSlaaSammen: (id: string) => void
  erPlanlagt: boolean
  samples: WorkoutKlokkesyncData['samples']
  hr: Array<{ t: number; hr: number }>
  kurve: KurveValg
  sport: string | null
  totalSek: number
  punkter: Punkt[]
  planBlokker: PlanBlokk[]
  /** Samlet rettelse 4: samme graf som øktsiden — GRAF · KURVER · BEGGE. */
  visning: GrafVisning
  heartZones: HeartZone[]
  /** Klokkas originale runder (start-sekunder) — merker i kartet. */
  runder: number[]
  rader: ActivityRow[]
  sonerRader: SoneDbRad[]
}) {
  const kurveSerier: KurveSerie[] = useMemo(() => {
    const ut: KurveSerie[] = []
    const fart = samples?.pace_samples ?? samples?.speed_samples ?? []
    const watt = samples?.watt_samples ?? []
    const hoyde = samples?.altitude_samples ?? []
    if (hr.length > 0) ut.push({
      id: 'puls', navn: 'Puls', farge: KURVE_FARGER.puls,
      punkter: hr.map(p => ({ t: p.t, v: p.hr })), format: (v: number) => `${Math.round(v)}`,
    })
    if (fart.length > 0) ut.push({
      id: 'fart', navn: 'Fart', farge: KURVE_FARGER.fart,
      punkter: fart.map(p => ({ t: p.t, v: p.mps })), format: (v: number) => fmtFartVerdi(v, sport),
    })
    if (watt.length > 0) ut.push({
      id: 'watt', navn: 'Watt', farge: KURVE_FARGER.watt,
      punkter: watt.map(p => ({ t: p.t, v: p.w })), format: (v: number) => `${Math.round(v)}`,
    })
    if (hoyde.length > 2) ut.push({
      id: 'hoyde', navn: 'Høyde', farge: 'var(--tekst-5-app)',
      punkter: hoyde.map(p => ({ t: p.t, v: p.alt })), format: (v: number) => `${Math.round(v)}`,
      somAreal: true,
    })
    return ut
  }, [samples, hr, sport])

  const [vindu, setVindu] = useState<[number, number] | null>(() => hentVindu(workoutId))
  // GJENNOMFØRT-KARTET i byggeren: utkastets rader som blokker med faktisk
  // sone (snittpuls i vinduet mot egne soner — samme regel som øktsiden).
  // Sverre 5. sep: uten klokkekurve (plan, ny økt, manuell) tegnes dragene i
  // RADENES soner — samme som øktgrafen (fraActivityRows). Med kurve vinner
  // pulsen i vinduet (rettelse 12: klokkedata tegnes som blokker).
  const soneSekAv = useMemo(() => new Map(fraActivityRows(rader).map(b => [b.id, b.soneSek])), [rader])
  const kartInn: PlanBlokkInn[] = useMemo(() => [...utkast].sort((a, b) => a.startSek - b.startSek).map(u => {
    const puls = parseInt(u.snittpuls)
    const erDrag = !PAUSE_TYPER.has(u.type) && !u.type.startsWith('skyting')
    // Godkjent regel: drag ≥ 3 min → de første 30 s utenfor snittet.
    const [fra, til] = erDrag ? snittVindu(u.startSek, u.startSek + u.varighetSek) : [u.startSek, u.startSek + u.varighetSek]
    const vindu = hr.length > 0 && erDrag ? pulsIVindu(hr, fra, til).snitt : null
    const rad = rader.find(r => r.id === u.id)
    const soner = sonerRader.length > 0 ? resolveSoner(sonerRader, u.bevegelsesform, rad?.movement_subcategory ?? '') : null
    const km = parseFloat(String(u.distanseKm).replace(',', '.'))
    return {
      id: u.id, type: u.type, navn: u.navn, bevegelsesform: u.bevegelsesform, underkategori: rad?.movement_subcategory ?? '',
      soner: soner ?? undefined,
      // Sverre 5. sep: med kurve stables sonene i runden (tid i hver sone) — som øktgrafen.
      sek: u.varighetSek, startSek: u.startSek, soneSek: hr.length === 0 ? (soneSekAv.get(u.id) ?? {}) : (erDrag || u.type === 'oppvarming' || u.type === 'nedjogg' ? soneSekFraPuls(hr, fra, til, soner ?? heartZones) : {}),
      snittpuls: vindu ?? (Number.isFinite(puls) && puls > 0 ? puls : null),
      gruppeId: u.gruppeId,
      proneShots: u.type === 'skyting_liggende' || u.type === 'skyting_kombinert' ? 1 : 0,
      standingShots: u.type === 'skyting_staaende' || u.type === 'skyting_kombinert' ? 1 : 0,
      distanseKm: Number.isFinite(km) && km > 0 ? km : 0,
    }
  }), [utkast, hr, rader, sonerRader, soneSekAv])
  const kartSpokelser = useMemo(() => tilSpokelser(byggPlanBlokker(kartInn, heartZones)), [kartInn, heartZones])
  const grafPunkter = useMemo(() => punkter.filter(p => p.sek != null && p.slag !== 'skyting' && p.slag !== 'veksling')
    .map(p => ({ id: p.id, sek: p.sek as number, slag: p.slag, planlagt: p.planlagt, tittel: PUNKT_SLAG[p.slag].navn })), [punkter])
  // Forhåndsvisningen: linja opp gjennom kurven mens pekeren står over
  // båndet (eller etter et kutt) — visning, ikke et håndtak.
  const [forhandsSek, setForhandsSek] = useState<number | null>(null)
  const fokusSerie = kurveSerier.find(k => k.id === kurve) ?? null

  const tallFor = (u: Utkast) => {
    const fort = (v: string) => { const n = parseInt(v); return Number.isFinite(n) ? n : null }
    const f = { snitt: fort(u.snittpuls), maks: fort(u.makspuls) }
    if (f.snitt != null || f.maks != null) return f
    if (hr.length === 0) return f
    if (PAUSE_TYPER.has(u.type) || u.type.startsWith('skyting')) return { snitt: null, maks: null }
    const m = pulsIVindu(hr, u.startSek, u.startSek + u.varighetSek)
    return { snitt: m.snitt, maks: m.maks }
  }

  // «plan: 8 min» — blokka må dekke radens midtpunkt og være av samme type.
  const planTekstFor = (u: Utkast) => {
    if (planBlokker.length === 0) return null
    const midt = u.startSek + u.varighetSek / 2
    const minType = segmentTypeFor(u.type, u.bevegelsesform)
    const b = planBlokker.find(x => midt >= x.startSek && midt < x.sluttSek && segmentTypeFor(x.type, '') === minType)
    if (!b) return null
    const planSek = b.sluttSek - b.startSek
    if (Math.abs(planSek - u.varighetSek) < 5) return null
    return `plan: ${fmtKlokkeSek(planSek)}`
  }

  const overlay = (h: KurveHjelpere, paaKurve: boolean) => (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {visning === 'begge' && planBlokker.length > 0 && <PlanSpokelse blokker={planBlokker} pct={h.pct} slag="omriss" />}
      {/* Samlet rettelse 4/5: ingen mørke radfliser oppå kurven lenger —
          blokkene ligger i mellomlaget (BEGGE), valgt rad får bare en ramme. */}
      {(() => {
        const u = utkast.find(x => x.id === valgtRad)
        if (!u) return null
        const utenfor = paaKurve && u.startSek + u.varighetSek > totalSek + KURVE_TOLERANSE_SEK
        return (
          <span data-valgt-rad aria-hidden style={{
            position: 'absolute', left: h.pct(u.startSek), width: `calc(${h.pct(h.fraSek + u.varighetSek)} - 1px)`, minWidth: 6,
            top: 4, bottom: 26, borderRadius: 6, border: `2px solid ${utenfor ? '#E23A5A' : 'var(--tekst-1-app)'}`, opacity: 0.8,
          }} />
        )
      })()}
      {forhandsSek != null && forhandsSek >= h.fraSek && forhandsSek <= h.tilSek && (() => {
        const verdi = paaKurve && fokusSerie ? verdiVed(fokusSerie, forhandsSek) : null
        const farge = modus === 'kutt' ? '#E23A5A' : modus === 'punkt' ? 'var(--accent)' : 'var(--tekst-1-app)'
        return (
          <span data-kuttlinje aria-hidden style={{ position: 'absolute', left: h.pct(forhandsSek), top: 0, bottom: 0, width: 0, borderLeft: `1.5px ${modus ? 'solid' : 'dashed'} ${farge}`, zIndex: 6 }}>
            <span style={{
              position: 'absolute', top: 4, left: 6, whiteSpace: 'nowrap',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              color: 'var(--tekst-1-app)', background: 'var(--flate-12-alt)', border: `1px solid ${farge}`, borderRadius: 6, padding: '2px 6px',
            }}>
              {fmtKlokkeSek(forhandsSek)}{verdi != null && fokusSerie ? ` · ${fokusSerie.format(verdi)}` : ''}
            </span>
          </span>
        )
      })()}
      {punkter.map(p => {
        if (p.sek == null) return null
        const y = paaKurve ? h.yPctForSerie(kurve, p.sek) : '18%'
        return (
          <span key={p.id} aria-hidden>
            {/* Sverre 5. sep: stiplet pekelinje fra pilla ned til punktet — som på øktgrafen. */}
            <span style={{ position: 'absolute', left: h.pct(p.sek), top: 0, height: y, width: 0, borderLeft: `1px dashed ${PUNKT_SLAG[p.slag].farge}`, opacity: 0.7, pointerEvents: 'none', zIndex: 4 }} />
            <span data-bygger-punkt={p.slag} data-planlagt={p.planlagt || undefined} style={{
              position: 'absolute', left: h.pct(p.sek), top: y, transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 5, lineHeight: 0,
            }}>
              <PunktMerke slag={p.slag} planlagt={p.planlagt} storrelse={12} />
            </span>
          </span>
        )
      })}
      {/* Skytingene: stiplet linje + 🎯 på kurven (pilla over bærer L/S og treff). */}
      {utkast.filter(u => u.type.startsWith('skyting')).map(u => (
        <span key={`sky-${u.id}`} aria-hidden>
          <span style={{ position: 'absolute', left: h.pct(u.startSek), top: 0, bottom: 22, width: 0, borderLeft: '1px dashed var(--tekst-1-app)', opacity: 0.5, pointerEvents: 'none', zIndex: 4 }} />
        </span>
      ))}
    </div>
  )

  const harKurve = kurveSerier.some(k => !k.somAreal && k.punkter.length > 0)
  const baand = (
    <ByggerBaand utkast={utkast} valgtId={valgtRad} onVelg={onVelgRad}
      fraSek={harKurve ? (vindu?.[0] ?? 0) : 0} tilSek={harKurve ? (vindu?.[1] ?? Math.max(1, totalSek)) : Math.max(1, totalSek)}
      modus={modus} onKlikkSek={onKlikkSek} onHover={setForhandsSek}
      onDelHer={onDelHer} onSlaaSammen={onSlaaSammen} kurveSlutt={harKurve ? totalSek : 0} />
  )
  // Kartet (GRAF, og alltid uten kurve): samme PlanGraf som øktsiden, med
  // planen bak, klokkas runder som merker og punktene. Klikk på en blokk =
  // kutt/punkt/start her etter modus, ellers velges raden.
  // Forhåndsvisningen over kartet: samme linje som over kurven (kutt /
  // punkt / start her), på kartets egen tidsakse (0 → totalSek).
  const kartPct = (sek: number) => `${Math.max(0, Math.min(100, (sek / Math.max(1, totalSek)) * 100))}%`
  const sekFraHendelse = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * Math.max(1, totalSek)
  }
  const kart = (
    <div data-bygger-kart
      onPointerMove={modus ? e => setForhandsSek(sekFraHendelse(e)) : undefined}
      onPointerLeave={modus ? () => setForhandsSek(null) : undefined}
      onClick={modus && onKlikkSek ? e => onKlikkSek(sekFraHendelse(e)) : undefined}
      style={{ position: 'relative', background: 'var(--flate-12-alt)', border: `1px ${erPlanlagt ? 'dashed' : 'solid'} var(--kant-3)`, borderRadius: 10, padding: '4px 6px 0', cursor: modus ? 'crosshair' : undefined }}>
      <PlanGraf blokker={kartInn} heartZones={heartZones} tetthet="full" totalSek={totalSek} kilde={erPlanlagt ? 'plan' : 'faktisk'}
        spokelser={planBlokker} punkter={grafPunkter} runder={runder}
        valgtId={valgtRad} onVelgBlokk={onVelgRad} onKlikkSek={modus ? onKlikkSek : undefined} />
      {forhandsSek != null && forhandsSek >= 0 && forhandsSek <= totalSek && (() => {
        const farge = modus === 'kutt' ? '#E23A5A' : modus === 'punkt' ? 'var(--accent)' : 'var(--tekst-1-app)'
        return (
          <span data-kuttlinje aria-hidden style={{ position: 'absolute', left: kartPct(forhandsSek), top: 4, bottom: 4, width: 0, borderLeft: `1.5px ${modus ? 'solid' : 'dashed'} ${farge}`, pointerEvents: 'none', zIndex: 3 }}>
            <span style={{
              position: 'absolute', top: 4, left: 6, whiteSpace: 'nowrap',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              color: 'var(--tekst-1-app)', background: 'var(--flate-12-alt)', border: `1px solid ${farge}`, borderRadius: 6, padding: '2px 6px',
            }}>
              {fmtKlokkeSek(forhandsSek)}
            </span>
          </span>
        )
      })()}
    </div>
  )
  if (!harKurve || visning === 'graf') {
    return (
      <div>
        {kart}
        {baand}
      </div>
    )
  }

  const valgt = utkast.find(u => u.id === valgtRad) ?? null
  // Sverre 5. sep: pillene over kurven (🩸 2,8 · 🍌 40 g · 🎯 L 5/5) med
  // stiplet strek ned — samme komponent som øktgrafen. Verdien når den er
  // ført, «fyll inn» ellers.
  const pillePunkter = [
    ...punkter.filter(p => p.sek != null).map(p => ({ id: p.id, slag: p.slag, t: p.sek as number, tittel: p.tittel ?? PUNKT_SLAG[p.slag].navn, farge: PUNKT_SLAG[p.slag].farge, planlagt: p.planlagt })),
    ...utkast.filter(u => u.type.startsWith('skyting')).map(u => {
      const r = rader.find(x => x.id === u.id)
      return { id: `sky-${u.id}`, slag: 'skyting' as const, t: u.startSek, tittel: skyteTittel(r, u.type), farge: PUNKT_SLAG.skyting.farge, planlagt: false }
    }),
  ]
  const segmentVed = (sek: number): Segment | null => {
    const u = utkast.find(x => sek >= x.startSek && sek < x.startSek + x.varighetSek)
    return u ? ({ etikett: etikettFor(u, utkast) } as unknown as Segment) : null
  }
  return (
    <div>
      {pillePunkter.length > 0 && (
        <PunktEtiketter punkter={pillePunkter} synlig={[vindu?.[0] ?? 0, vindu?.[1] ?? totalSek]} segmentVed={segmentVed} />
      )}
      <OktKurve
        serier={kurveSerier}
        paaIds={kurveSerier.filter(x => x.id === kurve || x.somAreal).map(x => x.id)}
        fokusId={kurve}
        totalSek={totalSek}
        hoyde={KURVE_HOYDE}
        vindu={vindu ?? undefined}
        onVindu={v => {
          const heleOkta = v[0] <= 0.5 && v[1] >= totalSek - 0.5
          setVindu(heleOkta ? null : v)
          lagreVindu(workoutId, heleOkta ? [0, totalSek] : v)
        }}
        onKrysshaar={modus ? sek => setForhandsSek(sek) : undefined}
        onKlikk={modus ? onKlikkSek : undefined}
        bakgrunn={h => (planBlokker.length > 0 ? <PlanSpokelse blokker={planBlokker} pct={h.pct} dempet={0.10} /> : null)}
        mellomlag={h => (visning === 'begge' ? <PlanSpokelse blokker={kartSpokelser} pct={h.pct} dempet={0.55} slag="faktisk" /> : null)}
        overlay={h => overlay(h, true)}
      />
      {baand}
      {valgt && (() => {
        const puls = pulsIVindu(hr, valgt.startSek, valgt.startSek + valgt.varighetSek)
        return (
          <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
            <b>{etikettFor(valgt, utkast)}</b>
            {' '}{fmtKlokkeSek(valgt.startSek)}–{fmtKlokkeSek(valgt.startSek + valgt.varighetSek)}
            {' · varighet '}<b>{fmtKlokkeSek(valgt.varighetSek)}</b>
            {puls.snitt != null
              ? <>{' · puls snitt '}<b>{puls.snitt}</b>{puls.inn != null ? <>{' · inn '}<b>{puls.inn}</b></> : null}</>
              : <>{' · puls: for lite data'}</>}
            {valgt.type.startsWith('skyting') && (
              <span style={{ color: 'var(--tekst-8-alt)' }}>
                {' · '}{valgt.skytetidSek != null
                  ? `ført skytetid ${fmtKlokkeSek(valgt.skytetidSek)} — teller i statistikken`
                  : 'kun puls-markering — utenfor skytetid-statistikk'}
              </span>
            )}
          </p>
        )
      })()}
    </div>
  )
}

// ── BOLK 23: panelet for det valgte punktet — rett under grafen ───────
/** Bolk 22: stillingen slik lista viser den — L / S / L+S, eller «velg L/S». */
function skytePosisjonKort(r: ActivityRow): string {
  if (r.activity_type === 'skyting_liggende') return 'L'
  if (r.activity_type === 'skyting_staaende') return 'S'
  const serier = r.shooting_series ?? []
  const L = serier.some(x => x.position === 'L') || !!String(r.prone_shots ?? '').trim()
  const S = serier.some(x => x.position === 'S') || !!String(r.standing_shots ?? '').trim()
  return L && S ? 'L+S' : L ? 'L' : S ? 'S' : '· velg L/S'
}

function PunktPanel({ valgt, punkter, laktat, ernaering, rader, totalSek, onLukk, onEndrePunkt, onFjernPunkt, onLaktat, settLaktatSek, laktatSek, onErnaering, settErnaeringMin, onEndreRad, erPlanlagt = false }: {
  erPlanlagt?: boolean
  valgt: { slag: 'notat' | 'laktat' | 'ernaering' | 'skyting'; id: string }
  punkter: TidspunktNotat[]
  laktat: LactateRow[]
  ernaering: NutritionEntryRow[]
  rader: ActivityRow[]
  totalSek: number
  onLukk: () => void
  onEndrePunkt: (id: string, patch: Partial<TidspunktNotat>) => void
  onFjernPunkt: (id: string) => void
  onLaktat: (l: LactateRow[]) => void
  settLaktatSek: (id: string, sek: number | null) => void
  laktatSek: (l: LactateRow) => number | null
  onErnaering: (n: NutritionEntryRow[]) => void
  settErnaeringMin: (id: string, min: number | null) => void
  onEndreRad: (id: string, patch: Partial<ActivityRow>) => void
}) {
  const ramme: React.CSSProperties = { border: '1px solid var(--accent)', borderRadius: 10, padding: '8px 10px', background: 'var(--flate-12-alt)' }
  const fyllInn = (tom: boolean) => (tom ? <span data-fyll-inn style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 999, padding: '2px 8px' }}>fyll inn</span> : null)
  const topp = (tittel: string, tom: boolean) => (
    <div className="flex items-center gap-2 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-5-app)' }}>
      <span style={{ color: 'var(--tekst-1-app)', fontWeight: 700 }}>{tittel}</span>{fyllInn(tom)}
      <button type="button" onClick={onLukk} aria-label="Lukk punktet" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--tekst-8-alt)', cursor: 'pointer', fontSize: 16 }}>×</button>
    </div>
  )
  if (valgt.slag === 'notat') {
    const p = punkter.find(x => x.id === valgt.id); if (!p) return null
    const tom = p.type === 'ernaering' ? !p.tekst.trim() && !(p.ernaering?.karbo_g) : !p.tekst.trim() && p.type !== 'laktat'
    return <div data-punkt-panel={p.type} style={ramme}>{topp(`${PUNKT_SLAG[p.type].navn} ved ${fmtKlokkeSek(p.sek)}`, tom)}
      <NotatPunktRad p={p} totalSek={totalSek} onEndre={patch => onEndrePunkt(p.id, patch)} onFjern={() => { onFjernPunkt(p.id); onLukk() }} /></div>
  }
  if (valgt.slag === 'laktat') {
    const l = laktat.find(x => x.id === valgt.id); if (!l) return null
    const tom = !String(l.mmol ?? '').trim()
    const sek = laktatSek(l)
    return <div data-punkt-panel="laktat" style={ramme}>{topp(`Laktat ved ${sek != null ? fmtKlokkeSek(sek) : '—'}`, tom)}
      <PunktRad farge={PUNKT_FARGER.laktat} navn="Laktat" sek={sek}
        onSek={s2 => settLaktatSek(l.id, Math.max(0, Math.round(s2)))} onPlasser={() => settLaktatSek(l.id, Math.round(totalSek / 2))}
        onFjern={() => { settLaktatSek(l.id, null); onLukk() }} verdi={l.mmol} verdiNavn="mmol"
        onVerdi={v => onLaktat(laktat.map(x => (x.id === l.id ? { ...x, mmol: v } : x)))} /></div>
  }
  if (valgt.slag === 'ernaering') {
    const n = ernaering.find(x => x.id === valgt.id); if (!n) return null
    const tom = !String(n.carbs_g ?? '').trim() && !String(n.protein_g ?? '').trim() && !String(n.fat_g ?? '').trim() && !String(n.ketones_g ?? '').trim()
    const felt: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)', background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 6, padding: '5px 8px', minHeight: 32 }
    const gram = (k: 'carbs_g' | 'protein_g' | 'fat_g' | 'ketones_g', navn: string) => (
      <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-5-app)' }}>
        <input type="text" inputMode="decimal" value={n[k] ?? ''} placeholder="g" aria-label={`${navn} (gram)`}
          onChange={e => onErnaering(ernaering.map(x => (x.id === n.id ? { ...x, [k]: e.target.value } : x)))}
          style={{ ...felt, width: 54, padding: '4px 6px', minHeight: 30 }} />
        {navn}
      </label>
    )
    return <div data-punkt-panel="ernaering" style={ramme}>{topp(`Ernæring ved ${n.time_offset_minutes.trim() ? fmtKlokkeSek((parseInt(n.time_offset_minutes) || 0) * 60) : '—'}`, tom)}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={n.nutrition_type || ''} aria-label="Type"
          onChange={e => onErnaering(ernaering.map(x => (x.id === n.id ? { ...x, nutrition_type: e.target.value as NutritionEntryRow['nutrition_type'] } : x)))} style={felt}>
          <option value="">hva?</option>
          {(['gel', 'drikke', 'bar', 'frukt', 'mat', 'salt', 'egendefinert'] as const).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {n.nutrition_type === 'egendefinert' && (
          <input type="text" value={n.custom_label || ''} placeholder="hva" aria-label="Egendefinert"
            onChange={e => onErnaering(ernaering.map(x => (x.id === n.id ? { ...x, custom_label: e.target.value } : x)))} style={{ ...felt, flex: '1 1 120px' }} />
        )}
        {gram('carbs_g', 'karbo')}{gram('protein_g', 'protein')}{gram('fat_g', 'fett')}{gram('ketones_g', 'ketoner')}
        <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 10px', fontSize: 12, minHeight: 32 }} onClick={() => { settErnaeringMin(n.id, null); onLukk() }}>Fjern fra kurven</button>
      </div></div>
  }
  const rad = rader.find(x => x.id === valgt.id); if (!rad) return null
  return <SkytingPunktPanel rad={rad} onEndre={patch => onEndreRad(rad.id, patch)} onLukk={onLukk} planMode={erPlanlagt} />
}

// ── BOLK 23: skytepunktets felt rett under grafen ───────────────────
const SKYTETYPER: Array<{ value: ActivityRow['shooting_type']; label: string }> = [
  { value: '', label: 'Type …' },
  { value: 'basisskyting', label: 'Basisskyting' },
  { value: 'rolig_komb', label: 'Rolig komb' },
  { value: 'hard_komb', label: 'Hard komb' },
  { value: 'hurtighet_komb', label: 'Hurtighet komb' },
  { value: 'torrtrening', label: 'Tørrtrening' },
]

/** Sverre 5. sep: en skyterad som plasseres på kurven får én serie (L/S fra
    typen, 5 skudd) så seriefeltet står klart i panelet. */
function medSerie(rad: ActivityRow): ActivityRow {
  if ((rad.shooting_series ?? []).length > 0) return rad
  const serie: ShootingSeriesRow = {
    id: crypto.randomUUID(), position: rad.activity_type === 'skyting_staaende' ? 'S' : 'L',
    shots: '5', hits: '', time_seconds: '', avg_heart_rate: '', max_heart_rate: '',
    note: '', shot_plot: null, points: '', vind_retning: null, vind_styrke: null, sikt: null,
  }
  return { ...rad, shooting_series: [serie] }
}

/** Pilla over kurven: «L 5/5» fra seriene, ellers radens felt. */
function skyteTittel(r: ActivityRow | undefined, type: string): string {
  const pos = type === 'skyting_staaende' ? 'S' : type === 'skyting_liggende' ? 'L' : 'L+S'
  if (!r) return pos
  const serier = r.shooting_series ?? []
  if (serier.length > 0) {
    const sum = shootingSummary(serier)
    return sum.recordedShots > 0 ? `${pos} ${sum.recordedHits}/${sum.recordedShots}` : `${pos} fyll inn`
  }
  const treff = type === 'skyting_staaende' ? r.standing_hits : r.prone_hits
  const skudd = type === 'skyting_staaende' ? r.standing_shots : r.prone_shots
  return String(treff ?? '').trim() ? `${pos} ${treff}/${skudd || '5'}` : `${pos} fyll inn`
}

function SkytingPunktPanel({ rad, onEndre, onLukk, planMode = false }: {
  rad: ActivityRow
  onEndre: (patch: Partial<ActivityRow>) => void
  onLukk: () => void
  planMode?: boolean
}) {
  const ligg = rad.activity_type === 'skyting_liggende' || rad.activity_type === 'skyting_kombinert'
  const staa = rad.activity_type === 'skyting_staaende' || rad.activity_type === 'skyting_kombinert'
  // «fyll inn» til treff er ført — i seriene når de finnes, ellers i radens felt.
  const serier = rad.shooting_series ?? []
  const tom = serier.length > 0
    ? shootingSummary(serier).recordedShots === 0
    : (ligg && !String(rad.prone_hits ?? '').trim()) || (staa && !String(rad.standing_hits ?? '').trim())
  const felt = (k: 'prone_shots' | 'prone_hits' | 'standing_shots' | 'standing_hits', navn: string) => (
    <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-5-app)' }}>
      {navn}
      <input type="text" inputMode="numeric" value={rad[k] ?? ''} aria-label={navn} data-skyting-felt={k}
        onChange={e => onEndre({ [k]: e.target.value })}
        style={{ width: 46, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)', background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 6, padding: '4px 6px', minHeight: 30, textAlign: 'center' }} />
    </label>
  )
  return (
    <div data-punkt-panel="skyting" style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: '8px 10px', background: 'var(--flate-12-alt)' }}>
      <div className="flex items-center gap-2 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-5-app)' }}>
        <span style={{ color: 'var(--tekst-1-app)', fontWeight: 700 }}>🎯 {ligg && staa ? 'Skyting L+S' : ligg ? 'Skyting L' : 'Skyting S'} ved {rad.window_start_seconds != null ? fmtKlokkeSek(rad.window_start_seconds) : '—'}</span>
        {tom && <span data-fyll-inn style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 999, padding: '2px 8px' }}>fyll inn</span>}
        <button type="button" onClick={onLukk} aria-label="Lukk punktet" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--tekst-8-alt)', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sverre 5. sep: skytetypen som liste (sparer plass) … */}
        <select value={rad.shooting_type ?? ''} onChange={e => onEndre({ shooting_type: e.target.value as ActivityRow['shooting_type'] })} data-skyting-type
          aria-label="Skytetype"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)', background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 8, padding: '4px 8px', minHeight: 32 }}>
          {SKYTETYPER.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {ligg && (rad.shooting_series ?? []).length === 0 && <>{felt('prone_hits', 'L treff')}<span style={{ color: 'var(--tekst-8-alt)' }}>/</span>{felt('prone_shots', 'skudd')}</>}
        {staa && (rad.shooting_series ?? []).length === 0 && <>{felt('standing_hits', 'S treff')}<span style={{ color: 'var(--tekst-8-alt)' }}>/</span>{felt('standing_shots', 'skudd')}</>}
        {(rad.avg_heart_rate || rad.max_heart_rate) && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-5-app)' }}>puls {rad.avg_heart_rate || '—'} · maks {rad.max_heart_rate || '—'}</span>}
      </div>
      {/* Sverre 5. sep: hele seriefeltet (L/S · skudd · treff · tid · puls · maks · + legg til serie) — samme som i aktivitetsraden. */}
      <div className="mt-2" data-skyting-serier>
        <SerieListe series={rad.shooting_series ?? []} onChange={next => onEndre({ shooting_series: next })} planMode={planMode} showPoints={false} />
      </div>
    </div>
  )
}

// ── BÅNDET UNDER KURVEN (rettelse 11) — her skjer all klipping ────────
// Klikk i båndet = kuttpunkt (kutt-modus), startpunkt (start her) eller
// punkt (punkt-modus); ellers velger klikket raden. Pekeren over båndet
// tegner linja opp gjennom kurven (forhåndsvisning). «Del her» / «Slå
// sammen» er små knapper på det valgte segmentet.

function ByggerBaand({ utkast, valgtId, onVelg, fraSek, tilSek, modus, onKlikkSek, onHover, onDelHer, onSlaaSammen, kurveSlutt }: {
  utkast: Utkast[]
  valgtId: string | null
  onVelg: (id: string | null) => void
  fraSek: number
  tilSek: number
  modus: BaandModus
  onKlikkSek?: (sek: number) => void
  onHover: (sek: number | null) => void
  onDelHer: (id: string) => void
  onSlaaSammen: (id: string) => void
  kurveSlutt: number
}) {
  const spenn = Math.max(1, tilSek - fraSek)
  const pct = (sek: number) => `${Math.max(0, Math.min(100, ((sek - fraSek) / spenn) * 100))}%`
  const sekVed = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return fraSek + Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * spenn
  }
  const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
  const valgt = sortert.find(u => u.id === valgtId) ?? null
  const knapp: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.08em',
    textTransform: 'uppercase', background: 'var(--flate-12-alt)', border: '1px solid var(--line2)',
    color: 'var(--tekst-1-app)', borderRadius: 999, padding: '4px 9px', minHeight: 28, cursor: 'pointer',
  }
  return (
    <div data-bygger-baand data-modus={modus ?? undefined} style={{ position: 'relative', marginTop: valgt && !modus ? 34 : 6 }}>
      {/* Små knapper på det valgte segmentet — bare uten modus. */}
      {valgt && !modus && (
        <div style={{ position: 'absolute', left: pct(valgt.startSek), top: -32, display: 'flex', gap: 4, zIndex: 3 }}>
          <button type="button" style={knapp} onClick={() => onDelHer(valgt.id)} disabled={valgt.varighetSek < 10} data-baand-del>Del her</button>
          <button type="button" style={knapp} onClick={() => onSlaaSammen(valgt.id)} data-baand-slaa>Slå sammen</button>
        </div>
      )}
      <div
        onMouseMove={e => onHover(sekVed(e))}
        onMouseLeave={() => onHover(null)}
        onClick={e => { if (modus && onKlikkSek) onKlikkSek(sekVed(e)) }}
        style={{
          position: 'relative', height: 30, borderRadius: 6, background: 'var(--flate-12-alt)',
          border: `1px ${modus ? 'solid' : 'dashed'} ${modus === 'kutt' ? '#E23A5A' : modus ? 'var(--accent)' : 'var(--kant-3)'}`,
          cursor: modus ? 'crosshair' : 'default', overflow: 'visible',
        }}>
        {sortert.map(u => {
          const type = segmentTypeFor(u.type, u.bevegelsesform)
          const farge = SEGMENT_FARGER[type]
          const er = valgtId === u.id
          const utenfor = kurveSlutt > 0 && u.startSek + u.varighetSek > kurveSlutt + KURVE_TOLERANSE_SEK
          const andel = u.varighetSek / spenn
          return (
            <button key={u.id} type="button" data-baand-segment={u.id} data-valgt={er || undefined}
              aria-label={`${etikettFor(u, utkast)} ${fmtKlokkeSek(u.startSek)}–${fmtKlokkeSek(u.startSek + u.varighetSek)}`}
              onClick={e => { if (modus) return; e.stopPropagation(); onVelg(er ? null : u.id) }}
              style={{
                position: 'absolute', left: pct(u.startSek), width: `calc(${pct(fraSek + u.varighetSek)} - 1px)`, minWidth: 10,
                top: 3, bottom: 3, padding: '0 4px', borderRadius: 4,
                background: segmentBakgrunn(type), opacity: er ? 1 : 0.8,
                border: `1.5px solid ${utenfor ? '#E23A5A' : er ? 'var(--tekst-1-app)' : 'transparent'}`,
                boxShadow: er ? `0 0 0 2px ${farge}66` : 'none',
                color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 9.5,
                letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
                cursor: modus ? 'crosshair' : 'pointer', pointerEvents: modus ? 'none' : 'auto',
                zIndex: andel < 0.03 ? 2 : 1,
              }}>
              {andel >= 0.035 ? (type === 'drag' ? `${fmtVarighetKort(u.varighetSek)}${u.varighetSek < 90 ? ' s' : ''}` : etikettFor(u, utkast)) : ''}
              {andel < 0.03 && <span aria-hidden style={{ position: 'absolute', top: -11, bottom: -11, left: -6, right: -6, minWidth: 36 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Radene som bånd på lerretet — lesevisning (rettelse 11: ingen klikk her) ──

function RadLag({ utkast, valgtId, h, onVelg, tallFor, planTekstFor, klikkbar, kurveSlutt = 0 }: {
  utkast: Utkast[]
  valgtId: string | null
  h: KurveHjelpere
  onVelg: (id: string | null) => void
  tallFor: (u: Utkast) => { snitt: number | null; maks: number | null }
  planTekstFor: (u: Utkast) => string | null
  klikkbar: boolean
  /** Rader som ender etter kurven får rød kant — aldri stille klipp. */
  kurveSlutt?: number
}) {
  return (
    <>
      {[...utkast].sort((a, b) => a.startSek - b.startSek).map(u => {
        const type = segmentTypeFor(u.type, u.bevegelsesform)
        const farge = SEGMENT_FARGER[type]
        const valgt = valgtId === u.id
        const andel = u.varighetSek / Math.max(1, h.tilSek - h.fraSek)
        const smalt = andel < 0.03
        const t = tallFor(u)
        const plan = planTekstFor(u)
        const utenfor = kurveSlutt > 0 && u.startSek + u.varighetSek > kurveSlutt + KURVE_TOLERANSE_SEK
        return (
          <button key={u.id} type="button" tabIndex={klikkbar ? 0 : -1}
            data-utenfor-kurven={utenfor ? '1' : undefined}
            title={utenfor ? 'Raden stikker ut forbi kurven' : undefined}
            onClick={e => { e.stopPropagation(); onVelg(valgt ? null : u.id) }}
            aria-label={`${etikettFor(u, utkast)} ${fmtKlokkeSek(u.startSek)}–${fmtKlokkeSek(u.startSek + u.varighetSek)}`}
            style={{
              position: 'absolute', left: h.pct(u.startSek),
              width: `calc(${h.pct(h.fraSek + u.varighetSek)} - 1px)`, minWidth: 10,
              top: 6, bottom: 26, padding: 0, borderRadius: 6,
              zIndex: smalt ? 4 : 2,
              background: segmentBakgrunn(type), opacity: valgt ? 0.34 : 0.18,
              border: `1.5px solid ${utenfor ? '#E23A5A' : farge}`,
              boxShadow: valgt ? `0 0 0 2px ${farge}66` : utenfor ? '0 0 0 2px #E23A5A88' : 'none',
              cursor: klikkbar ? 'pointer' : 'inherit',
              pointerEvents: klikkbar ? 'auto' : 'none',
            }}>
            <span style={{
              position: 'absolute', top: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: farge,
            }}>
              {smalt ? '' : etikettFor(u, utkast)}
              {!smalt && (t.snitt != null || t.maks != null) && (
                <span style={{ color: 'var(--tekst-5-app)' }}>
                  {t.snitt != null ? ` · snitt ${t.snitt}` : ''}
                  {t.maks != null ? ` · maks ${t.maks}` : ''}
                </span>
              )}
            </span>
            {!smalt && plan && (
              <span style={{
                position: 'absolute', bottom: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5,
                letterSpacing: '0.05em', color: 'var(--tekst-8-alt)', fontStyle: 'italic',
              }}>
                {plan}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

// ── Én rad i lista — tall og knapper ─────────────────────────

function Rad({
  u, alle, valgt, hr, userHasBiathlon, harNabo,
  onVelg, onStart, onVarighet, onType, onNavn, onDel, onSlaaSammen, onSlett, onPaaPuls,
}: {
  /** Skyterad: start plassering på pulskurven (Sverre 5. sep). */
  onPaaPuls?: () => void
  u: Utkast
  alle: Utkast[]
  valgt: boolean
  hr: Array<{ t: number; hr: number }>
  userHasBiathlon: boolean
  harNabo: boolean
  onVelg: () => void
  onStart: (sek: number) => void
  onVarighet: (sek: number) => void
  onType: (t: ActivityType) => void
  onNavn: (navn: string) => void
  onDel: () => void
  onSlaaSammen: () => void
  onSlett: () => void
}) {
  const farge = SEGMENT_FARGER[segmentTypeFor(u.type, u.bevegelsesform)]
  const puls = pulsIVindu(hr, u.startSek, u.startSek + u.varighetSek)
  const knapp: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11.5,
    letterSpacing: '0.08em', textTransform: 'uppercase', background: 'none',
    border: '1px solid var(--line2)', color: 'var(--tekst-1-app)',
    borderRadius: 999, padding: '6px 12px', minHeight: 36, cursor: 'pointer',
  }
  return (
    <div data-oktbygger-rad data-valgt={valgt ? '1' : '0'}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
        color: 'var(--tekst-5-app)', background: valgt ? 'var(--flate-12-alt)' : 'none',
        border: `1px solid ${valgt ? farge : 'var(--kant-3)'}`,
        borderLeft: `3px solid ${farge}`,
        borderRadius: 8, padding: '8px 10px',
      }}>
      <div role="button" tabIndex={0} onClick={onVelg}
        onKeyDown={e => {
          // Enter i et tidsfelt inni raden skal IKKE velge/avvelge raden
          // (målt: Enter i «start» vippet valget) — bare raden selv.
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVelg() }
        }}
        className="flex items-center gap-3 flex-wrap text-left"
        style={{ minHeight: 36, cursor: 'pointer' }}>
        <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600, minWidth: 96 }}>{etikettFor(u, alle)}</b>
        <span>{fmtKlokkeSek(u.startSek)}–{fmtKlokkeSek(u.startSek + u.varighetSek)}</span>
        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>start</span>
        <TidInput sek={u.startSek} onSek={onStart} />
        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>varighet</span>
        <TidInput sek={u.varighetSek} onSek={onVarighet} />
        {(u.snittpuls || puls.snitt != null) ? (
          <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>
            snitt {u.snittpuls || puls.snitt}{u.snittpuls ? ' · M' : ' · målt'}
          </span>
        ) : u.arvetPuls ? (
          <span className="ml-auto" title="Dragets snitt — vises som hint, lagres ikke"
            style={{ color: 'var(--tekst-8-alt)', fontStyle: 'italic' }}>
            snitt {u.arvetPuls} · hint
          </span>
        ) : null}
      </div>
      {valgt && (
        <div className="flex gap-2 flex-wrap items-center mt-2">
          <select value={u.type}
            onChange={e => onType(e.target.value as ActivityType)}
            aria-label="Type"
            style={{ ...knapp, paddingRight: 8 }}>
            {typerForRad(userHasBiathlon, u.type).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <NavnFelt navn={u.navn} plassholder={etikettFor(u, alle)} onNavn={onNavn} />
          <button type="button" style={knapp} onClick={onDel} disabled={u.varighetSek < 10}
            title="Deler raden på midten — begge får start og varighet">
            Del her
          </button>
          {harNabo && (
            <button type="button" style={knapp} onClick={onSlaaSammen}>Slå sammen med neste</button>
          )}
          {onPaaPuls && (
            <button type="button" style={knapp} onClick={onPaaPuls} data-rad-paa-puls title="Klikk på kurven der skytingen skal ligge, eller skriv tid">
              🎯 → puls
            </button>
          )}
          <button type="button" style={{ ...knapp, color: '#E23A5A', borderColor: '#E23A5A55' }} onClick={onSlett}>
            Slett
          </button>
        </div>
      )}
    </div>
  )
}

/** Navnet skrives lokalt og legges på angre-stabelen først når man går
    videre — ellers ville hvert tastetrykk vært et angre-steg. */
function NavnFelt({ navn, plassholder, onNavn }: {
  navn: string; plassholder: string; onNavn: (navn: string) => void
}) {
  const [tekst, setTekst] = useState<string | null>(null)
  const bruk = () => {
    if (tekst != null && tekst !== navn) onNavn(tekst)
    setTekst(null)
  }
  return (
    <input value={tekst ?? navn}
      onChange={e => setTekst(e.target.value)}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      placeholder={plassholder}
      aria-label="Navn på raden"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, minHeight: 36,
        background: 'var(--flate-14)', border: '1px solid var(--kant-3)',
        borderRadius: 8, color: 'var(--tekst-1-app)', padding: '6px 10px', width: 160,
      }} />
  )
}

function fmtFartVerdi(mps: number, sport: string | null): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const sekPerKm = 1000 / mps
  const m = Math.floor(sekPerKm / 60)
  const sek = Math.round(sekPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}

// Redigerbart tidsfelt (mm:ss eller t:mm:ss).
function TidInput({ sek, onSek }: { sek: number; onSek: (sek: number) => void }) {
  const [tekst, setTekst] = useState<string | null>(null)
  // Enter fulgt av blur skal gi ÉN skriving, ikke to (angre-stabelen fikk
  // et tomt steg). Utkastet leses fra en ref som nulles i det den brukes.
  const utkast = useRef<string | null>(null)
  const bruk = () => {
    const t = utkast.current
    if (t == null) return
    utkast.current = null
    const deler = t.trim().split(':').map(Number)
    if (deler.length >= 2 && deler.every(d => Number.isFinite(d) && d >= 0)) {
      onSek(deler.length === 3 ? deler[0] * 3600 + deler[1] * 60 + deler[2] : deler[0] * 60 + deler[1])
    }
    setTekst(null)
  }
  return (
    <input type="text" inputMode="numeric"
      value={tekst ?? fmtKlokkeSek(sek)}
      onClick={e => e.stopPropagation()}
      onFocus={e => { e.stopPropagation(); utkast.current = fmtKlokkeSek(sek); setTekst(utkast.current); e.currentTarget.select() }}
      onChange={e => { utkast.current = e.target.value; setTekst(e.target.value) }}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        width: 62, textAlign: 'center', minHeight: 36,
        color: 'var(--tekst-1-app)', background: 'var(--flate-14)',
        border: '1px solid var(--kant-3)', borderRadius: 6,
      }} />
  )
}

function Overskrift({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
      {children}
    </p>
  )
}

/** Et tidspunkt-notat i lista: type, tidspunkt, tekst (og gram for
    planlagt ernæring). Planlagt laktat har med vilje ikke noe verdifelt. */
function NotatPunktRad({ p, totalSek, onEndre, onFjern }: {
  p: TidspunktNotat
  totalSek: number
  onEndre: (patch: Partial<TidspunktNotat>) => void
  onFjern: () => void
}) {
  const felt: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)',
    background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 6, padding: '5px 8px', minHeight: 32,
  }
  const gram = (k: keyof NonNullable<TidspunktNotat['ernaering']>, navn: string) => (
    <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-5-app)' }}>
      <input type="text" inputMode="decimal" value={p.ernaering?.[k] ?? ''} placeholder="g" aria-label={`${navn} (gram)`}
        onChange={e => onEndre({ ernaering: { ...(p.ernaering ?? {}), [k]: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || null } })}
        style={{ ...felt, width: 54, padding: '4px 6px', minHeight: 30 }} />
      {navn}
    </label>
  )
  return (
    <div className="flex items-center gap-3 flex-wrap" data-notat-punkt={p.type} data-planlagt={p.planlagt || undefined}
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
      <PunktMerke slag={p.type} planlagt={p.planlagt} storrelse={11} />
      <span style={{ minWidth: 120 }}>{PUNKT_SLAG[p.type].navn}{p.planlagt ? ' · planlagt' : ''}</span>
      <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>tidspunkt</span>
      <TidInput sek={p.sek} onSek={s => onEndre({ sek: Math.max(0, Math.min(totalSek > 0 ? totalSek : s, Math.round(s))) })} />
      <input type="text" value={p.tekst} aria-label="Tekst"
        placeholder={p.type === 'laktat' ? (p.planlagt ? 'notat — ingen verdi, det er en planlagt måling' : 'notat') : p.type === 'ernaering' ? 'hva (gel, drikke, bar …)' : 'notat'}
        onChange={e => onEndre({ tekst: e.target.value })} style={{ ...felt, flex: '1 1 160px' }} />
      {p.type === 'ernaering' && (
        <span className="flex items-center gap-2 flex-wrap">
          {gram('karbo_g', 'karbo')}{gram('protein_g', 'protein')}{gram('fett_g', 'fett')}{gram('ketoner_g', 'ketoner')}
        </span>
      )}
      <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 10px', fontSize: 12, minHeight: 32 }} onClick={onFjern}>
        Fjern
      </button>
    </div>
  )
}

function PunktRad({ farge, navn, sek, onSek, onPlasser, onFjern, verdi, onVerdi, verdiNavn }: {
  farge: string
  navn: string
  sek: number | null
  onSek: (sek: number) => void
  onPlasser: () => void
  onFjern: () => void
  /** Verdien i raden (mmol for laktat, gram karbo for ernæring) — går begge veier. */
  verdi?: string
  onVerdi?: (v: string) => void
  verdiNavn?: string
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: farge }} />
      <span style={{ minWidth: 150 }}>{navn}</span>
      {sek != null ? (
        <>
          <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>tidspunkt</span>
          <TidInput sek={sek} onSek={onSek} />
          {onVerdi && (
            <input type="text" inputMode="decimal" value={verdi ?? ''} onChange={e => onVerdi(e.target.value)} placeholder={verdiNavn}
              aria-label={verdiNavn} style={{
                width: 76, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-1-app)',
                background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 6, padding: '5px 8px', minHeight: 32,
              }} />
          )}
          <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onFjern}>
            Fjern tidspunkt
          </button>
        </>
      ) : (
        <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onPlasser}>
          Plasser på kurven
        </button>
      )}
    </div>
  )
}
