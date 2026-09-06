// Beste rullende snitt over et tidsvindu (sekunder) i en tidsserie — brukes
// av power-kurven (Klokkedata) og terskel-estimatene (bolk 2: beste 20-min
// watt × 0,95, beste 30-min fart). Flyttet hit fra klokkedata-trender så
// det finnes ÉN kopi (regel 11). To-peker-vindu, O(n).

export function besteRullendeSnitt(
  data: Array<{ t: number; v: number }>,
  vinduSek: number,
): number | null {
  if (data.length < 2) return null
  const totalSek = data[data.length - 1].t - data[0].t
  if (totalSek < vinduSek) return null
  let best = -Infinity
  let i = 0, j = 0, sum = 0, antall = 0
  while (j < data.length) {
    sum += data[j].v
    antall++
    while (data[j].t - data[i].t > vinduSek && i < j) {
      sum -= data[i].v
      antall--
      i++
    }
    if (data[j].t - data[i].t >= vinduSek - 1) {
      const a = sum / antall
      if (a > best) best = a
    }
    j++
  }
  return best === -Infinity ? null : best
}
