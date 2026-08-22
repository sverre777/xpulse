// Selvtest for lib/equipment-usage.ts — km/tid-telling per utstyr (bolk 4).
// Vokter særlig MIGRERINGSPARITETEN: økter uten overstyringer skal telle
// nøyaktig som før bolk 4 (øktas totaler per arv-kobling).
// Vokter i tillegg PLANLAGT-REGELEN (fiks-runde bolk 1): utstyr kan planlegges,
// men km og tid registreres først når økta er markert gjennomført — og endrer
// man utstyret på en gjennomført økt, skal tallene FLYTTE seg.
// Kjør: npx tsx scripts/utstyr-usage-selftest.ts

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { beregnEquipmentUsage, tellerSomGjennomfort, type UsageLink, type UsageWorkout } from '../lib/equipment-usage'

let feil = 0
function ok(navn: string, betingelse: boolean) {
  if (betingelse) console.log(`  ok   ${navn}`)
  else { feil++; console.error(`  FEIL ${navn}`) }
}
const nesten = (a: number, b: number) => Math.abs(a - b) < 1e-9

const kategorier = new Map([
  ['ski1', 'ski'], ['ski2', 'ski'], ['staver', 'skistaver'], ['sko', 'lopesko'],
])

console.log('PARITET — kun arv (som all data før migreringen)')
{
  // To økter, ski1 på begge, staver på én. Gammel telling: per kobling
  // summeres øktas distance_km/duration_minutes.
  const links: UsageLink[] = [
    { equipment_id: 'ski1', workout_id: 'w1', activity_id: null },
    { equipment_id: 'ski1', workout_id: 'w2', activity_id: null },
    { equipment_id: 'staver', workout_id: 'w1', activity_id: null },
  ]
  const workouts = new Map([
    ['w1', { distance_km: 20, duration_minutes: 90, is_completed: true }],
    ['w2', { distance_km: 12.5, duration_minutes: 60, is_completed: true }],
  ])
  const u = beregnEquipmentUsage(['ski1', 'ski2', 'staver'], links, workouts, new Map(), kategorier)
  ok('ski1: 32.5 km (20+12.5)', nesten(u.get('ski1')!.total_km, 32.5))
  ok('ski1: 150 min', nesten(u.get('ski1')!.total_minutes, 150))
  ok('ski1: 2 økter', u.get('ski1')!.workout_count === 2)
  ok('staver: 20 km / 90 min / 1 økt', nesten(u.get('staver')!.total_km, 20) && u.get('staver')!.workout_count === 1)
  ok('ski2 (ubrukt): 0 overalt', u.get('ski2')!.total_km === 0 && u.get('ski2')!.workout_count === 0)
  ok('null-verdier på økt teller 0 (ikke NaN)', (() => {
    const u2 = beregnEquipmentUsage(['ski1'],
      [{ equipment_id: 'ski1', workout_id: 'w3', activity_id: null }],
      new Map([['w3', { distance_km: null, duration_minutes: null, is_completed: true }]]),
      new Map(), kategorier)
    return u2.get('ski1')!.total_km === 0 && u2.get('ski1')!.total_minutes === 0 && u2.get('ski1')!.workout_count === 1
  })())
}

