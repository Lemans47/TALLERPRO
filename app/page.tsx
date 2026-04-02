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
import type { Servicio, Gasto, Empleado } from "@/lib/database"
import { useAuth } from "@/lib/auth-context"

interface KPIs {
  ingresosFacturado: number  // todos los servicios del mes, sin IVA
  ingresosCobrado: number    // solo Cerrado/Pagado, sin IVA
  totalGastos: number
  utilidadRealizada: number  // ingresosCobrado - costos cerrados - gastos
  utilidadEstimada: number   // ingresosFacturado - todos costos - gastos
  margenRealizado: number
  margenEstimado: number
  tasaCobro: number          // % del facturado ya cobrado
  porCobrar: number
  serviciosActivos: number
  serviciosTotal: number
  serviciosCerrados: number
}

export default function DashboardPage() {
  const { role } = useAuth()
  const isOperador = role === "operador"
  const [kpis, setKpis] = useState<KPIs>({
    ingresosFacturado: 0,
    ingresosCobrado: 0,
    totalGastos: 0,
    utilidadRealizada: 0,
    utilidadEstimada: 0,
    margenRealizado: 0,
    margenEstimado: 0,
    tasaCobro: 0,
    porCobrar: 0,
    serviciosActivos: 0,
    serviciosTotal: 0,
    serviciosCerrados: 0,
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
      const { servicios: serviciosData, gastos: gastosData, empleados: empleadosData } = await fetchDashboardData(year, month)

      setServicios(serviciosData)
      calculateKPIs(serviciosData, gastosData, empleadosData)
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateKPIs = (servicios: Servicio[], gastos: Gasto[], empleados: Empleado[]) => {
    const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")

    // Ingresos
    const ingresosFacturado = servicios.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)
    const ingresosCobrado = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)

    // Sueldos comprometidos: suma de sueldo_base de todos los empleados activos
    // (independiente de si se ha pagado o no en el mes)
    const sueldosComprometidos = empleados
      .filter((e) => e.activo)
      .reduce((sum, e) => sum + Number(e.sueldo_base || 0), 0)

    // Gastos operacionales del mes EXCLUYENDO sueldos
    // (los sueldos ya se cuentan por sueldo_base, no por abonos registrados)
    const gastosOperacionales = gastos
      .filter((g) => g.categoria !== "Sueldos")
      .reduce((sum, g) => sum + Number(g.monto || 0), 0)

    const gastosConSueldos = gastosOperacionales + sueldosComprometidos

    // Costos internos de servicios
    const parseArr = (v: any) => Array.isArray(v) ? v : (typeof v === "string" && v ? JSON.parse(v) : [])
    const costosCerrados = serviciosCerrados.reduce((sum, s) => {
      return sum + parseArr(s.costos).reduce((c: number, costo: any) => c + Number(costo.monto || 0), 0)
    }, 0)
    const costosTotal = servicios.reduce((sum, s) => {
      return sum + parseArr(s.costos).reduce((c: number, costo: any) => c + Number(costo.monto || 0), 0)
    }, 0)

    // Utilidades
    const utilidadRealizada = ingresosCobrado - costosCerrados - gastosConSueldos
    const utilidadEstimada = ingresosFacturado - costosTotal - gastosConSueldos
    const margenRealizado = ingresosCobrado > 0 ? (utilidadRealizada / ingresosCobrado) * 100 : 0
    const margenEstimado = ingresosFacturado > 0 ? (utilidadEstimada / ingresosFacturado) * 100 : 0

    const tasaCobro = ingresosFacturado > 0 ? (ingresosCobrado / ingresosFacturado) * 100 : 0

    const porCobrar = servicios
      .filter((s) => Number(s.saldo_pendiente || 0) > 0)
      .reduce((sum, s) => sum + Number(s.saldo_pendiente || 0), 0)

    setKpis({
      ingresosFacturado,
      ingresosCobrado,
      totalGastos: gastosConSueldos + costosCerrados,
      utilidadRealizada,
      utilidadEstimada,
      margenRealizado,
      margenEstimado,
      tasaCobro,
      porCobrar,
      serviciosActivos: servicios.filter((s) => s.estado !== "Cerrado/Pagado").length,
      serviciosTotal: servicios.length,
      serviciosCerrados: serviciosCerrados.length,
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
          title="Facturado"
          value={formatCurrency(kpis.ingresosFacturado)}
          description="Todos los servicios, sin IVA"
          icon={<DollarSign className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Cobrado"
          value={formatCurrency(kpis.ingresosCobrado)}
          description={`Tasa de cobro: ${kpis.tasaCobro.toFixed(1)}%`}
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
          title="Servicios"
          value={kpis.serviciosTotal.toString()}
          description={`${kpis.serviciosCerrados} cerrados · ${kpis.serviciosActivos} en proceso`}
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
      {!isOperador && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Utilidad Realizada"
            value={formatCurrency(kpis.utilidadRealizada)}
            description={`Margen: ${kpis.margenRealizado.toFixed(1)}% · sobre cobrado`}
            icon={<TrendingUp className="w-5 h-5" />}
            variant={kpis.utilidadRealizada >= 0 ? "success" : "destructive"}
          />
          <KPICard
            title="Utilidad Estimada"
            value={formatCurrency(kpis.utilidadEstimada)}
            description={`Margen: ${kpis.margenEstimado.toFixed(1)}% · si todo se cobra`}
            icon={<TrendingUp className="w-5 h-5" />}
            variant={kpis.utilidadEstimada >= 0 ? "warning" : "destructive"}
          />
          <KPICard
            title="Por Cobrar"
            value={formatCurrency(kpis.porCobrar)}
            description="Saldos pendientes"
            icon={<AlertCircle className="w-5 h-5" />}
            variant={kpis.porCobrar > 0 ? "warning" : "success"}
          />
          <KPICard
            title="Tasa de Cierre"
            value={`${kpis.serviciosTotal > 0 ? ((kpis.serviciosCerrados / kpis.serviciosTotal) * 100).toFixed(1) : "0.0"}%`}
            description={`${kpis.serviciosCerrados} de ${kpis.serviciosTotal} servicios cerrados`}
            icon={<Activity className="w-5 h-5" />}
            variant={kpis.serviciosCerrados / (kpis.serviciosTotal || 1) >= 0.5 ? "success" : "warning"}
          />
        </div>
      )}
      {isOperador && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KPICard
            title="Por Cobrar"
            value={formatCurrency(kpis.porCobrar)}
            description="Saldos pendientes"
            icon={<AlertCircle className="w-5 h-5" />}
            variant={kpis.porCobrar > 0 ? "warning" : "success"}
          />
          <KPICard
            title="Tasa de Cierre"
            value={`${kpis.serviciosTotal > 0 ? ((kpis.serviciosCerrados / kpis.serviciosTotal) * 100).toFixed(1) : "0.0"}%`}
            description={`${kpis.serviciosCerrados} de ${kpis.serviciosTotal} servicios cerrados`}
            icon={<Activity className="w-5 h-5" />}
            variant={kpis.serviciosCerrados / (kpis.serviciosTotal || 1) >= 0.5 ? "success" : "warning"}
          />
        </div>
      )}
    </div>
  )
}
