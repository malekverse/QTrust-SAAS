"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
const LEAD_STATUS_VALUES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const

const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  CONTACTED: "تم التواصل",
  CONVERTED: "تم التعاقد",
  CLOSED: "مغلق",
}

const selectCls =
  "h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"

export function LeadStatusSelect({
  leadId,
  status,
}: {
  leadId: string
  status: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function onChange(next: string) {
    if (next === status) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      disabled={saving}
      className={selectCls}
    >
      {LEAD_STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s] ?? s}
        </option>
      ))}
    </select>
  )
}
