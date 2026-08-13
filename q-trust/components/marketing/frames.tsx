import Image from "next/image"
import { BrandLogo } from "@/components/brand-logo"

// Device frames (§8.2.1 #5/#6): every product visual sits in a clean frame.
// Until the founder's real captures from the demo tenant land (§8.2.8), the
// slot renders an honest, quiet placeholder — never a fake dashboard drawing.

export function ScreenshotSlot({
  src,
  alt,
  aspect = "16/10",
  label = "لقطة حقيقية من المنصة",
  priority = false,
  sizes,
}: {
  src?: string
  alt: string
  aspect?: string
  label?: string
  priority?: boolean
  sizes?: string
}) {
  if (src) {
    return (
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes ?? "(max-width: 768px) 100vw, 960px"}
          className="object-cover object-top"
        />
      </div>
    )
  }
  return (
    <div className="mk-shot-slot w-full" style={{ aspectRatio: aspect }} role="img" aria-label={alt}>
      <BrandLogo variant="symbol" className="h-10 w-10 opacity-40" />
      <span>{label}</span>
    </div>
  )
}

export function BrowserFrame({
  children,
  url = "app.q-trust.tn",
  className = "",
}: {
  children: React.ReactNode
  url?: string
  className?: string
}) {
  return (
    <div className={`mk-browser-frame ${className}`}>
      <div className="mk-browser-bar" aria-hidden="true">
        <span className="mk-browser-dot" />
        <span className="mk-browser-dot" />
        <span className="mk-browser-dot" />
        <span className="mk-browser-url">{url}</span>
      </div>
      {children}
    </div>
  )
}

export function PhoneFrame({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mk-phone-frame ${className}`}>
      <div className="mk-phone-screen">{children}</div>
    </div>
  )
}
