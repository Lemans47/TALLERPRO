"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getServicios, getGastos } from "@/lib/local-storage"
import { TrendingUp, TrendingDown } from "lucide-react"

export function MonthlyComparisonChart() {
  const monthlyData = useMemo(() => {
    const servicios = getServicios()
    const gastos = getGastos()

    // Group data by month
    const monthMap: Record<string, { ingresos: number; gastos: number; costosServicios: number; servicios: number; margen: number }> = {}

    // Process services
    servicios.forEach((servicio) => {
      const month = servicio.fecha_ingreso.substring(0, 7) // YYYY-MM
      if (!monthMap[month]) {
        monthMap[month] = { ingresos: 0, gastos: 0, costosServicios: 0, servicios: 0, margen: 0 }
      }
      if (servicio.estado === "Cerrado/Pagado") {
        monthMap[month].ingresos += Number(servicio.monto_total_sin_iva) || 0
      }
      const costoServicio = (servicio.costos || []).reduce((sum, c) => sum + (Number(c.monto) || 0), 0)
      monthMap[month].costosServicios += costoServicio
      monthMap[month].servicios += 1
    })

    // Process expenses
    gastos.forEach((gasto) => {
      const month = gasto.fecha.substring(0, 7) // YYYY-MM
      if (!monthMap[month]) {
        monthMap[month] = { ingresos: 0, gastos: 0, costosServicios: 0, servicios: 0, margen: 0 }
      }
      monthMap[month].gastos += Number(gasto.monto) || 0
    })

    // Calculate margins and format data
    const data = Object.entries(monthMap)
      .map(([month, values]) => {
        const utilidad = values.ingresos - values.gastos - values.costosServicios
        const margen = values.ingresos > 0 ? (utilidad / values.ingresos) * 100 : 0
        return {
          mes: new Date(month + "-01").toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
          ingresos: values.ingresos,
          gastos: values.gastos,
          utilidad,
          servicios: values.servicios,
          margen,
        }
      })
      .sort((a, b) => {
        // Sort by date
        const dateA = new Date(a.mes)
        const dateB = new Date(b.mes)
        return dateA.getTime() - dateB.getTime()
      })
      .slice(-6) // Last 6 months

    return data
  }, [])

  const totalIngresos = useMemo(() => {
    return monthlyData.reduce((sum, month) => sum + month.ingresos, 0)
  }, [monthlyData])

  const totalGastos = useMemo(() => {
    return monthlyData.reduce((sum, month) => sum + month.gastos, 0)
  }, [monthlyData])

  const totalUtilidad = totalIngresos - totalGastos

  const promedioMargen = useMemo(() => {
    if (monthlyData.length === 0) return 0
    return monthlyData.reduce((sum, month) => sum + month.margen, 0) / monthlyData.length
  }, [monthlyData])

  // Calculate trend (comparing first half vs second half)
  const trend = useMemo(() => {
    if (monthlyData.length < 2) return 0
    const mid = Math.floor(monthlyData.length / 2)
    const firstHalf = monthlyData.slice(0, mid)
    const secondHalf = monthlyData.slice(mid)

    const firstAvg = firstHalf.reduce((sum, m) => sum + m.utilidad, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.utilidad, 0) / secondHalf.length

    if (firstAvg === 0) return 0
    return ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100
  }, [monthlyData])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativa Mensual</CardTitle>
        <CardDescription>Últimos 6 meses de operación</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Ingresos</p>
            <p className="text-xl font-bold">${(totalIngresos / 1000).toFixed(0)}k</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Gastos</p>
            <p className="text-xl font-bold">${(totalGastos / 1000).toFixed(0)}k</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Utilidad</p>
            <p className={`text-xl font-bold ${totalUtilidad >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${(totalUtilidad / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Tendencia</p>
            <div className="flex items-center gap-1">
              {trend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <p className={`text-xl font-bold ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {Math.abs(trend).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString("es-CL")}`}
                contentStyle={{ backgroundColor: "#1e2a3c", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
              />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="utilidad" name="Utilidad" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>No hay datos suficientes para mostrar la comparativa</p>
          </div>
        )}

        {/* Details Table */}
        {monthlyData.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Mes</th>
                  <th className="text-right p-3 font-medium">Servicios</th>
                  <th className="text-right p-3 font-medium">Ingresos</th>
                  <th className="text-right p-3 font-medium">Gastos</th>
                  <th className="text-right p-3 font-medium">Utilidad</th>
                  <th className="text-right p-3 font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((month, index) => (
                  <tr key={index} className="border-t hover:bg-muted/50">
                    <td className="p-3 font-medium">{month.mes}</td>
                    <td className="p-3 text-right">{month.servicios}</td>
                    <td className="p-3 text-right">${month.ingresos.toLocaleString("es-CL")}</td>
                    <td className="p-3 text-right">${month.gastos.toLocaleString("es-CL")}</td>
                    <td
                      className={`p-3 text-right font-medium ${month.utilidad >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      ${month.utilidad.toLocaleString("es-CL")}
                    </td>
                    <td
                      className={`p-3 text-right font-medium ${month.margen >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {month.margen.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
