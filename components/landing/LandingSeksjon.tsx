import { AppFragment } from './AppFragment'

// UNDERSIDENE v2 bolk B4 - én seksjon: kicker, H2, ingress og tre punktbokser med
// oransje venstrekant, med media vekselvis til høyre og venstre. Media er enten et
// ekte produktfragment (regel 11), et foto, eller merkelista for klokkesynk - den
// har ingen skjerm, og merkene vises bare når integrasjonen er live og klarert.

export interface LandingPunkt { tittel: string; tekst: string }

export type LandingMedia =
  | { type: 'app'; navn: string; kap: string; hoyde?: number }
  | { type: 'foto'; bilde: string; alt: string; blaa?: boolean }
  | { type: 'merker'; merker: { navn: string; status: string; pavei?: boolean }[]; fot?: string }

interface Props {
  id?: string
  kicker?: string
  tittel: string
  ingress?: string
  punkter?: LandingPunkt[]
  media?: LandingMedia
  /** Annenhver seksjon speiles (fasit): media til venstre. */
  speilvendt?: boolean
  blaa?: boolean
}

export function LandingSeksjon({ id, kicker, tittel, ingress, punkter, media, speilvendt, blaa }: Props) {
  return (
    <section className="lp-us" id={id}>
      <div className={`lp-us-inn${media ? (speilvendt ? ' rev' : '') : ' full'}`}>
        <div className="lp-us-tekst">
          {kicker && <div className="lp-kap" style={blaa ? { color: '#1A6FD4' } : undefined}>{kicker}</div>}
          <h2>{tittel}</h2>
          {ingress && <p className="lp-ing">{ingress}</p>}
          {punkter && punkter.length > 0 && (
            <div className="lp-pkg">
              {punkter.map(p => (
                <div key={p.tittel} className={`lp-pk${blaa ? ' blaa' : ''}`}>
                  <b>{p.tittel}</b>
                  <p>{p.tekst}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {media && <div className="lp-us-media">
          {media?.type === 'app' && (
            <div className="lp-skjerm">
              <div className="lp-sk-topp"><span className="lp-sk-kap">{media.kap}</span></div>
              <AppFragment navn={media.navn} hoyde={media.hoyde} />
            </div>
          )}
          {media?.type === 'foto' && (
            <div className={`lp-foto${media.blaa ? ' blaa' : ''}`}>
              <img src={`/underside/${media.bilde}-1280.webp`} alt={media.alt} loading="lazy" decoding="async"
                srcSet={`/underside/${media.bilde}-760.webp 760w, /underside/${media.bilde}-1280.webp 1280w, /underside/${media.bilde}-1920.webp 1920w`}
                sizes="(max-width: 1000px) 100vw, 640px" />
            </div>
          )}
          {media?.type === 'merker' && (
            <div>
              <div className="lp-klokker">
                {media.merker.map(m => (
                  <span key={m.navn} className={`lp-mrk${m.pavei ? ' pavei' : ''}`}>{m.navn}<em>{m.status}</em></span>
                ))}
              </div>
              {media.fot && <p className="lp-ing" style={{ marginTop: 14, fontSize: 13.5 }}>{media.fot}</p>}
            </div>
          )}
        </div>}
      </div>
    </section>
  )
}
