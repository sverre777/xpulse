// Felles props for alle sport-ikoner i landing-siden.
//
// Ikonene er Sverres strektegninger i public/sport-icons/ (oransje strek på
// gjennomsiktig bunn). Klassen xp-idrettsikon (app/globals.css) gjør dem hvite
// i mørk modus og sorte i lys modus - samme regel som forsidens disiplinrad.

export interface SportIconProps {
  className?: string
  size?: number
}

export const ICON_DEFAULT_CLASS = 'w-6 h-6'

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
      className={`xp-idrettsikon ${className}`}
      style={{
        objectFit: 'contain',
        display: 'block',
        ...sizeStyle,
      }}
    />
  )
}
