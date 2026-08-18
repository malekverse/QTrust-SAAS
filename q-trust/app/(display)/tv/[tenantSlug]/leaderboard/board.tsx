"use client"

import { useEffect, useState, useCallback } from "react"
import { Trophy, Medal, Award, Star, CalendarCheck, BookOpen, Loader2 } from "lucide-react"
import { BADGE, BADGE_LABELS } from "@/lib/leaderboard-badges"
import { useTranslations } from "next-intl"

interface Entry {
  studentId: string
  displayName: string
  points: number
  presentCount: number
  hifzVerses: number
  badges: string[]
}

interface BoardData {
  tenant: { name: string; primaryColor: string; secondaryColor: string }
  entries: Entry[]
  updatedAt: string
}

const REFRESH_MS = 30_000

export function LeaderboardBoard({ slug }: { slug: string }) {
  const t = useTranslations("leaderboard")
  const [data, setData] = useState<BoardData | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "locked">("loading")

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard/${slug}`, { cache: "no-store" })
      if (res.status === 403) {
        setStatus("locked")
        return
      }
      if (!res.ok) {
        setStatus((s) => (s === "ok" ? "ok" : "error"))
        return
      }
      setData(await res.json())
      setStatus("ok")
    } catch {
      setStatus((s) => (s === "ok" ? "ok" : "error"))
    }
  }, [slug])

  useEffect(() => {
    // Polling effect: load() only updates state after an awaited fetch, so no
    // synchronous cascading render occurs here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-white">
        <Loader2 className="h-10 w-10 animate-spin opacity-60" />
      </div>
    )
  }

  if (status === "locked") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b1220] px-6 text-center text-white">
        <Trophy className="h-14 w-14 opacity-40" />
        <p className="text-xl font-bold">{t("locked")}</p>
        <p className="max-w-md text-white/60">{t("lockedDesc")}</p>
      </div>
    )
  }

  if (status === "error" && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b1220] px-6 text-center text-white">
        <Trophy className="h-14 w-14 opacity-40" />
        <p className="text-xl font-bold">{t("loadError")}</p>
      </div>
    )
  }

  const accent = data?.tenant.primaryColor || "#136F4E"
  const gold = data?.tenant.secondaryColor || "#F4C76C"
  const entries = data?.entries || []
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  const rankColor = (i: number) =>
    i === 0 ? gold : i === 1 ? "#C0C7D1" : i === 2 ? "#CD8B62" : "rgba(255,255,255,0.15)"

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0b1220] px-6 py-8 text-white"
      style={{ backgroundImage: `radial-gradient(1200px 600px at 50% -10%, ${accent}33, transparent)` }}
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <Trophy className="h-9 w-9" style={{ color: gold }} />
            <h1 className="text-4xl font-bold">{t("title")}</h1>
          </div>
          <p className="text-lg text-white/60">{data?.tenant.name}</p>
        </div>

        {entries.length === 0 ? (
          <div className="mt-24 text-center text-white/50">
            <Star className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="text-xl">{t("empty")}</p>
          </div>
        ) : (
          <>
            {/* Podium (top 3) */}
            <div className="mb-8 grid grid-cols-3 items-end gap-3 sm:gap-6">
              {/* order: 2nd, 1st, 3rd for a podium feel */}
              {[podium[1], podium[0], podium[2]].map((entry, idx) => {
                if (!entry) return <div key={idx} />
                const realRank = entry === podium[0] ? 0 : entry === podium[1] ? 1 : 2
                const isFirst = realRank === 0
                return (
                  <div
                    key={entry.studentId}
                    className="flex flex-col items-center rounded-2xl border p-4 text-center"
                    style={{
                      borderColor: `${rankColor(realRank)}66`,
                      background: `linear-gradient(180deg, ${rankColor(realRank)}22, transparent)`,
                      transform: isFirst ? "translateY(-8px)" : undefined,
                    }}
                  >
                    <div
                      className="mb-2 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold"
                      style={{ backgroundColor: rankColor(realRank), color: "#0b1220" }}
                    >
                      {realRank + 1}
                    </div>
                    <p className={`font-bold ${isFirst ? "text-xl" : "text-base"}`}>{entry.displayName}</p>
                    <p className="mt-1 text-2xl font-black" style={{ color: gold }} dir="ltr">
                      {entry.points}
                    </p>
                    <p className="text-xs text-white/50">{t("point")}</p>
                    <BadgeRow badges={entry.badges} />
                  </div>
                )
              })}
            </div>

            {/* Rest of the ranking */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {rest.map((entry, i) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center gap-4 rounded-xl bg-white/5 px-4 py-3"
                  >
                    <div className="w-8 text-center text-lg font-bold text-white/40">{i + 4}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.displayName}</p>
                      <div className="mt-0.5 flex items-center gap-4 text-xs text-white/50">
                        <span className="flex items-center gap-1">
                          <CalendarCheck className="h-3 w-3" />
                          {entry.presentCount} {t("attendance")}
                        </span>
                        {entry.hifzVerses > 0 && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {entry.hifzVerses} {t("verse")}
                          </span>
                        )}
                      </div>
                    </div>
                    <BadgeRow badges={entry.badges} compact />
                    <div className="text-xl font-black" style={{ color: gold }} dir="ltr">
                      {entry.points}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-xs text-white/30">
          {t("footer")}
        </p>
      </div>
    </div>
  )
}

function BadgeRow({ badges, compact }: { badges: string[]; compact?: boolean }) {
  if (!badges || badges.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "" : "mt-2 justify-center"}`}>
      {badges.map((b) => (
        <span
          key={b}
          title={BADGE_LABELS[b] || b}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80"
        >
          {b === BADGE.PERFECT_ATTENDANCE ? (
            <Medal className="h-3 w-3" />
          ) : (
            <Award className="h-3 w-3" />
          )}
          {!compact && (BADGE_LABELS[b] || b)}
        </span>
      ))}
    </div>
  )
}
