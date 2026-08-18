import type { Metadata } from "next"
import { MarketingNav } from "@/components/marketing/nav"
import { MarketingFooter } from "@/components/marketing/footer"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://q-trust-saas.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Q-Trust — Quranic School & Association Management",
    template: "%s | Q-Trust",
  },
  description:
    "Replace paper registers with a complete digital system: QR attendance, payment tracking, student and parent portal, AI assistant — one platform for your school.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Q-Trust",
    images: [{ url: "/q-trust_logo/full_logo_with_title_white_bg.png", width: 1200, height: 360 }],
  },
}

export default function EnglishMarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div dir="ltr" lang="en">
      <MarketingNav locale="en" />
      <main>{children}</main>
      <MarketingFooter locale="en" />
    </div>
  )
}
