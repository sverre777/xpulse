import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection, SportPageCTA } from '@/components/landing/SportFeatureSection'
import { buildFeatureMetadata, FEATURE_SPORTS, findFeatureSport } from '@/lib/landing-meta'
import { getSportPageContent } from '@/lib/sport-feature-content'
import {
  LangrennIcon, SkiskytingIcon, LanglopIcon, LopingIcon,
  SyklingIcon, TriatlonIcon,
} from '@/components/branding/sport-icons'

// Dynamisk rute for alle sport-undersider. Innhold pluk­kes fra
// SPORT_PAGE_CONTENT etter slug; mangler innhold (fortsatt null for sykling
// og triatlon) → 404 inntil Chunk 6 fyller dem inn.

const ICONS = {
  langrenn: LangrennIcon,
  skiskyting: SkiskytingIcon,
  langlop: LanglopIcon,
  loping: LopingIcon,
  sykling: SyklingIcon,
  triatlon: TriatlonIcon,
} as const

export async function generateStaticParams() {
  // Bare sporter med innhold registrert i SPORT_PAGE_CONTENT skal pre-rendres.
  // Resterende slugs (sykling, triatlon) går gjennom Chunk 6 før de aktiveres.
  return FEATURE_SPORTS
    .filter(s => getSportPageContent(s.slug) !== null)
    .map(s => ({ sport: s.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ sport: string }> },
): Promise<Metadata> {
  const { sport } = await params
  const meta = findFeatureSport(sport)
  const content = getSportPageContent(sport)
  if (!meta || !content) return { title: 'Funksjon — X-PULSE' }
  return buildFeatureMetadata({
    title: meta.label,
    description: content.metaDescription,
    path: `/funksjoner/${meta.slug}`,
  })
}

export default async function SportFeaturePage(
  { params }: { params: Promise<{ sport: string }> },
) {
  const { sport } = await params
  const content = getSportPageContent(sport)
  if (!content) notFound()
  const Icon = ICONS[content.slug]

  return (
    <LandingShell>
      <SportPageHero
        kicker={content.hero.kicker}
        title={
          <>
            {content.hero.titleLines.map((line, i) => (
              <span key={i} style={
                i === content.hero.titleLines.length - 1
                  ? { color: '#FF4500' }
                  : undefined
              }>
                {line}
                {i < content.hero.titleLines.length - 1 && <br />}
              </span>
            ))}
          </>
        }
        description={content.hero.description}
        icon={<Icon size={140} />}
      />

      {content.sections.map((s, i) => (
        <SportFeatureSection
          key={s.id ?? i}
          id={s.id}
          kicker={s.kicker}
          title={s.title}
          intro={s.intro}
          bullets={s.bullets}
        />
      ))}

      <SportPageCTA />
    </LandingShell>
  )
}
