"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAllServiciosAndPresupuestos, type Servicio } from "@/lib/local-storage"
import { History, TrendingUp, Calendar, DollarSign } from "lucide-react"

interface VehicleHistoryProps {
  patente: string
}

export function VehicleHistory({ patente }: VehicleHistoryProps) {
  const [historial, setHistorial] = useState<Servicio[]>([])
  const [stats, setStats] = useState({
    totalServicios: 0,
    totalGastado: 0,
    promedioServicio: 0,
    ultimoServicio: null as Date | null,
  })

  useEffect(() => {
    if (!patente || patente.length < 4) {
      setHistorial([])
      return
    }

    // Get all services (including presupuestos) for this patente
    const allServicios = getAllServiciosAndPresupuestos()
    const vehicleHistory = allServicios
      .filter((s) => s.patente.toUpperCase() === patente.toUpperCase())
      .sort((a, b) => new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime())

    setHistorial(vehicleHistory)

    // Calculate stats
    const serviciosRealizados = vehicleHistory.filter((s) => s.tipo === "servicio")
    const totalGastado = serviciosRealizados.reduce((sum, s) => sum + s.monto_total_con_iva, 0)
    const promedioServicio = serviciosRealizados.length > 0 ? totalGastado / serviciosRealizados.length : 0
    const ultimoServicio = vehicleHistory.length > 0 ? new Date(vehicleHistory[0].fecha_ingreso) : null

    setStats({
      totalServicios: serviciosRealizados.length,
      totalGastado,
      promedioServicio,
      ultimoServicio,
    })
  }, [patente])

  if (!patente || patente.length < 4) {
    return null
  }

  if (historial.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="w-4 h-4" />
            <p className="text-sm">Sin historial previo para esta patente</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Historial del Vehículo
        </CardTitle>
        <p className="text-sm text-muted-foreground">Servicios anteriores de {patente.toUpperCase()}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Servicios</span>
            </div>
            <p className="text-lg font-semibold">{stats.totalServicios}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />
              <span>Total Gastado</span>
            </div>
            <p className="text-lg font-semibold">${stats.totalGastado.toLocaleString("es-CL")}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />
              <span>Promedio</span>
            </div>
            <p className="text-lg font-semibold">${Math.round(stats.promedioServicio).toLocaleString("es-CL")}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Último</span>
            </div>
            <p className="text-lg font-semibold">
              {stats.ultimoServicio ? stats.ultimoServicio.toLocaleDateString("es-CL") : "-"}
            </p>
          </div>
        </div>

        {/* History List */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {historial.map((servicio) => (
            <div key={servicio.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={servicio.tipo === "presupuesto" ? "outline" : "default"} className="text-xs">
                      {servicio.tipo === "presupuesto" ? "Presupuesto" : servicio.estado}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(servicio.fecha_ingreso).toLocaleDateString("es-CL")}
                    </span>
                  </div>
                  {servicio.marca && servicio.modelo && (
                    <p className="text-sm mt-1">
                      {servicio.marca} {servicio.modelo} {servicio.año}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">${servicio.monto_total_con_iva.toLocaleString("es-CL")}</p>
                  {servicio.saldo_pendiente > 0 && (
                    <p className="text-xs text-orange-600">
                      Saldo: ${servicio.saldo_pendiente.toLocaleString("es-CL")}
                    </p>
                  )}
                </div>
              </div>
              {servicio.observaciones && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{servicio.observaciones}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
