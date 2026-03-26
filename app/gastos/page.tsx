"use client"

import { useState, useEffect, useCallback } from "react"
import { ExpenseForm } from "@/components/expense-form"
import { ExpensesTable } from "@/components/expenses-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw, Receipt, Paintbrush, Wrench, Home, Users } from "lucide-react"
import { useMonth } from "@/lib/month-context"
import { api, type Gasto } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

const ALL_CATEGORIAS = [
  { id: "Gastos de Pintura", label: "Pintura", icon: Paintbrush, color: "text-purple-400", roles: ["admin", "supervisor", "operador"] },
  { id: "Gastos Misceláneos", label: "Misceláneos", icon: Wrench, color: "text-blue-400", roles: ["admin", "supervisor", "operador"] },
  { id: "Gastos Fijos", label: "Fijos", icon: Home, color: "text-orange-400", roles: ["admin", "supervisor"] },
  { id: "Sueldos", label: "Sueldos", icon: Users, color: "text-green-400", roles: ["admin", "supervisor"] },
]

export default function ExpensesPage() {
  const { role } = useAuth()
  const CATEGORIAS = ALL_CATEGORIAS.filter((c) => role && c.roles.includes(role))
  const [activeCategory, setActiveCategory] = useState("Gastos de Pintura")
  const [gastoAEditar, setGastoAEditar] = useState<Gasto | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedMonth } = useMonth()

  const loadGastos = useCallback(async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const data = await api.gastos.getByMonth(year, month)
      setGastos(data)
    } catch (error) {
      console.error("Error loading gastos:", error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    loadGastos()
  }, [loadGastos])

  const handleEditGasto = (gasto: Gasto) => {
    setGastoAEditar(gasto)
    setActiveCategory(gasto.categoria)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSaved = () => {
    setGastoAEditar(null)
    loadGastos()
  }

  const filteredGastos = gastos.filter((g) => g.categoria === activeCategory)
  const totalByCategory = CATEGORIAS.reduce(
    (acc, cat) => {
      acc[cat.id] = gastos.filter((g) => g.categoria === cat.id).reduce((sum, g) => sum + Number(g.monto), 0)
      return acc
    },
    {} as Record<string, number>,
  )

  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto), 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/10">
              <Receipt className="w-6 h-6 text-destructive" />
            </div>
            Gastos
          </h1>
          <p className="text-muted-foreground mt-2">Registra y gestiona los gastos del taller</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-xs text-muted-foreground">Total del mes</p>
            <p className="text-xl font-bold text-destructive">${totalGastos.toLocaleString("es-CL")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadGastos}
            disabled={loading}
            className="border-border hover:bg-secondary bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIAS.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              className={`rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/50 hover:bg-secondary/30"
              }`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${isActive ? "bg-primary/10" : "bg-secondary"}`}>
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary" : cat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                  <p className="font-bold text-lg">${totalByCategory[cat.id]?.toLocaleString("es-CL") || 0}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 rounded-xl">
          {CATEGORIAS.map((cat) => {
            const Icon = cat.icon
            return (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg gap-2"
              >
                <Icon className="w-4 h-4 hidden sm:block" />
                <span className="text-xs sm:text-sm">{cat.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {CATEGORIAS.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1">
                <ExpenseForm
                  defaultCategory={cat.id}
                  gastoAEditar={gastoAEditar?.categoria === cat.id ? gastoAEditar : null}
                  onSaved={handleSaved}
                  onCancel={() => setGastoAEditar(null)}
                />
              </div>
              <div className="xl:col-span-2">
                <ExpensesTable
                  gastos={filteredGastos}
                  onEditGasto={handleEditGasto}
                  onDeleted={loadGastos}
                  loading={loading}
                />
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
