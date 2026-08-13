"use client"

import { useEffect, useRef, useState } from "react"
import { useScroll } from "motion/react"
import { BrowserFrame, ScreenshotSlot } from "./frames"
import { TOUR_BEATS, SHOTS } from "./content"

// The centerpiece (§8.2.2 #4): a pinned device frame whose screen swaps
// through three beats as the visitor scrolls, captions synced alongside.
// This is the single section that justifies the `motion` dependency — and it
// loads only on this route. The static stacked variant is the DESIGNED
// fallback (reduced motion, touch/small viewports, no-JS, pre-hydration),
// not an afterthought: it renders first and everywhere by default.

function StaticTour() {
  return (
    <div className="space-y-16">
      {TOUR_BEATS.map((beat) => (
        <figure key={beat.key} className="grid gap-6 lg:grid-cols-[1fr_1.7fr] lg:items-center">
          <figcaption>
            <h3 className="mk-display mk-h3">{beat.title}</h3>
            <p className="mk-body mt-3 max-w-[44ch]">{beat.caption}</p>
          </figcaption>
          <BrowserFrame>
            <ScreenshotSlot src={SHOTS[beat.shot] || undefined} alt={beat.title} />
          </BrowserFrame>
        </figure>
      ))}
    </div>
  )
}

function StickyTour() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  })

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (p) => {
      setActive(Math.min(TOUR_BEATS.length - 1, Math.max(0, Math.floor(p * TOUR_BEATS.length))))
    })
    return unsub
  }, [scrollYProgress])

  return (
    <div ref={wrapRef} style={{ height: `${TOUR_BEATS.length * 100 + 60}vh` }}>
      <div className="mk-tour-sticky">
        <div className="w-full grid gap-10 lg:grid-cols-[1fr_1.7fr] lg:items-center">
          {/* Caption rail */}
          <div className="relative min-h-40">
            {TOUR_BEATS.map((beat, i) => (
              <div
                key={beat.key}
                aria-hidden={i !== active}
                className="absolute inset-0 transition-[opacity,transform] duration-400"
                style={{
                  opacity: i === active ? 1 : 0,
                  transform: i === active ? "none" : "translateY(16px)",
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <p className="mk-eyebrow mb-2">
                  {i + 1} / {TOUR_BEATS.length}
                </p>
                <h3 className="mk-display mk-h3">{beat.title}</h3>
                <p className="mk-body mt-3 max-w-[44ch]">{beat.caption}</p>
              </div>
            ))}
            {/* Progress ticks */}
            <div className="absolute bottom-0 start-0 flex gap-2" aria-hidden="true">
              {TOUR_BEATS.map((b, i) => (
                <span
                  key={b.key}
                  className="h-1 rounded-full transition-all duration-400"
                  style={{
                    width: i === active ? "2rem" : "0.75rem",
                    background:
                      i === active ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.15)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Pinned frame — screens crossfade (transform + opacity only) */}
          <BrowserFrame>
            <div className="relative" style={{ aspectRatio: "16/10" }}>
              {TOUR_BEATS.map((beat, i) => (
                <div
                  key={beat.key}
                  aria-hidden={i !== active}
                  className="absolute inset-0 transition-[opacity,transform] duration-400"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? "none" : "scale(0.985)",
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  <ScreenshotSlot src={SHOTS[beat.shot] || undefined} alt={beat.title} />
                </div>
              ))}
            </div>
          </BrowserFrame>
        </div>
      </div>
    </div>
  )
}

export function ProductTour() {
  // Static by default (SSR + first paint + no-JS). Upgrade to the sticky
  // showcase only on desktop-class pointers with motion allowed.
  const [sticky, setSticky] = useState(false)

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)")
    const fine = window.matchMedia("(pointer: fine)")
    const motionOk = window.matchMedia("(prefers-reduced-motion: no-preference)")
    const decide = () => setSticky(wide.matches && fine.matches && motionOk.matches)
    decide()
    wide.addEventListener("change", decide)
    motionOk.addEventListener("change", decide)
    return () => {
      wide.removeEventListener("change", decide)
      motionOk.removeEventListener("change", decide)
    }
  }, [])

  return sticky ? <StickyTour /> : <StaticTour />
}
