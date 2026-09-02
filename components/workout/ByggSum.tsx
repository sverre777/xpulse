'use client'

// Oppsummeringsstripa under lerretet — «SE HVORDAN DEN BLIR».
// Fasit: design/xpulse-oktbyggeren-design.html (lerret A og B).
//
// Regel 11 — ÉN kilde: tallene regnes av computeActivityTotals, nøyaktig
// samme funksjon som dagbok, kalender og analyse bruker, og belastningen av
// beregnSoneTss, samme regnestykke som ATL/CTL-kurven. Stripa er derfor ikke
// et anslag «i byggeren», men den samme økta sett fra samme motor mens den
// bygges. Utkastet mappes til ActivityLike; puls uten eksplisitt sone faller
// tilbake til pulssonene der inne — det er nettopp regelen for lerret B:
// den FØRTE pulsen bestemmer sonen.
//
// Stripa er ren AVLEDNING og skriver ingenting.

import { useMemo } from 'react'
import {
  computeActivityTotals, ZONE_COLORS_V2, isShootingActivityType,
  type ActivityLike,
} from '@/lib/activity-summary'
import { beregnSoneTss } from '@/lib/belastning'
import { SEGMENT_FARGER } from '@/lib/segmenter'
import type { HeartZone, ExtendedZoneName } from '@/lib/heart-zones'
import type { Utkast } from '@/lib/oktbygger-rader'

