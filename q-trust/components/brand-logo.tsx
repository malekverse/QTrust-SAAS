import Image from "next/image"
import { cn } from "@/lib/utils"

/** Paths under `public/q-trust_logo` */
export const brandAssetPaths = {
  symbol: "/q-trust_logo/logo_symbol.png",
  withTitle: "/q-trust_logo/logo_with_title.png",
  symbolWhiteBg: "/q-trust_logo/logo_symbol_white_bg.png",
  fullWithTitleWhiteBg: "/q-trust_logo/full_logo_with_title_white_bg.png",
  whiteSymbol: "/q-trust_logo/white_logo_symbol.png",
  whiteWithTitle: "/q-trust_logo/white_logo_with_title.png",
} as const

type BrandLogoProps = {
  variant: keyof typeof brandAssetPaths
  className?: string
  priority?: boolean
  sizes?: string
}

const intrinsic = {
  symbol: { width: 256, height: 256 },
  withTitle: { width: 800, height: 240 },
  symbolWhiteBg: { width: 256, height: 256 },
  fullWithTitleWhiteBg: { width: 1200, height: 360 },
  whiteSymbol: { width: 665, height: 668 },
  whiteWithTitle: { width: 880, height: 1194 },
} as const

const defaultAlt = "Q-Trust"

export function BrandLogo({ variant, className, priority, sizes }: BrandLogoProps) {
  const { width, height } = intrinsic[variant]
  return (
    <Image
      src={brandAssetPaths[variant]}
      alt={defaultAlt}
      width={width}
      height={height}
      className={cn("object-contain object-center shrink-0", className)}
      priority={priority}
      {...(sizes ? { sizes } : {})}
    />
  )
}
