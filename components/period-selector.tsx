"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function PeriodSelector() {
  const [period, setPeriod] = useState("month")
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="flex gap-4 flex-wrap items-center">
      <div className="flex gap-2">
        <Button variant={period === "week" ? "default" : "outline"} onClick={() => setPeriod("week")}>
          Semana
        </Button>
        <Button variant={period === "month" ? "default" : "outline"} onClick={() => setPeriod("month")}>
          Mes
        </Button>
        <Button variant={period === "quarter" ? "default" : "outline"} onClick={() => setPeriod("quarter")}>
          Trimestre
        </Button>
        <Button variant={period === "year" ? "default" : "outline"} onClick={() => setPeriod("year")}>
          Año
        </Button>
      </div>

      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
