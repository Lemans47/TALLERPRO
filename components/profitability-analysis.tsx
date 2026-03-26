"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"

export function ProfitabilityAnalysis() {
  const metrics = [
    {
      label: "Margen de Ganancia",
      value: "42.3%",
      change: "+5.2%",
      positive: true,
    },
    {
      label: "ROI (Retorno de Inversión)",
      value: "156%",
      change: "+12.1%",
      positive: true,
    },
    {
      label: "Costo Promedio por Servicio",
      value: "$450",
      change: "-8.3%",
      positive: true,
    },
    {
      label: "Ingreso Promedio por Servicio",
      value: "$780",
      change: "+3.5%",
      positive: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metrics.map((metric, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <div className="flex items-end justify-between">
                <div className="text-3xl font-bold">{metric.value}</div>
                <div
                  className={`flex items-center gap-1 text-sm ${metric.positive ? "text-green-600" : "text-red-600"}`}
                >
                  {metric.positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {metric.change}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
