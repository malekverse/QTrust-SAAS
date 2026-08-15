import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://q-trust-saas.vercel.app'

// Only the public marketing surface belongs in the sitemap — the
// authenticated dashboards are deliberately invisible to search engines.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/features', '/pricing', '/demo', '/about', '/contact', '/terms', '/privacy']
  const now = new Date()
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/pricing' || route === '/demo' ? 0.9 : 0.6,
  }))
}
