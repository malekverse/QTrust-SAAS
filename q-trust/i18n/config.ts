export const locales = ['ar', 'fr', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ar'

export function isRtl(locale: Locale): boolean {
  return locale === 'ar'
}
