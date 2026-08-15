"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { BrowserFrame, ScreenshotSlot } from "./frames"
import { ScanScreen } from "./scan-demo"
import { TOUR_BEATS, SHOTS } from "./content"

type Beat = { key: string; title: string; caption: string; shot: "qrCheckin" | "dashboard" | "ledger" }

const LazyStickyTour = dynamic(
  () => import("./sticky-tour").then((m) => m.StickyTour),
  { ssr: false }
)

function BeatScreen({ beat }: { beat: Beat }) {
  const src = SHOTS[beat.shot]
  if (!src && beat.key === "qr") return <ScanScreen />
  return <ScreenshotSlot src={src || undefined} alt={beat.title} />
}

function StaticTour({ beats }: { beats: Beat[] }) {
  return (
    <div className="space-y-16">
      {beats.map((beat) => (
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

export function ProductTour({ beats = TOUR_BEATS }: { beats?: Beat[] } = {}) {
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

  return sticky ? <LazyStickyTour beats={beats} /> : <StaticTour beats={beats} />
}
