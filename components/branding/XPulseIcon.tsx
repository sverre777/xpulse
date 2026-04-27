// To-farget X-ikon brukt som "X" i X-PULSE-logoen. Oransje (utøver) i øvre
// venstre del, blå (trener) i nedre høyre — samme split som favicon.
//
// Transparent bakgrunn: ingen <rect>-fyll, slik at logoen kan ligge over
// nav-gradienten eller andre bakgrunner uten boks rundt.
//
// id-er på clip-paths har unike navn slik at flere instanser av ikonet på
// samme side ikke kolliderer.

let counter = 0

interface Props {
  size?: number
  className?: string
  ariaLabel?: string
}

export function XPulseIcon({ size = 24, className, ariaLabel }: Props) {
  const uid = ++counter
  const tlId = `xpulse-tl-${uid}`
  const brId = `xpulse-br-${uid}`
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <defs>
        <clipPath id={tlId}>
          <polygon points="0,0 200,200 0,200" />
        </clipPath>
        <clipPath id={brId}>
          <polygon points="0,0 200,0 200,200" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${tlId})`}>
        <path
          d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z"
          fill="#FF4500"
        />
      </g>
      <g clipPath={`url(#${brId})`}>
        <path
          d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z"
          fill="#1A6FD4"
        />
      </g>
    </svg>
  )
}
