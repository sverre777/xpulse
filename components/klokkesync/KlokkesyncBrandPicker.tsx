import Link from 'next/link'
import { StravaLogo } from '@/components/strava/StravaBrand'
import { KLOKKESYNC_BRANDS, type KlokkesyncBrand } from '@/lib/klokkesync-brands'

// Merkevelgeren. SAMME komponent brukes tre steder:
//  1. klokkesync-siden når brukeren ikke har noen tilkobling (hovedinngangen)
//  2. klokkesync-siden under «Koble til flere» når de har minst én
//  3. nederst på hver merkeside («Eller koble til et annet merke»)
//
// Alt innhold kommer fra KLOKKESYNC_BRANDS — nytt merke legges til ved å
// utvide lista, ikke ved å kopiere denne komponenten.
//
// Mobil: hver rad er en liste-rad med minst 44px trykkflate, ikke et tett
// ikonrutenett. Merker som ikke er live rendres som <div>, ikke <Link>, så de
// verken er klikkbare eller tab-bare.

interface Props {
  title?: string
  intro?: string
  /** Merket brukeren allerede er på — utelates fra lista. */
  activeSlug?: string
  /** Merker brukeren allerede har koblet til — markeres. */
  connectedSlugs?: string[]
  /** Vis henvisningen til .fit-opplasting under lista. */
  showFitHint?: boolean
}

export function KlokkesyncBrandPicker({
  title = 'Velg klokkemerke',
  intro,
  activeSlug,
  connectedSlugs = [],
  showFitHint = true,
}: Props) {
  const brands = KLOKKESYNC_BRANDS.filter(b => b.slug !== activeSlug)
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-3"
        style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: '0.06em', color: 'var(--tekst-1-app)', margin: 0,
        }}>
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        {title}
      </h2>
      {intro && (
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
          color: 'rgba(242,240,236,0.6)', lineHeight: 1.7, margin: '8px 0 14px',
        }}>
          {intro}
        </p>
      )}

      <ul className="list-none p-0 m-0" style={{ display: 'grid', gap: 10 }}>
        {brands.map(brand => (
          <li key={brand.slug}>
            <BrandRow brand={brand} connected={connectedSlugs.includes(brand.slug)} />
          </li>
        ))}
      </ul>

      {showFitHint && (
        <div className="mt-4 p-4"
          style={{
            background: 'rgba(40,168,110,0.06)',
            border: '1px solid rgba(40,168,110,0.3)', borderRadius: 10,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'rgba(242,240,236,0.8)', lineHeight: 1.6,
          }}>
          <strong style={{ color: '#28A86E' }}>Uansett merke:</strong> du kan alltid laste opp
          {' '}<strong style={{ color: 'var(--tekst-1-app)' }}>.fit-filer</strong> manuelt — fra alle klokkemerker,
          med full data, og uten noen tilkobling. Opplastingen ligger lenger ned på denne siden.
        </div>
      )}
    </section>
  )
}

function BrandRow({ brand, connected }: { brand: KlokkesyncBrand; connected: boolean }) {
  const live = brand.status === 'live'
  const body = (
    <div className="flex items-center justify-between gap-3"
      style={{
        // 44px+ trykkflate på mobil.
        minHeight: 56,
        padding: '12px 14px',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${live ? brand.accent : 'var(--kant-6)'}`,
        borderRadius: 12,
        opacity: live ? 1 : 0.55,
      }}>
      <div className="flex items-center gap-3 min-w-0">
        <BrandMark brand={brand} />
        <div className="min-w-0">
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
          letterSpacing: '0.06em', color: 'var(--tekst-1-app)',
        }}>
          {brand.name}
        </div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5,
          color: 'rgba(242,240,236,0.6)', lineHeight: 1.5,
        }}>
          {brand.tagline}
        </div>
        </div>
      </div>
      <span className="shrink-0" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: connected ? '#28A86E' : live ? brand.accent : 'var(--tekst-8-app)',
      }}>
        {connected ? '✓ Tilkoblet' : live ? 'Koble til →' : 'Kommer'}
      </span>
    </div>
  )

  if (!live) {
    return <div aria-disabled="true">{body}</div>
  }
  return (
    <Link href={`/app/innstillinger/klokkesync/${brand.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      {body}
    </Link>
  )
}

// Merke-flis. Tre varianter, i prioritert rekkefølge:
//   1. brand.logoSrc — offisiell logo-fil når vi har den (legges i /public)
//   2. Strava — merkets egen logo, som vi både har og SKAL bruke
//   3. nøytralt monogram i merkets farge
//
// Vi tegner ikke andre merkers logoer selv. En omtrentlig kopi av et varemerke
// er dårligere enn en ren monogram-flis, både visuelt og juridisk — og for
// Polar er logobruk eksplisitt begrenset i lisensavtalen.
export function BrandMark({ brand, size = 40 }: { brand: KlokkesyncBrand; size?: number }) {
  const live = brand.status === 'live'
  const letter = brand.mark ?? brand.name.slice(0, 1).toUpperCase()

  // Live merker får FYLT flis i merkefargen med utsparet bokstav — det leser
  // som et bevisst designelement, ikke som en logo som ikke lastet. Merker
  // som ikke er live får dempet omriss, så de trer tydelig tilbake.
  const style: React.CSSProperties = live
    ? { background: brand.accent, border: 'none' }
    : { background: 'transparent', border: '1px solid var(--kant-6)' }
  const inkColor = live ? '#0A0A0B' : '#555560'

  return (
    <span
      aria-hidden="true"
      className="shrink-0 inline-flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.26, ...style }}>
      {brand.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoSrc} alt="" width={size * 0.62} height={size * 0.62}
          style={{ objectFit: 'contain' }} />
      ) : brand.branding === 'strava' ? (
        // Stravas egen logo, hvit på merkefargen — slik brand guidelines viser den.
        <StravaLogo size={size * 0.58} color="var(--tekst-1-ren)" />
      ) : (
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: size * 0.52, lineHeight: 1, color: inkColor,
          letterSpacing: '0.02em', paddingTop: size * 0.04,
        }}>
          {letter}
        </span>
      )}
    </span>
  )
}
