// Selvtest for lib/equipment-usage.ts — km/tid-telling per utstyr (bolk 4).
// Vokter særlig MIGRERINGSPARITETEN: økter uten overstyringer skal telle
// nøyaktig som før bolk 4 (øktas totaler per arv-kobling).
// Kjør: npx tsx scripts/utstyr-usage-selftest.ts

import { beregnEquipmentUsage, type UsageLink } from '../lib/equipment-usage'

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
    ['w1', { distance_km: 20, duration_minutes: 90 }],
    ['w2', { distance_km: 12.5, duration_minutes: 60 }],
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
      new Map([['w3', { distance_km: null, duration_minutes: null }]]),
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
  const workouts = new Map([['w1', { distance_km: 30, duration_minutes: 120 }]])
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
  const workouts = new Map([['w1', { distance_km: 15, duration_minutes: 60 }]])
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

if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
