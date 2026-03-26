"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { KPICard } from "@/components/kpi-card"
import { RevenueChart } from "@/components/revenue-chart"
import { ServicesStatusChart } from "@/components/services-status-chart"
import { PendingPaymentsAlert } from "@/components/pending-payments-alert"
import { DollarSign, TrendingUp, TrendingDown, Wrench, AlertCircle, Plus, RefreshCw, Activity } from "lucide-react"
import { useMonth } from "@/lib/month-context"
import { fetchDashboardData } from "@/lib/api-client"
import type { Servicio, Gasto } from "@/lib/database"

interface KPIs {
  ingresosSinIVA: number
  ingresosConIVA: number
  totalGastos: number
  utilidadOperacional: number
  margenPromedio: number
  porCobrar: number
  serviciosActivos: number
  serviciosTotal: number
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({
    ingresosSinIVA: 0,
    ingresosConIVA: 0,
    totalGastos: 0,
    utilidadOperacional: 0,
    margenPromedio: 0,
    porCobrar: 0,
    serviciosActivos: 0,
    serviciosTotal: 0,
  })
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedMonth } = useMonth()

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const { servicios: serviciosData, gastos: gastosData } = await fetchDashboardData(year, month)

      setServicios(serviciosData)
      calculateKPIs(serviciosData, gastosData)
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateKPIs = (servicios: Servicio[], gastos: Gasto[]) => {
    const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")
    const ingresosSinIVA = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)
    // Ingresos brutos = todos los servicios del mes (facturado total, pagado o no)
    const ingresosConIVA = servicios.reduce((sum, s) => sum + Number(s.monto_total || 0), 0)
    const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto || 0), 0)

    const costosServicios = servicios.reduce((sum, s) => {
      const costos = s.costos || []
      return sum + costos.reduce((c, costo) => c + Number(costo.monto || 0), 0)
    }, 0)

    const gastosTotal = totalGastos + costosServicios
    const utilidadOperacional = ingresosSinIVA - gastosTotal
    const margenPromedio = ingresosSinIVA > 0 ? (utilidadOperacional / ingresosSinIVA) * 100 : 0

    const porCobrar = servicios
      .filter((s) => Number(s.saldo_pendiente || 0) > 0)
      .reduce((sum, s) => sum + Number(s.saldo_pendiente || 0), 0)

    setKpis({
      ingresosSinIVA,
      ingresosConIVA,
      totalGastos: gastosTotal,
      utilidadOperacional,
      margenPromedio,
      porCobrar,
      serviciosActivos: servicios.filter((s) => s.estado !== "Cerrado/Pagado").length,
      serviciosTotal: servicios.length,
    })
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("es-CL")}`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Resumen de operaciones del taller</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-border hover:bg-secondary bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Link href="/servicios">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Servicio
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ingresos Netos"
          value={formatCurrency(kpis.ingresosSinIVA)}
          description="Sin IVA"
          icon={<DollarSign className="w-5 h-5" />}
          variant="success"
        />
        <KPICard
          title="Gastos Totales"
          value={formatCurrency(kpis.totalGastos)}
          description="Operacionales + Costos"
          icon={<TrendingDown className="w-5 h-5" />}
          variant="destructive"
        />
        <KPICard
          title="Utilidad"
          value={formatCurrency(kpis.utilidadOperacional)}
          description={`Margen: ${kpis.margenPromedio.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          variant={kpis.utilidadOperacional >= 0 ? "success" : "destructive"}
        />
        <KPICard
          title="Servicios"
          value={kpis.serviciosTotal.toString()}
          description={`${kpis.serviciosActivos} en proceso`}
          icon={<Wrench className="w-5 h-5" />}
          variant="default"
        />
      </div>

      {/* Alertas de cobros pendientes */}
      <PendingPaymentsAlert servicios={servicios} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <ServicesStatusChart servicios={servicios} />
        </div>
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Margen de Utilidad"
          value={`${kpis.margenPromedio.toFixed(1)}%`}
          description="Rentabilidad operacional"
          icon={<Activity className="w-5 h-5" />}
          variant={kpis.margenPromedio >= 20 ? "success" : kpis.margenPromedio >= 0 ? "warning" : "destructive"}
        />
        <KPICard
          title="Por Cobrar"
          value={formatCurrency(kpis.porCobrar)}
          description="Saldos pendientes"
          icon={<AlertCircle className="w-5 h-5" />}
          variant={kpis.porCobrar > 0 ? "warning" : "success"}
        />
        <KPICard
          title="Ingresos Brutos"
          value={formatCurrency(kpis.ingresosConIVA)}
          description="Con IVA incluido"
          icon={<DollarSign className="w-5 h-5" />}
          variant="default"
        />
      </div>
    </div>
  )
}
