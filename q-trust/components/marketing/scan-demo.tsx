import { Check } from "lucide-react"
import { PhoneFrame } from "./frames"

// The scanner beat (§8.2.2 #7): a phone mockup looping the product's
// scan-success pulse — the single most-repeated interaction in the product.
// Pure CSS animation (marketing.css); freezes on the success state under
// prefers-reduced-motion.
export function ScanDemo() {
  return (
    <PhoneFrame className="w-64 sm:w-72 mx-auto rotate-3">
      <div className="relative flex h-105 flex-col bg-[hsl(217_33%_12%)] text-white">
        {/* Scanner viewport */}
        <div className="relative mx-6 mt-10 aspect-square overflow-hidden rounded-2xl border border-white/15">
          {/* Corner brackets */}
          <span className="absolute start-2 top-2 h-6 w-6 rounded-ss-lg border-s-2 border-t-2 border-white/60" aria-hidden="true" />
          <span className="absolute end-2 top-2 h-6 w-6 rounded-se-lg border-e-2 border-t-2 border-white/60" aria-hidden="true" />
          <span className="absolute bottom-2 start-2 h-6 w-6 rounded-es-lg border-b-2 border-s-2 border-white/60" aria-hidden="true" />
          <span className="absolute bottom-2 end-2 h-6 w-6 rounded-ee-lg border-b-2 border-e-2 border-white/60" aria-hidden="true" />
          {/* Sweep line */}
          <span className="mk-scan-line top-6" aria-hidden="true" />
        </div>

        {/* Success state — mirrors the product's check-in pulse */}
        <div className="mk-scan-check mx-6 mt-6 flex items-center justify-center gap-2.5 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
            <Check className="h-4 w-4" />
          </span>
          تم تسجيل الحضور
        </div>

        <p className="mt-auto pb-6 text-center text-[0.6875rem] text-white/40">
          تطبيق الماسح — Q-Trust
        </p>
      </div>
    </PhoneFrame>
  )
}
