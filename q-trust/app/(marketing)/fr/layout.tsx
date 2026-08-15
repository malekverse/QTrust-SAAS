import type { Metadata } from "next"
import { MarketingNav } from "@/components/marketing/nav"
import { MarketingFooter } from "@/components/marketing/footer"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://q-trust-saas.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Q-Trust — Gestion des associations et écoles coraniques",
    template: "%s | Q-Trust",
  },
  description:
    "Remplacez les registres papier par un système numérique complet : présence par QR, suivi des paiements, portail élèves et parents, assistant IA — une seule plateforme pour gérer votre association.",
  openGraph: {
    type: "website",
    locale: "fr_TN",
    siteName: "Q-Trust",
    images: [{ url: "/q-trust_logo/full_logo_with_title_white_bg.png", width: 1200, height: 360 }],
  },
}

export default function FrenchMarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div dir="ltr" lang="fr">
      <MarketingNav locale="fr" />
      <main>{children}</main>
      <MarketingFooter locale="fr" />
    </div>
  )
}
