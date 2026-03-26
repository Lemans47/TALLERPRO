"use client"

import { useMonth } from "@/lib/month-context"
import { Calendar } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function MonthSelector() {
  const { selectedMonth, setSelectedMonth } = useMonth()

  // Generate last 12 months
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const label = date.toLocaleDateString("es-CL", { year: "numeric", month: "long" })
    months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
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
