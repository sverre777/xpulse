import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { KlokkesyncBrandPicker, BrandMark } from '@/components/klokkesync/KlokkesyncBrandPicker'
import { StravaConnectPanel } from '@/components/strava/StravaConnectPanel'
import { PoweredByStravaBadge } from '@/components/strava/StravaBrand'
import { getKlokkesyncBrand, KLOKKESYNC_BRANDS, type KlokkesyncBrand } from '@/lib/klokkesync-brands'

// Merkets egen side: /app/innstillinger/klokkesync/<merke>
//
// ÉN rute for alle merker — innholdet kommer fra KLOKKESYNC_BRANDS, så nytt
// merke krever ingen ny fil. Merker som ikke er live gir 404 (de er heller
// ikke klikkbare i velgeren).
//
// Nederst ligger merkevelgeren igjen («Eller koble til et annet merke») med
// det aktive merket utelatt — samme komponent som på hovedsiden, ikke en kopi.

interface Props {
  params: Promise<{ merke: string }>
}

export default async function KlokkesyncMerkeSide({ params }: Props) {
  const { merke } = await params
  const brand = getKlokkesyncBrand(merke)
  if (!brand || brand.status !== 'live') notFound()

  const user = await getAuthUser()
  if (!user) redirect('/app')

  const supabase = await createClient()

  // Hvilke merker brukeren allerede har koblet til — brukes både til å vise
  // riktig tilstand her og til å markere dem i velgeren nederst.
  const connectedSlugs: string[] = []
  for (const b of KLOKKESYNC_BRANDS) {
    if (!b.connectionTable) continue
    const { data } = await supabase
      .from(b.connectionTable)
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) connectedSlugs.push(b.slug)
  }
  const isConnected = connectedSlugs.includes(brand.slug)

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title={brand.name} />

        <div className="space-y-8">
          <Link href="/app/innstillinger/klokkesync"
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 44,
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#8A8A96', textDecoration: 'none',
            }}>
            ← Klokkesync
          </Link>

          <section className="p-5"
            style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 14, borderTop: `3px solid ${brand.accent}`,
            }}>
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="flex items-center gap-3" style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
                letterSpacing: '0.06em', color: '#F0F0F2', margin: 0,
              }}>
                <BrandMark brand={brand} size={44} />
                {brand.name}
              </h2>
              {/* Stravas brand guidelines krever «Powered by Strava»-merking
                  der Strava-data vises. Polar har motsatt regel: navnet brukes
                  nøytralt, og kilden krediteres tekstlig. Styres av lista. */}
              {brand.branding === 'strava' && <PoweredByStravaBadge />}
            </div>

            {brand.intro && (
              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
                color: 'rgba(242,240,236,0.75)', lineHeight: 1.7, marginBottom: 18,
              }}>
                {brand.intro}
              </p>
            )}

            {isConnected ? (
              <div className="p-4"
                style={{
                  background: 'rgba(40,168,110,0.08)',
                  border: '1px solid rgba(40,168,110,0.4)', borderRadius: 10,
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                  color: 'rgba(242,240,236,0.85)', lineHeight: 1.6,
                }}>
                <strong style={{ color: '#28A86E' }}>✓ {brand.name} er koblet til.</strong>
                <br />
                Synk-status, auto-synk og frakobling ligger på{' '}
                <Link href="/app/innstillinger/klokkesync" style={{ color: '#FF4500' }}>
                  klokkesync-siden
                </Link>.
              </div>
            ) : brand.branding === 'strava' ? (
              <StravaConnectPanel />
            ) : (
              <>
                <a href={brand.connectPath}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 44, padding: '11px 22px',
                    background: brand.accent, color: '#F0F0F2',
                    borderRadius: 10, textDecoration: 'none',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
                  }}>
                  Koble til {brand.name}
                </a>
                <p style={{
                  marginTop: 10, fontSize: 12, color: 'rgba(242,240,236,0.5)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  Ved tilkobling samtykker du til {brand.name} sine vilkår og X-PULSE sine vilkår.
                </p>
              </>
            )}
          </section>

          <BrandFacts brand={brand} />

          <KlokkesyncBrandPicker
            title="Eller koble til et annet merke"
            activeSlug={brand.slug}
            connectedSlugs={connectedSlugs}
            showFitHint={false}
          />
        </div>
      </div>
    </div>
  )
}

function BrandFacts({ brand }: { brand: KlokkesyncBrand }) {
  type Block = { title: string; items?: string[]; tone: 'nøytral' | 'advarsel' }
  const blocks: Block[] = ([
    { title: 'Hva vi henter', items: brand.fetches, tone: 'nøytral' },
    { title: 'Hva vi lagrer', items: brand.stores, tone: 'nøytral' },
    { title: 'Viktig å vite', items: brand.limits, tone: 'advarsel' },
    { title: 'Hva som skjer ved frakobling', items: brand.deletion, tone: 'advarsel' },
  ] as Block[]).filter(b => (b.items?.length ?? 0) > 0)

  return (
    <section className="space-y-4">
      {blocks.map(block => (
        <div key={block.title} className="p-4"
          style={{
            background: block.tone === 'advarsel' ? 'rgba(245,197,66,0.05)' : 'var(--card)',
            border: `1px solid ${block.tone === 'advarsel' ? 'rgba(245,197,66,0.3)' : 'var(--line)'}`,
            borderRadius: 12,
          }}>
          <p className="mb-2" style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: block.tone === 'advarsel' ? '#F5C542' : '#8A8A96', margin: 0,
          }}>
            {block.title}
          </p>
          <ul className="mt-2 space-y-1.5 list-none p-0" style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'rgba(242,240,236,0.8)', lineHeight: 1.6,
          }}>
            {block.items!.map(item => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      ))}

      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
        color: '#555560', lineHeight: 1.7, margin: 0,
      }}>
        {brand.credit && <>Datakilde: {brand.credit}. </>}
        {brand.privacyUrl && (
          <>
            {brand.name} sin personvernerklæring:{' '}
            <a href={brand.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#8A8A96' }}>
              {brand.privacyLabel ?? brand.privacyUrl}
            </a>. {' '}
          </>
        )}
        Se også X-PULSE sin{' '}
        <Link href="/personvern" style={{ color: '#8A8A96' }}>personvernerklæring</Link>.
      </p>
    </section>
  )
}
