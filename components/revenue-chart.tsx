"use client"

import { useEffect, useMemo, useState } from "react"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { fetchChartData, type ChartMonthlyRow } from "@/lib/api-client"

type Modo = "facturado" | "cobrado"
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const START = "2026-04"

const fmtCLP = (v: number) => `$${Math.round(v).toLocaleString("es-CL")}`

interface RevenueDatum {
  mes: string
  ingresos: number
  gastosFijos: number
  gastosOperativos: number
  gastosTotal: number
  margen: number
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: RevenueDatum }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const Row = ({ color, label, value }: { color: string; label: string; value: string }) => (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
  return (
    <div
      className="rounded-xl bg-white p-3 text-xs space-y-1.5"
      style={{ border: "1px solid #e1e8f4", boxShadow: "0 4px 12px rgb(13 27 62 / 0.08)" }}
    >
      <div className="font-semibold text-sm mb-1" style={{ color: "#0d1b3e" }}>{d.mes}</div>
      <Row color="#1a4ed8" label="Ingresos" value={fmtCLP(d.ingresos)} />
      <Row color="#b91c1c" label="Gastos Fijos" value={fmtCLP(d.gastosFijos)} />
      <Row color="#f59e0b" label="Gastos Operativos" value={fmtCLP(d.gastosOperativos)} />
      <div className="pt-1 mt-1 border-t border-border">
        <Row color="#94a3b8" label="Gastos Total" value={fmtCLP(d.gastosTotal)} />
      </div>
      <Row color="#16a34a" label="Margen" value={`${d.margen}%`} />
    </div>
  )
}

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
        // Fijos = sueldos devengados + gastos fijos de la tabla.
        const gastosFijos = Math.round(Number(r.sueldos_comprometidos) + Number(r.gastos_fijos_tabla))
        // Operativos = costos por servicio + gastos misceláneos/pintura.
        const gastosOperativos = Math.round(Number(r.costos_internos) + Number(r.gastos_operativos_tabla))
        const gastosTotal = gastosFijos + gastosOperativos
        const margen = ingresos > 0 ? Math.round(((ingresos - gastosTotal) / ingresos) * 100) : 0
        const monthNum = Number.parseInt(r.mes.split("-")[1])
        return { mes: MONTH_NAMES[monthNum - 1], ingresos, gastosFijos, gastosOperativos, gastosTotal, margen }
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
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#1a4ed8" }} />
            <span className="text-muted-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#b91c1c" }} />
            <span className="text-muted-foreground">Gastos Fijos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
            <span className="text-muted-foreground">Gastos Operativos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#16a34a" }} />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e8f4" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12, fill: "#4a5878" }}
              axisLine={{ stroke: "#e1e8f4" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: "#4a5878" }}
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
              tick={{ fontSize: 12, fill: "#4a5878" }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#e1e8f4", opacity: 0.5 }} />
            <Bar yAxisId="left" dataKey="ingresos" fill="#1a4ed8" radius={[6, 6, 0, 0]} />
            <Bar yAxisId="left" dataKey="gastosFijos" stackId="gastos" fill="#b91c1c" />
            <Bar yAxisId="left" dataKey="gastosOperativos" stackId="gastos" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Line
              yAxisId="right"
              dataKey="margen"
              stroke="#16a34a"
              strokeWidth={2}
              dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
