"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { fetchDashboardData } from "@/lib/api-client"

interface Kpis {
  ingresoNeto: number
  costosDirectos: number
  gastosOperativos: number
  gastosTabla: number
  sueldosComprometidos: number
  utilidadNeta: number
  margenPct: number
  ingresoPromedio: number
  costoPromedio: number
  roi: number
  serviciosFinalizados: number
  tasaAbsorcion: number
  ingresosManoObra: number
}

function calcDelta(current: number, prev: number): { label: string; positive: boolean; neutral: boolean } {
  if (prev === 0 && current === 0) return { label: "Sin datos", positive: true, neutral: true }
  if (prev === 0) return { label: "Nuevo", positive: true, neutral: true }
  const pct = ((current - prev) / Math.abs(prev)) * 100
  const sign = pct >= 0 ? "+" : ""
  return { label: `${sign}${pct.toFixed(1)}% vs mes ant.`, positive: pct >= 0, neutral: false }
}

export function ProfitabilityAnalysis() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [prevKpis, setPrevKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1

        // Mes anterior
        const prevDate = new Date(year, month - 2, 1)
        const prevYear = prevDate.getFullYear()
        const prevMonth = prevDate.getMonth() + 1

        const [current, prev] = await Promise.all([
          fetchDashboardData(year, month),
          fetchDashboardData(prevYear, prevMonth),
        ])

        setKpis((current as any).kpis ?? null)
        setPrevKpis((prev as any).kpis ?? null)
      } catch (e) {
        console.error("ProfitabilityAnalysis error:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!kpis) {
    return (
      <div className="text-sm text-muted-foreground p-4">No se pudieron cargar los datos de rentabilidad.</div>
    )
  }

  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  const metrics = [
    {
      label: "Margen de Ganancia",
      value: fmtPct(kpis.margenPct),
      delta: calcDelta(kpis.margenPct, prevKpis?.margenPct ?? 0),
      // Costo positivo = margen > 0, negativo = pérdida
      isPositive: kpis.margenPct >= 0,
    },
    {
      label: "ROI (Retorno de Inversión)",
      value: fmtPct(kpis.roi),
      delta: calcDelta(kpis.roi, prevKpis?.roi ?? 0),
      isPositive: kpis.roi >= 0,
    },
    {
      label: "Costo Promedio por Servicio",
      value: fmt(kpis.costoPromedio),
      // Para costos, bajar es positivo
      delta: calcDelta(kpis.costoPromedio, prevKpis?.costoPromedio ?? 0),
      isPositive: kpis.costoPromedio <= (prevKpis?.costoPromedio ?? kpis.costoPromedio),
    },
    {
      label: "Ingreso Promedio por Servicio",
      value: fmt(kpis.ingresoPromedio),
      delta: calcDelta(kpis.ingresoPromedio, prevKpis?.ingresoPromedio ?? 0),
      isPositive: kpis.ingresoPromedio >= (prevKpis?.ingresoPromedio ?? kpis.ingresoPromedio),
    },
    {
      label: "Tasa de Absorción",
      value: fmtPct(kpis.tasaAbsorcion),
      delta: calcDelta(kpis.tasaAbsorcion, prevKpis?.tasaAbsorcion ?? 0),
      isPositive: kpis.tasaAbsorcion >= (prevKpis?.tasaAbsorcion ?? kpis.tasaAbsorcion),
    },
  ]

  const costoTotal = kpis.costosDirectos + kpis.gastosOperativos

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold">{metric.value}</div>
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      metric.delta.neutral
                        ? "text-muted-foreground"
                        : metric.isPositive
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {metric.delta.neutral ? (
                      <Minus className="w-4 h-4" />
                    ) : metric.isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {metric.delta.label}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desglose de costos */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-3">Desglose de Costos del Mes</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Costos directos (servicios)</p>
              <p className="text-lg font-semibold mt-0.5">{fmt(kpis.costosDirectos)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {costoTotal > 0 ? ((kpis.costosDirectos / costoTotal) * 100).toFixed(1) : 0}% del total
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sueldos comprometidos</p>
              <p className="text-lg font-semibold mt-0.5">{fmt(kpis.sueldosComprometidos)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {costoTotal > 0 ? ((kpis.sueldosComprometidos / costoTotal) * 100).toFixed(1) : 0}% del total
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gastos operacionales</p>
              <p className="text-lg font-semibold mt-0.5">{fmt(kpis.gastosTabla)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {costoTotal > 0 ? ((kpis.gastosTabla / costoTotal) * 100).toFixed(1) : 0}% del total
              </p>
            </div>
          </div>
          <div className="border-t border-border mt-4 pt-3 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Total costos</p>
            <p className="text-lg font-bold">{fmt(costoTotal)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
