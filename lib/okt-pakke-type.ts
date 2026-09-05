// Typen for øktpakka (bolk 4) — bor i lib, ikke i «use server»-fila
// (typer skal aldri eksporteres derfra: Turbopack visker dem ikke ut).
import type { WorkoutFormData } from './types'
import type { Equipment, WorkoutEquipmentSelection } from './equipment-types'

export interface OktPakke {
  okt: Partial<WorkoutFormData> | null
  utstyr: Equipment[] | null
  utstyrsvalg: WorkoutEquipmentSelection | null
}
