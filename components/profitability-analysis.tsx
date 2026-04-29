"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react"
import { fetchDashboardData } from "@/lib/api-client"
import { useMonth } from "@/lib/month-context"

interface GastoCategoria {
  categoria: string
  monto: number
  items: { descripcion: string; monto: number }[]
}

interface Kpis {
  ingresoNeto: number
  costosDirectos: number
  gastosOperativos: number
  gastosTabla: number
  gastosDesglose: GastoCategoria[]
  sueldosComprometidos: number
  margenContribucion: number
  margenContribucionPct: number
  utilidadNeta: number
  margenPct: number
  ingresoPromedio: number
  costoDirectoPromedio: number
  puntoEquilibrio: number
  serviciosCount: number
  roi: number
  serviciosFinalizados: number
  tasaAbsorcion: number
  ingresosManoObra: number
}

function calcDelta(current: number, prev: number | null): { label: string; positive: boolean; neutral: boolean } {
  if (prev === null) return { label: "Sin datos ant.", positive: true, neutral: true }
  if (prev === 0 && current === 0) return { label: "Sin datos", positive: true, neutral: true }
  if (prev === 0) return { label: "Nuevo", positive: true, neutral: true }
  const pct = ((current - prev) / Math.abs(prev)) * 100
  const sign = pct >= 0 ? "+" : ""
  return { label: `${sign}${pct.toFixed(1)}% vs mes ant.`, positive: pct >= 0, neutral: false }
}

function DeltaBadge({ delta, isPositive }: { delta: ReturnType<typeof calcDelta>; isPositive: boolean }) {
  return (
    <div className={`flex items-center gap-1 text-sm ${
      delta.neutral ? "text-muted-foreground" : isPositive ? "text-green-500" : "text-red-500"
    }`}>
      {delta.neutral ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta.label}
    </div>
  )
}

export function ProfitabilityAnalysis() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const { selectedMonth } = useMonth()
  const [prevKpis, setPrevKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGastosDesglose, setShowGastosDesglose] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [year, month] = selectedMonth.split("-").map(Number)
        const prevDate = new Date(year, month - 2, 1)
        const [current, prev] = await Promise.all([
          fetchDashboardData(year, month),
          fetchDashboardData(prevDate.getFullYear(), prevDate.getMonth() + 1),
        ])
        setKpis((current as any).kpis ?? null)
        const prevData = (prev as any).kpis ?? null
        setPrevKpis(prevData?.serviciosCount > 0 ? prevData : null)
      } catch (e) {
        console.error("ProfitabilityAnalysis error:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedMonth])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6 space-y-3">
              <Skeleton className="h-4 w-40" /><Skeleton className="h-9 w-28" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6 space-y-3">
          <Skeleton className="h-4 w-40" /><Skeleton className="h-20 w-full" />
        </CardContent></Card>
      </div>
    )
  }

  if (!kpis) return (
    <div className="text-sm text-muted-foreground p-4">No se pudieron cargar los datos de rentabilidad.</div>
  )

  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  return (
    <div className="space-y-4">

      {/* Cascada financiera */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">Resultado del Mes</p>
          <div className="space-y-3">

            {/* Ingresos */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Ingresos facturados ({kpis.serviciosCount} servicios)</span>
              <span className="text-base font-semibold text-green-500">{fmt(kpis.ingresoNeto)}</span>
            </div>

            {/* Costos directos */}
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-sm text-muted-foreground">− Costos directos (variables)</span>
              <span className="text-base font-semibold text-red-400">{fmt(kpis.costosDirectos)}</span>
            </div>

            {/* Margen de contribución */}
            <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
              kpis.margenContribucion >= 0 ? "bg-green-500/10" : "bg-red-500/10"
            }`}>
              <div>
                <span className="text-sm font-medium">= Margen de contribución</span>
                <span className="text-xs text-muted-foreground ml-2">({fmtPct(kpis.margenContribucionPct)})</span>
              </div>
              <div className="text-right">
                <span className={`text-base font-bold ${kpis.margenContribucion >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {fmt(kpis.margenContribucion)}
                </span>
                <DeltaBadge
                  delta={calcDelta(kpis.margenContribucion, prevKpis?.margenContribucion ?? null)}
                  isPositive={kpis.margenContribucion >= (prevKpis?.margenContribucion ?? kpis.margenContribucion)}
                />
              </div>
            </div>

            {/* Sueldos */}
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-sm text-muted-foreground">− Sueldos pagados (abonos del mes)</span>
              <span className="text-base font-semibold text-red-400">{fmt(kpis.sueldosComprometidos)}</span>
            </div>

            {/* Gastos operacionales */}
            <div className="border-t border-border pt-2">
              <button
                onClick={() => setShowGastosDesglose(!showGastosDesglose)}
                className="w-full flex items-center justify-between py-2 hover:opacity-80 transition-opacity"
              >
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  − Gastos operacionales
                  {showGastosDesglose ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
                <span className="text-base font-semibold text-red-400">{fmt(kpis.gastosTabla)}</span>
              </button>
              {showGastosDesglose && (
                <div className="ml-4 mb-2 space-y-1.5">
                  {kpis.gastosDesglose.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">Sin registros este mes</p>
                  ) : (
                    kpis.gastosDesglose.map((cat) => (
                      <div key={cat.categoria} className="flex justify-between text-xs py-0.5">
                        <span className="text-muted-foreground">{cat.categoria}</span>
                        <span>{fmt(cat.monto)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Resultado neto */}
            <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg border ${
              kpis.utilidadNeta >= 0 ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
            }`}>
              <div>
                <span className="text-sm font-medium">= Resultado neto</span>
                <span className="text-xs text-muted-foreground ml-2">({fmtPct(kpis.margenPct)})</span>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${kpis.utilidadNeta >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {fmt(kpis.utilidadNeta)}
                </span>
                <DeltaBadge
                  delta={calcDelta(kpis.utilidadNeta, prevKpis?.utilidadNeta ?? null)}
                  isPositive={kpis.utilidadNeta >= (prevKpis?.utilidadNeta ?? kpis.utilidadNeta)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            label: "ROI",
            value: fmtPct(kpis.roi),
            delta: calcDelta(kpis.roi, prevKpis?.roi ?? null),
            isPositive: kpis.roi >= 0,
          },
          {
            label: "Tasa de Absorción",
            value: fmtPct(kpis.tasaAbsorcion),
            delta: calcDelta(kpis.tasaAbsorcion, prevKpis?.tasaAbsorcion ?? null),
            isPositive: kpis.tasaAbsorcion >= (prevKpis?.tasaAbsorcion ?? kpis.tasaAbsorcion),
          },
          {
            label: "Ingreso Promedio por Servicio",
            value: fmt(kpis.ingresoPromedio),
            delta: calcDelta(kpis.ingresoPromedio, prevKpis?.ingresoPromedio ?? null),
            isPositive: kpis.ingresoPromedio >= (prevKpis?.ingresoPromedio ?? kpis.ingresoPromedio),
          },
          {
            label: "Costo Directo Promedio por Servicio",
            value: fmt(kpis.costoDirectoPromedio),
            delta: calcDelta(kpis.costoDirectoPromedio, prevKpis?.costoDirectoPromedio ?? null),
            isPositive: kpis.costoDirectoPromedio <= (prevKpis?.costoDirectoPromedio ?? kpis.costoDirectoPromedio),
          },
        ].map((metric, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <div className="flex items-end justify-between mt-2">
                <p className="text-2xl font-bold">{metric.value}</p>
                <DeltaBadge delta={metric.delta} isPositive={metric.isPositive} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
