import type { MetadataRoute } from 'next'

// Offentlige sider skal crawles; hele app-flaten (bak innlogging), onboarding,
// auth og API skal ikke. NB: «/app$» + «/app/» i stedet for «/app» — ren
// prefiks-matching ville også blokkert /apple-icon.png.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app$', '/app/', '/onboarding/', '/auth/', '/api/'],
      },
    ],
    sitemap: 'https://x-pulse.no/sitemap.xml',
  }
}
