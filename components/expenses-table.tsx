"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2, Search, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { api, type Gasto } from "@/lib/api-client"
import { formatFechaDMA } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

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

  const handleTogglePagado = async (gasto: Gasto) => {
    try {
      await api.gastos.update(gasto.id, { pagado: !gasto.pagado })
      onDeleted() // refresca la lista
    } catch {
      toast({ title: "Error actualizando estado de pago", variant: "destructive" })
    }
  }

  const filteredGastos = gastos.filter((g) => g.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))

  const totalFiltered = filteredGastos.reduce((sum, g) => sum + Number(g.monto), 0)
  const totalPendiente = filteredGastos.filter((g) => g.pagado === false).reduce((sum, g) => sum + Number(g.monto), 0)

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
            <div className="flex flex-wrap gap-3 mt-1">
              <p className="text-sm text-muted-foreground">
                {filteredGastos.length} gastos • Total: ${totalFiltered.toLocaleString("es-CL")}
              </p>
              {totalPendiente > 0 && (
                <p className="text-sm font-semibold text-orange-400">
                  ⏳ Pendiente de pago: ${totalPendiente.toLocaleString("es-CL")}
                </p>
              )}
            </div>
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
            {filteredGastos.map((gasto) => {
              const isPendiente = gasto.pagado === false
              return (
              <div key={gasto.id} className={`p-4 hover:bg-muted/30 transition-colors ${isPendiente ? "border-l-2 border-orange-500" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{gasto.descripcion}</p>
                      {isPendiente ? (
                        <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30 shrink-0">
                          <Clock className="w-3 h-3 mr-1" />Pendiente
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30 shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Pagado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatFechaDMA(gasto.fecha)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${isPendiente ? "text-orange-400" : "text-destructive"}`}>
                      ${Number(gasto.monto).toLocaleString("es-CL")}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className={`h-8 w-8 bg-transparent ${isPendiente ? "border-orange-500/30 text-orange-400 hover:bg-orange-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}
                        onClick={() => handleTogglePagado(gasto)}
                        title={isPendiente ? "Marcar como pagado" : "Marcar como pendiente"}
                      >
                        {isPendiente ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      </Button>
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
            )
          })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
