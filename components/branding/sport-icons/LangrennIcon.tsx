import { SportIconImg, type SportIconProps } from './types'

// Bruker PNG-en fra hero-strip-en, tvunget oransje via CSS-filter.
export function LangrennIcon(props: SportIconProps) {
  return <SportIconImg src="/sport-icons/langrenn.png" {...props} />
}
