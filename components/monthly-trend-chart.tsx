"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const data = [
  { mes: "Ene", ingresos: 4000, gastos: 2400, utilidad: 1600 },
  { mes: "Feb", ingresos: 3000, gastos: 1398, utilidad: 1602 },
  { mes: "Mar", ingresos: 2000, gastos: 9800, utilidad: -7800 },
  { mes: "Abr", ingresos: 2780, gastos: 3908, utilidad: -1128 },
  { mes: "May", ingresos: 1890, gastos: 4800, utilidad: -2910 },
  { mes: "Jun", ingresos: 2390, gastos: 3800, utilidad: -1410 },
]

export function MonthlyTrendChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia de Utilidades</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={2} />
            <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} />
            <Line type="monotone" dataKey="utilidad" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
