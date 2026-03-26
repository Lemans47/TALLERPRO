"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { fetchChartData } from "@/lib/api-client"

export function RevenueChart() {
  const [chartData, setChartData] = useState<Array<{ mes: string; ingresos: number; gastos: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChartData()
  }, [])

  const loadChartData = async () => {
    try {
      const { servicios, gastos } = await fetchChartData()

      const monthlyData: Record<string, { ingresos: number; gastos: number }> = {}
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        monthlyData[key] = { ingresos: 0, gastos: 0 }
      }

      servicios.forEach((s) => {
        const fecha = new Date(s.fecha_ingreso)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
        if (monthlyData[key]) {
          if (s.estado === "Cerrado/Pagado") {
            monthlyData[key].ingresos += Number(s.monto_total_sin_iva || 0)
          }
          // Solo sumar costos de servicios cerrados/pagados
          if (s.estado === "Cerrado/Pagado") {
            const costoServicio = (s.costos || []).reduce((sum, c) => sum + (Number(c.monto) || 0), 0)
            monthlyData[key].gastos += costoServicio
          }
        }
      })

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
          return {
            mes: monthNames[Number.parseInt(month) - 1],
            ingresos: Math.round(values.ingresos),
            gastos: Math.round(values.gastos),
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
          <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Gastos</span>
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
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dee2e7" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#dee2e7" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `$${value.toLocaleString("es-CL")}`,
                name === "ingresos" ? "Ingresos" : "Gastos",
              ]}
              contentStyle={{
                backgroundColor: "#1e2a3c",
                border: "1px solid #334155",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
              cursor={{ fill: "#334155", opacity: 0.5 }}
            />
            <Bar dataKey="ingresos" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="gastos" fill="#dc2626" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
