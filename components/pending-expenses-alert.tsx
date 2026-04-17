"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Receipt, CheckCircle2, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { Gasto } from "@/lib/database"
import { formatFechaDMA } from "@/lib/utils"

interface PendingExpensesAlertProps {
  gastos: Gasto[]
  maxItems?: number
}

export function PendingExpensesAlert({ gastos, maxItems = 5 }: PendingExpensesAlertProps) {
  const pendientes = gastos
    .filter((g) => g.pagado === false)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  const totalPendiente = pendientes.reduce((sum, g) => sum + Number(g.monto), 0)

  if (pendientes.length === 0) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-success">Sin gastos pendientes</p>
            <p className="text-sm text-muted-foreground">Todos los gastos están pagados</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-destructive/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Receipt className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Gastos Pendientes
              <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">
                {pendientes.length}
              </Badge>
            </h3>
            <p className="text-sm text-muted-foreground">Gastos por pagar este mes</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-destructive">${totalPendiente.toLocaleString("es-CL")}</p>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
        {pendientes.slice(0, maxItems).map((gasto) => (
          <div key={gasto.id} className="p-4 transition-colors hover:bg-secondary/50">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{gasto.descripcion}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {gasto.categoria} • {formatFechaDMA(gasto.fecha)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-lg text-destructive">
                  ${Number(gasto.monto).toLocaleString("es-CL")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {pendientes.length > maxItems && (
        <div className="p-3 bg-secondary/30 text-center text-sm text-muted-foreground">
          Y {pendientes.length - maxItems} gastos más pendientes
        </div>
      )}

      <div className="p-3 border-t border-border">
        <Link href="/gastos">
          <Button variant="ghost" className="w-full justify-between hover:bg-secondary" size="sm">
            Ver todos los gastos
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
