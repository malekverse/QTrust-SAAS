import type { Metadata } from "next"
import { IBM_Plex_Sans_Arabic } from "next/font/google"
import "./marketing.css"
import { LenisProvider } from "@/components/marketing/lenis-provider"

const plexArabic = IBM_Plex_Sans_Arabic({
  weight: ["400", "500", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-mk-sans",
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://q-trust-saas.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Q-Trust — منصة إدارة جمعيات تحفيظ القرآن",
    template: "%s | Q-Trust",
  },
  description:
    "استبدل دفاتر الحضور الورقية بنظام رقمي متكامل: حضور بمسح QR، متابعة المدفوعات، بوابة للطلاب والأولياء، ومساعد ذكي — منصة واحدة لإدارة جمعيتك.",
  openGraph: {
    type: "website",
    locale: "ar_TN",
    siteName: "Q-Trust",
    images: [{ url: "/q-trust_logo/full_logo_with_title_white_bg.png", width: 1200, height: 360 }],
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`mk ${plexArabic.variable}`} data-js="false" id="mk-root">
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('mk-root').setAttribute('data-js','true')`,
        }}
      />
      <LenisProvider />
      {children}
    </div>
  )
}
