// Felles props for alle sport-ikoner i landing-siden.
//
// Ikonene er rene SVG-tegninger uten farge-state — fargen styres med
// currentColor via stroke. Forelderen velger oransje / blå / hvit etter
// kontekst (kort-overlay, nav-element osv.).

export interface SportIconProps {
  className?: string
  size?: number
}

export const ICON_DEFAULT_CLASS = 'w-6 h-6'
