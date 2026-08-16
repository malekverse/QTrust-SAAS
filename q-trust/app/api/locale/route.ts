import { NextRequest, NextResponse } from 'next/server'
import { locales, type Locale } from '@/i18n/config'

export async function POST(request: NextRequest) {
  const { locale } = await request.json()
  if (!locales.includes(locale as Locale)) {
    return NextResponse.json({ message: 'Invalid locale' }, { status: 400 })
  }

  const res = NextResponse.json({ locale })
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return res
}
