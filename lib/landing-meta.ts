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
  | 'multisport'

export interface FeatureSport {
  slug: FeatureSportSlug
  label: string
  description: string
  priority: boolean
  // Søkeords-rik tittel brukt i <title>/OG — norske søk («treningsdagbok
  // for skiskyting» osv.). label brukes fortsatt i UI-kort og nav.
  seoTitle?: string
}

export const FEATURE_SPORTS: FeatureSport[] = [
  {
    slug: 'langrenn',
    seoTitle: 'Treningsdagbok for langrenn – skipark, ski-tester og analyse',
    label: 'Langrenn',
    description: 'Klassisk, skøyting og staking. Skipark, ski-tester og bevegelsesform-spesifikk analyse.',
    priority: true,
  },
  {
    slug: 'skiskyting',
    seoTitle: 'Treningsdagbok for skiskyting – skyteanalyse og treff%',
    label: 'Skiskyting',
    description: 'Eneste plattformen med dyp skyting-analyse. Auto-konkurransestruktur og treff% per posisjon.',
    priority: true,
  },
  {
    slug: 'langlop',
    seoTitle: 'Treningsdagbok for langløp – Birken, Vasaloppet og pacing',
    label: 'Langløp',
    description: 'Bygd for Birken og Vasaloppet. Lange utholdenhetsøkter med terreng, ernæring og pacing.',
    priority: true,
  },
  {
    slug: 'loping',
    seoTitle: 'Treningsdagbok for løping – soner, intervaller og pace',
    label: 'Løping',
    description: 'Fra intervall på bane til langløp i terreng. Sone-styrt plan og pace-utvikling.',
    priority: false,
  },
  {
    slug: 'sykling',
    seoTitle: 'Treningsdagbok for sykling – watt og effekt-soner',
    label: 'Sykling',
    description: 'Landevei og terreng. Effekt-soner, høydemeter og sammenligning over sesong.',
    priority: false,
  },
  {
    slug: 'triatlon',
    seoTitle: 'Treningsdagbok for triatlon – tre disipliner, én plan',
    label: 'Triatlon',
    description: 'Tre disipliner i én plan. Bytt-tider, brick-økter og periodisering mot konkurranse.',
    priority: false,
  },
  {
    slug: 'multisport',
    label: 'Multisport',
    seoTitle: 'Treningsdagbok for multisport – all trening i én app',
    description: 'Løping, sykling, ski, styrke — alt du gjør, samlet i én plan og én dagbok.',
    priority: false,
  },
]

export function findFeatureSport(slug: string): FeatureSport | null {
  return FEATURE_SPORTS.find(s => s.slug === slug) ?? null
}
