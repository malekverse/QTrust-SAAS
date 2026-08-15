import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://q-trust-saas.vercel.app'

// Only the public marketing surface belongs in the sitemap — the
// authenticated dashboards are deliberately invisible to search engines.
export default function sitemap(): MetadataRoute.Sitemap {
  const arRoutes = ['', '/features', '/pricing', '/demo', '/about', '/contact', '/terms', '/privacy']
  const frRoutes = ['/fr', '/fr/features', '/fr/pricing', '/fr/demo', '/fr/about', '/fr/contact', '/fr/terms', '/fr/privacy']
  const now = new Date()

  const arEntries: MetadataRoute.Sitemap = arRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/pricing' || route === '/demo' ? 0.9 : 0.6,
  }))

  const frEntries: MetadataRoute.Sitemap = frRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '/fr' ? 'weekly' : 'monthly',
    priority: route === '/fr' ? 0.9 : route === '/fr/pricing' || route === '/fr/demo' ? 0.8 : 0.5,
  }))

  return [...arEntries, ...frEntries]
}
