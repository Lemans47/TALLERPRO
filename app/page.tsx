"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { KPICard } from "@/components/kpi-card"
import { RevenueChart } from "@/components/revenue-chart"
import { PendingPaymentsAlert } from "@/components/pending-payments-alert"
import { VehiclePipeline } from "@/components/vehicle-pipeline"
import { AverageTicketChart } from "@/components/average-ticket-chart"
import { MonthSelector } from "@/components/month-selector"
import {
  Car, ArrowUpDown, TrendingUp, AlertCircle,
  Activity, Clock, Wrench, Plus, RefreshCw,
} from "lucide-react"
import { useMonth } from "@/lib/month-context"
import { fetchDashboardData } from "@/lib/api-client"
import type { Servicio, Gasto, Empleado } from "@/lib/database"
import { useAuth } from "@/lib/auth-context"

interface KPIs {
  vehiculosEnTaller: number
  vehiculosDesglose: string
  flujoCaja: number
  flujoEntradas: number
  flujoSalidas: number
  margenGanancia: number
  ingresosCobrado: number
  ingresosFacturado: number
  porCobrar: number
  porCobrarDesglose: string
  serviciosActivos: number
  serviciosTotal: number
  serviciosCerrados: number
  tasaCierre: number
  tiempoPromedio: number
}