console.log('\nOVERSTYRING — ⇄ på raden (faktisk bytte)')
{
  // Økt 30 km / 120 min, tre aktiviteter. ski1 = hele økta, men på aktivitet
  // a3 (10 km / 40 min) byttet man til ski2.
  const links: UsageLink[] = [
    { equipment_id: 'ski1', workout_id: 'w1', activity_id: null },
    { equipment_id: 'ski2', workout_id: 'w1', activity_id: 'a3' },
  ]
  const workouts = new Map([['w1', { distance_km: 30, duration_minutes: 120, is_completed: true }]])
  const activities = new Map([
    ['a1', { workout_id: 'w1', distance_meters: 10000, duration_seconds: 2400 }],
    ['a2', { workout_id: 'w1', distance_meters: 10000, duration_seconds: 2400 }],
    ['a3', { workout_id: 'w1', distance_meters: 10000, duration_seconds: 2400 }],
  ])
  const u = beregnEquipmentUsage(['ski1', 'ski2', 'staver'], links, workouts, activities, kategorier)
  ok('ski2 (byttet inn): 10 km / 40 min', nesten(u.get('ski2')!.total_km, 10) && nesten(u.get('ski2')!.total_minutes, 40))
  ok('ski1 (arv, samme kategori): 20 km / 80 min', nesten(u.get('ski1')!.total_km, 20) && nesten(u.get('ski1')!.total_minutes, 80))
  ok('km+tid summerer til øktas totaler', nesten(u.get('ski1')!.total_km + u.get('ski2')!.total_km, 30))
  ok('begge teller økta én gang', u.get('ski1')!.workout_count === 1 && u.get('ski2')!.workout_count === 1)

  // Staver som arv i samme økt: ANNEN kategori — mister ingenting på ski-byttet.
  const links2 = [...links, { equipment_id: 'staver', workout_id: 'w1', activity_id: null } as UsageLink]
  const u2 = beregnEquipmentUsage(['ski1', 'ski2', 'staver'], links2, workouts, activities, kategorier)
  ok('staver (annen kategori): fulle 30 km / 120 min', nesten(u2.get('staver')!.total_km, 30) && nesten(u2.get('staver')!.total_minutes, 120))
}

console.log('\nKANTTILFELLER')
{
  const workouts = new Map([['w1', { distance_km: 15, duration_minutes: 60, is_completed: true }]])
  const activities = new Map([
    ['a1', { workout_id: 'w1', distance_meters: 8000, duration_seconds: 1800 }],
    ['a2', { workout_id: 'w1', distance_meters: 7000, duration_seconds: 1800 }],
  ])

  // Samme utstyr på to aktiviteter eksplisitt (uten arv-rad).
  const u = beregnEquipmentUsage(['ski1'],
    [
      { equipment_id: 'ski1', workout_id: 'w1', activity_id: 'a1' },
      { equipment_id: 'ski1', workout_id: 'w1', activity_id: 'a2' },
    ], workouts, activities, kategorier)
  ok('utstyr på to aktiviteter: summerer radene (15 km / 60 min)', nesten(u.get('ski1')!.total_km, 15) && nesten(u.get('ski1')!.total_minutes, 60))
  ok('…men bare 1 økt i tellingen', u.get('ski1')!.workout_count === 1)

  // Overstyring som dekker HELE økta: arven i samme kategori går til 0, aldri negativt.
  const u2 = beregnEquipmentUsage(['ski1', 'ski2'],
    [
      { equipment_id: 'ski1', workout_id: 'w1', activity_id: null },
      { equipment_id: 'ski2', workout_id: 'w1', activity_id: 'a1' },
      { equipment_id: 'ski2', workout_id: 'w1', activity_id: 'a2' },
    ], workouts, activities, kategorier)
  ok('arv redusert til 0 (15−8−7), aldri negativ', u2.get('ski1')!.total_km === 0)
  ok('byttet utstyr får radene (15 km)', nesten(u2.get('ski2')!.total_km, 15))

  // Ukjent aktivitet (slettet) på overstyring → raden teller 0, krasjer ikke.
  const u3 = beregnEquipmentUsage(['ski1'],
    [{ equipment_id: 'ski1', workout_id: 'w1', activity_id: 'finnes-ikke' }],
    workouts, activities, kategorier)
  ok('overstyring mot slettet aktivitet teller 0', u3.get('ski1')!.total_km === 0)

  // Kobling mot ukjent økt ignoreres.
  const u4 = beregnEquipmentUsage(['ski1'],
    [{ equipment_id: 'ski1', workout_id: 'finnes-ikke', activity_id: null }],
    workouts, activities, kategorier)
  ok('kobling mot slettet økt ignoreres', u4.get('ski1')!.total_km === 0 && u4.get('ski1')!.workout_count === 0)
}

