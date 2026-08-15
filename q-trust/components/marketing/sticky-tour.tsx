"use client"

import { useEffect, useRef, useState } from "react"
import { useScroll } from "motion/react"
import { BrowserFrame, ScreenshotSlot } from "./frames"
import { ScanScreen } from "./scan-demo"
import { SHOTS, SCRUB } from "./content"

type Beat = { key: string; title: string; caption: string; shot: "qrCheckin" | "dashboard" | "ledger" }

function BeatScreen({ beat }: { beat: Beat }) {
  const src = SHOTS[beat.shot]
  if (!src && beat.key === "qr") return <ScanScreen />
  return <ScreenshotSlot src={src || undefined} alt={beat.title} />
}

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

export function StickyTour({ beats }: { beats: Beat[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(0)
  const [near, setNear] = useState(false)
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  })

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

  useEffect(() => {
    if (!frames) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) ctx.drawImage(frames[0], 0, 0, canvas.width, canvas.height)
  }, [frames])

  useEffect(() => {
    const count = beats.length
    const unsub = scrollYProgress.on("change", (p) => {
      setActive(Math.min(count - 1, Math.max(0, Math.floor(p * count))))

      const f = framesRef.current
      const canvas = canvasRef.current
      if (f && canvas) {
        const local = Math.min(1, Math.max(0, p * count))
        const idx = Math.min(SCRUB.count - 1, Math.floor(local * (SCRUB.count - 1)))
        const img = f[idx]
        if (img?.complete) {
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
      }
    })
    return unsub
  }, [scrollYProgress, beats.length])

  return (
    <div ref={wrapRef} style={{ height: `${beats.length * 100 + 60}vh` }}>
      <div className="mk-tour-sticky">
        <div className="w-full grid gap-10 lg:grid-cols-[1fr_1.7fr] lg:items-center">
          <div className="relative min-h-40">
            {beats.map((beat, i) => (
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
                  {i + 1} / {beats.length}
                </p>
                <h3 className="mk-display mk-h3">{beat.title}</h3>
                <p className="mk-body mt-3 max-w-[44ch]">{beat.caption}</p>
              </div>
            ))}
            <div className="absolute bottom-0 start-0 flex gap-2" aria-hidden="true">
              {beats.map((b, i) => (
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

          <BrowserFrame>
            <div className="relative" style={{ aspectRatio: "16/10" }}>
              {beats.map((beat, i) => (
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