export default function DashboardPage() {
  const { role } = useAuth()
  const isOperador = role === "operador"
  const [kpis, setKpis] = useState<KPIs>({
    vehiculosEnTaller: 0,
    vehiculosDesglose: "",
    flujoCaja: 0,
    flujoEntradas: 0,
    flujoSalidas: 0,
    margenGanancia: 0,
    ingresosCobrado: 0,
    ingresosFacturado: 0,
    porCobrar: 0,
    porCobrarDesglose: "",
    serviciosActivos: 0,
    serviciosTotal: 0,
    serviciosCerrados: 0,
    tasaCierre: 0,
    tiempoPromedio: 0,
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
    const parseArr = (v: any): any[] => {
      if (Array.isArray(v)) return v
      if (typeof v === "string" && v) {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
      }
      return []
    }

    const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")
    const serviciosFacturados = servicios.filter((s) => s.estado === "Cerrado/Pagado" || s.estado === "Entregado")

    // Ingresos
    const ingresosCobrado = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)
    const ingresosFacturado = serviciosFacturados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)

    // Costos
    const costosCerrados = serviciosCerrados.reduce((sum, s) => {
      return sum + parseArr(s.costos).reduce((c: number, costo: any) => c + Number(costo.monto || 0), 0)
    }, 0)
    const costosFacturados = serviciosFacturados.reduce((sum, s) => {
      return sum + parseArr(s.costos).reduce((c: number, costo: any) => c + Number(costo.monto || 0), 0)
    }, 0)

    // Sueldos comprometidos (empleados activos)
    const sueldosComprometidos = empleados
      .filter((e) => e.activo)
      .reduce((sum, e) => sum + Number(e.sueldo_base || 0), 0)

    // Gastos operacionales (excluye sueldos)
    const gastosOperacionales = gastos
      .filter((g) => g.categoria !== "Sueldos")
      .reduce((sum, g) => sum + Number(g.monto || 0), 0)

    // ---- KPI 1: Vehículos en taller ----
    const vehiculosEnTaller = servicios.filter(
      (s) => s.estado !== "Cerrado/Pagado" && s.estado !== "Entregado",
    )
    const estadosActivos = ["En Reparación", "En Proceso", "Esperando Repuestos", "En Cola", "Listo para Entrega", "Control de Calidad"]
    const desgloseParts = estadosActivos
      .map((e) => ({ e, n: vehiculosEnTaller.filter((s) => s.estado === e).length }))
      .filter((x) => x.n > 0)
      .slice(0, 3)
      .map((x) => `${x.n} ${x.e.toLowerCase()}`)
    const vehiculosDesglose = desgloseParts.length > 0 ? desgloseParts.join(" · ") : "Sin vehículos activos"

    // ---- KPI 2: Flujo de caja ----
    const anticiposTotal = servicios.reduce((s, sv) => s + Number(sv.anticipo || 0), 0)
    const flujoEntradas = ingresosCobrado + anticiposTotal
    const flujoSalidas = gastosOperacionales + costosCerrados + sueldosComprometidos
    const flujoCaja = flujoEntradas - flujoSalidas

    // ---- KPI 3: Margen de ganancia ----
    const margenGanancia = ingresosFacturado > 0
      ? ((ingresosFacturado - costosFacturados) / ingresosFacturado) * 100
      : 0

    // ---- KPI 4: Por cobrar con edad ----
    const hoy = new Date()
    let edadVieja = 0, edadMedia = 0, edadReciente = 0
    const porCobrar = servicios
      .filter((s) => Number(s.saldo_pendiente || 0) > 0)
      .reduce((sum, s) => {
        const dias = Math.floor((hoy.getTime() - new Date(s.fecha_ingreso).getTime()) / 86400000)
        const monto = Number(s.saldo_pendiente)
        if (dias > 30) edadVieja += monto
        else if (dias > 15) edadMedia += monto
        else edadReciente += monto
        return sum + monto
      }, 0)

    const edadParts: string[] = []
    if (edadVieja > 0) edadParts.push(`$${(edadVieja / 1000).toFixed(0)}k en >30d`)
    if (edadMedia > 0) edadParts.push(`$${(edadMedia / 1000).toFixed(0)}k en 15-30d`)
    if (edadReciente > 0) edadParts.push(`$${(edadReciente / 1000).toFixed(0)}k reciente`)
    const porCobrarDesglose = edadParts.join(" · ") || "Sin deuda pendiente"

    // ---- KPIs secundarios ----
    const activosParaPromedio = servicios.filter((s) => !["Cerrado/Pagado", "Entregado"].includes(s.estado))
    const tiempoPromedio = activosParaPromedio.length > 0
      ? activosParaPromedio.reduce(
          (sum, s) => sum + Math.floor((hoy.getTime() - new Date(s.fecha_ingreso).getTime()) / 86400000),
          0,
        ) / activosParaPromedio.length
      : 0

    const serviciosTotal = servicios.length
    const serviciosCerradosCount = serviciosCerrados.length
    const tasaCierre = serviciosTotal > 0 ? (serviciosCerradosCount / serviciosTotal) * 100 : 0

    setKpis({
      vehiculosEnTaller: vehiculosEnTaller.length,
      vehiculosDesglose,
      flujoCaja,
      flujoEntradas,
      flujoSalidas,
      margenGanancia,
      ingresosCobrado,
      ingresosFacturado,
      porCobrar,
      porCobrarDesglose,
      serviciosActivos: vehiculosEnTaller.length,
      serviciosTotal,
      serviciosCerrados: serviciosCerradosCount,
      tasaCierre,
      tiempoPromedio,
    })
  }

  const formatCurrency = (value: number) => `$${Math.abs(value).toLocaleString("es-CL")}`

  const margenVariant =
    kpis.margenGanancia >= 40 ? "success" : kpis.margenGanancia >= 20 ? "warning" : "destructive"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Resumen de operaciones del taller</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector />
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-border hover:bg-secondary bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ZONA 1: KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Vehículos en Taller"
          value={kpis.vehiculosEnTaller.toString()}
          description={kpis.vehiculosDesglose}
          icon={<Car className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Flujo de Caja"
          value={`${kpis.flujoCaja < 0 ? "-" : ""}${formatCurrency(kpis.flujoCaja)}`}
          description={`Entradas ${formatCurrency(kpis.flujoEntradas)} · Salidas ${formatCurrency(kpis.flujoSalidas)}`}
          icon={<ArrowUpDown className="w-5 h-5" />}
          variant={kpis.flujoCaja >= 0 ? "success" : "destructive"}
        />
        <KPICard
          title="Margen de Ganancia"
          value={`${kpis.margenGanancia.toFixed(1)}%`}
          description={`Sobre ${formatCurrency(kpis.ingresosFacturado)} facturado`}
          icon={<TrendingUp className="w-5 h-5" />}
          variant={margenVariant}
        />
        <KPICard
          title="Por Cobrar"
          value={formatCurrency(kpis.porCobrar)}
          description={kpis.porCobrarDesglose}
          icon={<AlertCircle className="w-5 h-5" />}
          variant={kpis.porCobrar > 0 ? "warning" : "success"}
        />
      </div>

      {/* ZONA 2: Operación y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VehiclePipeline servicios={servicios} />
        </div>
        <div className="flex flex-col gap-4">
          <PendingPaymentsAlert servicios={servicios} maxItems={3} />
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Acciones Rápidas</p>
            <Link href="/servicios">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Servicio
              </Button>
            </Link>
            <Link href="/servicios">
              <Button variant="outline" className="w-full bg-transparent justify-start">
                Ver Todos los Servicios
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ZONA 3: Tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <AverageTicketChart />
        </div>
      </div>

      {/* KPIs secundarios (solo no-operador) */}
      {!isOperador && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            title="Tasa de Cierre"
            value={`${kpis.tasaCierre.toFixed(1)}%`}
            description={`${kpis.serviciosCerrados} de ${kpis.serviciosTotal} cerrados`}
            icon={<Activity className="w-5 h-5" />}
            variant={kpis.tasaCierre >= 50 ? "success" : "warning"}
          />
          <KPICard
            title="Tiempo Promedio en Taller"
            value={`${kpis.tiempoPromedio.toFixed(0)} días`}
            description="Servicios activos del mes"
            icon={<Clock className="w-5 h-5" />}
            variant="default"
          />
          <KPICard
            title="Servicios del Mes"
            value={kpis.serviciosTotal.toString()}
            description={`${kpis.serviciosCerrados} cerrados · ${kpis.serviciosActivos} activos`}
            icon={<Wrench className="w-5 h-5" />}
            variant="default"
          />
        </div>
      )}
    </div>
  )
}
