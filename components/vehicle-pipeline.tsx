"use client"

import { ChevronRight, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Servicio } from "@/lib/database"
import { useEstados } from "@/lib/estados"

interface VehiclePipelineProps {
  servicios: Servicio[]
}

export function VehiclePipeline({ servicios }: VehiclePipelineProps) {
  const hoy = new Date()
  const { estados, esFinalizado } = useEstados()

  // Stages del pipeline = estados de tipo activo, en el orden configurado.
  // Cada stage usa el color editable del estado.
  const PIPELINE_STAGES = estados
    .filter((e) => e.tipo === "activo" && e.visible)
    .map((e) => ({ key: e.nombre, color: e.color || "#6b7280" }))

  const activos = servicios.filter((s) => !esFinalizado(s.estado))

  const counts: Record<string, number> = {}
  PIPELINE_STAGES.forEach((stage) => {
    counts[stage.key] = activos.filter((s) => s.estado === stage.key).length
  })

  const countValues = Object.values(counts)
  const maxCount = countValues.length > 0 ? Math.max(...countValues) : 0

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
    <div className="rounded-xl border border-border bg-card p-5 space-y-5 w-full">
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
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs font-medium px-1 py-0.5 rounded cursor-default" style={{ backgroundColor: stage.color + "22", color: stage.color }}>
                            ⚠
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Cuello de botella detectado en la etapa de {stage.key}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          )
        })}
      </div>

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
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 text-xs font-semibold text-warning whitespace-nowrap cursor-default">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {s.dias}d
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Este vehículo superó el tiempo estimado en la etapa de {s.estado}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
