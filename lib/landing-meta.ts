import type { Metadata } from 'next'

// Felles felter for funksjoner-undersider. Tittel-suffikset og default-OG
// holdes ett sted så alle undersidene har konsistent SEO-form.

const SITE_NAME = 'X-PULSE'
const DEFAULT_OG_IMAGE = '/x-pulse-icon-1024.png'

interface FeatureMetaInput {
  title: string
  description: string
  path: string
  image?: string
}

export function buildFeatureMetadata(input: FeatureMetaInput): Metadata {
  const fullTitle = `${input.title} — ${SITE_NAME}`
  const image = input.image ?? DEFAULT_OG_IMAGE
  return {
    title: fullTitle,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: 'website',
      title: fullTitle,
      description: input.description,
      url: input.path,
      siteName: SITE_NAME,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: input.description,
      images: [image],
    },
  }
}

// Sport-meta brukt av /funksjoner/[sport]-rute og sport-kort-grid.
// Rekkefølge i SPORT_SLUGS bestemmer kort-grid-rekkefølge på landing-side.

export type FeatureSportSlug =
  | 'langrenn'
  | 'skiskyting'
  | 'langlop'
  | 'loping'
  | 'sykling'
  | 'triatlon'

export interface FeatureSport {
  slug: FeatureSportSlug
  label: string
  description: string
  priority: boolean
}

export const FEATURE_SPORTS: FeatureSport[] = [
  {
    slug: 'langrenn',
    label: 'Langrenn',
    description: 'Klassisk, skøyting og staking. Skipark, ski-tester og bevegelsesform-spesifikk analyse.',
    priority: true,
  },
  {
    slug: 'skiskyting',
    label: 'Skiskyting',
    description: 'Eneste plattformen med dyp skyting-analyse. Auto-konkurransestruktur og treff% per posisjon.',
    priority: true,
  },
  {
    slug: 'langlop',
    label: 'Langløp',
    description: 'Bygd for Birken og Vasaloppet. Lange utholdenhetsøkter med terreng, ernæring og pacing.',
    priority: true,
  },
  {
    slug: 'loping',
    label: 'Løping',
    description: 'Fra intervall på bane til langløp i terreng. Sone-styrt plan og pace-utvikling.',
    priority: false,
  },
  {
    slug: 'sykling',
    label: 'Sykling',
    description: 'Landevei og terreng. Effekt-soner, høydemeter og sammenligning over sesong.',
    priority: false,
  },
  {
    slug: 'triatlon',
    label: 'Triatlon',
    description: 'Tre disipliner i én plan. Bytt-tider, brick-økter og periodisering mot konkurranse.',
    priority: false,
  },
]

export function findFeatureSport(slug: string): FeatureSport | null {
  return FEATURE_SPORTS.find(s => s.slug === slug) ?? null
}
