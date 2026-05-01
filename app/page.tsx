"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { KPICard } from "@/components/kpi-card"
import { RevenueChart } from "@/components/revenue-chart"
import { PendingPaymentsAlert } from "@/components/pending-payments-alert"
import { PendingExpensesAlert } from "@/components/pending-expenses-alert"
import { VehiclePipeline } from "@/components/vehicle-pipeline"
import { AverageTicketChart } from "@/components/average-ticket-chart"
import { MonthSelector } from "@/components/month-selector"
import {
  Car, ArrowUpDown, TrendingUp, TrendingDown, CheckCircle2,
  Activity, Clock, Wrench, Plus, RefreshCw, ChevronDown, ChevronUp,
  Paintbrush, Receipt, FileWarning,
} from "lucide-react"
import { useMonth } from "@/lib/month-context"
import { fetchDashboardData } from "@/lib/api-client"
import type { Servicio, Gasto, Empleado, AbonoEmpleado } from "@/lib/database"
import { useAuth } from "@/lib/auth-context"
import { useEstados } from "@/lib/estados"
import { extraerIvaIncluido } from "@/lib/utils"

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
  ivaDebitoMes: number
  ivaCreditoMes: number
  ivaNetoMes: number
  ventasConIvaTotal: number
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

function parseDesglose(
  s: string,
  total: number,
): { label: string; value: string; highlight?: boolean }[] | null {
  if (!s) return null
  const labelMap: Record<string, string> = {
    cola: "En cola",
    reparación: "Reparación",
    reparacion: "Reparación",
    repuestos: "Repuestos",
    "esperando repuestos": "Repuestos",
  }
  const parts = s
    .split("·")
    .map((p) => p.trim())
    .map((p) => {
      const m = p.match(/^(\d+)\s+(?:en\s+)?(.+)$/i)
      if (!m) return null
      const rawLabel = m[2].toLowerCase().trim()
      const label = labelMap[rawLabel] ?? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
      return { label, value: m[1] }
    })
    .filter((x): x is { label: string; value: string } => x !== null)
    .filter((x) => Number(x.value) > 0)
  if (parts.length === 0) return null
  return [...parts, { label: "Total", value: String(total), highlight: true }]
}

