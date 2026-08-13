import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/super-admin/',
          '/teacher/',
          '/student/',
          '/api/',
          '/auth/',
          '/home',
          '/t/',
          '/scanner',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
