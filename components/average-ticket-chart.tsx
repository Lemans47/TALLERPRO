"use client"

import { useEffect, useMemo, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Receipt } from "lucide-react"
import { fetchChartData, type ChartMonthlyRow } from "@/lib/api-client"

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const START = "2026-04"

export function AverageTicketChart() {
  const [rows, setRows] = useState<ChartMonthlyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { monthlyData } = await fetchChartData()
        if (!cancelled) setRows(monthlyData ?? [])
      } catch (error) {
        console.error("Error loading ticket data:", error)
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
        const monthNum = Number.parseInt(r.mes.split("-")[1])
        const ticket = r.count_servicios > 0 ? Math.round(Number(r.facturado) / r.count_servicios) : 0
        return { mes: MONTH_NAMES[monthNum - 1], ticket }
      })
  }, [rows])

  const currentTicket = useMemo(() => {
    const last = [...chartData].reverse().find((d) => d.ticket > 0)
    return last?.ticket ?? 0
  }, [chartData])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-6">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Ticket Promedio por OT
        </h3>
        {currentTicket > 0 ? (
          <p className="text-sm text-muted-foreground mt-0.5">
            Último mes: <span className="font-semibold text-foreground">${currentTicket.toLocaleString("es-CL")}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5">Desde Abril 2026</p>
        )}
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
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dee2e7" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#dee2e7" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString("es-CL")}`, "Ticket promedio"]}
              contentStyle={{
                backgroundColor: "#1e2a3c",
                border: "1px solid #334155",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
              cursor={{ stroke: "#334155", strokeWidth: 1 }}
            />
            <Line
              dataKey="ticket"
              stroke="var(--primary, #f59e0b)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--primary, #f59e0b)", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
