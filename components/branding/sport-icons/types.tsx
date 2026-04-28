// Felles props for alle sport-ikoner i landing-siden.
//
// Ikonene er PNG-er hentet fra public/sport-icons/. Vi tvinger dem til ren
// oransje (#FF4500) med CSS-filter i stedet for å re-eksportere fargede
// versjoner. Filteret er kalibrert for de eksisterende grayscale-PNG-ene
// fra hero-strip-en.

export interface SportIconProps {
  className?: string
  size?: number
}

export const ICON_DEFAULT_CLASS = 'w-6 h-6'

export const ORANGE_PNG_FILTER =
  'brightness(0) saturate(100%) invert(34%) sepia(96%) saturate(4990%) ' +
  'hue-rotate(7deg) brightness(102%) contrast(106%)'

// Felles render for sport-ikon-PNG. Hver navngitt ikon-komponent (LangrennIcon
// osv.) er en tynn wrapper rundt denne — bevarer eksisterende API (className
// + size) og hindrer at hvert komponent-fil må gjenta samme markup.
interface SportIconImgProps extends SportIconProps {
  src: string
  alt?: string
}

export function SportIconImg({ src, alt = '', className = ICON_DEFAULT_CLASS, size }: SportIconImgProps) {
  const sizeStyle: React.CSSProperties | undefined = size
    ? { width: size, height: size }
    : undefined
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      className={className}
      style={{
        objectFit: 'contain',
        display: 'block',
        filter: ORANGE_PNG_FILTER,
        ...sizeStyle,
      }}
    />
  )
}
