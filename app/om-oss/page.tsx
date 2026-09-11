import Link from 'next/link'
import { LandingShell } from '@/components/landing/LandingShell'

// Kort «om oss». Ingen navn - vi er utholdenhetsutøvere som bygde verktøyet
// vi selv manglet. Lenkes fra topplinja (Om oss) og footerne.

export const metadata = {
  title: 'Om oss - X-PULSE',
  description: 'X-PULSE er bygget av utholdenhetsutøvere, for utholdenhetsutøvere. Her er hvorfor.',
}

const FONT_TITTEL = "'Bebas Neue', sans-serif"
const FONT_TEKST = "'Barlow Condensed', sans-serif"

function Avsnitt({ children }: { children: React.ReactNode }) {
  return <p className="text-lg mb-5" style={{ fontFamily: FONT_TEKST, color: 'var(--tekst-3-app)', lineHeight: 1.6 }}>{children}</p>
}

export default function OmOssPage() {
  return (
    <LandingShell aktiv="om">
      <div className="px-4 py-12" style={{ backgroundColor: 'var(--flate-3)' }}>
        <div className="max-w-2xl mx-auto">
          <span className="inline-block mb-4 px-2.5 py-1 text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT_TEKST, color: '#FF4500', border: '1px solid var(--kant-6)', letterSpacing: '0.2em' }}>
            Om oss
          </span>
          <h1 className="text-5xl md:text-6xl mb-8" style={{ fontFamily: FONT_TITTEL, color: 'var(--tekst-1-app)', letterSpacing: '0.08em' }}>
            Bygget av utholdenhetsutøvere
          </h1>

          <Avsnitt>
            Vi som lager X-PULSE trener selv. Langrenn, skiskyting, løping, sykling - og i
            mange år har vi ført treningen i regneark, i notatapper og i verktøy laget for
            noe annet: for å dele turer, for å telle skritt, for å se på et kart.
          </Avsnitt>
          <Avsnitt>
            Ingen av dem var laget for det vi faktisk trenger: en plan som møter
            virkeligheten. Soner som er våre egne. Skyting ført der den skjedde, på
            pulskurven. En trener som ser det samme som utøveren, uten å be om et
            skjermbilde. Og analyse som svarer på det vi lurer på i sesongen, ikke på
            slutten av den.
          </Avsnitt>
          <Avsnitt>
            Så vi bygde det selv. X-PULSE er en treningsdagbok og planlegger for
            utholdenhetsidrett, laget i Norge, av folk som bruker den hver dag. Den skal
            være rask nok til å føre en økt i garderoben, og dyp nok til å planlegge en
            sesong.
          </Avsnitt>
          <Avsnitt>
            Vi er små, og vi vil være det en stund. Det betyr at når du skriver til oss,
            leser en av oss det - og ofte ender det som en endring i appen. Si fra hva du
            savner.
          </Avsnitt>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/kontakt" className="text-sm"
              style={{ fontFamily: FONT_TEKST, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#FFFFFF', backgroundColor: '#FF4500', borderRadius: 999, padding: '12px 24px', textDecoration: 'none' }}>
              Kontakt oss
            </Link>
            <Link href="/nytt" className="text-sm"
              style={{ fontFamily: FONT_TEKST, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-1-app)', border: '1px solid var(--kant-4)', borderRadius: 999, padding: '12px 24px', textDecoration: 'none' }}>
              Hva er nytt
            </Link>
          </div>
        </div>
      </div>
    </LandingShell>
  )
}
