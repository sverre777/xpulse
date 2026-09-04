// ÉN fabrikk for en tom aktivitetsrad — brukes av skjemaet (+ Legg til
// aktivitet / skyting) og av Øktbyggeren (skyting satt fra grafen, 4. sep).
import type { ActivityRow, ActivityType } from './types'
import { emptyActivityZones } from './types'

export function nyAktivitetsrad(type: ActivityType, movement: string): ActivityRow {
  return {
    id: crypto.randomUUID(),
    activity_type: type,
    movement_name: movement,
    movement_subcategory: '',
    start_time: '',
    duration: '',
    distance_km: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    avg_watts: '',
    max_watts: '',
    resistance_level: '',
    avg_pace_seconds_per_km: '',
    pace_unit_preference: '',
    splits_per_km: [],
    prone_shots: '',
    prone_hits: '',
    standing_shots: '',
    standing_hits: '',
    is_dry_training: false,
    shooting_type: '',
    shooting_is_innskyting: false,
    shooting_is_test: false,
    shooting_surface: '',
    shooting_test_ref: '',
    shooting_series: [],
    elevation_gain_m: '',
    elevation_loss_m: '',
    incline_percent: '',
    pack_weight_kg: '',
    sled_weight_kg: '',
    weather: '',
    temperature_c: '',
    notes: '',
    zones: emptyActivityZones(),
    exercises: [],
    lactate_measurements: [],
  }
}
