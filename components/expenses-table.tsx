"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2, Search, AlertCircle } from "lucide-react"
import { api, type Gasto } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"

interface ExpensesTableProps {
  gastos: Gasto[]
  onEditGasto: (gasto: Gasto) => void
  onDeleted: () => void
  loading?: boolean
}

export function ExpensesTable({ gastos, onEditGasto, onDeleted, loading }: ExpensesTableProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")

  const handleDelete = async (gasto: Gasto) => {
    if (!confirm(`¿Eliminar gasto "${gasto.descripcion}"?`)) return

    try {
      await api.gastos.delete(gasto.id)
      onDeleted()
      toast({ title: "Gasto eliminado" })
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
    }
  }

  const filteredGastos = gastos.filter((g) => g.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))

  const totalFiltered = filteredGastos.reduce((sum, g) => sum + Number(g.monto), 0)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registro de Gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Registro de Gastos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredGastos.length} gastos • Total: ${totalFiltered.toLocaleString("es-CL")}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gastos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredGastos.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No hay gastos registrados</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredGastos.map((gasto) => (
              <div key={gasto.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{gasto.descripcion}</p>
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const [y, m, d] = (gasto.fecha || "").substring(0, 10).split("-")
                        const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
                        return `${Number(d)} ${months[Number(m)-1]} ${y}`
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-destructive">${Number(gasto.monto).toLocaleString("es-CL")}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={() => onEditGasto(gasto)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-red-200 text-red-600 bg-transparent"
                        onClick={() => handleDelete(gasto)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