const SONE_REKKE: ExtendedZoneName[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']

function varighetTekst(sek: number): { tall: string; enhet: string } {
  const m = Math.round(sek / 60)
  if (m < 60) return { tall: String(m), enhet: 'min' }
  return { tall: `${Math.floor(m / 60)}t ${m % 60}`, enhet: 'min' }
}

export function ByggSum({
  utkast, heartZones, rpe, erPlanlagt,
}: {
  utkast: Utkast[]
  heartZones: HeartZone[]
  rpe: number | null
  erPlanlagt: boolean
}) {
  const sum = useMemo(() => {
    const rader: ActivityLike[] = utkast.map(u => ({
      activity_type: u.type,
      // Skyting teller sin FØRTE skytetid når den finnes — samme port som
      // statistikken bruker ellers.
      duration_seconds: u.skytetidSek != null && isShootingActivityType(u.type)
        ? u.skytetidSek : u.varighetSek,
      distance_meters: u.distanseKm ? Math.round(parseFloat(u.distanseKm.replace(',', '.')) * 1000) || null : null,
      avg_heart_rate: u.snittpuls ? parseInt(u.snittpuls) || null : null,
      zones: u.sone ? { [u.sone]: u.varighetSek } : null,
    }))
    const t = computeActivityTotals(rader, heartZones)
    let hovedsone: ExtendedZoneName | null = null
    for (const s of SONE_REKKE) {
      if (t.zoneSeconds[s] > 0 && (hovedsone == null || t.zoneSeconds[s] > t.zoneSeconds[hovedsone])) hovedsone = s
    }
    // Ligg/stå deles bare når raden sier det — kombinert/innskyting/basis
    // vet vi ikke stillingen på, og gjettes ikke.
    let ligg = 0, staa = 0, annenSkyting = 0
    for (const u of utkast) {
      if (!isShootingActivityType(u.type)) continue
      const sek = u.skytetidSek != null ? u.skytetidSek : u.varighetSek
      if (u.type === 'skyting_liggende') ligg += sek
      else if (u.type === 'skyting_staaende') staa += sek
      else annenSkyting += sek
    }
    return { t, hovedsone, ligg, staa, annenSkyting, tss: beregnSoneTss(t.zoneSeconds) }
  }, [utkast, heartZones])

  const { t, hovedsone } = sum
  const totalSek = t.totalSeconds + t.pauseSeconds + t.vekslingSeconds + t.shootingSeconds
  const v = varighetTekst(totalSek)
  const hovedTid = hovedsone ? Math.round(t.zoneSeconds[hovedsone] / 60) : 0

  const bandDeler = [
    ...SONE_REKKE.filter(s => t.zoneSeconds[s] > 0)
      .map(s => ({ navn: s, sek: t.zoneSeconds[s], farge: ZONE_COLORS_V2[s] })),
    ...(sum.ligg > 0 ? [{ navn: 'Ligg', sek: sum.ligg, farge: SEGMENT_FARGER.skyting_ligg }] : []),
    ...(sum.staa > 0 ? [{ navn: 'Stå', sek: sum.staa, farge: SEGMENT_FARGER.skyting_staa }] : []),
    ...(sum.annenSkyting > 0 ? [{ navn: 'Skyting', sek: sum.annenSkyting, farge: SEGMENT_FARGER.skyting_ligg }] : []),
    ...(t.pauseSeconds > 0 ? [{ navn: 'Pause', sek: t.pauseSeconds, farge: SEGMENT_FARGER.pause }] : []),
    ...(t.vekslingSeconds > 0 ? [{ navn: 'Veksling', sek: t.vekslingSeconds, farge: SEGMENT_FARGER.veksling }] : []),
  ]
  const bandSum = bandDeler.reduce((s, d) => s + d.sek, 0)

  const celle: React.CSSProperties = {
    flex: '1 1 118px', padding: '11px 13px', borderRight: '1px solid var(--line2)',
  }
  const merkelapp: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
    letterSpacing: '0.14em', fontSize: 10, color: 'var(--tekst-5-app)',
  }
  const verdi: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 23 }
  const enhet: React.CSSProperties = { fontSize: 11, color: 'var(--tekst-5-app)', fontFamily: 'inherit' }

  return (
    <div data-byggsum style={{ marginTop: 12 }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', border: '1px solid var(--line2)',
        borderRadius: 10, overflow: 'hidden', background: 'var(--flate-14)',
      }}>
        <div style={celle}>
          <div style={merkelapp}>VARIGHET</div>
          <div style={verdi}>{v.tall}<small style={enhet}> {v.enhet}</small></div>
        </div>
        <div style={celle}>
          <div style={merkelapp}>HOVEDSONE</div>
          <div style={{ ...verdi, color: hovedsone ? ZONE_COLORS_V2[hovedsone] : 'var(--tekst-5-app)' }}>
            {hovedsone ?? '—'}
          </div>
        </div>
        <div style={celle}>
          <div style={merkelapp}>{hovedsone ? `${hovedsone}-TID` : 'TID I SONE'}</div>
          <div style={verdi}>
            {hovedsone ? <>{hovedTid}<small style={enhet}> min</small></> : '—'}
          </div>
        </div>
        <div style={celle}>
          <div style={merkelapp}>BELASTNING</div>
          <div style={verdi}>
            {sum.tss > 0 ? <>{Math.round(sum.tss)}<small style={enhet}> TSS</small></> : '—'}
          </div>
        </div>
        <div style={{ ...celle, flex: '1 1 150px', borderRight: 0, background: 'var(--flate-12-alt)' }}>
          <div style={merkelapp}>
            {erPlanlagt ? 'FORVENTET' : <>FORVENTET <span style={{ color: 'var(--accent)' }}>· FØRES</span></>}
          </div>
          <div style={verdi}>
            {rpe != null ? <>{rpe}<small style={enhet}> /10</small></> : <span style={{ color: 'var(--tekst-5-app)' }}>—</span>}
          </div>
        </div>
      </div>
      {bandSum > 0 && (
        <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
          {bandDeler.map(d => (
            <div key={d.navn} title={`${d.navn} — ${Math.round(d.sek / 60)} min`}
              style={{ flex: `${d.sek} 0 0`, minWidth: 26 }}>
              <div style={{
                height: 7, borderRadius: 3, background: d.farge,
                backgroundImage: d.navn === 'Veksling'
                  ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 3px, transparent 3px 6px)'
                  : undefined,
              }} />
              <div style={{
                marginTop: 3, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                fontSize: 10, letterSpacing: '.08em', color: 'var(--tekst-5-app)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{d.navn}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
