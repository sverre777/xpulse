// Bolk 1: ChartWrapper/MetricCard sjekker nøkkelen sin mot graf-registeret.
// I utvikling varsles én gang per ukjent nøkkel — i prod er det stille.
import { grafInfo } from '@/lib/graf-register'

const varslet = new Set<string>()

export function sjekkGrafNokkel(chartKey: string | undefined, tittel: string): void {
  if (process.env.NODE_ENV === 'production') return
  if (!chartKey) {
    if (!varslet.has(`uten:${tittel}`)) { varslet.add(`uten:${tittel}`); console.warn(`[graf-register] «${tittel}» mangler chartKey`) }
    return
  }
  if (!grafInfo(chartKey) && !varslet.has(chartKey)) {
    varslet.add(chartKey)
    console.warn(`[graf-register] chartKey «${chartKey}» («${tittel}») står ikke i lib/graf-register.ts`)
  }
}
