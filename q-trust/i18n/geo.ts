import { type Locale } from './config'

// Countries where Arabic is the primary or dominant everyday language.
// ISO 3166-1 alpha-2 codes, as sent by Vercel's `x-vercel-ip-country` header.
const ARABIC_COUNTRIES = new Set([
  'DZ', // Algeria
  'BH', // Bahrain
  'TD', // Chad (Arabic co-official, Chadian Arabic is the lingua franca)
  'EG', // Egypt
  'IQ', // Iraq
  'JO', // Jordan
  'KW', // Kuwait
  'LB', // Lebanon
  'LY', // Libya
  'MR', // Mauritania
  'MA', // Morocco
  'OM', // Oman
  'PS', // Palestine
  'QA', // Qatar
  'SA', // Saudi Arabia
  'SO', // Somalia (Arabic co-official)
  'SD', // Sudan
  'SY', // Syria
  'TN', // Tunisia
  'AE', // United Arab Emirates
  'YE', // Yemen
])

// Countries/territories where French is the primary or dominant public language.
const FRENCH_COUNTRIES = new Set([
  'FR', // France
  'BE', // Belgium
  'LU', // Luxembourg
  'MC', // Monaco
  'CH', // Switzerland (multilingual; French is the strongest match we offer)
  // Francophone Africa
  'BJ', // Benin
  'BF', // Burkina Faso
  'BI', // Burundi
  'CM', // Cameroon
  'CF', // Central African Republic
  'KM', // Comoros
  'CG', // Congo-Brazzaville
  'CD', // Congo-Kinshasa
  'CI', // Côte d'Ivoire
  'DJ', // Djibouti
  'GA', // Gabon
  'GN', // Guinea
  'MG', // Madagascar
  'ML', // Mali
  'NE', // Niger
  'SN', // Senegal
  'TG', // Togo
  // Caribbean / other
  'HT', // Haiti
  // French overseas territories
  'GP', // Guadeloupe
  'MQ', // Martinique
  'GF', // French Guiana
  'RE', // Réunion
  'YT', // Mayotte
  'NC', // New Caledonia
  'PF', // French Polynesia
  'PM', // Saint Pierre and Miquelon
  'WF', // Wallis and Futuna
  'BL', // Saint Barthélemy
  'MF', // Saint Martin
])

/**
 * Strong geo signal only: returns 'ar' or 'fr' when the country clearly maps
 * to one of them (Quebec counts as French). Returns null otherwise so the
 * caller can fall through to the visitor's browser language — that's what
 * makes the detection "intelligent" instead of a blunt country table.
 */
export function localeForCountry(
  country?: string | null,
  region?: string | null
): Locale | null {
  if (!country) return null
  const c = country.toUpperCase()
  if (c === 'CA') return region?.toUpperCase() === 'QC' ? 'fr' : null
  if (ARABIC_COUNTRIES.has(c)) return 'ar'
  if (FRENCH_COUNTRIES.has(c)) return 'fr'
  return null
}

/**
 * Picks the first supported language from the browser's Accept-Language
 * header (browsers already order entries by preference).
 */
export function localeFromAcceptLanguage(header?: string | null): Locale | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase()
    if (tag.startsWith('ar')) return 'ar'
    if (tag.startsWith('fr')) return 'fr'
    if (tag.startsWith('en')) return 'en'
  }
  return null
}

/**
 * Full detection chain for first-time visitors (no NEXT_LOCALE cookie):
 * geo country (ar/fr regions, Quebec → fr) → browser language → English.
 * Header reads only — zero external calls, zero added latency.
 */
export function detectLocale(opts: {
  country?: string | null
  region?: string | null
  acceptLanguage?: string | null
}): Locale {
  return (
    localeForCountry(opts.country, opts.region) ??
    localeFromAcceptLanguage(opts.acceptLanguage) ??
    'en'
  )
}
