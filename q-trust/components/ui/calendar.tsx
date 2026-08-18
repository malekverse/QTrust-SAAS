"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  setYear,
  setMonth,
  getYear,
  getMonth
} from "date-fns"
import { ar } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  className?: string
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const t = useTranslations("calendar")
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date())

  const MONTHS = Array.from({ length: 12 }, (_, i) => t(`months.${i}`))
  const WEEKDAYS = Array.from({ length: 7 }, (_, i) => t(`weekdays.${i}`))

  // Generate years from 1920 to current year
  const currentYear = new Date().getFullYear()
  const years = React.useMemo(() => {
    const arr = []
    for (let y = currentYear; y >= 1920; y--) {
      arr.push(y)
    }
    return arr
  }, [currentYear])

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleYearChange = (year: string) => {
    setCurrentMonth(setYear(currentMonth, parseInt(year)))
  }

  const handleMonthChange = (month: string) => {
    setCurrentMonth(setMonth(currentMonth, parseInt(month)))
  }

  const handleDateSelect = (date: Date) => {
    onSelect?.(date)
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 6 }) // Start from Saturday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 6 })

  const days: Date[] = []
  let day = startDate
  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

  // Group days into weeks
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return (
    <div className={cn("p-3", className)}>
      {/* Header with navigation and dropdowns */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-7 w-7"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Select value={getMonth(currentMonth).toString()} onValueChange={handleMonthChange}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={getYear(currentMonth).toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="h-8 w-20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, index) => (
          <div
            key={index}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, currentMonth)
              const isSelected = selected && isSameDay(date, selected)
              const isToday = isSameDay(date, new Date())

              return (
                <button
                  key={dayIndex}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={cn(
                    "h-8 w-8 mx-auto text-sm rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isToday && !isSelected && "bg-accent/50",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {format(date, "d")}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Calendar
