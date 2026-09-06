'use client'

// Bolk 1: favoritt-rendring for Helse-nøklene (Favoritter-fanen). Dataene er
// getHelseOversikt for 30 dager — samme henting som helseflaten. Følelse og
// årstrenden trenger egen henting/føring og faller tilbake til «Åpne Helse».

import type { HelseOversiktData } from '@/app/actions/helse-oversikt'
import { HELSE_TREND_FARGER } from '@/lib/helse-farger'
import { HelseOversikt, SeksjonsTittel, TrendPanel } from './HelseOversikt'
import { StadieStabler } from './SovnGrafikk'

export function renderFavoritt(key: string, data: HelseOversiktData, ctx?: { targetUserId?: string }): React.ReactNode | null {
  const dager = data.dager
  switch (key) {
    case 'helse_oversikt': return <HelseOversikt forhandsdata={data} kompaktHeader targetUserId={ctx?.targetUserId} chartKey="helse_oversikt" />
    case 'helse_hrv': return <TrendPanel chartKey={key} navn="HRV" enhet="ms" farge={HELSE_TREND_FARGER.hrv} dager={dager} felt="hrv_ms" ukesnitt={false} />
    case 'helse_resting_hr': return <TrendPanel chartKey={key} navn="HVILEPULS" enhet="bpm" farge={HELSE_TREND_FARGER.hvilepuls} dager={dager} felt="resting_hr" ukesnitt={false} />
    case 'helse_sovnscore': return <TrendPanel chartKey={key} navn="SØVNSCORE" enhet="" farge={HELSE_TREND_FARGER.sovnscore} dager={dager} felt="sleep_score" ukesnitt={false} />
    case 'helse_body_weight': return dager.some(d => d.body_weight_kg != null)
      ? <TrendPanel chartKey={key} navn="VEKT" enhet="kg" farge="#E8B93C" dager={dager} felt="body_weight_kg" ukesnitt={false} /> : null
    case 'helse_sovnstadier': {
      const netter = dager.filter(d => d.total_sleep_minutes != null).slice(-14)
      if (netter.length === 0) return null
      return (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 10, padding: '12px 14px' }}>
          <SeksjonsTittel chartKey={key} tittel="SØVNSTADIER — PER NATT" merknad={`timer · siste ${netter.length} netter`} />
          <StadieStabler netter={netter} />
        </div>
      )
    }
    default: return null
  }
}
