"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  onChange?: (value: string) => void
  error?: boolean
}

/**
 * Email input component with real-time validation
 */
export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  function EmailInput({ value = '', onChange, className, error, ...props }, ref) {
    const [touched, setTouched] = React.useState(false)

    // Email validation regex
    const isValidEmail = React.useCallback((email: string) => {
      if (!email) return null // No validation state for empty
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    }, [])

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setTouched(true)
      onChange?.(e.target.value)
    }, [onChange])

    const validationState = touched ? isValidEmail(value) : null
    const showValid = validationState === true && !error
    const showInvalid = validationState === false || error

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="email"
          dir="ltr"
          className={cn(
            "text-left",
            showValid && "border-emerald-500 focus-visible:ring-emerald-500 pl-9",
            showInvalid && "border-destructive focus-visible:ring-destructive pl-9",
            className
          )}
          value={value}
          onChange={handleChange}
          placeholder={props.placeholder || "example@email.com"}
          autoComplete="email"
        />
        {showValid && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
            <Check className="h-4 w-4" />
          </span>
        )}
        {showInvalid && value && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive pointer-events-none">
            <X className="h-4 w-4" />
          </span>
        )}
      </div>
    )
  }
)

export default EmailInput
