import type React from "react"
import { TrendingUp, TrendingDown, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Variant = "default" | "success" | "warning" | "destructive"

interface KPIStat {
  label: string
  value: string
  highlight?: boolean
}

interface KPIBadge {
  text: string
  trend?: "up" | "down"
}

interface KPICardProps {
  title: string
  value: string
  description?: string
  icon?: React.ReactNode
  variant?: Variant
  badge?: KPIBadge
  stats?: KPIStat[]
  tooltip?: string
}

const variantStyles: Record<Variant, string> = {
  default: "border-border bg-card",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  destructive: "border-destructive/30 bg-destructive/5",
}

const iconStyles: Record<Variant, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
}

const valueStyles: Record<Variant, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

const badgeStyles: Record<Variant, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
}

export function KPICard({ title, value, description, icon, variant = "default", badge, stats, tooltip }: KPICardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-all hover:shadow-lg hover:shadow-black/5 flex flex-col",
        variantStyles[variant],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Info sobre ${title}`}
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon && <div className={cn("p-2.5 rounded-xl shrink-0", iconStyles[variant])}>{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <p className={cn("text-2xl font-bold tracking-tight", valueStyles[variant])}>{value}</p>
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              badgeStyles[variant],
            )}
          >
            {badge.trend === "up" && <TrendingUp className="w-3 h-3" />}
            {badge.trend === "down" && <TrendingDown className="w-3 h-3" />}
            {badge.text}
          </span>
        )}
      </div>

      {description && !stats && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}

      {stats && stats.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-border/50">
          {stats.map((s, i) => (
            <div key={i} className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p
                className={cn(
                  "text-xs font-semibold truncate",
                  s.highlight ? valueStyles[variant] : "text-foreground",
                )}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
