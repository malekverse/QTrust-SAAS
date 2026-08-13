"use client"

import { useEffect, useRef } from "react"

// The one reveal grammar (§8.2.3): opacity 0→1 + 24px rise, 600ms,
// ease-out-expo family, staggered siblings via `delay`, fired ONCE.
// CSS owns the animation (marketing.css .mk-reveal); this only observes.
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: "div" | "section" | "li" | "span" | "figure"
}) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-in")
            io.disconnect()
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`mk-reveal ${className}`}
      style={delay ? ({ "--mk-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}
