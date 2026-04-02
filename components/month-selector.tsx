"use client"

import { useMonth } from "@/lib/month-context"
import { Calendar } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function MonthSelector() {
  const { selectedMonth, setSelectedMonth } = useMonth()

  // Generate months from April 2026 up to current month
  const START_YEAR = 2026
  const START_MONTH = 4 // April
  const months = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  for (let y = currentYear; y >= START_YEAR; y--) {
    const fromMonth = y === START_YEAR ? START_MONTH : 1
    const toMonth = y === currentYear ? currentMonth : 12
    for (let m = toMonth; m >= fromMonth; m--) {
      const date = new Date(y, m - 1, 1)
      const value = `${y}-${String(m).padStart(2, "0")}`
      const label = date.toLocaleDateString("es-CL", { year: "numeric", month: "long" })
      months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
    }
  }

  return (
    <div className="flex items-center gap-3 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 hover:bg-secondary transition-colors">
      <Calendar className="w-4 h-4 text-primary" />
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="border-0 shadow-none h-auto p-0 focus:ring-0 font-medium text-sm bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value} className="focus:bg-secondary">
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
