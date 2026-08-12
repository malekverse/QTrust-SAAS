"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastContext = React.createContext<{
  toast: (props: ToastProps) => string
  dismiss: (id?: string) => void
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  loading: (title: string, description?: string) => string
  update: (id: string, props: Partial<ToastProps>) => void
  promise: <T>(
    promise: Promise<T>,
    opts: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: Error) => string)
    }
  ) => Promise<T>
} | null>(null)

export interface ToastProps {
  id?: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success" | "warning" | "info" | "loading"
  duration?: number
  icon?: React.ReactNode
}

interface Toast extends ToastProps {
  id: string
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-xl border-2 p-4 pr-10 shadow-xl transition-all animate-in slide-in-from-top-2 duration-300",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground shadow-lg",
        destructive:
          "border-red-400 bg-red-100 text-red-900 shadow-red-200/50 dark:border-red-700 dark:bg-red-950 dark:text-red-100 dark:shadow-red-900/30",
        success:
          "border-emerald-400 bg-emerald-100 text-emerald-900 shadow-emerald-200/50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100 dark:shadow-emerald-900/30",
        warning:
          "border-amber-400 bg-amber-100 text-amber-900 shadow-amber-200/50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:shadow-amber-900/30",
        info:
          "border-blue-400 bg-blue-100 text-blue-900 shadow-blue-200/50 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 dark:shadow-blue-900/30",
        loading:
          "border-primary/40 bg-primary/10 text-foreground shadow-primary/20 dark:border-primary/50 dark:bg-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const variantIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-300 shrink-0" />,
  destructive: <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-300 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-700 dark:text-blue-300 shrink-0" />,
  loading: <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const toast = React.useCallback((props: ToastProps) => {
    const id = props.id || Math.random().toString(36).substr(2, 9)
    const duration = props.duration ?? (props.variant === "loading" ? Infinity : 4000)
    
    setToasts((prev) => {
      // Update if toast with same id exists
      const existingIndex = prev.findIndex(t => t.id === id)
      if (existingIndex !== -1) {
        const updated = [...prev]
        updated[existingIndex] = { ...props, id }
        return updated
      }
      return [...prev, { ...props, id }]
    })

    if (duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const dismiss = React.useCallback((id?: string) => {
    if (id) {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    } else {
      setToasts([])
    }
  }, [])

  const update = React.useCallback((id: string, props: Partial<ToastProps>) => {
    setToasts((prev) => prev.map(t => 
      t.id === id ? { ...t, ...props } : t
    ))
    
    // Set auto-dismiss for updated toast
    const duration = props.duration ?? (props.variant === "loading" ? Infinity : 4000)
    if (duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  // Convenience methods
  const success = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "success" })
  }, [toast])

  const error = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "destructive", duration: 5000 })
  }, [toast])

  const warning = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "warning" })
  }, [toast])

  const info = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "info" })
  }, [toast])

  const loading = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "loading" })
  }, [toast])

  // Promise-based toast (similar to react-hot-toast)
  const promiseToast = React.useCallback(async <T,>(
    promise: Promise<T>,
    opts: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: Error) => string)
    }
  ): Promise<T> => {
    const id = toast({ title: opts.loading, variant: "loading" })
    
    try {
      const result = await promise
      const successMessage = typeof opts.success === "function" ? opts.success(result) : opts.success
      update(id, { title: successMessage, variant: "success", duration: 4000 })
      return result
    } catch (err) {
      const errorMessage = typeof opts.error === "function" 
        ? opts.error(err as Error) 
        : opts.error
      update(id, { title: errorMessage, variant: "destructive", duration: 5000 })
      throw err
    }
  }, [toast, update])

  return (
    <ToastContext.Provider value={{ 
      toast, 
      dismiss, 
      success, 
      error, 
      warning, 
      info, 
      loading,
      update,
      promise: promiseToast 
    }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ 
  toasts, 
  dismiss 
}: { 
  toasts: Toast[]
  dismiss: (id: string) => void 
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-100 flex max-h-screen w-full flex-col gap-2 p-4 sm:top-auto sm:bottom-4 sm:right-4 sm:left-auto sm:translate-x-0 md:max-w-[400px]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(toastVariants({ variant: toast.variant }))}
          role="alert"
          aria-live="polite"
        >
          {/* Icon */}
          {toast.icon || (toast.variant && variantIcons[toast.variant])}
          
          {/* Content */}
          <div className="flex-1 grid gap-0.5">
            {toast.title && (
              <div className="text-sm font-semibold leading-tight">{toast.title}</div>
            )}
            {toast.description && (
              <div className="text-sm opacity-90 leading-snug">{toast.description}</div>
            )}
          </div>
          
          {/* Close button */}
          <button
            className="absolute left-2 top-2 rounded-md p-1.5 opacity-50 transition-all hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-80"
            onClick={() => dismiss(toast.id)}
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

