'use client'

// PLAN-GRAFEN — øktkartet som lesevisning (Øktbygger bolk 5).
// Fasit: design/xpulse-oktkart-design.html: blokker (bredde = varighet,
// høyde/farge = sone), I1 grunnflate, etiketter med pekelinje, klammer
// over repeterte grupper, pause-etikett under. ÉN komponent, to tettheter:
// 'full' (skjema live + hovedside) og 'kompakt' (kalender, øktliste).
// Redigeringen skjer i radene — grafen er resultatet.

import { useMemo, useState } from 'react'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import {
  byggPlanBlokker, grupperPlanBlokker, planNokkeltall, fmtMin, SONE_HOYDE, erKortintervall, soneSpennTekst, soneAndelerAv,
  type PlanBlokkInn, type PlanBlokk,
} from '@/lib/plan-graf'
import { fmtVarighetKort, segmentTypeFor, SEGMENT_FARGER, fmtKlokkeSek } from '@/lib/segmenter'
import type { HeartZone, ExtendedZoneName } from '@/lib/heart-zones'
import type { PlanBlokk as SpokelseBlokk } from '@/app/actions/runder'
import { Nokkeltall, fmtVarighetLang, type NokkeltallCelle } from './WorkoutDetailChart'
import { PUNKT_SLAG, type GrafPunkt } from './Punkt'

const B = 660          // viewBox-bredde
const PLOT = 120       // plotflatas høyde
const TOPP_FULL = 62   // plass til etiketter + klammer
const BUNN_FULL = 20

// Etikettbredde i viewBox-enheter: ~6,2 per tegn i 12 px Barlow Condensed.
const TEGN_BREDDE = 6.2

export function PlanGraf({ blokker: inn, heartZones = [], tetthet = 'full', hoyde, punkter = [], totalSek, spokelser = [], kilde = 'plan', runder = [], onKlikkSek, onVelgBlokk, valgtId = null, punktStil = 'etikett' }: {
  blokker: PlanBlokkInn[]
  heartZones?: HeartZone[]
  tetthet?: 'full' | 'kompakt'
  /** Bolk 21: 'ikon' = punktene (og skytingene 🎯) som ikon uten
      etikett-tekst, med tooltip — oversiktens kompakte kart. */
  punktStil?: 'etikett' | 'ikon'
  /** Kompakt: pikselhøyde på kortet. */
  hoyde?: number
  /** Punktene (bolk 8): planlagte hule, førte fylte — markør på blokka,
      etikett med pekelinje i nivåsystemet. */
  punkter?: GrafPunkt[]
  /** Tidsaksens lengde når den skal være lengre enn blokkene (gjennomført-
      kartet: kurvens lengde, eller planens slutt når planen stikker ut). */
  totalSek?: number
  /** Planens blokker som spøkelse BAK (rettelse 12): stiplet, dempet, i
      sonefargen — avviket leses direkte (I4-blokk oppå I3-spøkelse). */
  spokelser?: SpokelseBlokk[]
  /** Hva kartet viser — bare et data-attributt for flater og tester. */
  kilde?: 'plan' | 'faktisk'
  /** Klokkas rundegrenser (sekunder) — markeres som tynne stiplete streker
      gjennom blokkene (Sverre 4. sep): blokkene viser det som er BYGD,
      rundene fra klokka ses likevel. */
  runder?: number[]
  /** Byggeren (samlet rettelse 5): klikk på en blokk = kutt der (kutt-modus)
      eller velg raden; valgt rad får ramme. Uten disse er kartet lesing. */
  onKlikkSek?: (sek: number) => void
  onVelgBlokk?: (id: string | null) => void
  valgtId?: string | null
}) {
  const blokker = useMemo(() => byggPlanBlokker(inn, heartZones), [inn, heartZones])
  // Trange blokker viser etiketten ved trykk (og hover via CSS) — aldri utelatt.
  const [aktivBlokk, setAktivBlokk] = useState<string | null>(null)
  const total = Math.max(
    totalSek ?? 0,
    blokker.reduce((m, b) => Math.max(m, b.startSek + b.sek), 0),
    ...spokelser.map(p => p.sluttSek),
  )
  // VERN (rettelse 9): antallet i etiketten = antall drag under klammen.
  // Stemmer det ikke, tegnes ingen klamme — hvert drag får egen etikett.
  const grupper = useMemo(() => (tetthet === 'full'
    ? grupperPlanBlokker(blokker).filter(g => blokker.slice(g.fra, g.til + 1).filter(b => b.slag !== 'pause' && b.slag !== 'skyting_ligg' && b.slag !== 'skyting_staa').length === g.antall)
    : []), [blokker, tetthet])
  // Sverre 5. sep: flere bolker med ULIKE bev.former (svømming → løping,
  // skøyting → klassisk) markeres øverst: «Bolk 1 · Langrenn skøyting».
  // Pauser/skyting hører til bolken før. Én bev.form = ingen linje.
  const bolker = useMemo(() => {
    if (tetthet !== 'full') return []
    const ut: { fra: number; til: number; navn: string }[] = []
    let gjeldende: string | null = null
    blokker.forEach((b, i) => {
      const erPause = b.slag === 'pause' || b.slag === 'skyting_ligg' || b.slag === 'skyting_staa'
      const navn = erPause ? '' : `${b.bevegelsesform}${b.underkategori ? ` ${b.underkategori}` : ''}`.trim()
      if (!navn) { if (ut.length) ut[ut.length - 1].til = i; return }
      if (navn !== gjeldende) { ut.push({ fra: i, til: i, navn }); gjeldende = navn }
      else ut[ut.length - 1].til = i
    })
    return ut.length >= 2 ? ut : []
  }, [blokker, tetthet])
  if (blokker.length === 0 || total <= 0) return null

  const x = (sek: number) => (sek / total) * B
  const kompakt = tetthet === 'kompakt'
  const iKlamme = new Set(grupper.flatMap(g => blokker.slice(g.fra, g.til + 1).map(b => b.id)))

  // ETIKETT-NIVÅER (rettelse 7): står to etiketter nærmere hverandre enn
  // bredden sin, får den ene lengre pekelinje og står ett nivå høyere —
  // to nivåer, tre om nødvendig. Regel i tegningen: blokk- og klamme-
  // etiketter legges først, så skytemarkørene (de havner dermed på nivå 2
  // når de ligger inntil en blokk-etikett), og til sist de trange (vises
  // ved trykk/hover). Aldri overlapp, aldri utelatt.
  const etiketter = (() => {
    type Item = { id: string; cx: number; bredde: number; slag: 'blokk' | 'klamme' | 'skyting' | 'punkt'; trang: boolean; nivaa: number }
    const items: Item[] = []
    if (tetthet === 'full') {
      for (const b of blokker) {
        const skyting = b.slag === 'skyting_ligg' || b.slag === 'skyting_staa'
        if (!skyting && iKlamme.has(b.id)) continue
        const cx = x(b.startSek + b.sek / 2)
        if (skyting) { items.push({ id: b.id, cx, bredde: b.etikett.length * TEGN_BREDDE + 12, slag: 'skyting', trang: false, nivaa: 0 }); continue }
        const under = b.slag === 'sone' ? `${blokkMengde(b, kilde)}${soneSpennTekst(b) ? ` · ${soneSpennTekst(b)}` : ''}` : fmtMin(b.sek)
        const bredde = Math.max(b.etikett.length, under.length) * TEGN_BREDDE + 6
        // Trang = blokka er smalere enn 60 % av etiketten. Etiketter får henge
        // litt utenfor blokka si — nivåene løser kollisjonene.
        items.push({ id: b.id, cx, bredde, slag: 'blokk', trang: x(b.sek) < bredde * 0.6, nivaa: 0 })
      }
      for (const g of grupper) {
        const forste = blokker[g.fra], siste = blokker[g.til]
        const cx = (x(forste.startSek) + x(siste.startSek + siste.sek)) / 2
        const sone = klammeSone(blokker, g)
        const kortM = klammeKort(blokker, g)
        const kmM = klammeKm(blokker, g, kilde)
        const tekst = `${g.antall} × ${kmM ?? fmtVarighetKort(g.arbeidSek)}${sone ? ` · ${sone}` : ''}${kortM ? ` · ${kortM}` : ''}`
        items.push({ id: `k-${g.fra}`, cx, bredde: Math.max(tekst.length, 12) * TEGN_BREDDE + 6, slag: 'klamme', trang: false, nivaa: 0 })
      }
      for (const pk of (punktStil === 'ikon' ? [] : punkter)) {
        if (pk.sek < 0 || pk.sek > total) continue
        items.push({ id: `p-${pk.id}`, cx: x(pk.sek), bredde: (pk.tittel.length + 2) * TEGN_BREDDE + 8, slag: 'punkt', trang: false, nivaa: 0 })
      }
    }
    const GAP = 4, MAKS = 2
    const plassert: Item[][] = [[], [], []]
    const krasjer = (a: Item, b: Item) => Math.abs(a.cx - b.cx) < (a.bredde + b.bredde) / 2 + GAP
    const legg = (it: Item) => {
      // Skytemarkører tar alltid nivå 2 når de ligger inntil en blokk-/klamme-etikett.
      let n = it.slag === 'skyting' && items.some(o => o.slag !== 'skyting' && !o.trang && krasjer(o, it)) ? 1 : 0
      while (n < MAKS && plassert[n].some(o => krasjer(o, it))) n++
      if (n === MAKS && plassert[n].some(o => krasjer(o, it))) {
        // Tre nivåer er brukt opp — velg det minst trange (aldri utelatt).
        n = plassert.map((p, i) => [p.filter(o => krasjer(o, it)).length, i] as const).sort((a, b) => a[0] - b[0])[0][1]
      }
      it.nivaa = n; plassert[n].push(it)
    }
    const rekkefolge = (slag: Item['slag'][], trang: boolean) => items.filter(i => slag.includes(i.slag) && i.trang === trang).sort((a, b) => a.cx - b.cx)
    rekkefolge(['blokk', 'klamme'], false).forEach(legg)
    rekkefolge(['skyting', 'punkt'], false).forEach(legg)
    rekkefolge(['blokk'], true).forEach(legg)
    const nivaaer = items.length ? Math.max(...items.map(i => i.nivaa)) + 1 : 1
    return { nivaaFor: (id: string) => items.find(i => i.id === id)?.nivaa ?? 0, nivaaer }
  })()

  const NIVAA_H = 32   // ≥ høyden på en to-linjers etikett (tittel + underlinje), så nivåene aldri berører hverandre
  const BOLK_H = bolker.length > 0 ? 20 : 0
  const topp = kompakt ? 4 : TOPP_FULL + (etiketter.nivaaer - 1) * NIVAA_H + BOLK_H
  const bunn = kompakt ? 2 : BUNN_FULL
  const plot = kompakt ? Math.max(12, (hoyde ?? 30) - 6) : PLOT
  const H = topp + plot + bunn
  const gulv = topp + plot

  return (
    <svg data-plan-graf data-tetthet={tetthet} data-kilde={kilde} viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: kompakt ? (hoyde ?? 30) : undefined, overflow: 'visible' }}
      aria-label={kilde === 'faktisk' ? 'Gjennomført-kartet' : 'Plan-grafen'}>
      {/* I1 grunnflate gjennom hele økta */}
      <rect x={0} y={gulv - plot * 0.36} width={B} height={plot * 0.36} rx={2} fill={ZONE_COLORS_V2.I1} opacity={0.18} />
      {/* Planen bak (rettelse 12): samme farge- og høyderegel som spøkelset
          på kurven (PlanSpokelse), tegnet i SVG-en så den følger aksen. */}
      {spokelser.map(p => {
        const f = spokelseFarge(p)
        const h = plot * f.hoyde
        const andeler = soneAndelerAv((p.soner ?? {}) as Partial<Record<ExtendedZoneName, number>>)
        const bw = Math.max(1, x(p.sluttSek - p.startSek) - 1.5)
        let y = gulv
        return (
          <g key={`s-${p.id}`}>
            {andeler.map(a => { const ah = h * a.andel; y -= ah; return <rect key={a.sone} x={x(p.startSek) + 0.75} y={y} width={bw} height={ah} fill={ZONE_COLORS_V2[a.sone]} fillOpacity={0.14} pointerEvents="none" /> })}
            <rect data-plan-spokelse-blokk x={x(p.startSek) + 0.75} y={gulv - h} width={bw} height={h}
              rx={kompakt ? 1 : 3} fill={f.farge} fillOpacity={andeler.length >= 2 ? 0 : 0.14} stroke={f.farge} strokeOpacity={0.55} strokeDasharray="3 2" vectorEffect="non-scaling-stroke">
              <title>{`Plan: ${p.navn ?? p.type} · ${fmtMin(p.sluttSek - p.startSek)}${andeler.length >= 2 ? ` · ${andeler[0].sone}–${andeler[andeler.length - 1].sone}` : p.sone ? ` · ${p.sone}` : ''}`}</title>
            </rect>
          </g>
        )
      })}
      {blokker.map(b => {
        const w = Math.max(1.5, x(b.sek) - 1.5)
        const h = plot * b.hoyde
        const grunnflate = b.slag === 'sone' && b.sone === 'I1'
        const valgt = valgtId != null && valgtId === b.id
        const klikkbar = !!(onKlikkSek || onVelgBlokk)
        return (
          <g key={b.id}>
            {/* Bolk 19: flere soner på raden → sonefargene stablet oppover etter
                andel (laveste nederst). Rammen under er selve blokka. */}
            {b.soneAndeler.length >= 2 && (() => {
              let y = gulv
              return b.soneAndeler.map(a => {
                const ah = h * a.andel
                y -= ah
                return <rect key={a.sone} x={x(b.startSek) + 0.75} y={y} width={w} height={ah} fill={ZONE_COLORS_V2[a.sone]} opacity={0.95} data-sone-lag={a.sone} pointerEvents="none" />
              })
            })()}
            <rect x={x(b.startSek) + 0.75} y={gulv - h} width={w} height={h} rx={kompakt ? 1 : 3}
              fill={b.soneAndeler.length >= 2 ? 'transparent' : b.farge} opacity={grunnflate ? 0.62 : b.slag === 'pause' || b.slag === 'veksling' ? 0.7 : 0.95}
              data-blokk={b.id} data-valgt={valgt || undefined} data-stablet={b.soneAndeler.length >= 2 ? b.soneAndeler.map(a => a.sone).join(',') : undefined}
              stroke={valgt ? 'var(--tekst-1-app)' : undefined} strokeWidth={valgt ? 2 : undefined} vectorEffect="non-scaling-stroke"
              style={klikkbar ? { cursor: onKlikkSek ? 'crosshair' : 'pointer' } : undefined}
              onClick={klikkbar ? (e) => {
                e.stopPropagation()
                if (onKlikkSek) {
                  // Sekundet der man klikket i blokka (viewBox-x → sek).
                  const svg = (e.currentTarget as SVGRectElement).ownerSVGElement
                  const r = svg?.getBoundingClientRect()
                  const sek = r && r.width > 0 ? ((e.clientX - r.left) / r.width) * total : b.startSek + b.sek / 2
                  onKlikkSek(Math.max(b.startSek, Math.min(b.startSek + b.sek, sek)))
                } else onVelgBlokk?.(valgt ? null : b.id)
              } : undefined}>
              <title>{b.soneAndeler.length >= 2
                ? `${b.etikett} · ${fmtMin(b.sek)} · ${soneSpennTekst(b)}\n${b.soneAndeler.map(a => `${a.sone} ${fmtKlokkeSek(a.sek)} (${Math.round(a.andel * 100)} %)`).join(' · ')}`
                : `${b.etikett} · ${fmtMin(b.sek)}${b.sone ? ` · ${b.sone}` : ''}`}</title>
            </rect>
            {b.slag === 'veksling' && (
              <rect x={x(b.startSek) + 0.75} y={gulv - h} width={w} height={h} rx={kompakt ? 1 : 3}
                fill="url(#plan-striper)" opacity={0.5} />
            )}
            {/* Kortintervall inni draget (50/10 …): striper på blokka (Sverre 5. sep). */}
            {b.slag === 'sone' && erKortintervall(b.navn) && (
              <rect x={x(b.startSek) + 0.75} y={gulv - h} width={w} height={h} rx={kompakt ? 1 : 3}
                fill="url(#plan-striper)" opacity={0.45} data-kortintervall={b.navn.trim()} pointerEvents="none" />
            )}
          </g>
        )
      })}
      {/* Planens OMRISS oppå blokkene (Sverre 5. sep): planen er der for å
          sammenliknes — kanten står også der en høyere faktisk blokk dekker. */}
      {spokelser.map(p => {
        const f = spokelseFarge(p)
        const h = plot * f.hoyde
        return (
          <rect key={`so-${p.id}`} data-plan-omriss x={x(p.startSek) + 0.75} y={gulv - h} width={Math.max(1, x(p.sluttSek - p.startSek) - 1.5)} height={h}
            rx={kompakt ? 1 : 3} fill="none" stroke={f.farge} strokeOpacity={0.9} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )
      })}
      {/* Klokkas runder: stiplet strek gjennom plotflata, samme uttrykk som
          rundegrensene på kurven. Aldri en blokk — bare et merke. */}
      {runder.filter(t => t > 0 && t < total).map((t, i) => (
        <line key={`r-${i}`} data-runde-merke x1={x(t)} y1={gulv - plot} x2={x(t)} y2={gulv + (kompakt ? 0 : 4)}
          stroke="var(--tekst-10-alt)" strokeDasharray="3 3" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
      ))}
      <defs>
        <pattern id="plan-striper" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="rgba(255,255,255,.35)" />
        </pattern>
      </defs>
      {kompakt && punkter.filter(pk => pk.sek >= 0 && pk.sek <= total).map(pk => (
        <text key={`kp-${pk.id}`} x={x(pk.sek)} y={topp + 8} textAnchor="middle" data-graf-punkt={pk.slag} data-planlagt={pk.planlagt || undefined}
          style={{ font: "9px sans-serif", fill: PUNKT_SLAG[pk.slag].farge, opacity: pk.planlagt ? 0.6 : 1 }}>{PUNKT_SLAG[pk.slag].ikon}</text>
      ))}
      {kompakt && blokker.filter(b => b.slag === 'skyting_ligg' || b.slag === 'skyting_staa').map(b => (
        <text key={`k-${b.id}`} x={x(b.startSek + b.sek / 2)} y={topp + 8} textAnchor="middle" data-skytemarkor
          style={{ font: "9px sans-serif", fill: 'var(--tekst-1-app)' }}>🎯</text>
      ))}
      {!kompakt && (
        <>
          <line x1={0} y1={gulv} x2={B} y2={gulv} stroke="var(--line2)" />
          {/* Etiketter med pekelinje — bare på blokker som ikke ligger i en klamme
              og er brede nok til at teksten får plass. */}
          <style>{`.plan-trang .plan-tekst{opacity:0;transition:opacity .12s}.plan-trang:hover .plan-tekst,.plan-trang[data-aktiv="true"] .plan-tekst{opacity:1}`}</style>
          {blokker.map(b => {
            const skyting = b.slag === 'skyting_ligg' || b.slag === 'skyting_staa'
            // Skyting får alltid markøren sin (rettelse 1) — også inni en klamme
            // og også når blokka er smal; klammen bærer bare dragene.
            // Alle andre blokker utenfor en klamme får etikett (rettelse 4):
            // direkte når den får plass, ellers ved trykk/hover — aldri utelatt.
            if (!skyting && iKlamme.has(b.id)) return null
            const cx = x(b.startSek + b.sek / 2)
            const nv = etiketter.nivaaFor(b.id) * NIVAA_H
            if (skyting) return (
              <g key={`e-${b.id}`} data-skytemarkor data-nivaa={etiketter.nivaaFor(b.id) + 1}>
                <text x={cx} y={topp - 30 - nv} textAnchor="middle"
                  style={{ font: "700 11px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-1-app)', letterSpacing: '.04em' }}>
                  {b.etikett}
                </text>
                <line x1={cx} y1={topp - 24 - nv} x2={cx} y2={gulv - plot * b.hoyde - 2} stroke="var(--line2)" />
              </g>
            )
            const under = b.slag === 'sone' ? `${blokkMengde(b, kilde)}${soneSpennTekst(b) ? ` · ${soneSpennTekst(b)}` : ''}` : fmtMin(b.sek)
            const bredde = Math.max(b.etikett.length, under.length) * TEGN_BREDDE + 6
            const trang = x(b.sek) < bredde * 0.6
            const h = plot * b.hoyde
            return (
              <g key={`e-${b.id}`} data-etikett-for={b.id} data-trang={trang || undefined} data-nivaa={etiketter.nivaaFor(b.id) + 1}
                className={trang ? 'plan-trang' : undefined} data-aktiv={trang && aktivBlokk === b.id ? 'true' : undefined}
                onClick={trang ? () => setAktivBlokk(v => (v === b.id ? null : b.id)) : undefined}
                style={trang ? { cursor: 'pointer' } : undefined}>
                {trang && (
                  /* Treffflate over blokka (≥ 36 px i høyden): hover/trykk viser etiketten. */
                  <rect x={x(b.startSek)} y={Math.min(gulv - h, gulv - 36)} width={Math.max(x(b.sek), 8)} height={Math.max(h, 36)} fill="transparent" />
                )}
                <g className="plan-tekst">
                  <text x={cx} y={topp - 44 - nv} textAnchor="middle" className="plan-etikett"
                    style={{ font: "700 12px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-1-app)', letterSpacing: '.06em', textTransform: 'uppercase', paintOrder: 'stroke', stroke: 'var(--flate-12-alt)', strokeWidth: trang ? 4 : 0 }}>
                    {b.etikett}
                  </text>
                  <text x={cx} y={topp - 30 - nv} textAnchor="middle"
                    style={{ font: "11px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-5-app)', paintOrder: 'stroke', stroke: 'var(--flate-12-alt)', strokeWidth: trang ? 4 : 0 }}>
                    {under}
                  </text>
                </g>
                <line x1={cx} y1={topp - 24 - nv} x2={cx} y2={gulv - h - 2} stroke="var(--line2)" />
              </g>
            )
          })}
          {/* Bolkene (Sverre 5. sep): linje + «Bolk n · bev.form» helt øverst. */}
          {bolker.map((bk, i) => {
            const x1 = x(blokker[bk.fra].startSek) + 1, x2 = x(blokker[bk.til].startSek + blokker[bk.til].sek) - 1
            return (
              <g key={`bolk-${i}`} data-bolk={i + 1} data-bolk-navn={bk.navn}>
                <text x={(x1 + x2) / 2} y={11} textAnchor="middle"
                  style={{ font: "700 10px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-5-app)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Bolk {i + 1} · {bk.navn}
                </text>
                <line x1={x1} y1={16} x2={x2} y2={16} stroke="var(--tekst-8-alt)" strokeWidth={1} />
                <line x1={x1} y1={13} x2={x1} y2={19} stroke="var(--tekst-8-alt)" />
                <line x1={x2} y1={13} x2={x2} y2={19} stroke="var(--tekst-8-alt)" />
              </g>
            )
          })}
          {/* Bolk 21: på oversikten (ikon-stil) får skyteblokkene 🎯 L/S over
              seg — kun ikon, stillingen og treffene i tooltip. */}
          {punktStil === 'ikon' && blokker.filter(b => b.slag === 'skyting_ligg' || b.slag === 'skyting_staa').map(b => (
            <g key={`ki-${b.id}`} data-skytemarkor data-punkt-stil="ikon">
              <title>{b.etikett}</title>
              <text x={x(b.startSek + b.sek / 2)} y={gulv - plot * (b.hoyde ?? 0.36) - 8} textAnchor="middle" style={{ font: '11px sans-serif' }}>🎯</text>
            </g>
          ))}
          {/* Punktene (bolk 8): markør på blokka, etikett med pekelinje. Planlagte
              er hule/stiplete, førte fylte — samme former som på klokke-grafen. */}
          {punkter.map(pk => {
            if (pk.sek < 0 || pk.sek > total) return null
            const cx = x(pk.sek)
            const b = blokker.find(bl => pk.sek >= bl.startSek && pk.sek < bl.startSek + bl.sek) ?? blokker[blokker.length - 1]
            const cy = gulv - plot * (b?.hoyde ?? 0.36)
            if (punktStil === 'ikon') {
              // Bolk 21: bare ikonet, verdien i tooltip (hover/trykk).
              return (
                <g key={`p-${pk.id}`} data-graf-punkt={pk.slag} data-punkt-stil="ikon" data-planlagt={pk.planlagt || undefined}>
                  <title>{PUNKT_SLAG[pk.slag].navn} · {pk.tittel}{pk.planlagt ? ' · plan' : ''}</title>
                  <text x={cx} y={cy - 8} textAnchor="middle" style={{ font: '11px sans-serif', opacity: pk.planlagt ? 0.6 : 1 }}>{PUNKT_SLAG[pk.slag].ikon}</text>
                </g>
              )
            }
            const nv = etiketter.nivaaFor(`p-${pk.id}`) * NIVAA_H
            const farge = PUNKT_SLAG[pk.slag].farge
            const fyll = pk.planlagt ? 'none' : farge
            const strek = pk.planlagt ? farge : 'var(--flate-3)'
            return (
              <g key={`p-${pk.id}`} data-graf-punkt={pk.slag} data-planlagt={pk.planlagt || undefined} data-nivaa={etiketter.nivaaFor(`p-${pk.id}`) + 1}>
                <line x1={cx} y1={topp - 24 - nv} x2={cx} y2={cy - 7} stroke={farge} opacity={0.6} />
                {pk.slag === 'laktat' && <circle cx={cx} cy={cy} r={5} fill={fyll} stroke={strek} strokeWidth={2} strokeDasharray={pk.planlagt ? '2 2' : undefined} />}
                {pk.slag === 'ernaering' && <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} transform={`rotate(45 ${cx} ${cy})`} fill={fyll} stroke={strek} strokeWidth={2} strokeDasharray={pk.planlagt ? '2 2' : undefined} />}
                {pk.slag === 'notat' && <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} rx={1.5} fill={fyll} stroke={strek} strokeWidth={2} strokeDasharray={pk.planlagt ? '2 2' : undefined} />}
                {(pk.slag === 'skyting' || pk.slag === 'veksling') && <text x={cx} y={cy + 4} textAnchor="middle" style={{ font: '11px sans-serif' }}>{PUNKT_SLAG[pk.slag].ikon}</text>}
                <text x={cx} y={topp - 30 - nv} textAnchor="middle" data-punkt-etikett
                  style={{ font: "700 11px 'Barlow Condensed', sans-serif", fill: farge, letterSpacing: '.05em', textTransform: 'uppercase', opacity: pk.planlagt ? 0.8 : 1 }}>
                  {PUNKT_SLAG[pk.slag].ikon} {pk.tittel}{pk.planlagt ? ' · plan' : ''}
                </text>
              </g>
            )
          })}
          {/* Klammer over repeterte grupper: én etikett, pause-etikett under. */}
          {grupper.map(g => {
            const forste = blokker[g.fra], siste = blokker[g.til]
            const x1 = x(forste.startSek), x2 = x(siste.startSek + siste.sek)
            const cx = (x1 + x2) / 2
            const sone = klammeSone(blokker, g)
            const nv = etiketter.nivaaFor(`k-${g.fra}`) * NIVAA_H
            return (
              <g key={`k-${g.fra}`} data-klamme={`${g.antall} × ${fmtVarighetKort(g.arbeidSek)}${sone ? ` ${sone}` : ''}${g.pauseSek > 0 ? ` · ${fmtMin(g.pauseSek)} pause` : ''}`} data-nivaa={etiketter.nivaaFor(`k-${g.fra}`) + 1}>
                {nv > 0 && <line x1={cx} y1={topp - 24 - nv} x2={cx} y2={topp - 22} stroke="var(--line2)" />}
                <text x={cx} y={topp - 44 - nv} textAnchor="middle"
                  style={{ font: "700 12px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-1-app)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {g.antall} × {klammeKm(blokker, g, kilde) ?? `${fmtVarighetKort(g.arbeidSek)}${Math.round(g.arbeidSek) < 90 ? ' s' : ''}`}{sone ? ` · ${sone}` : ''}{klammeKort(blokker, g) ? ` · ${klammeKort(blokker, g)}` : ''}
                </text>
                {g.pauseSek > 0 && (
                  <text x={cx} y={topp - 30 - nv} textAnchor="middle"
                    style={{ font: "11px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-5-app)' }}>
                    {fmtMin(g.pauseSek)} pause
                  </text>
                )}
                <path d={`M${x1 + 1} ${topp - 18} v-4 h${x2 - x1 - 2} v4`} fill="none" stroke="var(--line2)" />
              </g>
            )
          })}
          <text x={0} y={H - 4} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-5-app)' }}>0:00</text>
          <text x={B} y={H - 4} textAnchor="end" style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-5-app)' }}>{fmtKlokke(total)}</text>
        </>
      )}
    </svg>
  )
}

/** Klammens sone: dragenes felles sone — eller spennet «I3–I4» når dragene
    faktisk endte i ulike soner (gjennomført-kartet sier det som det er). */
/** Planlagte km-drag (Sverre 5. sep): mengden på blokka er «1 km», ikke tida —
    bare i planen (kilde 'plan'); gjennomført-kartet viser tid. */
function fmtKm(km: number): string {
  return `${(Math.round(km * 100) / 100).toString().replace('.', ',')} km`
}
function blokkMengde(b: PlanBlokk, kilde: 'plan' | 'faktisk'): string {
  return kilde === 'plan' && b.distanseKm > 0 ? fmtKm(b.distanseKm) : fmtMin(b.sek)
}
/** «6 × 1 km» når alle dragene under klammen er planlagt med samme distanse. */
function klammeKm(blokker: PlanBlokk[], g: { fra: number; til: number }, kilde: 'plan' | 'faktisk'): string | null {
  if (kilde !== 'plan') return null
  const drag = blokker.slice(g.fra, g.til + 1).filter(b => b.slag === 'sone')
  if (drag.length === 0 || drag.some(b => !(b.distanseKm > 0))) return null
  const km = drag[0].distanseKm
  return drag.every(b => Math.abs(b.distanseKm - km) < 0.005) ? fmtKm(km) : null
}

/** Kortintervall-mønsteret når ALLE dragene under klammen har det samme («50/10»). */
function klammeKort(blokker: PlanBlokk[], g: { fra: number; til: number }): string | null {
  const drag = blokker.slice(g.fra, g.til + 1).filter(b => b.slag === 'sone')
  if (drag.length === 0) return null
  const navn = drag.map(b => (erKortintervall(b.navn) ? b.navn.trim() : null))
  return navn.every(n => n && n === navn[0]) ? navn[0] : null
}

function klammeSone(blokker: PlanBlokk[], g: { fra: number; til: number }): string | null {
  const soner = [...new Set(blokker.slice(g.fra, g.til + 1).filter(b => b.slag === 'sone' && b.sone).map(b => b.sone as string))]
  if (soner.length === 0) return null
  if (soner.length === 1) return soner[0]
  const rekke = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']
  const sortert = soner.sort((a, b) => rekke.indexOf(a) - rekke.indexOf(b))
  return `${sortert[0]}–${sortert[sortert.length - 1]}`
}

/** Spøkelsets farge/høyde — samme regel som PlanSpokelse på kurven. */
function spokelseFarge(p: SpokelseBlokk): { farge: string; hoyde: number } {
  const seg = segmentTypeFor(p.type, '')
  if (seg === 'pause' || seg === 'veksling' || seg.startsWith('skyting')) return { farge: SEGMENT_FARGER.pause, hoyde: 0.18 }
  const sone = (p.sone && p.sone in ZONE_COLORS_V2 ? p.sone : null) as ExtendedZoneName | null
  // Bolk 19: flere soner → høyden er den høyeste sonens, fargen hovedsonens.
  const andeler = soneAndelerAv((p.soner ?? {}) as Partial<Record<ExtendedZoneName, number>>)
  if (andeler.length >= 2) return { farge: sone ? ZONE_COLORS_V2[sone] : ZONE_COLORS_V2[andeler[andeler.length - 1].sone], hoyde: SONE_HOYDE[andeler[andeler.length - 1].sone] }
  if (sone) return { farge: ZONE_COLORS_V2[sone], hoyde: SONE_HOYDE[sone] }
  return { farge: SEGMENT_FARGER[seg], hoyde: 0.36 }
}

function fmtKlokke(sek: number): string {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(Math.floor(sek % 60)).padStart(2, '0')}`
}

/** Nøkkeltallsraden under plan-grafen — beregnet, aldri ført, unntatt
    forventet/opplevd som føres i samme skala som ellers. */
export function planNokkeltallCeller(inn: PlanBlokkInn[], heartZones: HeartZone[] = []): NokkeltallCelle[] {
  const blokker = byggPlanBlokker(inn, heartZones)
  const n = planNokkeltall(blokker)
  const celler: NokkeltallCelle[] = []
  if (n.totalSek > 0) celler.push({ id: 'varighet', etikett: 'Varighet', verdi: fmtVarighetLang(n.totalSek) })
  if (n.hovedsone) {
    celler.push({ id: 'hovedsone', etikett: 'Hovedsone', verdi: n.hovedsone, farge: ZONE_COLORS_V2[n.hovedsone] })
    celler.push({ id: 'hovedsone-tid', etikett: `${n.hovedsone}-tid`, verdi: fmtVarighetLang(n.hovedsoneSek) })
  }
  if (n.tss > 0) celler.push({ id: 'tss', etikett: 'Belastning', verdi: String(Math.round(n.tss)), hale: 'TSS' })
  if (n.distanseKm > 0) celler.push({ id: 'km', etikett: 'Distanse', verdi: (Math.round(n.distanseKm * 10) / 10).toFixed(1), hale: 'km' })
  return celler
}

export { Nokkeltall }
export type { PlanBlokk }
