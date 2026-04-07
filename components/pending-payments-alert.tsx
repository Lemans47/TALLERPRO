"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Clock, Phone, CheckCircle2, ChevronRight, MessageCircle } from "lucide-react"
import Link from "next/link"
import type { Servicio } from "@/lib/database"

interface PendingPaymentsAlertProps {
  servicios: Servicio[]
  maxItems?: number
}

export function PendingPaymentsAlert({ servicios, maxItems = 5 }: PendingPaymentsAlertProps) {
  const ahora = new Date()

  const pendingPayments = servicios
    .filter((s) => Number(s.saldo_pendiente) > 0 && (s.estado === "Entregado" || s.estado === "Por Cobrar"))
    .map((servicio) => {
      const fechaIngreso = new Date(servicio.fecha_ingreso)
      const diasTranscurridos = Math.floor((ahora.getTime() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24))

      let urgencia: "alta" | "media" | "baja" = "baja"
      if (diasTranscurridos > 30) urgencia = "alta"
      else if (diasTranscurridos > 15) urgencia = "media"

      return { ...servicio, diasTranscurridos, urgencia }
    })
    .sort((a, b) => Number(b.saldo_pendiente) - Number(a.saldo_pendiente))

  const totalPendiente = pendingPayments.reduce((sum, p) => sum + Number(p.saldo_pendiente), 0)

  if (pendingPayments.length === 0) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-success">Sin cobros pendientes</p>
            <p className="text-sm text-muted-foreground">Todos los servicios están al día</p>
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
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Cobros Pendientes
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                {pendingPayments.length}
              </Badge>
            </h3>
            <p className="text-sm text-muted-foreground">Servicios con saldo por cobrar</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-warning">${totalPendiente.toLocaleString("es-CL")}</p>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
        {pendingPayments.slice(0, maxItems).map((pago) => (
          <div
            key={pago.id}
            className={`p-4 transition-colors hover:bg-secondary/50 ${
              pago.urgencia === "alta"
                ? "border-l-2 border-l-destructive"
                : pago.urgencia === "media"
                  ? "border-l-2 border-l-warning"
                  : ""
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{pago.patente}</span>
                  {pago.urgencia === "alta" && (
                    <Badge variant="destructive" className="text-xs">
                      URGENTE
                    </Badge>
                  )}
                  {pago.urgencia === "media" && (
                    <Badge className="text-xs bg-warning/10 text-warning border-warning/30">ATENCIÓN</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {pago.cliente} • {pago.marca} {pago.modelo}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  {pago.telefono && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {pago.telefono}
                      <a
                        href={`https://wa.me/${pago.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${pago.cliente}, le recordamos que tiene un saldo pendiente de $${Number(pago.saldo_pendiente).toLocaleString("es-CL")} por el servicio de su vehículo ${pago.marca} ${pago.modelo} (${pago.patente}). Quedo a su disposición para coordinar el pago. Saludos, TallerPro.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-green-500 transition-colors"
                        title="Contactar por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {pago.diasTranscurridos} días
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-lg text-warning">
                  ${Number(pago.saldo_pendiente).toLocaleString("es-CL")}
                </p>
                <p className="text-xs text-muted-foreground">de ${Number(pago.monto_total).toLocaleString("es-CL")}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {pendingPayments.length > maxItems && (
        <div className="p-3 bg-secondary/30 text-center text-sm text-muted-foreground">
          Y {pendingPayments.length - maxItems} servicios más con saldo pendiente
        </div>
      )}

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
