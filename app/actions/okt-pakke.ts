'use server'

// YTELSE bolk 4 (Sverre 5. sep 2026): ÉN pakke når en økt åpnes — økta
// (skjemadata inkl. tidspunkt_notater, ernæring, laktat), utstyrslista og
// utstyrsvalget i ETT svar med Promise.all på serveren, i stedet for tre
// separate actions fra WorkoutModal (hver med sin middleware-/Auth-rundtur
// og sin funksjonsstart). Klokkedata er stor og hentes fortsatt parallelt
// for seg (varmKlokkedata). Trener-visning (targetUserId) har ikke egen
// utstyrsliste — da er utstyr null.
import { getWorkoutForEdit } from './workouts'
import { listEquipmentWithUsage, getWorkoutEquipmentSelection } from './equipment'
import { medTid } from '@/lib/ytelse-tid'
import type { OktPakke } from '@/lib/okt-pakke-type'

export async function hentOktPakke(workoutId: string, formMode: 'plan' | 'dagbok', targetUserId?: string): Promise<OktPakke> {
  return medTid('hentOktPakke', async () => {
    const [okt, utstyr, utstyrsvalg] = await Promise.all([
      getWorkoutForEdit(workoutId, formMode, targetUserId),
      targetUserId ? Promise.resolve(null) : listEquipmentWithUsage({ status: 'active' }).catch(() => null),
      targetUserId ? Promise.resolve(null) : getWorkoutEquipmentSelection(workoutId).catch(() => null),
    ])
    return { okt, utstyr, utstyrsvalg }
  }, { mode: formMode })
}
