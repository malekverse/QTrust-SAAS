"use client"

import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from "lucide-react"
import { useTranslations } from "next-intl"

interface PaginationProps {
  page: number
  pages: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pages, total, onPageChange }: PaginationProps) {
  const t = useTranslations("pagination")
  if (pages <= 1) return null

  const canPrev = page > 1
  const canNext = page < pages

  const range: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, page + 2)
  for (let i = start; i <= end; i++) range.push(i)

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <p className="text-sm text-muted-foreground">
        {t("page")} {page} {t("of")} {pages} — {total} {t("items")}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev} onClick={() => onPageChange(1)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {range[0] > 1 && <span className="px-1 text-muted-foreground">…</span>}
        {range.map((p) => (
          <Button key={p} variant={p === page ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => onPageChange(p)}>
            {p}
          </Button>
        ))}
        {range[range.length - 1] < pages && <span className="px-1 text-muted-foreground">…</span>}

        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canNext} onClick={() => onPageChange(pages)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
