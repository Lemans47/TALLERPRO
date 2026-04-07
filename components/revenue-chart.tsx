"use client"

import { useEffect, useState } from "react"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { fetchChartData } from "@/lib/api-client"

type Modo = "facturado" | "cobrado"

export function RevenueChart() {
  const [modo, setModo] = useState<Modo>("facturado")
  const [chartData, setChartData] = useState<Array<{ mes: string; ingresos: number; gastos: number; margen: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChartData(modo)
  }, [modo])

  const loadChartData = async (modoActual: Modo) => {
    setLoading(true)
    try {
      const { servicios, gastos } = await fetchChartData()

      const monthlyData: Record<string, { ingresos: number; gastos: number }> = {}
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

      const now = new Date()
      const START = "2026-04"
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (key >= START) monthlyData[key] = { ingresos: 0, gastos: 0 }
      }

      servicios.forEach((s) => {
        const fecha = new Date(s.fecha_ingreso)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
        if (!monthlyData[key]) return

        // Ingresos según modo
        const incluyeIngreso =
          modoActual === "facturado"
            ? Number(s.monto_total_sin_iva || 0) > 0
            : s.estado === "Cerrado/Pagado"

        if (incluyeIngreso) {
          monthlyData[key].ingresos += Number(s.monto_total_sin_iva || 0)
        }

        // Costos internos: excluir "Materiales Pintura" (evita doble conteo con Gastos de Pintura)
        const incluyeCosto =
          modoActual === "facturado"
            ? Number(s.monto_total_sin_iva || 0) > 0
            : s.estado === "Cerrado/Pagado"

        if (incluyeCosto) {
          const rawCostos =
            typeof s.costos === "string" && s.costos
              ? (() => { try { const p = JSON.parse(s.costos as string); return Array.isArray(p) ? p : [] } catch { return [] } })()
              : Array.isArray(s.costos) ? s.costos : []

          const costoServicio = (rawCostos as any[])
            .filter((c) => !String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
            .reduce((sum: number, c: any) => sum + (Number(c.monto) || 0), 0)

          monthlyData[key].gastos += costoServicio
        }
      })

      // Gastos operacionales (todos incluidos — "Gastos de Pintura" representa compras reales)
      gastos.forEach((g) => {
        const fecha = new Date(g.fecha)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
        if (monthlyData[key]) {
          monthlyData[key].gastos += Number(g.monto || 0)
        }
      })

      const data = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, values]) => {
          const [, month] = key.split("-")
          const ingresos = Math.round(values.ingresos)
          const gastosVal = Math.round(values.gastos)
          const margen = ingresos > 0 ? Math.round(((ingresos - gastosVal) / ingresos) * 100) : 0
          return {
            mes: monthNames[Number.parseInt(month) - 1],
            ingresos,
            gastos: gastosVal,
            margen,
          }
        })

      setChartData(data)
    } catch (error) {
      console.error("Error loading chart data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Ingresos vs Gastos
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setModo("facturado")}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                modo === "facturado"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              Facturado
            </button>
            <button
              onClick={() => setModo("cobrado")}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                modo === "cobrado"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              Cobrado
            </button>
            <span className="text-xs text-muted-foreground">· Desde Abril 2026</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#10b981]" />
            <span className="text-muted-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#dc2626]" />
            <span className="text-muted-foreground">Gastos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
            <span className="text-muted-foreground">Margen %</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[280px] text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Cargando datos...</span>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dee2e7" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#dee2e7" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "margen") return [`${value}%`, "Margen"]
                if (name === "ingresos") return [`$${value.toLocaleString("es-CL")}`, "Ingresos"]
                return [`$${value.toLocaleString("es-CL")}`, "Gastos"]
              }}
              contentStyle={{
                backgroundColor: "#1e2a3c",
                border: "1px solid #334155",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
              cursor={{ fill: "#334155", opacity: 0.5 }}
            />
            <Bar yAxisId="left" dataKey="ingresos" fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar yAxisId="left" dataKey="gastos" fill="#dc2626" radius={[6, 6, 0, 0]} />
            <Line
              yAxisId="right"
              dataKey="margen"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
