"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface CINInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  onChange?: (value: string) => void
  error?: boolean
}

/**
 * Tunisia CIN (Carte d'Identité Nationale) input component
 * - Restricted to 8 digits only
 * - Clear formatting and validation
 * - Displays with proper spacing (XXXX XXXX)
 */
export const CINInput = React.forwardRef<HTMLInputElement, CINInputProps>(
  function CINInput({ value = '', onChange, className, error, ...props }, ref) {
    // Format display value with space (XXXX XXXX)
    const formatDisplay = React.useCallback((val: string) => {
      const digits = val.replace(/\D/g, '').slice(0, 8)
      if (digits.length <= 4) return digits
      return `${digits.slice(0, 4)} ${digits.slice(4)}`
    }, [])

    const displayValue = formatDisplay(value)

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      // Extract only digits, limit to 8
      const digits = inputValue.replace(/\D/g, '').slice(0, 8)
      onChange?.(digits)
    }, [onChange])

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation keys
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'].includes(e.key)) {
        return
      }
      
      // Allow backspace and delete
      if (['Backspace', 'Delete'].includes(e.key)) {
        return
      }

      // Allow clipboard operations
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        return
      }

      // Allow digits only
      if (/^\d$/.test(e.key)) {
        // Check if we already have 8 digits
        const currentDigits = value.replace(/\D/g, '')
        if (currentDigits.length >= 8) {
          e.preventDefault()
        }
        return
      }

      // Block other characters
      e.preventDefault()
    }, [value])

    const isComplete = value.replace(/\D/g, '').length === 8

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          dir="ltr"
          className={cn(
            "text-left font-mono tracking-wider",
            error && "border-destructive focus-visible:ring-destructive",
            isComplete && !error && "border-emerald-500 focus-visible:ring-emerald-500 pl-9",
            className
          )}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="XXXX XXXX"
          maxLength={9} // 8 digits + 1 space
          autoComplete="off"
        />
        {isComplete && !error && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
    )
  }
)

export default CINInput
