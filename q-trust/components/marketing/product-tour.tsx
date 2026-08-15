"use client"

import { useEffect, useRef, useState } from "react"
import { useScroll } from "motion/react"
import { BrowserFrame, ScreenshotSlot } from "./frames"
import { ScanScreen } from "./scan-demo"
import { TOUR_BEATS, SHOTS, SCRUB } from "./content"

function BeatScreen({ beat }: { beat: (typeof TOUR_BEATS)[number] }) {
  const src = SHOTS[beat.shot]
  if (!src && beat.key === "qr") return <ScanScreen />
  return <ScreenshotSlot src={src || undefined} alt={beat.title} />
}

// ── The one scroll-scrubbed sequence (§8.2.3) ─────────────────────────────
// The check-in flow (card → sweep → success bloom) pre-rendered as a webp
// frame sequence drawn to a canvas from scroll progress — never
// video.currentTime, which stutters on mid-range hardware. Frames load only
// when the tour approaches the viewport; until then (or on any load failure)
// the static screenshot renders, so the scrub can only ever upgrade the page.
function useScrubFrames(enabled: boolean) {
  const [frames, setFrames] = useState<HTMLImageElement[] | null>(null)

  useEffect(() => {
    if (!enabled || frames) return
    let cancelled = false
    const imgs: HTMLImageElement[] = []
    let loaded = 0
    for (let i = 1; i <= SCRUB.count; i++) {
      const img = new Image()
      img.decoding = "async"
      img.src = `${SCRUB.basePath}/frame_${String(i).padStart(2, "0")}.webp`
      img.onload = () => {
        loaded++
        if (!cancelled && loaded === SCRUB.count) setFrames(imgs)
      }
      img.onerror = () => {
        cancelled = true
      }
      imgs.push(img)
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return frames
}

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
            <BeatScreen beat={beat} />
          </BrowserFrame>
        </figure>
      ))}
    </div>
  )
}

function StickyTour() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(0)
  const [near, setNear] = useState(false)
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  })

  // Start fetching scrub frames one viewport before the tour arrives.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: "100% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const frames = useScrubFrames(near)
  const framesRef = useRef<HTMLImageElement[] | null>(null)
  framesRef.current = frames

  // First paint of the canvas as soon as frames are ready.
  useEffect(() => {
    if (!frames) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) ctx.drawImage(frames[0], 0, 0, canvas.width, canvas.height)
  }, [frames])

  useEffect(() => {
    const beats = TOUR_BEATS.length
    const unsub = scrollYProgress.on("change", (p) => {
      setActive(Math.min(beats - 1, Math.max(0, Math.floor(p * beats))))

      // Beat 0 scrub: map its share of the scroll ([0, 1/beats]) onto the
      // frame sequence. drawImage of a decoded webp is compositor-cheap.
      const f = framesRef.current
      const canvas = canvasRef.current
      if (f && canvas) {
        const local = Math.min(1, Math.max(0, p * beats))
        const idx = Math.min(SCRUB.count - 1, Math.floor(local * (SCRUB.count - 1)))
        const img = f[idx]
        if (img?.complete) {
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
      }
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
                  {i === 0 && frames ? (
                    <canvas
                      ref={canvasRef}
                      width={SCRUB.width}
                      height={SCRUB.height}
                      className="h-full w-full object-cover"
                      role="img"
                      aria-label={beat.title}
                    />
                  ) : (
                    <BeatScreen beat={beat} />
                  )}
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
