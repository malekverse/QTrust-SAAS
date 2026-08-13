"use client"

import { useEffect, useRef, useState } from "react"

// Stat numeral count-up on scroll-into-view (§8.2.3 micro-interactions).
// Runs once, ≤700ms, instant under prefers-reduced-motion.
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return
        started.current = true
        io.disconnect()
        if (reduced) {
          setDisplay(value)
          return
        }
        const duration = 700
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration)
          // ease-out-expo family, matching the reveal grammar
          const eased = 1 - Math.pow(2, -10 * p)
          setDisplay(Math.round(value * eased))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.6 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value])

  return (
    <span ref={ref} dir="ltr">
      {display.toLocaleString("ar-TN")}
      {suffix}
    </span>
  )
}
