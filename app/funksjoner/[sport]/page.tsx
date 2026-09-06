import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingSnarvei } from '@/components/landing/LandingSnarvei'
import { SportFeatureSection, SportPageCTA } from '@/components/landing/SportFeatureSection'
import { buildFeatureMetadata, FEATURE_SPORTS, findFeatureSport } from '@/lib/landing-meta'
import { getSportPageContent } from '@/lib/sport-feature-content'
// Dynamisk rute for alle sport-undersider. Innhold pluk­kes fra
// SPORT_PAGE_CONTENT etter slug; mangler innhold (fortsatt null for sykling
// og triatlon) → 404 inntil Chunk 6 fyller dem inn.



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
  if (!meta || !content) return { title: 'Funksjon - X-PULSE' }
  return buildFeatureMetadata({
    title: meta.seoTitle ?? meta.label,
    description: content.metaDescription,
    path: `/funksjoner/${meta.slug}`,
  })
}

export default async function SportFeaturePage(
  { params }: { params: Promise<{ sport: string }> },
) {
  const { sport } = await params
  const content = getSportPageContent(sport)
  const meta = findFeatureSport(sport)
  if (!content) notFound()

  // H1 er SØKEORDET, hentet fra seoTitle i landing-meta - én kilde (bolk B2).
  const sok = (meta?.seoTitle ?? `Treningsdagbok for ${meta?.label ?? ''}`).split(' - ')[0]
  const snarveier = [
    ...content.sections.filter(x => x.id).map(x => ({ id: x.id!, navn: x.snarvei ?? x.kicker ?? x.title })),
    ...(content.faq?.length ? [{ id: 'faq', navn: 'Spørsmål' }] : []),
  ]

  return (
    <LandingShell aktiv="idretter">
      <LandingHero
        bilde={content.hero.bilde ?? 'langrenn-hoved-rulleski-kollen'}
        alt={content.hero.alt ?? meta?.label ?? ''}
        smuler={[
          { navn: 'Forsiden', href: '/xpulse.html' },
          { navn: 'Idretter', href: '/xpulse.html#sports' },
          { navn: meta?.label ?? '' },
        ]}
        kicker={content.hero.kicker}
        overskrift={sok}
        ingress={content.hero.description}
        bevis={content.hero.bevis ?? []}
        ctaSekHref={`#${content.sections[0]?.id ?? 'okt'}`}
      />

      <LandingSnarvei punkter={snarveier} />

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
