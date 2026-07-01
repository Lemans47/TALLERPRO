"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { hoyChile } from "@/lib/utils"

interface MonthContextType {
  selectedMonth: string
  setSelectedMonth: (month: string) => void
}

const MonthContext = createContext<MonthContextType | undefined>(undefined)

export function MonthProvider({ children }: { children: ReactNode }) {
  // Default to current month (format: YYYY-MM) en horario de Chile.
  const [selectedMonth, setSelectedMonth] = useState<string>(() => hoyChile().slice(0, 7))

  return <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>{children}</MonthContext.Provider>
}

export function useMonth() {
  const context = useContext(MonthContext)
  if (context === undefined) {
    throw new Error("useMonth must be used within a MonthProvider")
  }
  return context
}