console.log('\nPLANLAGT vs. GJENNOMFØRT — de tre scenarioene (bolk 1)')
{
  // Radene har samme form som app/actions/equipment.ts faktisk henter:
  //   .select('id, distance_km, duration_minutes, is_completed')
  // Økta: 18.4 km / 72 min. Utstyr: ski1 planlagt («hvilke ski skal jeg bruke»).
  const links: UsageLink[] = [{ equipment_id: 'ski1', workout_id: 'w1', activity_id: null }]
  const planlagt = new Map<string, UsageWorkout>([
    ['w1', { distance_km: 18.4, duration_minutes: 72, is_completed: false }],
  ])
  const gjennomfort = new Map<string, UsageWorkout>([
    ['w1', { distance_km: 18.4, duration_minutes: 72, is_completed: true }],
  ])

  // 1) Planlagt økt m/ utstyr → 0 km / 0 t på utstyret.
  const u1 = beregnEquipmentUsage(['ski1', 'ski2'], links, planlagt, new Map(), kategorier)
  ok('1) planlagt økt: ski1 = 0 km', u1.get('ski1')!.total_km === 0)
  ok('1) planlagt økt: ski1 = 0 min', u1.get('ski1')!.total_minutes === 0)
  ok('1) planlagt økt teller ikke som brukt økt', u1.get('ski1')!.workout_count === 0)

  // 2) Marker gjennomført → km og tid dukker opp (samme kobling, is_completed true).
  const u2 = beregnEquipmentUsage(['ski1', 'ski2'], links, gjennomfort, new Map(), kategorier)
  ok('2) gjennomført: ski1 = 18.4 km', nesten(u2.get('ski1')!.total_km, 18.4))
  ok('2) gjennomført: ski1 = 72 min (1 t 12 min)', nesten(u2.get('ski1')!.total_minutes, 72))
  ok('2) gjennomført: ski1 = 1 økt', u2.get('ski1')!.workout_count === 1)

  // 3) Endre utstyr på den ALLEREDE gjennomførte økta: ski1 → ski2.
  //    setWorkoutEquipment erstatter koblingene, så tellingen bygges på nytt.
  const etterBytte: UsageLink[] = [{ equipment_id: 'ski2', workout_id: 'w1', activity_id: null }]
  const u3 = beregnEquipmentUsage(['ski1', 'ski2'], etterBytte, gjennomfort, new Map(), kategorier)
  ok('3) etter bytte: ski1 tilbake til 0 km / 0 min', u3.get('ski1')!.total_km === 0 && u3.get('ski1')!.total_minutes === 0)
  ok('3) etter bytte: ski2 = 18.4 km', nesten(u3.get('ski2')!.total_km, 18.4))
  ok('3) etter bytte: ski2 = 72 min', nesten(u3.get('ski2')!.total_minutes, 72))
  ok('3) etter bytte: ski1 = 0 økter, ski2 = 1 økt',
    u3.get('ski1')!.workout_count === 0 && u3.get('ski2')!.workout_count === 1)
  ok('3) summen er bevart — km flyttet, ikke duplisert',
    nesten(u3.get('ski1')!.total_km + u3.get('ski2')!.total_km, 18.4))
}

