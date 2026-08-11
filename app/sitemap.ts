import type { MetadataRoute } from 'next'

const BASE = 'https://x-pulse.no'

// Alle offentlige sider. Forsiden og sport-undersidene prioriteres —
// det er der de norske søkeordene («treningsdagbok», «skiskyting app» osv.)
// skal rangere.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'weekly',
  ): MetadataRoute.Sitemap[number] => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  })

  return [
    page('/', 1.0),
    page('/funksjoner/langrenn', 0.9),
    page('/funksjoner/skiskyting', 0.9),
    page('/funksjoner/langlop', 0.9),
    page('/funksjoner/loping', 0.9),
    page('/funksjoner/sykling', 0.9),
    page('/funksjoner/triatlon', 0.9),
    page('/funksjoner/dagbok-og-plan', 0.8),
    page('/funksjoner/analyse', 0.8),
    page('/funksjoner/trener', 0.8),
    page('/funksjoner/klokkesync', 0.8),
    page('/funksjoner/ai-coach', 0.7),
    page('/pris', 0.8),
    page('/kontakt', 0.4, 'monthly'),
    page('/personvern', 0.2, 'monthly'),
    page('/vilkar', 0.2, 'monthly'),
    page('/cookies', 0.2, 'monthly'),
  ]
}
