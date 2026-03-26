"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Activity } from "lucide-react"
import type { Servicio } from "@/lib/database"

const STATUS_COLORS: Record<string, string> = {
  "En Cola": "#3b82f6",
  "En Proceso": "#8b5cf6",
  "En Reparación": "#f59e0b",
  "Esperando Repuestos": "#ef4444",
  "Control de Calidad": "#10b981",
  "Listo para Entrega": "#06b6d4",
  Entregado: "#6366f1",
  "Por Cobrar": "#f97316",
  "Cerrado/Pagado": "#22c55e",
}

interface ServicesStatusChartProps {
  servicios: Servicio[]
}

export function ServicesStatusChart({ servicios }: ServicesStatusChartProps) {
  const statusCount: Record<string, number> = {}

  servicios.forEach((s) => {
    const estado = s.estado || "Sin Estado"
    statusCount[estado] = (statusCount[estado] || 0) + 1
  })

  const chartData = Object.entries(statusCount)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || "#6b7280",
    }))

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Estado de Servicios</h3>
        </div>
        <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
          No hay servicios registrados
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Estado de Servicios</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{servicios.length} servicios este mes</p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground truncate">{item.name}</span>
            <span className="font-medium text-foreground ml-auto">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
