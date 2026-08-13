import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SessionProvider } from "@/components/providers/session-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { ToastProvider } from "@/components/ui/toast"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const faviconBase = "/q-trust_logo/q-trust_favicon"

export const metadata: Metadata = {
  title: {
    default: "Q-Trust — منصة إدارة جمعيات تحفيظ القرآن",
    template: "%s | Q-Trust"
  },
  description: "منصة إدارة جمعيات ومدارس تحفيظ القرآن: الحضور بمسح QR، المدفوعات، والمتابعة في مكان واحد.",
  keywords: ["قرآن", "تحفيظ", "جمعية", "حضور", "إدارة", "تونس"],
  manifest: `${faviconBase}/site.webmanifest`,
  icons: {
    icon: [
      { url: `${faviconBase}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
      { url: `${faviconBase}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      {
        url: `${faviconBase}/android-chrome-192x192.png`,
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: `${faviconBase}/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    title: "Q-Trust",
    statusBarStyle: "default",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Arabic Font - Amiri */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <SessionProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <ToastProvider>
                {children}
              </ToastProvider>
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