export default function DashboardPage() {
  const { role } = useAuth()
  const { esCerrado, esPorCobrar, esFinalizado } = useEstados()
  const isOperador = role === "operador"
  const isSupervisor = role === "supervisor"
  const isVistaSimple = isOperador || isSupervisor
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
    ivaDebitoMes: 0,
    ivaCreditoMes: 0,
    ivaNetoMes: 0,
    ventasConIvaTotal: 0,
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
  const [facturasPendientes, setFacturasPendientes] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [showBreakeven, setShowBreakeven] = useState(false)
  const [showFacturasPendientes, setShowFacturasPendientes] = useState(false)
  const { selectedMonth } = useMonth()
  // Guards contra refetches concurrentes y tormenta de focus events
  const inFlightRef = useRef(false)
  const lastLoadAtRef = useRef(0)

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  // Refetch cuando la pestaña vuelve a foco (ej. usuario editó un servicio y volvió).
  // Throttle de 30s y skip si ya hay una carga en curso para evitar saturar la DB.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") return
      if (inFlightRef.current) return
      if (Date.now() - lastLoadAtRef.current < 30_000) return
      loadData()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [selectedMonth])

  const loadData = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const response = await fetchDashboardData(year, month)
      const { servicios: serviciosData, gastos: gastosData, empleados: empleadosData, serviciosActivos: activosData, abonosMes, kpis: apiKpis, entregadosMes, serviciosFacturadosMes, facturasPendientes: pendientesData } = response
      setServicios(serviciosData)
      setServiciosActivos(activosData)
      setGastos(gastosData)
      setFacturasPendientes(pendientesData || [])
      calculateKPIs(serviciosData, gastosData, empleadosData, activosData, abonosMes, apiKpis, entregadosMes, serviciosFacturadosMes)
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
      inFlightRef.current = false
      lastLoadAtRef.current = Date.now()
    }
  }

  const calculateKPIs = (servicios: Servicio[], gastos: Gasto[], empleados: Empleado[], serviciosActivos: Servicio[], abonosMes: AbonoEmpleado[] = [], apiKpis?: any, entregadosMes?: number, serviciosFacturadosMes?: Servicio[]) => {
    const parseArr = (v: any): any[] => {
      if (Array.isArray(v)) return v
      if (typeof v === "string" && v) {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
      }
      return []
    }

    const serviciosCerrados = servicios.filter((s) => esCerrado(s.estado))
    // Facturado = todos los servicios con monto asignado (igual que el gráfico)
    const serviciosFacturados = servicios.filter((s) => Number(s.monto_total_sin_iva || 0) > 0)

    // Ingresos
    const ingresosCobrado = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)
    const ingresosFacturado = serviciosFacturados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)

    // Pendiente: derivado de monto sin IVA - anticipo sin IVA para evitar el bug
    // del campo saldo_pendiente, que se guarda con IVA y no es comparable con
    // monto_total_sin_iva. Solo no-cerrados (cerrados tienen saldo=0 por definicion).
    const pendienteMes = serviciosFacturados
      .filter((s) => !esCerrado(s.estado))
      .reduce((sum, s) => {
        const factor = s.iva === "con" ? 1.19 : 1
        const anticipoSinIva = Number(s.anticipo || 0) / factor
        const monto = Number(s.monto_total_sin_iva || 0)
        return sum + Math.max(0, monto - anticipoSinIva)
      }, 0)

    // ---- IVA del mes ----
    // Criterio SII: debito por fecha_facturacion (emision real), no por fecha_ingreso.
    // Un servicio ingresado en abril pero facturado en mayo suma al debito de mayo.
    const serviciosConIva = serviciosFacturadosMes ?? []
    // Total ventas con IVA incluido (lo que se declara al SII este mes)
    const ventasConIvaTotal = serviciosConIva.reduce((sum, s) => sum + Number(s.monto_total || 0), 0)
    // Debito: IVA emitido en servicios con fecha_facturacion en el mes
    const ivaDebitoMes = serviciosConIva
      .reduce((sum, s) => sum + (Number(s.monto_total || 0) - Number(s.monto_total_sin_iva || 0)), 0)

    // Credito: IVA contenido en gastos y costos[] con tipo_documento='factura'
    const ivaCreditoGastos = gastos
      .filter((g) => g.tipo_documento === "factura")
      .reduce((sum, g) => sum + extraerIvaIncluido(Number(g.monto || 0)), 0)

    const ivaCreditoCostos = servicios.reduce((sum, s) => {
      return sum + parseArr(s.costos)
        .filter((c: any) => c.tipo_documento === "factura")
        .reduce((c: number, costo: any) => c + extraerIvaIncluido(Number(costo.monto || 0)), 0)
    }, 0)

    const ivaCreditoMes = ivaCreditoGastos + ivaCreditoCostos
    const ivaNetoMes = ivaDebitoMes - ivaCreditoMes

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

    // Sueldos pagados: abonos reales del mes (para cash flow / Flujo de Caja)
    const sueldosPagados = abonosMes.reduce((sum, a) => sum + Number(a.monto || 0), 0)
    // Sueldos devengados: sueldo_base de empleados activos (para margen contable)
    const sueldosDevengados = empleados
      .filter((e) => e.activo)
      .reduce((sum, e) => sum + Number(e.sueldo_base || 0), 0)

    // Gastos operacionales (excluye sueldos)
    const gastosOperacionales = gastos
      .filter((g) => g.categoria !== "Sueldos")
      .reduce((sum, g) => sum + Number(g.monto || 0), 0)

    // ---- KPI 1: Vehículos en taller (usa TODOS los activos, no solo los del mes) ----
    // El conteo y el desglose usan el array completo de serviciosActivos (todo lo que no
    // sea cerrado ni por_cobrar), así no se pierden vehículos con estados configurados
    // por el usuario que aún no están marcados como tipo="activo".
    const vehiculosEnTaller = serviciosActivos
    const vehiculosEnTallerCount = serviciosActivos.length
    const desgloseMap = new Map<string, number>()
    for (const s of serviciosActivos) {
      const estado = s.estado || "Sin estado"
      desgloseMap.set(estado, (desgloseMap.get(estado) || 0) + 1)
    }
    const desgloseParts = [...desgloseMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([estado, n]) => `${n} ${estado.toLowerCase()}`)
    const vehiculosDesglose = desgloseParts.length > 0 ? desgloseParts.join(" · ") : "Sin vehículos activos"
    // Entregados del mes: backend usa por_cobrar+cerrado por updated_at
    const entregadosEsteMes = entregadosMes ?? servicios.filter((s) => esPorCobrar(s.estado)).length

    // ---- KPI 2: Flujo de caja ----
    // Anticipos solo de servicios NO cerrados (los cerrados ya están en ingresosCobrado)
    const anticiposNoCerrados = servicios
      .filter((s) => !esCerrado(s.estado))
      .reduce((s, sv) => s + Number(sv.anticipo || 0), 0)
    const flujoEntradas = ingresosCobrado + anticiposNoCerrados
    const flujoSalidas = gastosOperacionales + costosCerrados + sueldosPagados
    const flujoCaja = flujoEntradas - flujoSalidas
    // Pagado: dinero efectivamente recibido en el mes. Igual a flujoEntradas
    // para que el dato coincida en card Facturado y card Flujo de Caja.
    const pagadoMes = flujoEntradas

    // ---- KPI 3: Margen de ganancia (criterio devengado: sueldos completos del mes) ----
    const gastosTotalMes = costosFacturados + gastosOperacionales + sueldosDevengados
    const margenGanancia = ingresosFacturado > 0
      ? ((ingresosFacturado - gastosTotalMes) / ingresosFacturado) * 100
      : 0

    // ---- KPI 4: Por cobrar con edad ----
    const hoy = new Date()
    let edadVieja = 0, edadMedia = 0, edadReciente = 0
    const porCobrar = servicios
      .filter((s) => Number(s.saldo_pendiente || 0) > 0 && esPorCobrar(s.estado))
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
    const serviciosCompletadosCount = servicios.filter((s) => esFinalizado(s.estado)).length
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
      ivaDebitoMes,
      ivaCreditoMes,
      ivaNetoMes,
      ventasConIvaTotal,
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
    kpis.margenGanancia >= 20 ? "success" : kpis.margenGanancia >= 0 ? "warning" : "destructive"

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
          {!isVistaSimple && (
            <Link href="/servicios">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Servicio
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ZONA 1: KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {(() => {
          const vehStats = parseDesglose(kpis.vehiculosDesglose, kpis.vehiculosEnTaller)
          return (
            <KPICard
              title="Vehículos en Taller"
              value={kpis.vehiculosEnTaller.toString()}
              description={vehStats ? undefined : kpis.vehiculosDesglose}
              stats={vehStats ?? undefined}
              icon={<Car className="w-5 h-5" />}
              variant="default"
            />
          )
        })()}
        {(() => {
          const isPositive = kpis.margenGanancia >= 0
          const margenNeto = kpis.ingresosFacturado - kpis.gastosTotalMes
          return (
            <KPICard
              title="Facturado del Mes"
              tooltip="Margen contable (criterio devengado): incluye TODOS los costos del mes — servicios facturados (cerrados + en proceso), gastos operacionales y sueldos completos por empleados activos, hayan sido pagados o no."
              value={formatCurrency(kpis.ingresosFacturado)}
              icon={isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              variant={margenVariant}
              badge={isVistaSimple ? undefined : { text: `${kpis.margenGanancia.toFixed(1)}%`, trend: isPositive ? "up" : "down" }}
              stats={isVistaSimple ? undefined : [
                { label: "Pagado", value: formatCurrency(kpis.pagadoMes) },
                { label: "Pendiente", value: formatCurrency(kpis.pendienteMes) },
                { label: "Costos totales", value: formatCurrency(kpis.gastosTotalMes) },
                { label: "Margen", value: formatCurrency(margenNeto), highlight: true },
              ]}
            />
          )
        })()}
        {!isVistaSimple && (
          <KPICard
            title="Flujo de Caja"
            tooltip="Cash flow real del mes: solo cuenta dinero efectivamente movido — costos de servicios cerrados, gastos operacionales pagados y sueldos abonados (no proyectados)."
            value={`${kpis.flujoCaja < 0 ? "-" : ""}${formatCurrency(kpis.flujoCaja)}`}
            icon={<ArrowUpDown className="w-5 h-5" />}
            variant={kpis.flujoCaja >= 0 ? "success" : "destructive"}
            stats={[
              { label: "Entradas", value: formatCurrency(kpis.flujoEntradas) },
              { label: "Salidas (cerrados)", value: formatCurrency(kpis.flujoSalidas) },
            ]}
          />
        )}
        <KPICard
          title="Entregados este Mes"
          value={kpis.entregadosEsteMes.toString()}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant={kpis.entregadosEsteMes > 0 ? "success" : "default"}
          stats={[
            { label: "Cerrados", value: kpis.serviciosCerrados.toString() },
            { label: "Activos", value: kpis.serviciosActivos.toString() },
            { label: "Tasa cierre", value: `${kpis.tasaCierre.toFixed(0)}%` },
            { label: "Tiempo prom.", value: `${Math.round(kpis.tiempoPromedio)} d` },
          ]}
        />
        {(() => {
          const ivaVariant: "success" | "default" | "warning" =
            kpis.ivaNetoMes <= 0 ? "success"
            : kpis.ivaNetoMes < kpis.ivaDebitoMes * 0.5 ? "default"
            : "warning"
          return (
            <KPICard
              title="IVA del Mes"
              value={`${kpis.ivaNetoMes < 0 ? "-" : ""}${formatCurrency(kpis.ivaNetoMes)}`}
              icon={<Receipt className="w-5 h-5" />}
              variant={ivaVariant}
              stats={[
                { label: "Débito", value: formatCurrency(kpis.ivaDebitoMes) },
                { label: "Crédito", value: formatCurrency(kpis.ivaCreditoMes) },
                { label: "Neto", value: formatCurrency(kpis.ivaNetoMes), highlight: true },
                { label: "Ventas c/IVA", value: formatCurrency(kpis.ventasConIvaTotal) },
              ]}
            />
          )
        })()}
      </div>

      {/* Facturas pendientes de emitir (IVA): cerradas/entregadas/por cobrar con iva='con' sin fecha_facturacion */}
      {facturasPendientes.length > 0 && (() => {
        const totalBruto = facturasPendientes.reduce((s, f) => s + Number(f.monto_total || 0), 0)
        const totalIva = facturasPendientes.reduce((s, f) => s + (Number(f.monto_total || 0) - Number(f.monto_total_sin_iva || 0)), 0)
        return (
          <div className="rounded-xl border border-warning/40 bg-warning/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFacturasPendientes((v) => !v)}
              className="w-full flex items-center justify-between gap-3 p-4 hover:bg-warning/10 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-warning/15 text-warning shrink-0">
                  <FileWarning className="w-5 h-5" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold text-warning">
                    {facturasPendientes.length} factura{facturasPendientes.length !== 1 ? "s" : ""} pendiente{facturasPendientes.length !== 1 ? "s" : ""} de emitir
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total bruto {formatCurrency(totalBruto)} · IVA débito no declarado {formatCurrency(totalIva)}
                  </p>
                </div>
              </div>
              {showFacturasPendientes ? <ChevronUp className="w-4 h-4 text-warning shrink-0" /> : <ChevronDown className="w-4 h-4 text-warning shrink-0" />}
            </button>
            {showFacturasPendientes && (
              <div className="border-t border-warning/20 divide-y divide-warning/10">
                {facturasPendientes.map((f) => {
                  const ot = f.numero_ot != null ? `OT-${String(f.numero_ot).padStart(4, "0")}` : "(s/OT)"
                  const iva = Number(f.monto_total || 0) - Number(f.monto_total_sin_iva || 0)
                  return (
                    <Link
                      key={f.id}
                      href="/servicios"
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-warning/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xs font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">{ot}</span>
                        <span className="font-semibold text-sm shrink-0">{f.patente}</span>
                        <span className="text-sm text-muted-foreground truncate">{f.cliente}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-warning/40 text-warning">{f.estado}</Badge>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(Number(f.monto_total || 0))}</p>
                        <p className="text-[10px] text-muted-foreground">IVA {formatCurrency(iva)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

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
      {!isVistaSimple && kpis.piezasPintadas > 0 && (
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

      {/* ZONA 2 + 3: Operación, Alertas y Tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <VehiclePipeline servicios={serviciosActivos} />
          <RevenueChart />
          {!isVistaSimple && (
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
        <div className="flex flex-col gap-4">
          <PendingPaymentsAlert servicios={servicios} maxItems={3} />
          <PendingExpensesAlert gastos={gastos} maxItems={3} />
          <AverageTicketChart />
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

    </div>
  )
}
