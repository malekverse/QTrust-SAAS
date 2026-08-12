import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  animate?: boolean
}

export function PageHeader({ title, description, children, className, animate = true }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className={cn("space-y-0.5 sm:space-y-1", animate && "animate-fade-in")}>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-base text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className={cn(
            "flex flex-wrap items-center gap-2 sm:gap-3",
            animate && "animate-fade-in"
          )} style={animate ? { animationDelay: "0.1s" } : undefined}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
