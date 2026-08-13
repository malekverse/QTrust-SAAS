"use client"

import { useEffect } from "react"

// Inertial smooth scroll (§8.2.3) — marketing route group only, lazy-loaded
// after first paint, and skipped entirely on touch devices (native momentum
// is already right) and under prefers-reduced-motion.
export function LenisProvider() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const coarse = window.matchMedia("(pointer: coarse)").matches
    if (reduced || coarse) return

    let destroyed = false
    let lenis: { destroy: () => void } | null = null

    import("lenis").then(({ default: Lenis }) => {
      if (destroyed) return
      lenis = new Lenis({ autoRaf: true })
    })

    return () => {
      destroyed = true
      lenis?.destroy()
    }
  }, [])

  return null
}
