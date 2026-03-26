import type React from "react"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string
  description?: string
  icon?: React.ReactNode
  variant?: "default" | "success" | "warning" | "destructive"
  trend?: "up" | "down" | "neutral"
}

export function KPICard({ title, value, description, icon, variant = "default", trend }: KPICardProps) {
  const variantStyles = {
    default: "border-border bg-card",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    destructive: "border-destructive/30 bg-destructive/5",
  }

  const iconStyles = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  }

  const valueStyles = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-all hover:shadow-lg hover:shadow-black/5",
        variantStyles[variant],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className={cn("text-2xl font-bold tracking-tight", valueStyles[variant])}>{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {icon && <div className={cn("p-2.5 rounded-xl shrink-0", iconStyles[variant])}>{icon}</div>}
      </div>
    </div>
  )
}
