'use client'

// Skyting-grafen UTENFOR analysen — i dagboken, rett etter den fysiske
// «Custom graf». SAMME komponent som i Skyting-dybde, ingen kopi: denne
// filen henter bare dataene og bestemmer om seksjonen skal vises.
//
// Selvskjulende: en løper eller syklist skal ikke få en tom skyting-boks
// under kalenderen. Uten skytedata i perioden rendres ingenting — heller
// ikke overskriften.

import { useEffect, useState, useTransition } from 'react'
import { getShootingDepthAnalysis, type ShootingDepthAnalysis } from '@/app/actions/analysis'
import { CustomSkytingChartBuilder } from './CustomSkytingChartBuilder'
import type { DateRange } from './date-range'

export function SkytingChartSection({
  analysisRange, targetUserId,
}: {
  analysisRange: DateRange
  targetUserId?: string
}) {
  const [data, setData] = useState<ShootingDepthAnalysis | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let avbrutt = false
    startTransition(async () => {
      // sportFilter = null: funksjonen filtrerer selv på biathlon. Sender vi
      // en annen sport inn, svarer den med sportMismatch og tom analyse.
      const res = await getShootingDepthAnalysis(
        analysisRange.from, analysisRange.to, null, targetUserId,
      )
      if (avbrutt) return
      // Feil (f.eks. trener uten analysetilgang) skjuler seksjonen i stedet
      // for å rope om det — dette er en bonusflate, ikke en hovedflate.
      setData('error' in res ? null : res)
    })
    return () => { avbrutt = true }
  }, [analysisRange.from, analysisRange.to, targetUserId])

  if (!data || !data.hasData) return null

  return (
    <>
      <div className="flex items-center gap-3 mb-4 mt-8">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
          Skyting
        </h2>
      </div>
      <CustomSkytingChartBuilder data={data} />
    </>
  )
}
