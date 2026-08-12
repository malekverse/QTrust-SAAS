"use client"

import * as React from "react"
import { Button, type ButtonProps } from "./button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
  loadingText?: string
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ 
    children, 
    loading = false, 
    loadingText,
    disabled, 
    className,
    ...props 
  }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        className={cn(
          "relative",
          loading && "cursor-wait",
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
        )}
        {loading && loadingText ? loadingText : children}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }
