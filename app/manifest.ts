import type { MetadataRoute } from 'next'

// Web app manifest — gjør at X-PULSE kan legges på hjemskjermen og kjøre
// standalone (uten nettleser-chrome). Next serverer den som
// /manifest.webmanifest og lenker den automatisk fra alle app-sider.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'X-PULSE',
    short_name: 'X-PULSE',
    description: 'Treningsdagbok og planlegger for utholdenhetsutøvere.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0A0A0B',
    // Manifestet kan ikke være tema-avhengig — det leses ved installasjon og har
    // ingen varianter. I en kjørende nettleser vinner <meta name="theme-color">
    // over denne, og den settes per tema fra lib/tema.ts. Dette er altså
    // installasjons-standarden, ikke det brukeren ser i appen.
    theme_color: '#0A0A0B',
    icons: [
      { src: '/x-pulse-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/x-pulse-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
