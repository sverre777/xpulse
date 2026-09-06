import Link from 'next/link'
import { FEATURE_SPORTS, type FeatureSportSlug } from '@/lib/landing-meta'

// UNDERSIDENE v2 bolk B5 - «Andre idretter» nederst. Samme rad som forsidens
// «Velg din disiplin»: bilde, navn og SEO-linja fra landing-meta (én kilde).
// Idretten man står på utelates.

const BILDE: Partial<Record<FeatureSportSlug, string>> = {
  langrenn: 'langrenn-hoved-rulleski-kollen',
  skiskyting: 'skiskyting-hoved-tunnel',
  langlop: 'langlop-hoved-drone-skogslop',
  loping: 'loping-hoved-fjell-gress',
}
const FOTO: Partial<Record<FeatureSportSlug, string>> = {
  sykling: '/photos/sykling.jpg',
  triatlon: '/photos/triatlon.jpg',
  multisport: '/photos/multisport.jpg',
}

export function AndreIdretter({ utelat }: { utelat?: FeatureSportSlug }) {
  const idretter = FEATURE_SPORTS.filter(s => s.slug !== utelat)
  return (
    <section className="lp-andre">
      <div className="lp-kap">Andre idretter</div>
      <h2>SAMME APP, EGNE VERKTØY.</h2>
      <div className="lp-idrettsrad">
        {idretter.map(s => {
          const basis = BILDE[s.slug]
          return (
            <Link key={s.slug} href={`/funksjoner/${s.slug}`} className="lp-ip">
              {basis ? (
                <img src={`/underside/${basis}-760.webp`} alt="" loading="lazy" decoding="async" />
              ) : (
                <img src={FOTO[s.slug] ?? '/photos/hero-bg.jpg'} alt="" loading="lazy" decoding="async" />
              )}
              <span>{s.label}<small>{(s.seoTitle ?? '').split(' - ')[0]}</small></span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
