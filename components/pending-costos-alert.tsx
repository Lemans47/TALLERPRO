"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wallet, CheckCircle2, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { Servicio } from "@/lib/database"
import { resumenPagosCostos } from "@/lib/costos-pendientes"

interface PendingCostosAlertProps {
  servicios: Servicio[]
}

// Alerta global de "Costos Taller Pendientes": servicios con al menos un ítem
// de costo marcado como pendiente de pago (excluye pintura y auto-generados).
// Estructura clonada de pending-expenses-alert; paleta warning para
// distinguirla del card rojo de Gastos Pendientes.
export function PendingCostosAlert({ servicios }: PendingCostosAlertProps) {
  const pendientes = servicios
    .map((servicio) => ({ servicio, resumen: resumenPagosCostos(servicio.costos) }))
    .filter((x) => x.resumen.estado === "pendiente")

  const totalPendiente = pendientes.reduce((sum, x) => sum + x.resumen.totalPendiente, 0)

  if (pendientes.length === 0) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-success">Sin costos pendientes</p>
            <p className="text-sm text-muted-foreground">Todos los costos de taller están pagados</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-warning/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <Wallet className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Costos Taller Pendientes
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                {pendientes.length}
              </Badge>
            </h3>
            <p className="text-sm text-muted-foreground">Pagos pendientes por servicio</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-warning">${totalPendiente.toLocaleString("es-CL")}</p>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {pendientes.map(({ servicio, resumen }) => (
          <Link
            key={servicio.id}
            href={`/servicios?edit=${servicio.id}`}
            className="block p-4 transition-colors hover:bg-secondary/50 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {servicio.patente} · {servicio.cliente}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {resumen.cantidadPendiente} ítem{resumen.cantidadPendiente !== 1 ? "s" : ""} por pagar
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="font-bold text-lg text-warning">
                  ${resumen.totalPendiente.toLocaleString("es-CL")}
                </p>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <Link href="/servicios">
          <Button variant="ghost" className="w-full justify-between hover:bg-secondary" size="sm">
            Ver todos los servicios
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
