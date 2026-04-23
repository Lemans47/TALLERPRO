"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { KPICard } from "@/components/kpi-card"
import { RevenueChart } from "@/components/revenue-chart"
import { PendingPaymentsAlert } from "@/components/pending-payments-alert"
import { PendingExpensesAlert } from "@/components/pending-expenses-alert"
import { VehiclePipeline } from "@/components/vehicle-pipeline"
import { AverageTicketChart } from "@/components/average-ticket-chart"
import { MonthSelector } from "@/components/month-selector"
import {
  Car, ArrowUpDown, TrendingUp, CheckCircle2,
  Activity, Clock, Wrench, Plus, RefreshCw, ChevronDown, ChevronUp,
  Paintbrush,
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
  pagadoMes: number
  pendienteMes: number
  porCobrar: number
  porCobrarDesglose: string
  entregadosEsteMes: number
  serviciosActivos: number
  serviciosTotal: number
  serviciosCerrados: number
  tasaCierre: number
  tiempoPromedio: number
  puntoEquilibrio: number
  serviciosConMonto: number
  gastosOperativos: number
  margenContribucion: number
  gastosTotalMes: number
  // Pintura
  piezasPintadas: number
  ingresosPintura: number
  gastosPintura: number
  gastosPinturaMateriales: number
  manoObraPintura: number
  costoPorPieza: number
  margenPintura: number
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
    pagadoMes: 0,
    pendienteMes: 0,
    porCobrar: 0,
    porCobrarDesglose: "",
    entregadosEsteMes: 0,
    serviciosActivos: 0,
    serviciosTotal: 0,
    serviciosCerrados: 0,
    tasaCierre: 0,
    tiempoPromedio: 0,
    puntoEquilibrio: 0,
    serviciosConMonto: 0,
    gastosOperativos: 0,
    margenContribucion: 0,
    gastosTotalMes: 0,
    piezasPintadas: 0,
    ingresosPintura: 0,
    gastosPintura: 0,
    gastosPinturaMateriales: 0,
    manoObraPintura: 0,
    costoPorPieza: 0,
    margenPintura: 0,
  })
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [serviciosActivos, setServiciosActivos] = useState<Servicio[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [showBreakeven, setShowBreakeven] = useState(false)
  const { selectedMonth } = useMonth()

  // Migraciones únicas (una sola vez por navegador, gated con localStorage).
  // Los servicios nuevos ya reciben numero_ot al crearse (createServicio → ensureNumeroOtInfra),
  // así que migrate-numero-ot es solo backfill histórico — no hace falta en cada carga.
  useEffect(() => {
    if (!localStorage.getItem("mano_obra_migrated")) {
      const tarifa = Number(localStorage.getItem("mano_obra_pintura_default") || 0)
      if (tarifa > 0) {
        fetch("/api/migrate-mano-obra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarifa }),
        })
          .then((r) => r.json())
          .then((data) => {
            console.log("Migración mano de obra:", data)
            localStorage.setItem("mano_obra_migrated", "true")
          })
          .catch(console.error)
      }
    }

    if (!localStorage.getItem("numero_ot_migrated")) {
      fetch("/api/migrate-numero-ot", { method: "POST" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.backfilled > 0) console.log("N° OT asignados:", data.backfilled)
          localStorage.setItem("numero_ot_migrated", "true")
        })
        .catch((e) => console.error("migrate-numero-ot:", e))
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const response = await fetchDashboardData(year, month)
      const { servicios: serviciosData, gastos: gastosData, empleados: empleadosData, serviciosActivos: activosData, kpis: apiKpis, entregadosMes } = response
      setServicios(serviciosData)
      setServiciosActivos(activosData)
      setGastos(gastosData)
      calculateKPIs(serviciosData, gastosData, empleadosData, activosData, apiKpis, entregadosMes)
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateKPIs = (servicios: Servicio[], gastos: Gasto[], empleados: Empleado[], serviciosActivos: Servicio[], apiKpis?: any, entregadosMes?: number) => {
    const parseArr = (v: any): any[] => {
      if (Array.isArray(v)) return v
      if (typeof v === "string" && v) {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
      }
      return []
    }

    const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")
    // Facturado = todos los servicios con monto asignado (igual que el gráfico)
    const serviciosFacturados = servicios.filter((s) => Number(s.monto_total_sin_iva || 0) > 0)

    // Ingresos
    const ingresosCobrado = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)
    const ingresosFacturado = serviciosFacturados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)

    // Pendiente: derivado de monto sin IVA - anticipo sin IVA para evitar el bug
    // del campo saldo_pendiente, que se guarda con IVA y no es comparable con
    // monto_total_sin_iva. Solo no-cerrados (cerrados tienen saldo=0 por definicion).
    const pendienteMes = serviciosFacturados
      .filter((s) => s.estado !== "Cerrado/Pagado")
      .reduce((sum, s) => {
        const factor = s.iva === "con" ? 1.19 : 1
        const anticipoSinIva = Number(s.anticipo || 0) / factor
        const monto = Number(s.monto_total_sin_iva || 0)
        return sum + Math.max(0, monto - anticipoSinIva)
      }, 0)

    // Costos (excluye "materiales pintura" para evitar doble conteo con gastos de pintura)
    const costosCerrados = serviciosCerrados.reduce((sum, s) => {
      return sum + parseArr(s.costos)
        .filter((c: any) => !String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
        .reduce((c: number, costo: any) => c + Number(costo.monto || 0), 0)
    }, 0)
    const costosFacturados = serviciosFacturados.reduce((sum, s) => {
      return sum + parseArr(s.costos)
        .filter((c: any) => !String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
        .reduce((c: number, costo: any) => c + Number(costo.monto || 0), 0)
    }, 0)

    // Sueldos comprometidos (empleados activos)
    const sueldosComprometidos = empleados
      .filter((e) => e.activo)
      .reduce((sum, e) => sum + Number(e.sueldo_base || 0), 0)

    // Gastos operacionales (excluye sueldos)
    const gastosOperacionales = gastos
      .filter((g) => g.categoria !== "Sueldos")
      .reduce((sum, g) => sum + Number(g.monto || 0), 0)

    // ---- KPI 1: Vehículos en taller (usa TODOS los activos, no solo los del mes) ----
    const PIPELINE_STAGES = ["En Cola", "En Proceso", "En Reparación", "Esperando Repuestos", "Control de Calidad", "Listo para Entrega"]
    const vehiculosEnTaller = serviciosActivos
    const vehiculosEnTallerCount = PIPELINE_STAGES.reduce(
      (sum, estado) => sum + serviciosActivos.filter((s) => s.estado === estado).length, 0
    )
    const desgloseParts = PIPELINE_STAGES
      .map((e) => ({ e, n: serviciosActivos.filter((s) => s.estado === e).length }))
      .filter((x) => x.n > 0)
      .slice(0, 3)
      .map((x) => `${x.n} ${x.e.toLowerCase()}`)
    const vehiculosDesglose = desgloseParts.length > 0 ? desgloseParts.join(" · ") : "Sin vehículos activos"
    // Entregados: viene del backend (busca por updated_at, no fecha_ingreso)
    const entregadosEsteMes = entregadosMes ?? servicios.filter((s) => s.estado === "Entregado").length

    // ---- KPI 2: Flujo de caja ----
    // Anticipos solo de servicios NO cerrados (los cerrados ya están en ingresosCobrado)
    const anticiposNoCerrados = servicios
      .filter((s) => s.estado !== "Cerrado/Pagado")
      .reduce((s, sv) => s + Number(sv.anticipo || 0), 0)
    const flujoEntradas = ingresosCobrado + anticiposNoCerrados
    const flujoSalidas = gastosOperacionales + costosCerrados + sueldosComprometidos
    const flujoCaja = flujoEntradas - flujoSalidas
    // Pagado: dinero efectivamente recibido en el mes. Igual a flujoEntradas
    // para que el dato coincida en card Facturado y card Flujo de Caja.
    const pagadoMes = flujoEntradas

    // ---- KPI 3: Margen de ganancia (consistente con gráfico: ingresos vs todos los gastos) ----
    const gastosTotalMes = costosFacturados + gastosOperacionales + sueldosComprometidos
    const margenGanancia = ingresosFacturado > 0
      ? ((ingresosFacturado - gastosTotalMes) / ingresosFacturado) * 100
      : 0

    // ---- KPI 4: Por cobrar con edad ----
    const hoy = new Date()
    let edadVieja = 0, edadMedia = 0, edadReciente = 0
    const porCobrar = servicios
      .filter((s) => Number(s.saldo_pendiente || 0) > 0 && ["Entregado", "Por Cobrar"].includes(s.estado))
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

    // ---- KPIs Pintura ----
    const piezasPintadas = servicios.reduce((sum, s) => {
      return sum + parseArr(s.piezas_pintura).reduce((ps: number, p: any) => ps + Number(p.cantidad || p.cantidad_piezas || 1), 0)
    }, 0)
    const ingresosPintura = servicios.reduce((sum, s) => {
      return sum + parseArr(s.piezas_pintura).reduce((ps: number, p: any) => ps + Number(p.precio || 0), 0)
    }, 0)
    const gastosPinturaMateriales = gastos
      .filter((g) => g.categoria === "Gastos de Pintura")
      .reduce((sum, g) => sum + Number(g.monto || 0), 0)
    // Mano de obra pintura: prioriza costo real del item auto en costos (puede estar editado
    // manualmente por servicio), fallback a tarifa × piezas si el servicio no tiene el item.
    const tarifaFallback = Number(localStorage.getItem("mano_obra_pintura_default") || 0)
    const manoObraPintura = servicios.reduce((sum, s) => {
      const manoObraItem = parseArr(s.costos).find(
        (c: any) => c.isAuto && String(c.descripcion || "").toLowerCase().includes("mano de obra pintura")
      )
      if (manoObraItem) {
        return sum + Number(manoObraItem.monto || 0)
      }
      const piezas = parseArr(s.piezas_pintura)
      const cantPiezas = piezas.reduce((ps: number, p: any) => ps + Number(p.cantidad || p.cantidad_piezas || 1), 0)
      const tarifa = Number(s.mano_obra_pintura || 0) || tarifaFallback
      return sum + (cantPiezas * tarifa)
    }, 0)
    const gastosPintura = gastosPinturaMateriales + manoObraPintura
    const costoPorPieza = piezasPintadas > 0 ? gastosPintura / piezasPintadas : 0
    const margenPintura = ingresosPintura > 0 ? ((ingresosPintura - gastosPintura) / ingresosPintura) * 100 : 0

    // ---- KPIs secundarios ----
    const activosParaPromedio = serviciosActivos
    const tiempoPromedio = activosParaPromedio.length > 0
      ? activosParaPromedio.reduce(
          (sum, s) => sum + Math.floor((hoy.getTime() - new Date(s.fecha_ingreso).getTime()) / 86400000),
          0,
        ) / activosParaPromedio.length
      : 0

    const serviciosTotal = servicios.length
    const serviciosCompletadosCount = servicios.filter((s) =>
      ["Cerrado/Pagado", "Entregado", "Por Cobrar"].includes(s.estado)
    ).length
    const tasaCierre = serviciosTotal > 0 ? (serviciosCompletadosCount / serviciosTotal) * 100 : 0

    // ---- Punto de equilibrio (desde API para consistencia) ----
    const puntoEquilibrio = apiKpis?.puntoEquilibrio ?? 0
    const countConMonto = apiKpis?.serviciosCount ?? serviciosFacturados.length
    const gastosOperativosApi = apiKpis?.gastosOperativos ?? 0
    const margenContribucionApi = apiKpis?.margenContribucion ?? 0

    setKpis({
      vehiculosEnTaller: vehiculosEnTallerCount,
      vehiculosDesglose,
      flujoCaja,
      flujoEntradas,
      flujoSalidas,
      margenGanancia,
      ingresosCobrado,
      ingresosFacturado,
      pagadoMes,
      pendienteMes,
      porCobrar,
      porCobrarDesglose,
      entregadosEsteMes,
      serviciosActivos: vehiculosEnTaller.length,
      serviciosTotal,
      serviciosCerrados: serviciosCompletadosCount,
      tasaCierre,
      tiempoPromedio,
      puntoEquilibrio,
      serviciosConMonto: countConMonto,
      gastosOperativos: gastosOperativosApi,
      margenContribucion: margenContribucionApi,
      gastosTotalMes,
      piezasPintadas,
      ingresosPintura,
      gastosPintura,
      gastosPinturaMateriales,
      manoObraPintura,
      costoPorPieza,
      margenPintura,
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
          <Link href="/servicios">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Servicio
            </Button>
          </Link>
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
        {/* KPI Facturado del Mes con margen en esquina */}
        <div className={`rounded-xl border p-5 transition-all hover:shadow-lg hover:shadow-black/5 ${
          margenVariant === "success" ? "border-success/30 bg-success/5" :
          margenVariant === "warning" ? "border-warning/30 bg-warning/5" :
          "border-destructive/30 bg-destructive/5"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-muted-foreground">Facturado del Mes</p>
            <div className={`p-2.5 rounded-xl shrink-0 ${
              margenVariant === "success" ? "text-success bg-success/10" :
              margenVariant === "warning" ? "text-warning bg-warning/10" :
              "text-destructive bg-destructive/10"
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-2">
            <p className={`text-2xl font-bold tracking-tight ${
              margenVariant === "success" ? "text-success" :
              margenVariant === "warning" ? "text-warning" :
              "text-destructive"
            }`}>
              {formatCurrency(kpis.ingresosFacturado)}
            </p>
            <div className="text-right">
              <p className={`text-xl font-bold leading-none ${
                margenVariant === "success" ? "text-success" :
                margenVariant === "warning" ? "text-warning" :
                "text-destructive"
              }`}>
                {kpis.margenGanancia.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">margen</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Pagado {formatCurrency(kpis.pagadoMes)} · Pendiente {formatCurrency(kpis.pendienteMes)}
          </p>
          <p className="text-xs text-muted-foreground">
            Gastos {formatCurrency(kpis.gastosTotalMes)} · Margen {formatCurrency(kpis.ingresosFacturado - kpis.gastosTotalMes)}
          </p>
        </div>
        <KPICard
          title="Flujo de Caja"
          value={`${kpis.flujoCaja < 0 ? "-" : ""}${formatCurrency(kpis.flujoCaja)}`}
          description={`Entradas ${formatCurrency(kpis.flujoEntradas)} · Salidas ${formatCurrency(kpis.flujoSalidas)}`}
          icon={<ArrowUpDown className="w-5 h-5" />}
          variant={kpis.flujoCaja >= 0 ? "success" : "destructive"}
        />
        <KPICard
          title="Entregados este Mes"
          value={kpis.entregadosEsteMes.toString()}
          description={kpis.entregadosEsteMes > 0 ? `${kpis.entregadosEsteMes} vehículo${kpis.entregadosEsteMes !== 1 ? "s" : ""} entregado${kpis.entregadosEsteMes !== 1 ? "s" : ""}` : "Sin entregas este mes"}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant={kpis.entregadosEsteMes > 0 ? "success" : "default"}
        />
      </div>

      {/* Punto de Equilibrio */}
      {!isOperador && (() => {
        const faltan = kpis.puntoEquilibrio > 0 ? Math.max(0, kpis.puntoEquilibrio - kpis.serviciosConMonto) : 0
        const pct = kpis.puntoEquilibrio > 0 ? Math.min(100, Math.round((kpis.serviciosConMonto / kpis.puntoEquilibrio) * 100)) : 0
        const margenPorServicio = kpis.serviciosConMonto > 0 ? Math.round(kpis.margenContribucion / kpis.serviciosConMonto) : 0
        const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`
        return (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Punto de Equilibrio</p>
                <p className="text-2xl font-bold mt-1">
                  {kpis.puntoEquilibrio > 0 ? `${kpis.puntoEquilibrio} servicios` : "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {kpis.puntoEquilibrio === 0
                    ? "Sin datos suficientes para calcular"
                    : faltan > 0
                      ? `Faltan ${faltan} servicio${faltan !== 1 ? "s" : ""} para cubrir los gastos fijos`
                      : "Los gastos fijos están cubiertos este mes"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Actualmente</p>
                <p className="text-3xl font-bold">{kpis.serviciosConMonto}</p>
                <p className={`text-xs font-medium mt-0.5 ${faltan === 0 ? "text-green-500" : "text-amber-500"}`}>
                  {faltan === 0 ? "En zona rentable" : `${pct}% del objetivo`}
                </p>
              </div>
            </div>
            <div className="mt-3 w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${faltan === 0 ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {kpis.puntoEquilibrio > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <button
                  onClick={() => setShowBreakeven(!showBreakeven)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showBreakeven ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Cómo se calcula
                </button>
                {showBreakeven && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>Gastos fijos: <span className="text-foreground font-medium">{fmt(kpis.gastosOperativos)}</span></span>
                    <span>÷</span>
                    <span>Margen prom. por servicio: <span className="text-foreground font-medium">{fmt(margenPorServicio)}</span></span>
                    <span>= <span className="text-foreground font-medium">{kpis.puntoEquilibrio} servicios</span></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* KPIs Pintura */}
      {!isOperador && kpis.piezasPintadas > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Paintbrush className="w-4 h-4 text-purple-500" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">Pintura del Mes</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Piezas Pintadas</p>
              <p className="text-2xl font-bold mt-1">{kpis.piezasPintadas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingresos Pintura</p>
              <p className="text-2xl font-bold mt-1 text-green-500">{formatCurrency(kpis.ingresosPintura)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costos Pintura</p>
              <p className="text-2xl font-bold mt-1 text-red-400">{formatCurrency(kpis.gastosPintura)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mat. {formatCurrency(kpis.gastosPinturaMateriales)} · M.O. {formatCurrency(kpis.manoObraPintura)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costo por Pieza</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(kpis.costoPorPieza)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mat. {formatCurrency(kpis.piezasPintadas > 0 ? kpis.gastosPinturaMateriales / kpis.piezasPintadas : 0)} · M.O. {formatCurrency(kpis.piezasPintadas > 0 ? kpis.manoObraPintura / kpis.piezasPintadas : 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margen Pintura</p>
              <p className={`text-2xl font-bold mt-1 ${kpis.margenPintura >= 40 ? "text-green-500" : kpis.margenPintura >= 20 ? "text-amber-500" : "text-red-400"}`}>
                {kpis.margenPintura.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">ganancia {formatCurrency(kpis.ingresosPintura - kpis.gastosPintura)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ZONA 2: Operación y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <VehiclePipeline servicios={serviciosActivos} />
        </div>
        <div className="flex flex-col gap-4">
          <PendingPaymentsAlert servicios={serviciosActivos} maxItems={3} />
          <PendingExpensesAlert gastos={gastos} maxItems={3} />
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Acciones Rápidas</p>
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
