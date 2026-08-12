"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CalendarIcon } from "lucide-react"
import { format, parse, isValid } from "date-fns"

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  onChange?: (value: string) => void
  error?: boolean
  /** Whether to show the calendar button (adds extra tab stop) */
  showCalendarButton?: boolean
}

/**
 * Date input: typed digits are formatted as dd/mm/yyyy.
 * - Primary parse: day/month/year (common in this region and Europe).
 * - If that calendar date is invalid (e.g. month 23), tries month/day/year (US-style) so 04/23/2026 → April 23.
 * - Stores yyyy-MM-dd for APIs / Zod.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput({
    value = '',
    onChange,
    className,
    error,
    showCalendarButton = false,
    ...props
  }, ref) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
    // Track local input value for smooth typing
    const [localValue, setLocalValue] = React.useState<string | null>(null)

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!, [])

    // Convert ISO date (yyyy-mm-dd) to display format (dd/mm/yyyy)
    const isoToDisplay = React.useCallback((iso: string) => {
      if (!iso) return ''
      const parts = iso.split('-')
      if (parts.length !== 3) return iso
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }, [])

    // Eight digits → ISO: try DD/MM/YYYY first, then MM/DD/YYYY if the first is not a real calendar date.
    const displayToIso = React.useCallback((display: string) => {
      const cleaned = display.replace(/[^\d]/g, '')
      if (cleaned.length !== 8) return ''
      const first = cleaned.slice(0, 2)
      const second = cleaned.slice(2, 4)
      const year = cleaned.slice(4, 8)
      const isoDayMonth = `${year}-${second}-${first}`
      if (isValid(parse(isoDayMonth, 'yyyy-MM-dd', new Date()))) return isoDayMonth
      const isoMonthDay = `${year}-${first}-${second}`
      if (isValid(parse(isoMonthDay, 'yyyy-MM-dd', new Date()))) return isoMonthDay
      return ''
    }, [])

    // Convert ISO to Date object
    const isoToDate = (iso: string): Date | undefined => {
      if (!iso) return undefined
      const date = parse(iso, 'yyyy-MM-dd', new Date())
      return isValid(date) ? date : undefined
    }

    // Format input as user types (dd/mm/yyyy)
    const formatInput = React.useCallback((input: string) => {
      const cleaned = input.replace(/[^\d]/g, '')
      let formatted = ''
      
      if (cleaned.length > 0) {
        formatted = cleaned.slice(0, 2)
      }
      if (cleaned.length > 2) {
        formatted += '/' + cleaned.slice(2, 4)
      }
      if (cleaned.length > 4) {
        formatted += '/' + cleaned.slice(4, 8)
      }
      
      return formatted
    }, [])

    // Compute display value - use local value while typing, otherwise derive from prop
    const displayValue = localValue !== null ? localValue : isoToDisplay(value)

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatInput(e.target.value)
      setLocalValue(formatted)
      
      // Only update the actual value when we have a complete date
      const isoValue = displayToIso(formatted)
      if (isoValue) {
        onChange?.(isoValue)
      } else if (formatted === '') {
        onChange?.('')
      }
    }, [formatInput, displayToIso, onChange])

    const handleFocus = React.useCallback(() => {
      // Sync local value with prop value on focus
      setLocalValue(isoToDisplay(value))
    }, [value, isoToDisplay])

    const handleBlur = React.useCallback(() => {
      // Validate date on blur
      if (localValue !== null) {
        const isoValue = displayToIso(localValue)
        if (localValue && !isoValue) {
          // Invalid date, clear it
          onChange?.('')
        }
      }
      // Clear local value to use prop value
      setLocalValue(null)
    }, [localValue, displayToIso, onChange])

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation keys without interference
      if (['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace', 'Delete'].includes(e.key)) {
        return
      }
      
      // Only allow digits
      if (!/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
      }
    }, [])

    const handleCalendarSelect = React.useCallback((date: Date) => {
      const isoValue = format(date, 'yyyy-MM-dd')
      onChange?.(isoValue)
      setLocalValue(null)
      setIsCalendarOpen(false)
      // Return focus to input after calendar selection
      inputRef.current?.focus()
    }, [onChange])

    const isComplete = displayValue.replace(/[^\d]/g, '').length === 8
    const selectedDate = isoToDate(value)

    return (
      <div className="relative flex gap-2">
        <Input
          {...props}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          dir="ltr"
          className={cn(
            "text-left font-mono flex-1",
            error && "border-destructive focus-visible:ring-destructive",
            isComplete && !error && "border-emerald-500 focus-visible:ring-emerald-500",
            className
          )}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="dd/mm/yyyy"
          maxLength={10}
          autoComplete="off"
        />
        {showCalendarButton && (
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                tabIndex={-1}
                aria-label="فتح التقويم"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                selected={selectedDate}
                onSelect={handleCalendarSelect}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    )
  }
)

export default DateInput
