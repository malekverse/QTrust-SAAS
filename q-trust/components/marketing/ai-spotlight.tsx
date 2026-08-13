"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Check, X } from "lucide-react"
import { AI_SPOTLIGHT } from "./content"

// The dark-section chat mockup (§8.2.2 #6): a realistic admin request
// "types" itself, then the pending-action approval card appears — showing
// the intelligence AND the human-approval safety story in one visual.
// Mirrors the real product's chat → AIActionCard flow; nothing invented.
export function AiChatDemo() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [typed, setTyped] = useState("")
  const [phase, setPhase] = useState<"idle" | "typing" | "thinking" | "card">("idle")

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()

        if (reduced) {
          // Reduced motion: the complete, readable end state — instantly.
          setTyped(AI_SPOTLIGHT.typedRequest)
          setPhase("card")
          return
        }

        setPhase("typing")
        const text = AI_SPOTLIGHT.typedRequest
        let i = 0
        const interval = setInterval(() => {
          i++
          setTyped(text.slice(0, i))
          if (i >= text.length) {
            clearInterval(interval)
            setPhase("thinking")
            setTimeout(() => setPhase("card"), 700)
          }
        }, 45)
      },
      { threshold: 0.45 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="mk-card !border-foreground/12 p-5 sm:p-6 space-y-4" dir="rtl">
      {/* Admin message */}
      <div className="flex justify-end">
        <div className="mk-chat-bubble bg-primary text-primary-foreground">
          {typed || AI_SPOTLIGHT.typedRequest.slice(0, 1)}
          {phase === "typing" && <span className="mk-caret ms-0.5" aria-hidden="true" />}
        </div>
      </div>

      {/* Assistant thinking / response */}
      <div
        className="flex items-start gap-2.5 transition-[opacity,transform] duration-400"
        style={{
          opacity: phase === "thinking" || phase === "card" ? 1 : 0,
          transform: phase === "thinking" || phase === "card" ? "none" : "translateY(16px)",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </span>
        <div className="mk-chat-bubble border border-foreground/12 bg-foreground/4">
          وجدت الطالب. جهّزت العملية التالية — تحتاج موافقتك قبل التنفيذ:
        </div>
      </div>

      {/* Pending-action approval card — the human-approval safety story */}
      <div
        className="rounded-xl border border-secondary/50 bg-foreground/4 p-4 transition-[opacity,transform] duration-500"
        style={{
          opacity: phase === "card" ? 1 : 0,
          transform: phase === "card" ? "none" : "translateY(20px)",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        aria-hidden={phase !== "card"}
      >
        <p className="text-xs font-semibold text-secondary">عملية بانتظار الموافقة</p>
        <p className="mt-1.5 text-sm font-medium">{AI_SPOTLIGHT.actionDescription}</p>
        <div className="mt-3.5 flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
            <Check className="h-3.5 w-3.5" />
            {AI_SPOTLIGHT.approveLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-4 py-1.5 text-xs font-semibold text-foreground/70">
            <X className="h-3.5 w-3.5" />
            {AI_SPOTLIGHT.rejectLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
