import { cn } from "@/lib/utils"

interface IslamicDividerProps {
  className?: string
}

export function IslamicDivider({ className }: IslamicDividerProps) {
  return (
    <div className={cn("islamic-divider", className)}>
      <span className="islamic-divider-node" />
    </div>
  )
}

export function IslamicBorderTop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("islamic-border-top", className)}>
      {children}
    </div>
  )
}

