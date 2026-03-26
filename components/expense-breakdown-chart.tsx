"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const data = [
  { categoria: "Materiales", monto: 2400 },
  { categoria: "Salarios", monto: 3500 },
  { categoria: "Servicios", monto: 800 },
  { categoria: "Mantenimiento", monto: 1200 },
  { categoria: "Transporte", monto: 600 },
  { categoria: "Otros", monto: 400 },
]

export function ExpenseBreakdownChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Desglose de Gastos por Categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="categoria" type="category" width={100} />
            <Tooltip />
            <Bar dataKey="monto" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
