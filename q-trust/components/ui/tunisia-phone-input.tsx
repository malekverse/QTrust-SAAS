"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TunisiaPhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  onChange?: (value: string) => void
  error?: boolean
}

/**
 * Tunisia-friendly phone input component
 * - Default prefix +216 automatically
 * - User types only the 8 digits
 * - UI displays nicely grouped (e.g., 94 181 481)
 * - Stores normalized value (+21694181481)
 * - Allows editing the prefix if needed
 */
export const TunisiaPhoneInput = React.forwardRef<HTMLInputElement, TunisiaPhoneInputProps>(
  function TunisiaPhoneInput({ value = '', onChange, className, error, ...props }, ref) {
    const [isFocused, setIsFocused] = React.useState(false)
    
    // Parse the value to extract prefix and local number
    const parseValue = React.useCallback((val: string) => {
      if (!val) return { prefix: '+216', localNumber: '' }
      
      // If starts with +216
      if (val.startsWith('+216')) {
        return { prefix: '+216', localNumber: val.slice(4) }
      }
      // If starts with 216
      if (val.startsWith('216')) {
        return { prefix: '+216', localNumber: val.slice(3) }
      }
      // If starts with +
      if (val.startsWith('+')) {
        // Try to extract country code (assume first 3-4 digits after +)
        const match = val.match(/^\+(\d{1,4})(.*)$/)
        if (match) {
          return { prefix: '+' + match[1], localNumber: match[2] }
        }
      }
      // Just the local number
      return { prefix: '+216', localNumber: val.replace(/\D/g, '') }
    }, [])

    const { prefix, localNumber } = parseValue(value)

    // Format the display value with spaces (XX XXX XXX)
    const formatDisplay = React.useCallback((num: string) => {
      const digits = num.replace(/\D/g, '').slice(0, 8)
      if (digits.length === 0) return ''
      if (digits.length <= 2) return digits
      if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
    }, [])

    // The display value shown in the input
    const displayValue = isFocused 
      ? `${prefix} ${formatDisplay(localNumber)}`
      : value ? `${prefix} ${formatDisplay(localNumber)}` : ''

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      
      // If user clears everything
      if (!inputValue.trim()) {
        onChange?.('')
        return
      }

      // Remove all non-digit characters except + at the start
      const processed = inputValue.replace(/[^\d+]/g, '')
      
      // Handle prefix changes
      if (processed.startsWith('+')) {
        // User is editing the prefix, let them
        // Find where the local number starts (after country code)
        if (processed.startsWith('+216')) {
          const local = processed.slice(4).slice(0, 8)
          onChange?.(local ? `+216${local}` : '')
        } else {
          // Custom country code - store as is
          onChange?.(processed)
        }
      } else {
        // Just digits, assume Tunisia prefix
        const digits = processed.slice(0, 8)
        onChange?.(digits ? `+216${digits}` : '')
      }
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

      // Allow digits
      if (/^\d$/.test(e.key)) {
        // Check if we already have 8 digits
        if (localNumber.replace(/\D/g, '').length >= 8) {
          e.preventDefault()
        }
        return
      }

      // Allow + only at the beginning
      if (e.key === '+') {
        const input = e.currentTarget
        if (input.selectionStart !== 0) {
          e.preventDefault()
        }
        return
      }

      // Block other characters
      e.preventDefault()
    }, [localNumber])

    const handleFocus = React.useCallback(() => setIsFocused(true), [])
    const handleBlur = React.useCallback(() => setIsFocused(false), [])

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="tel"
          dir="ltr"
          className={cn(
            "text-left font-mono tracking-wide",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="+216 XX XXX XXX"
          autoComplete="tel"
        />
      </div>
    )
  }
)

export default TunisiaPhoneInput
