"use client"

import { useEffect, useMemo, useState } from "react"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { fetchChartData, type ChartMonthlyRow } from "@/lib/api-client"

type Modo = "facturado" | "cobrado"
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const START = "2026-04"

export function RevenueChart() {
  const [modo, setModo] = useState<Modo>("facturado")
  const [rows, setRows] = useState<ChartMonthlyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { monthlyData } = await fetchChartData()
        if (!cancelled) setRows(monthlyData ?? [])
      } catch (error) {
        console.error("Error loading chart data:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const chartData = useMemo(() => {
    return rows
      .filter((r) => r.mes >= START)
      .map((r) => {
        const ingresos = Math.round(modo === "facturado" ? Number(r.facturado) : Number(r.cobrado))
        const gastosVal = Math.round(Number(r.costos_internos) + Number(r.gastos_operativos) + Number(r.sueldos_comprometidos))
        const margen = ingresos > 0 ? Math.round(((ingresos - gastosVal) / ingresos) * 100) : 0
        const monthNum = Number.parseInt(r.mes.split("-")[1])
        return { mes: MONTH_NAMES[monthNum - 1], ingresos, gastos: gastosVal, margen }
      })
  }, [rows, modo])

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
              tickFormatter={(v: number) => {
                if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
                if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
                return `$${v}`
              }}
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
              formatter={(value, name) => {
                const v = Number(value)
                if (name === "margen") return [`${v}%`, "Margen"]
                if (name === "ingresos") return [`$${v.toLocaleString("es-CL")}`, "Ingresos"]
                return [`$${v.toLocaleString("es-CL")}`, "Gastos"]
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
