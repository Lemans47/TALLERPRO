"use client"

import { ChevronRight, Clock, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Servicio } from "@/lib/database"

const PIPELINE_STAGES = [
  { key: "En Cola", color: "#3b82f6" },
  { key: "En Proceso", color: "#8b5cf6" },
  { key: "En Reparación", color: "#f59e0b" },
  { key: "Esperando Repuestos", color: "#ef4444" },
  { key: "Control de Calidad", color: "#10b981" },
  { key: "Listo para Entrega", color: "#06b6d4" },
]

interface VehiclePipelineProps {
  servicios: Servicio[]
}

export function VehiclePipeline({ servicios }: VehiclePipelineProps) {
  const hoy = new Date()

  const activos = servicios.filter(
    (s) => !["Cerrado/Pagado", "Entregado", "Por Cobrar"].includes(s.estado),
  )

  const counts: Record<string, number> = {}
  PIPELINE_STAGES.forEach((stage) => {
    counts[stage.key] = activos.filter((s) => s.estado === stage.key).length
  })

  const countValues = Object.values(counts)
  const maxCount = countValues.length > 0 ? Math.max(...countValues) : 0

  const entregados = servicios.filter((s) => s.estado === "Entregado").length
  const cerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado").length

  const atascados = activos
    .map((s) => ({
      ...s,
      dias: Math.floor((hoy.getTime() - new Date(s.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .filter((s) => s.dias > 7)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 5)

  const getStageStyle = (stage: (typeof PIPELINE_STAGES)[0], count: number) => {
    const isBottleneck = count > 0 && count === maxCount
    if (count === 0) {
      return {
        container: "bg-secondary/40 border border-border/60",
        text: "text-muted-foreground",
        badge: "bg-muted text-muted-foreground",
      }
    }
    return {
      container: `bg-secondary/60 border ${isBottleneck ? "ring-2 ring-offset-1" : ""}`,
      text: "text-foreground font-medium",
      badge: "text-white",
      borderColor: stage.color,
      ringColor: isBottleneck ? stage.color : undefined,
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          Pipeline de Vehículos
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">{activos.length} vehículos en taller ahora</p>
      </div>

      {/* Pipeline stages */}
      <div className="flex flex-wrap items-center gap-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const count = counts[stage.key]
          const styles = getStageStyle(stage, count)
          const isBottleneck = count > 0 && count === maxCount

          return (
            <div key={stage.key} className="flex items-center gap-2">
              <div
                className={`rounded-lg px-3 py-2 ${styles.container}`}
                style={{
                  borderColor: count > 0 ? stage.color : undefined,
                  outlineColor: isBottleneck ? stage.color : undefined,
                  boxShadow: isBottleneck ? `0 0 0 2px ${stage.color}` : undefined,
                }}
              >
                <div className={`text-xs ${styles.text}`}>{stage.key}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="text-xl font-bold leading-none"
                    style={{ color: count > 0 ? stage.color : undefined }}
                  >
                    {count}
                  </span>
                  {isBottleneck && (
                    <span className="text-xs font-medium px-1 py-0.5 rounded" style={{ backgroundColor: stage.color + "22", color: stage.color }}>
                      ⚠
                    </span>
                  )}
                </div>
              </div>
              {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Footer summary */}
      <p className="text-xs text-muted-foreground">
        Entregados este mes: <span className="font-medium text-foreground">{entregados}</span>
        <span className="mx-2">|</span>
        Cerrados/Pagados: <span className="font-medium text-foreground">{cerrados}</span>
      </p>

      {/* Atascados */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Vehículos con más de 7 días en taller</span>
          {atascados.length > 0 && (
            <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30 text-xs">
              {atascados.length}
            </Badge>
          )}
        </div>

        {atascados.length === 0 ? (
          <div className="flex items-center gap-2 text-success text-sm py-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Todos los vehículos ingresaron hace menos de 7 días</span>
          </div>
        ) : (
          <div className="space-y-2">
            {atascados.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-bold text-foreground shrink-0">{s.patente}</span>
                  <span className="text-muted-foreground truncate">{s.cliente}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor:
                        PIPELINE_STAGES.find((p) => p.key === s.estado)?.color + "22" || "#6b728022",
                      color: PIPELINE_STAGES.find((p) => p.key === s.estado)?.color || "#6b7280",
                    }}
                  >
                    {s.estado}
                  </span>
                  <span className="text-xs font-semibold text-warning whitespace-nowrap">{s.dias}d</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