console.log('\nPLANLAGT — blandet historikk og kanttilfeller')
{
  // Ski1 brukt på to gjennomførte økter (12.0 + 8.5 km) og planlagt på en tredje
  // (25.0 km neste lørdag). Bare de to første skal telle.
  const links: UsageLink[] = [
    { equipment_id: 'ski1', workout_id: 'w1', activity_id: null },
    { equipment_id: 'ski1', workout_id: 'w2', activity_id: null },
    { equipment_id: 'ski1', workout_id: 'w3', activity_id: null },
  ]
  const workouts = new Map<string, UsageWorkout>([
    ['w1', { distance_km: 12.0, duration_minutes: 55, is_completed: true }],
    ['w2', { distance_km: 8.5, duration_minutes: 40, is_completed: true }],
    ['w3', { distance_km: 25.0, duration_minutes: 110, is_completed: false }],
  ])
  const u = beregnEquipmentUsage(['ski1'], links, workouts, new Map(), kategorier)
  ok('planlagt økt holdes utenfor: 20.5 km (12.0+8.5), ikke 45.5', nesten(u.get('ski1')!.total_km, 20.5))
  ok('planlagt økt holdes utenfor: 95 min (55+40), ikke 205', nesten(u.get('ski1')!.total_minutes, 95))
  ok('planlagt økt holdes utenfor: 2 økter, ikke 3', u.get('ski1')!.workout_count === 2)

  // ⇄-overstyring på en PLANLAGT økt teller heller ingenting.
  const planAkt = new Map([['a1', { workout_id: 'w3', distance_meters: 25000, duration_seconds: 6600 }]])
  const u2 = beregnEquipmentUsage(['ski2'],
    [{ equipment_id: 'ski2', workout_id: 'w3', activity_id: 'a1' }],
    workouts, planAkt, kategorier)
  ok('⇄-rad på planlagt økt teller 0', u2.get('ski2')!.total_km === 0 && u2.get('ski2')!.total_minutes === 0)

  // Sømvern: glemmer et kall å hente is_completed, skal tellingen gå til 0 —
  // aldri stille telle planlagte økter som brukt.
  const utenFeltet = new Map<string, UsageWorkout>([
    ['w1', { distance_km: 12.0, duration_minutes: 55 } as unknown as UsageWorkout],
  ])
  const u3 = beregnEquipmentUsage(['ski1'],
    [{ equipment_id: 'ski1', workout_id: 'w1', activity_id: null }], utenFeltet, new Map(), kategorier)
  ok('manglende is_completed teller 0 (feiler trygt, ikke stille feil vei)', u3.get('ski1')!.total_km === 0)
  ok('tellerSomGjennomfort er fasiten: kun true teller',
    tellerSomGjennomfort({ is_completed: true }) === true
    && tellerSomGjennomfort({ is_completed: false }) === false
    && tellerSomGjennomfort({ is_completed: null }) === false)
}

console.log('\nSØM — kallerne må faktisk levere is_completed')
{
  // Regelen bor i lib/equipment-usage.ts, men den virker bare hvis kallerne
  // henter feltet fra basen. Grønne tester på hver side av grensa sier
  // ingenting om grensa selv — her sjekkes selve kallet.
  const rot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const kallere = ['app/actions/equipment.ts', 'app/actions/coach-equipment.ts']
  for (const fil of kallere) {
    const kode = readFileSync(join(rot, fil), 'utf-8')
    const selects = kode.match(/\.select\('id, distance_km, duration_minutes[^']*'\)/g) ?? []
    ok(`${fil}: henter workout-totalene`, selects.length > 0)
    ok(`${fil}: is_completed er med i select`, selects.every(sel => sel.includes('is_completed')))
  }

  // km-siden-siste-slip regner utenom beregnEquipmentUsage — samme fasit må
  // brukes der, ellers teller en planlagt økt ned slipen.
  const eq = readFileSync(join(rot, 'app/actions/equipment.ts'), 'utf-8')
  ok('km_since_slip henter is_completed', eq.includes(".select('id, date, distance_km, is_completed')"))
  ok('km_since_slip bruker tellerSomGjennomfort', eq.includes('!tellerSomGjennomfort(w)'))
  ok('økt-historikken for et utstyr filtrerer på gjennomført', eq.includes(".eq('is_completed', true)"))
}

if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
